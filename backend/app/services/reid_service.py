import base64
import datetime
import logging
import threading
import time
import uuid
from typing import Dict, Any, List, Optional, Tuple, Set

import cv2
import numpy as np

from app.database import SessionLocal
from app.models.models import GlobalTrack, TrackHandoff

logger = logging.getLogger("tejas.reid_service")


def encode_crop_to_base64(img_bgr: np.ndarray, quality: int = 85) -> str:
    """Encodes an OpenCV image crop to a base64 data URI."""
    if img_bgr is None or img_bgr.size == 0:
        return ""
    success, buffer = cv2.imencode('.jpg', img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not success:
        return ""
    b64_str = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{b64_str}"


def compute_dominant_colors(crop_bgr: np.ndarray) -> Dict[str, str]:
    """Extracts human-readable dominant hex colors for upper and lower clothing."""
    try:
        h, w = crop_bgr.shape[:2]
        upper_strip = crop_bgr[int(h * 0.1):int(h * 0.5), :]
        lower_strip = crop_bgr[int(h * 0.5):int(h * 0.9), :]

        def get_hex(strip):
            if strip.size == 0:
                return "#888888"
            mean_bgr = np.mean(strip, axis=(0, 1)).astype(int)
            b, g, r = mean_bgr[0], mean_bgr[1], mean_bgr[2]
            return f"#{r:02X}{g:02X}{b:02X}"

        return {
            "upper_clothing": get_hex(upper_strip),
            "lower_clothing": get_hex(lower_strip)
        }
    except Exception:
        return {"upper_clothing": "#4A5568", "lower_clothing": "#2D3748"}


class ReIDService:
    """
    Production Cross-Camera Re-Identification (Re-ID) & Association Service.
    Tracks entities across separate camera fields of view:
      1. Extracts normalized spatial-appearance feature vectors.
      2. Enforces temporal and spatial connectivity constraints.
      3. Uses cosine distance with configurable thresholding to associate tracks.
      4. Assigns and maintains unified Global Track IDs (e.g. GLOBAL-027).
      5. Connects transitions to the Event & Threat engines.
    """

    def __init__(self):
        self.lock = threading.Lock()
        # Configuration
        self.similarity_threshold = 0.72       # Threshold for cross-camera identity match
        self.min_transit_seconds = 0.4         # Minimum physical time between camera handoffs
        self.max_transit_seconds = 180.0       # Maximum time an entity can stay in transit
        self.global_track_counter = 20         # Starting index for human-readable IDs

        # In-memory candidate active tracks for low-latency matching
        # Key: global_track_id -> track dictionary
        self.active_tracks: Dict[str, Dict[str, Any]] = {}
        # Local camera track map: (camera_id, local_track_id) -> global_track_id
        self.local_to_global: Dict[Tuple[str, int], str] = {}

        self._seed_initial_state()

    def _seed_initial_state(self):
        """Pre-seeds or loads existing global tracks from database on startup."""
        try:
            db = SessionLocal()
            existing = db.query(GlobalTrack).order_by(GlobalTrack.created_at.desc()).all()
            for gt in existing:
                try:
                    num_part = int(gt.id.split("-")[-1])
                    if num_part > self.global_track_counter:
                        self.global_track_counter = num_part
                except Exception:
                    pass

                if len(self.active_tracks) < 15:
                    self.active_tracks[gt.id] = {
                        "id": gt.id,
                        "entity_type": gt.entity_type,
                        "status": gt.status,
                        "current_camera": gt.current_camera,
                        "previous_camera": gt.previous_camera,
                        "first_seen_time": gt.first_seen_time,
                        "last_seen_time": gt.last_seen_time,
                        "last_seen_epoch": time.time() - 10.0,
                        "threat_score": gt.threat_score,
                        "severity": gt.severity,
                        "total_handoffs": gt.total_handoffs,
                        "embedding": np.array(gt.embedding_summary.get("vector", []), dtype=np.float32) if gt.embedding_summary else None,
                        "dominant_colors": gt.embedding_summary.get("dominant_colors", {}) if gt.embedding_summary else {},
                        "snapshot_b64": gt.latest_snapshot_base64,
                        "movement_path": gt.movement_path or []
                    }
            db.close()
            logger.info(f"Loaded {len(self.active_tracks)} existing global tracks into Re-ID memory (counter={self.global_track_counter}).")
        except Exception as e:
            logger.warning(f"Failed to hydrate global tracks: {e}")

    # -------------------------------------------------------------------------
    # 1. FEATURE EXTRACTION & APPEARANCE EMBEDDINGS
    # -------------------------------------------------------------------------
    def extract_reid_embedding(self, crop_bgr: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Extracts an L2-normalized 256-dimensional spatial-appearance feature vector
        combining multi-strip Hue-Saturation-Value and LAB color distributions
        with edge texture descriptors.
        """
        if crop_bgr is None or crop_bgr.size == 0:
            return None

        h, w = crop_bgr.shape[:2]
        if h < 20 or w < 10:
            return None

        # Standardize size for consistent spatial binning (128x64 standard Re-ID aspect ratio)
        resized = cv2.resize(crop_bgr, (64, 128), interpolation=cv2.INTER_LINEAR)

        # Multi-strip physiological partitioning:
        # Strip 1: Head / Shoulders (0% to 33% height)
        # Strip 2: Torso / Waist (33% to 66% height)
        # Strip 3: Lower Body / Legs (66% to 100% height)
        strips = [resized[0:42, :], resized[42:85, :], resized[85:, :]]

        features = []
        for s in strips:
            hsv = cv2.cvtColor(s, cv2.COLOR_BGR2HSV)
            lab = cv2.cvtColor(s, cv2.COLOR_BGR2LAB)

            # 2D HS color histogram (12 H bins, 8 S bins = 96 features)
            h_hist = cv2.calcHist([hsv], [0, 1], None, [12, 8], [0, 180, 0, 256]).flatten()
            h_hist = h_hist / (np.linalg.norm(h_hist) + 1e-6)

            # LAB A/B chrominance histogram (8x8 = 64 features)
            ab_hist = cv2.calcHist([lab], [1, 2], None, [8, 8], [0, 256, 0, 256]).flatten()
            ab_hist = ab_hist / (np.linalg.norm(ab_hist) + 1e-6)

            # LAB L-luminance histogram (16 features)
            l_hist = cv2.calcHist([lab], [0], None, [16], [0, 256]).flatten()
            l_hist = l_hist / (np.linalg.norm(l_hist) + 1e-6)

            # Texture edge orientation distribution (8 features)
            gray = cv2.cvtColor(s, cv2.COLOR_BGR2GRAY)
            gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
            gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
            _, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)
            t_hist = cv2.calcHist([ang], [0], None, [8], [0, 360]).flatten()
            t_hist = t_hist / (np.linalg.norm(t_hist) + 1e-6)

            # Strip vector with balanced weights (HS: 0.55, AB: 0.30, L: 0.10, Texture: 0.05)
            strip_vec = np.concatenate([h_hist * 0.55, ab_hist * 0.30, l_hist * 0.10, t_hist * 0.05])
            strip_vec = strip_vec / (np.linalg.norm(strip_vec) + 1e-6)
            features.extend(strip_vec)

        raw_vec = np.array(features, dtype=np.float32)
        norm = np.linalg.norm(raw_vec)
        norm_vec = raw_vec / (norm + 1e-6)

        dominant_colors = compute_dominant_colors(crop_bgr)
        snapshot_b64 = encode_crop_to_base64(crop_bgr)

        return {
            "vector": norm_vec.tolist(),
            "vector_np": norm_vec,
            "dimension": len(norm_vec),
            "dominant_colors": dominant_colors,
            "snapshot_b64": snapshot_b64
        }

    # -------------------------------------------------------------------------
    # 2. COSINE SIMILARITY
    # -------------------------------------------------------------------------
    @staticmethod
    def compute_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        Calculates normalized cosine similarity between two unit-norm feature vectors.
        Returns value strictly bounded between 0.0 and 1.0.
        """
        if vec1 is None or vec2 is None:
            return 0.0
        if len(vec1) != len(vec2):
            return 0.0
        dot = float(np.dot(vec1, vec2))
        return max(0.0, min(1.0, dot))

    # -------------------------------------------------------------------------
    # 3. CROSS-CAMERA ASSOCIATION & GLOBAL TRACK LIFECYCLE
    # -------------------------------------------------------------------------
    def match_or_create_global_track(
        self,
        camera_id: str,
        local_track_id: int,
        entity_type: str,
        crop_bgr: np.ndarray,
        box: List[int],
        timestamp_str: Optional[str] = None,
        transit_dt_override: Optional[float] = None
    ) -> Tuple[str, bool, Optional[Dict[str, Any]]]:
        """
        Matches a local camera detection to an existing global track identity or creates a new one.
        Returns:
          (global_track_id, is_cross_camera_handoff, match_metadata)
        """
        now = time.time()
        time_str = timestamp_str or datetime.datetime.now().strftime("%H:%M:%S")

        # Check if this local track on this camera is already assigned
        local_key = (camera_id, local_track_id)
        with self.lock:
            if local_key in self.local_to_global:
                gid = self.local_to_global[local_key]
                if gid in self.active_tracks:
                    self.active_tracks[gid]["last_seen_time"] = time_str
                    self.active_tracks[gid]["last_seen_epoch"] = now
                return gid, False, None

        # Extract appearance embedding
        emb_data = self.extract_reid_embedding(crop_bgr)
        if emb_data is None:
            # Fallback for unextractable small crops
            new_id = self._generate_new_global_id()
            return new_id, False, None

        new_vec = emb_data["vector_np"]
        best_candidate_id = None
        best_similarity = -1.0
        best_transit_dt = 0.0

        with self.lock:
            for gid, track_data in list(self.active_tracks.items()):
                # Only match tracks that were seen on a DIFFERENT camera
                if track_data["current_camera"] == camera_id:
                    continue

                cand_vec = track_data.get("embedding")
                if cand_vec is None or cand_vec.size == 0:
                    continue

                last_epoch = track_data.get("last_seen_epoch", now - 5.0)
                transit_dt = transit_dt_override if transit_dt_override is not None else (now - last_epoch)

                # Check temporal transit window constraints
                if self.min_transit_seconds <= transit_dt <= self.max_transit_seconds:
                    sim = self.compute_similarity(new_vec, cand_vec)
                    if sim > best_similarity:
                        best_similarity = sim
                        best_candidate_id = gid
                        best_transit_dt = transit_dt

        # Check if match meets configurable threshold
        if best_candidate_id and best_similarity >= self.similarity_threshold:
            # === GENUINE CROSS-CAMERA MATCH ===
            matched_gid = best_candidate_id
            with self.lock:
                cand_data = self.active_tracks[matched_gid]
                prev_cam = cand_data["current_camera"]
                cand_data["previous_camera"] = prev_cam
                cand_data["current_camera"] = camera_id
                cand_data["last_seen_time"] = time_str
                cand_data["last_seen_epoch"] = now
                cand_data["total_handoffs"] += 1
                cand_data["status"] = "ACTIVE"
                cand_data["snapshot_b64"] = emb_data["snapshot_b64"]

                # Smooth embedding vector with moving average
                cand_data["embedding"] = 0.7 * cand_data["embedding"] + 0.3 * new_vec
                cand_data["embedding"] = cand_data["embedding"] / np.linalg.norm(cand_data["embedding"])

                # Record breadcrumb movement step
                path_step = {
                    "from_camera": prev_cam,
                    "to_camera": camera_id,
                    "time": time_str,
                    "transit_seconds": round(best_transit_dt, 1),
                    "similarity": round(best_similarity, 3)
                }
                cand_data["movement_path"].append(path_step)
                self.local_to_global[local_key] = matched_gid

            # Persist Handoff & Update Global Track in Database
            handoff_id = f"HOFF-{uuid.uuid4().hex[:6].upper()}"
            try:
                db = SessionLocal()
                db_gt = db.query(GlobalTrack).filter(GlobalTrack.id == matched_gid).first()
                if db_gt:
                    db_gt.previous_camera = prev_cam
                    db_gt.current_camera = camera_id
                    db_gt.last_seen_time = time_str
                    db_gt.total_handoffs += 1
                    db_gt.movement_path = cand_data["movement_path"]
                    db_gt.latest_snapshot_base64 = emb_data["snapshot_b64"]
                    db_gt.status = "ACTIVE"

                db_hoff = TrackHandoff(
                    id=handoff_id,
                    global_track_id=matched_gid,
                    from_camera=prev_cam,
                    to_camera=camera_id,
                    local_track_id=local_track_id,
                    timestamp=time_str,
                    transition_time_seconds=round(best_transit_dt, 1),
                    similarity_score=round(best_similarity, 3),
                    confidence=0.92,
                    snapshot_base64=emb_data["snapshot_b64"],
                    metadata_json={"box": box, "dominant_colors": emb_data["dominant_colors"]}
                )
                db.add(db_hoff)
                db.commit()
                db.close()
            except Exception as db_err:
                logger.error(f"Failed to persist track handoff: {db_err}", exc_info=True)

            match_info = {
                "handoff_id": handoff_id,
                "global_track_id": matched_gid,
                "from_camera": prev_cam,
                "to_camera": camera_id,
                "similarity_score": round(best_similarity, 3),
                "transit_seconds": round(best_transit_dt, 1),
                "dominant_colors": emb_data["dominant_colors"],
                "snapshot_b64": emb_data["snapshot_b64"]
            }

            logger.info(
                f"CROSS-CAMERA RE-ID MATCH: [{matched_gid}] transitioned from {prev_cam} -> {camera_id} "
                f"(Sim: {round(best_similarity*100, 1)}%, Transit: {round(best_transit_dt, 1)}s)"
            )
            return matched_gid, True, match_info

        else:
            # === NEW GLOBAL TRACK IDENTITY ===
            # Do NOT claim identity when similarity is below threshold
            new_gid = self._generate_new_global_id()
            with self.lock:
                self.active_tracks[new_gid] = {
                    "id": new_gid,
                    "entity_type": entity_type,
                    "status": "ACTIVE",
                    "current_camera": camera_id,
                    "previous_camera": None,
                    "first_seen_time": time_str,
                    "last_seen_time": time_str,
                    "last_seen_epoch": now,
                    "threat_score": 10,
                    "severity": "LOW",
                    "total_handoffs": 0,
                    "embedding": new_vec,
                    "dominant_colors": emb_data["dominant_colors"],
                    "snapshot_b64": emb_data["snapshot_b64"],
                    "movement_path": [
                        {
                            "from_camera": camera_id,
                            "to_camera": camera_id,
                            "time": time_str,
                            "transit_seconds": 0.0,
                            "similarity": 1.0
                        }
                    ]
                }
                self.local_to_global[local_key] = new_gid

            # Persist new GlobalTrack in database
            try:
                db = SessionLocal()
                existing = db.query(GlobalTrack).filter(GlobalTrack.id == new_gid).first()
                if not existing:
                    db_gt = GlobalTrack(
                        id=new_gid,
                        entity_type=entity_type,
                        status="ACTIVE",
                        first_seen_camera=camera_id,
                        current_camera=camera_id,
                        previous_camera=None,
                        first_seen_time=time_str,
                        last_seen_time=time_str,
                        threat_score=10,
                        severity="LOW",
                        total_handoffs=0,
                        embedding_summary={
                            "dimension": emb_data["dimension"],
                            "dominant_colors": emb_data["dominant_colors"],
                            "vector": emb_data["vector"]
                        },
                        latest_snapshot_base64=emb_data["snapshot_b64"],
                        movement_path=self.active_tracks[new_gid]["movement_path"]
                    )
                    db.add(db_gt)
                    db.commit()
                db.close()
            except Exception as db_err:
                logger.error(f"Failed to persist new GlobalTrack: {db_err}", exc_info=True)

            return new_gid, False, None

    def _generate_new_global_id(self) -> str:
        """Generates sequential, tactical global identity labels (e.g. GLOBAL-027)."""
        db = SessionLocal()
        try:
            while True:
                self.global_track_counter += 1
                cand_id = f"GLOBAL-{self.global_track_counter:03d}"
                exists = db.query(GlobalTrack).filter(GlobalTrack.id == cand_id).first()
                if not exists and cand_id not in self.active_tracks:
                    return cand_id
        finally:
            db.close()

    def get_all_global_tracks(self) -> List[Dict[str, Any]]:
        """Returns all global tracks sorted with active ones first."""
        db = SessionLocal()
        try:
            tracks = db.query(GlobalTrack).order_by(GlobalTrack.updated_at.desc()).limit(30).all()
            result = []
            for t in tracks:
                result.append({
                    "id": t.id,
                    "entity_type": t.entity_type,
                    "status": t.status,
                    "first_seen_camera": t.first_seen_camera,
                    "current_camera": t.current_camera,
                    "previous_camera": t.previous_camera,
                    "first_seen_time": t.first_seen_time,
                    "last_seen_time": t.last_seen_time,
                    "threat_score": t.threat_score,
                    "severity": t.severity,
                    "total_handoffs": t.total_handoffs,
                    "dominant_colors": t.embedding_summary.get("dominant_colors", {}) if t.embedding_summary else {},
                    "snapshot_base64": t.latest_snapshot_base64,
                    "movement_path": t.movement_path or []
                })
            return result
        finally:
            db.close()

    def get_track_dossier(self, global_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves full cross-camera handoff history and snapshots for a single global entity."""
        db = SessionLocal()
        try:
            gt = db.query(GlobalTrack).filter(GlobalTrack.id == global_id).first()
            if not gt:
                return None
            handoffs = db.query(TrackHandoff).filter(TrackHandoff.global_track_id == global_id).order_by(TrackHandoff.created_at.asc()).all()
            return {
                "id": gt.id,
                "entity_type": gt.entity_type,
                "status": gt.status,
                "first_seen_camera": gt.first_seen_camera,
                "current_camera": gt.current_camera,
                "previous_camera": gt.previous_camera,
                "first_seen_time": gt.first_seen_time,
                "last_seen_time": gt.last_seen_time,
                "threat_score": gt.threat_score,
                "severity": gt.severity,
                "total_handoffs": gt.total_handoffs,
                "dominant_colors": gt.embedding_summary.get("dominant_colors", {}) if gt.embedding_summary else {},
                "snapshot_base64": gt.latest_snapshot_base64,
                "movement_path": gt.movement_path or [],
                "handoffs": [
                    {
                        "id": h.id,
                        "from_camera": h.from_camera,
                        "to_camera": h.to_camera,
                        "local_track_id": h.local_track_id,
                        "timestamp": h.timestamp,
                        "transition_time_seconds": h.transition_time_seconds,
                        "similarity_score": h.similarity_score,
                        "confidence": h.confidence,
                        "snapshot_base64": h.snapshot_base64,
                        "metadata": h.metadata_json
                    }
                    for h in handoffs
                ]
            }
        finally:
            db.close()

    def set_config(self, threshold: Optional[float] = None, max_transit: Optional[float] = None):
        """Allows dynamic operator configuration of Re-ID sensitivity."""
        with self.lock:
            if threshold is not None:
                self.similarity_threshold = max(0.40, min(0.95, float(threshold)))
            if max_transit is not None:
                self.max_transit_seconds = max(5.0, min(600.0, float(max_transit)))
        logger.info(f"Re-ID config updated: threshold={self.similarity_threshold}, max_transit={self.max_transit_seconds}s")


# Global Re-ID singleton instance
reid_service = ReIDService()
