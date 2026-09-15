import datetime
import logging
import time
import uuid
from typing import Dict, List, Any, Optional, Set, Tuple
import cv2
import numpy as np

from app.database import SessionLocal
from app.models.models import Event, Alert, Incident, Zone, Evidence, AuditLog
from app.services.threat_engine import evaluate_threat
from app.services.evidence_service import evidence_service
from app.websocket.connection_manager import manager

logger = logging.getLogger("tejas.event_engine")


class TrackState:
    def __init__(self, track_id: int, class_name: str, first_seen: float):
        self.track_id = track_id
        self.class_name = class_name
        self.first_seen = first_seen
        self.last_seen = first_seen
        self.initial_event_fired = False
        self.current_zones: Set[str] = set()
        self.zone_entry_times: Dict[str, float] = {}
        self.loiter_fired_zones: Set[str] = set()
        self.factors: Set[str] = {"rule_unverified_identity"}
        self.incident_id: Optional[str] = None
        self.timeline: List[Dict[str, Any]] = []
        self.threat_score: int = 10
        self.severity: str = "LOW"


class EventEngine:
    def __init__(self):
        self.tracks: Dict[int, TrackState] = {}
        # Configuration parameters
        self.night_start_hour: int = 18  # 18:00 (6 PM)
        self.night_end_hour: int = 6     # 06:00 (6 AM)
        self.loiter_threshold_seconds: float = 10.0
        self.alert_threshold: int = 50
        self.incident_threshold: int = 70
        # Simulated/test override for night mode
        self.force_night_mode: bool = False

    def is_night_time(self) -> bool:
        """Determines if current operational time is within night hours."""
        if self.force_night_mode:
            return True
        now = datetime.datetime.now()
        current_hour = now.hour
        if self.night_start_hour > self.night_end_hour:
            # Over midnight: e.g. 18:00 to 06:00
            return current_hour >= self.night_start_hour or current_hour < self.night_end_hour
        else:
            return self.night_start_hour <= current_hour < self.night_end_hour

    @staticmethod
    def get_reference_point(box: List[int]) -> Tuple[int, int]:
        """
        Computes the bottom-center reference point of the bounding box [x1, y1, x2, y2].
        This is the standard ground-plane contact point in surveillance geometry.
        """
        x1, y1, x2, y2 = box
        ref_x = int((x1 + x2) / 2)
        ref_y = int(y2)
        return ref_x, ref_y

    @staticmethod
    def is_point_in_polygon(ref_point: Tuple[int, int], contour: np.ndarray) -> bool:
        """Exact OpenCV point-in-polygon test. Returns True if point is inside or on edge."""
        if contour is None or len(contour) < 3:
            return False
        dist = cv2.pointPolygonTest(contour, (float(ref_point[0]), float(ref_point[1])), measureDist=False)
        return dist >= 0

    def process_frame(
        self,
        camera_id: str,
        tracks: List[Dict[str, Any]],
        zones: List[Dict[str, Any]],
        frame_shape: Tuple[int, int]
    ):
        """
        Main evaluation entry point called per processed video frame.
        Evaluates real tracks against polygonal zones, produces events, calculates threat,
        persists to database, and broadcasts to WebSocket clients.
        """
        now = time.time()
        time_str = datetime.datetime.now().strftime("%H:%M:%S")
        is_night = self.is_night_time()
        h, w = frame_shape[:2]

        # Prepare zone contours scaled to current frame resolution
        scaled_zones = []
        for z in zones:
            pts = z.get("points_json", [])
            if pts and len(pts) >= 3:
                contour = np.array(
                    [[int(p["x"] / 100.0 * w), int(p["y"] / 100.0 * h)] for p in pts],
                    dtype=np.int32
                )
                scaled_zones.append({
                    "id": z.get("id"),
                    "name": z.get("name", "Zone"),
                    "type": z.get("type", "RESTRICTED"),
                    "threat_weight": z.get("threat_weight", 30),
                    "contour": contour
                })

        seen_track_ids = set()

        for track_data in tracks:
            t_id = track_data["track_id"]
            if t_id < 0:
                continue

            seen_track_ids.add(t_id)
            cls_name = track_data["class_name"]
            box = track_data["box"]
            conf = track_data["confidence"]
            ref_pt = self.get_reference_point(box)

            # Initialize track state if new
            if t_id not in self.tracks:
                self.tracks[t_id] = TrackState(t_id, cls_name, now)

            track = self.tracks[t_id]
            track.last_seen = now
            entity_label = f"{cls_name.upper()} #{t_id}"

            # 1. First Detection Event
            if not track.initial_event_fired:
                track.initial_event_fired = True
                event_type = "PERSON_DETECTED" if cls_name == "person" else "VEHICLE_DETECTED"
                self._record_and_dispatch_event(
                    camera_id=camera_id,
                    entity_id=entity_label,
                    event_type=event_type,
                    time_str=time_str,
                    confidence=conf,
                    location=f"Camera {camera_id} Field of View",
                    metadata={"box": box, "track_id": t_id, "class": cls_name},
                    track=track
                )

            # 2. Polygon Zone Membership Check
            active_zones_for_track = set()
            for zone_info in scaled_zones:
                z_id = zone_info["id"]
                z_name = zone_info["name"]
                z_type = zone_info["type"]
                contour = zone_info["contour"]

                inside = self.is_point_in_polygon(ref_pt, contour)

                if inside:
                    active_zones_for_track.add(z_id)

                    # A. Check for Zone Entry
                    if z_id not in track.current_zones:
                        track.current_zones.add(z_id)
                        track.zone_entry_times[z_id] = now

                        # Add threat factor
                        if z_type in ["RESTRICTED", "BORDER"]:
                            track.factors.add("rule_restricted_intrusion")
                        elif z_type == "SENSITIVE":
                            track.factors.add("rule_movement_sensitive")

                        entry_event = "RESTRICTED_ZONE_ENTRY"
                        self._record_and_dispatch_event(
                            camera_id=camera_id,
                            entity_id=entity_label,
                            event_type=entry_event,
                            time_str=time_str,
                            confidence=conf,
                            location=f"{z_name} ({z_id})",
                            metadata={"zone_id": z_id, "zone_name": z_name, "zone_type": z_type, "box": box, "ref_point": ref_pt},
                            track=track
                        )

                        # Check Night Context
                        if is_night:
                            track.factors.add("rule_night_movement")
                            self._record_and_dispatch_event(
                                camera_id=camera_id,
                                entity_id=entity_label,
                                event_type="NIGHT_INTRUSION",
                                time_str=time_str,
                                confidence=conf,
                                location=f"{z_name} [NIGHT RESTRICTION]",
                                metadata={"zone_id": z_id, "night_hours": f"{self.night_start_hour}:00-{self.night_end_hour}:00", "box": box},
                                track=track
                            )

                    # B. Check for Loitering
                    else:
                        entry_time = track.zone_entry_times.get(z_id, now)
                        dwell_time = now - entry_time
                        if dwell_time >= self.loiter_threshold_seconds and z_id not in track.loiter_fired_zones:
                            track.loiter_fired_zones.add(z_id)
                            track.factors.add("rule_loitering")
                            self._record_and_dispatch_event(
                                camera_id=camera_id,
                                entity_id=entity_label,
                                event_type="LOITERING_DETECTED",
                                time_str=time_str,
                                confidence=conf,
                                location=f"{z_name} [DWELL: {int(dwell_time)}s]",
                                metadata={"zone_id": z_id, "dwell_seconds": round(dwell_time, 1), "box": box},
                                track=track
                            )

            # C. Check for Zone Exit
            exited_zones = track.current_zones - active_zones_for_track
            for z_id in exited_zones:
                track.current_zones.remove(z_id)
                track.zone_entry_times.pop(z_id, None)
                track.loiter_fired_zones.discard(z_id)

                self._record_and_dispatch_event(
                    camera_id=camera_id,
                    entity_id=entity_label,
                    event_type="RESTRICTED_ZONE_EXIT",
                    time_str=time_str,
                    confidence=conf,
                    location=f"Zone {z_id} Boundary",
                    metadata={"zone_id": z_id, "box": box},
                    track=track
                )

        # Purge stale tracks not seen for > 30 seconds
        stale_ids = [tid for tid, trk in self.tracks.items() if now - trk.last_seen > 30.0]
        for tid in stale_ids:
            self.tracks.pop(tid, None)

    def handle_anpr_event(
        self,
        camera_id: str,
        anpr_result: Dict[str, Any],
        track_id: Optional[int] = None
    ):
        """
        Processes ANPR results:
        1. Emits PLATE_DETECTED event.
        2. If watchlist match, adds rule_watchlist_vehicle factor, elevates threat,
           and emits WATCHLIST_MATCH event.
        3. Broadcasts real-time ANPR and threat events via WebSocket.
        """
        if not anpr_result or not anpr_result.get("plate_detected"):
            return

        now = time.time()
        time_str = anpr_result.get("timestamp") or datetime.datetime.now().strftime("%H:%M:%S")
        plate_number = anpr_result.get("plate_number") or "UNKNOWN"
        conf = float(anpr_result.get("confidence_after", 0.90))

        # Get or create TrackState
        t_id = track_id if (track_id is not None and track_id >= 0) else -1
        if t_id in self.tracks:
            track = self.tracks[t_id]
            entity_id = f"VEHICLE #{t_id} [{plate_number}]"
        else:
            # Virtual vehicle track for ANPR event
            virtual_id = 8000 + (abs(hash(plate_number)) % 1000)
            if virtual_id not in self.tracks:
                self.tracks[virtual_id] = TrackState(virtual_id, "vehicle", now)
            track = self.tracks[virtual_id]
            entity_id = f"VEHICLE [{plate_number}]"

        track.last_seen = now

        # 1. PLATE_DETECTED Event
        self._record_and_dispatch_event(
            camera_id=camera_id,
            entity_id=entity_id,
            event_type="PLATE_DETECTED",
            time_str=time_str,
            confidence=conf,
            location=f"Camera {camera_id} Checkpoint",
            metadata={
                "plate_number": plate_number,
                "raw_ocr_text": anpr_result.get("raw_ocr_text"),
                "quality_score": anpr_result.get("quality_assessment", {}).get("quality_score"),
                "applied_enhancements": anpr_result.get("applied_enhancements", []),
                "watchlist_status": anpr_result.get("watchlist_status"),
                "track_id": t_id
            },
            track=track
        )

        # 2. WATCHLIST_MATCH Event (if matched)
        if anpr_result.get("watchlist_match"):
            track.factors.add("rule_watchlist_vehicle")
            wl_entry = anpr_result.get("watchlist_entry", {})
            self._record_and_dispatch_event(
                camera_id=camera_id,
                entity_id=entity_id,
                event_type="WATCHLIST_MATCH",
                time_str=time_str,
                confidence=conf,
                location=f"Security Perimeter ({wl_entry.get('title', 'Flagged Vehicle')})",
                metadata={
                    "plate_number": plate_number,
                    "watchlist_id": wl_entry.get("id"),
                    "threat_level": wl_entry.get("threat_level"),
                    "category": wl_entry.get("category"),
                    "notes": wl_entry.get("notes"),
                    "track_id": t_id
                },
                track=track
            )

        # Broadcast dedicated ANPR_DETECTION payload for ANPR page
        anpr_ws_payload = {
            "type": "ANPR_DETECTION",
            "data": anpr_result
        }
        manager.broadcast_sync(anpr_ws_payload)

    def handle_cross_camera_handoff(
        self,
        global_track_id: str,
        from_camera: str,
        to_camera: str,
        similarity_score: float,
        transit_seconds: float,
        entity_type: str = "PERSON",
        snapshot_b64: Optional[str] = None
    ):
        """
        Processes a genuine cross-camera re-identification transition:
        1. Propagates existing threat factors along the unified global identity.
        2. Adds rule_multi_camera_transit factor (+20 points).
        3. Emits CROSS_CAMERA_HANDOFF event in database.
        4. Broadcasts real-time handoff and updated threat correlation via WebSocket.
        """
        now = time.time()
        time_str = datetime.datetime.now().strftime("%H:%M:%S")
        entity_id = f"{entity_type.upper()} [{global_track_id}]"

        # Lookup or create TrackState for this global entity
        virtual_id = 9000 + (abs(hash(global_track_id)) % 1000)
        if virtual_id not in self.tracks:
            self.tracks[virtual_id] = TrackState(virtual_id, entity_type.lower(), now)

        track = self.tracks[virtual_id]
        track.last_seen = now

        # Propagate multi-camera transit threat factor
        track.factors.add("rule_multi_camera_transit")

        # Emit CROSS_CAMERA_HANDOFF event
        self._record_and_dispatch_event(
            camera_id=to_camera,
            entity_id=entity_id,
            event_type="CROSS_CAMERA_HANDOFF",
            time_str=time_str,
            confidence=similarity_score,
            location=f"Transit: {from_camera} -> {to_camera}",
            metadata={
                "global_track_id": global_track_id,
                "from_camera": from_camera,
                "to_camera": to_camera,
                "similarity_score": round(similarity_score, 3),
                "transit_seconds": round(transit_seconds, 1),
                "snapshot_b64": snapshot_b64
            },
            track=track
        )

        # Broadcast specialized MULTI_CAMERA_HANDOFF WebSocket payload
        handoff_ws = {
            "type": "MULTI_CAMERA_HANDOFF",
            "data": {
                "global_track_id": global_track_id,
                "from_camera": from_camera,
                "to_camera": to_camera,
                "similarity_score": round(similarity_score, 3),
                "transit_seconds": round(transit_seconds, 1),
                "timestamp": time_str,
                "threat_score": track.threat_score,
                "severity": track.severity,
                "factors": list(track.factors)
            }
        }
        manager.broadcast_sync(handoff_ws)

    def handle_face_event(
        self,
        camera_id: str,
        face_result: Dict[str, Any],
        track_id: Optional[int] = None
    ):
        """
        Processes modular face recognition result:
        1. If MATCHED to WATCHLIST:
           - Elevates threat with rule_watchlist_face factor (+40 points).
           - Emits WATCHLIST_FACE_MATCH event in database.
           - Triggers/updates Incident with captured face evidence.
        2. If MATCHED to AUTHORIZED:
           - Applies rule_authorized_personnel factor (-30 points).
           - Emits AUTHORIZED_FACE_VERIFIED event.
        3. If UNKNOWN / UNVERIFIED:
           - Neutral observation: NEVER treated as suspicious (0 threat delta).
           - Emits neutral FACE_RECOGNITION_EVENT WebSocket event for HUD display.
        """
        if not face_result or not face_result.get("enabled"):
            return

        state = face_result.get("state")
        best_match = face_result.get("best_match")
        now = time.time()
        time_str = datetime.datetime.now().strftime("%H:%M:%S")

        t_id = track_id if (track_id is not None and track_id >= 0) else -1
        if t_id in self.tracks:
            track = self.tracks[t_id]
        else:
            virtual_id = 7000 + (t_id if t_id >= 0 else int(now) % 1000)
            if virtual_id not in self.tracks:
                self.tracks[virtual_id] = TrackState(virtual_id, "person", now)
            track = self.tracks[virtual_id]

        track.last_seen = now

        # Broadcast real-time biometric HUD telemetry
        manager.broadcast_sync({
            "type": "FACE_RECOGNITION_EVENT",
            "data": {
                "camera_id": camera_id,
                "track_id": track_id,
                "state": state,
                "faces_detected": face_result.get("faces_detected", 0),
                "best_match": best_match,
                "timestamp": time_str
            }
        })

        if state == "MATCHED" and best_match:
            identity = best_match.get("matched_identity", {})
            category = identity.get("category", "WATCHLIST")
            name = identity.get("name", "Unknown Suspect")
            conf = float(best_match.get("confidence", 0.90))

            if category == "WATCHLIST":
                track.factors.add("rule_watchlist_face")
                self._record_and_dispatch_event(
                    camera_id=camera_id,
                    entity_id=f"WATCHLIST PERSON [{name}]",
                    event_type="WATCHLIST_FACE_MATCH",
                    time_str=time_str,
                    confidence=conf,
                    location=f"Checkpoint Sector ({camera_id})",
                    metadata={
                        "face_id": identity.get("id"),
                        "name": name,
                        "category": category,
                        "threat_level": identity.get("threat_level", "CRITICAL"),
                        "similarity": best_match.get("similarity"),
                        "confidence": conf,
                        "box": best_match.get("box_global"),
                        "notes": identity.get("notes")
                    },
                    track=track
                )
            elif category in ("AUTHORIZED", "SECURITY_STAFF"):
                track.factors.add("rule_authorized_personnel")
                self._record_and_dispatch_event(
                    camera_id=camera_id,
                    entity_id=f"AUTHORIZED PERSON [{name}]",
                    event_type="AUTHORIZED_FACE_VERIFIED",
                    time_str=time_str,
                    confidence=conf,
                    location=f"Access Portal ({camera_id})",
                    metadata={
                        "face_id": identity.get("id"),
                        "name": name,
                        "category": category,
                        "confidence": conf
                    },
                    track=track
                )

    def _record_and_dispatch_event(
        self,
        camera_id: str,
        entity_id: str,
        event_type: str,
        time_str: str,
        confidence: float,
        location: str,
        metadata: Dict[str, Any],
        track: TrackState
    ):
        """Creates event record, evaluates threat, handles DB transactions, and broadcasts."""
        event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"

        # Add to track timeline
        timeline_entry = {
            "time": time_str,
            "camera": camera_id,
            "event": f"{event_type.replace('_', ' ').title()}: {location}"
        }
        track.timeline.append(timeline_entry)

        # Evaluate threat score via Threat Engine
        assessment = evaluate_threat(list(track.factors))
        track.threat_score = assessment["score"]
        track.severity = assessment["severity"]

        db = SessionLocal()
        created_alert_data = None
        created_incident_data = None

        try:
            # 1. Insert Event in DB
            db_event = Event(
                id=event_id,
                event_type=event_type,
                camera_id=camera_id,
                entity_id=entity_id,
                timestamp=time_str,
                confidence=float(confidence),
                location=location,
                metadata_json=metadata
            )
            db.add(db_event)

            # 2. Check if Alert should be created
            if track.threat_score >= self.alert_threshold:
                alert_id = f"ALT-{uuid.uuid4().hex[:6].upper()}"
                alert_msg = f"{event_type.replace('_', ' ').title()} on {camera_id} by {entity_id} at {location}."
                db_alert = Alert(
                    id=alert_id,
                    camera=camera_id,
                    title=f"{track.severity}: {event_type.replace('_', ' ').title()}",
                    severity=track.severity,
                    threat_score=track.threat_score,
                    message=alert_msg,
                    timestamp=time_str
                )
                db.add(db_alert)
                created_alert_data = {
                    "id": alert_id,
                    "camera": camera_id,
                    "title": db_alert.title,
                    "severity": track.severity,
                    "threat_score": track.threat_score,
                    "message": alert_msg,
                    "timestamp": time_str
                }

            # 3. Check if Incident should be created/updated
            if track.threat_score >= self.incident_threshold:
                anpr_info = {}
                if metadata.get("plate_number"):
                    anpr_info = {
                        "plate_number": metadata.get("plate_number"),
                        "vehicle_type": metadata.get("vehicle_type", "VEHICLE"),
                        "watchlist_status": metadata.get("watchlist_status", "MATCH"),
                        "confidence": metadata.get("confidence", 0.95),
                        "raw_ocr": metadata.get("raw_ocr", "")
                    }

                evidence_img = (
                    metadata.get("snapshot_b64") or 
                    metadata.get("raw_crop_base64") or 
                    metadata.get("restored_crop_base64") or 
                    metadata.get("crop_b64")
                )

                if track.incident_id:
                    # Update existing incident
                    db_inc = db.query(Incident).filter(Incident.id == track.incident_id).first()
                    if db_inc:
                        db_inc.threat_score = track.threat_score
                        db_inc.severity = track.severity
                        db_inc.threat_factors = assessment["breakdown"]
                        db_inc.timeline = track.timeline
                        db_event.incident_id = db_inc.id
                        if anpr_info:
                            db_inc.anpr_data = anpr_info

                        # Capture additional evidence for notable events if image is present
                        if evidence_img:
                            evidence_service.create_evidence_record(
                                db=db,
                                incident_id=db_inc.id,
                                camera_id=camera_id,
                                evidence_type="PLATE_CROP" if metadata.get("plate_number") else "SNAPSHOT",
                                event_id=event_id,
                                track_id=str(track.track_id),
                                threat_score=track.threat_score,
                                image_data=evidence_img,
                                metadata_json={
                                    "event_type": event_type,
                                    "entity_id": entity_id,
                                    "location": location,
                                    "box": metadata.get("box") or metadata.get("plate_box")
                                },
                                timestamp_str=time_str
                            )

                        created_incident_data = {
                            "id": db_inc.id,
                            "title": db_inc.title,
                            "target_entity": entity_id,
                            "threat_score": track.threat_score,
                            "severity": track.severity,
                            "primary_camera": camera_id,
                            "timestamp": db_inc.timestamp,
                            "status": db_inc.status,
                            "threat_factors": assessment["breakdown"],
                            "timeline": track.timeline,
                            "anpr_data": db_inc.anpr_data,
                            "affected_track_id": str(track.track_id)
                        }
                else:
                    # Create new Incident with lifecycle status 'NEW'
                    inc_id = f"INC-{datetime.date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
                    track.incident_id = inc_id
                    db_event.incident_id = inc_id
                    inc_title = f"{event_type.replace('_', ' ').title()} & Perimeter Alert"

                    db_inc = Incident(
                        id=inc_id,
                        title=inc_title,
                        target_entity=entity_id,
                        threat_score=track.threat_score,
                        severity=track.severity,
                        primary_camera=camera_id,
                        timestamp=time_str,
                        status="NEW",
                        assigned_to="Duty Officer",
                        threat_factors=assessment["breakdown"],
                        timeline=track.timeline,
                        anpr_data=anpr_info,
                        affected_track_id=str(track.track_id)
                    )
                    db.add(db_inc)

                    # Initial Audit Log entry
                    db_log = AuditLog(
                        incident_id=inc_id,
                        user="System AI Engine",
                        action=f"Incident auto-created with status NEW (Threat Score: {track.threat_score}, Severity: {track.severity}). Triggered by {event_type}.",
                        timestamp=time_str,
                        details={
                            "trigger": event_type,
                            "camera_id": camera_id,
                            "threat_score": track.threat_score,
                            "severity": track.severity,
                            "factors": assessment["breakdown"]
                        }
                    )
                    db.add(db_log)

                    # Save initial evidence snapshot
                    evidence_service.create_evidence_record(
                        db=db,
                        incident_id=inc_id,
                        camera_id=camera_id,
                        evidence_type="PLATE_CROP" if metadata.get("plate_number") else "SNAPSHOT",
                        event_id=event_id,
                        track_id=str(track.track_id),
                        threat_score=track.threat_score,
                        image_data=evidence_img,
                        metadata_json={
                            "event_type": event_type,
                            "entity_id": entity_id,
                            "location": location,
                            "box": metadata.get("box") or metadata.get("plate_box")
                        },
                        timestamp_str=time_str
                    )

                    created_incident_data = {
                        "id": inc_id,
                        "title": inc_title,
                        "target_entity": entity_id,
                        "threat_score": track.threat_score,
                        "severity": track.severity,
                        "primary_camera": camera_id,
                        "timestamp": time_str,
                        "status": "NEW",
                        "threat_factors": assessment["breakdown"],
                        "timeline": track.timeline,
                        "anpr_data": anpr_info,
                        "affected_track_id": str(track.track_id)
                    }

            db.commit()

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist event/incident to database: {e}", exc_info=True)
        finally:
            db.close()

        # 4. Broadcast live WebSocket message
        ws_payload = {
            "type": "CORRELATED_EVENT",
            "event": {
                "id": event_id,
                "event_type": event_type,
                "camera_id": camera_id,
                "entity_id": entity_id,
                "timestamp": time_str,
                "confidence": round(float(confidence), 2),
                "location": location,
                "metadata": metadata
            },
            "correlation": {
                "entity_id": entity_id,
                "threat_score": track.threat_score,
                "severity": track.severity,
                "factors": assessment["breakdown"],
                "timeline": track.timeline,
                "cameras_involved": [camera_id]
            },
            "alert": created_alert_data,
            "incident": created_incident_data
        }

        manager.broadcast_sync(ws_payload)

        # Broadcast explicit NEW_INCIDENT alert when a high-severity incident is created
        if created_incident_data and created_incident_data.get("status") == "NEW":
            manager.broadcast_sync({
                "type": "NEW_INCIDENT",
                "incident": created_incident_data,
                "severity": track.severity,
                "message": f"CRITICAL INCIDENT [{created_incident_data['id']}]: {created_incident_data['title']} on {camera_id}"
            })

        logger.info(
            f"Event [{event_type}] by [{entity_id}] on [{camera_id}] -> Threat Score: {track.threat_score} ({track.severity})"
        )


# Global singleton instance
event_engine = EventEngine()
