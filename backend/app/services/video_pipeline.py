import os
import sys
import time
import math
import logging
import threading
import queue
from pathlib import Path
from typing import Optional, Dict, Any, List, Set, Union

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from app.config import settings
from app.services.video_source import VideoSource

logger = logging.getLogger("tejas.video_pipeline")

class VideoPipelineService:
    """
    Decoupled Video Pipeline Architecture:
    1. Dedicated Capture Thread (_capture_worker):
       Reads frames in real-time from VideoSource into latest_raw_frame buffer, dropping stale frames.
    2. Dedicated Inference & Annotation Worker (_processing_worker):
       Throttled to TARGET_INFERENCE_FPS, runs YOLOv8 & ByteTrack, renders tactical HUD, and updates JPEG buffer.
    3. Asynchronous Protection Queue (_async_worker):
       Non-blocking background queue for threat engine, face biometrics, Re-ID, and DB logging.
    4. Safe Source Switching (switch_source):
       Pre-verifies candidate camera before swapping, never dropping to a blank screen on failure.
    """

    def __init__(self, source: Optional[Union[int, str]] = None):
        if source is None:
            try:
                source = settings.get_resolved_video_source()
            except Exception:
                source = 0
        self.source = source
        self.is_running = False
        self.cap: Optional[cv2.VideoCapture] = None
        
        # Concurrency & Synchronization
        self.lock = threading.Lock()
        self.frame_lock = threading.Lock()
        self.capture_thread: Optional[threading.Thread] = None
        self.processing_thread: Optional[threading.Thread] = None
        self.async_worker_thread: Optional[threading.Thread] = None
        self.new_frame_event = threading.Event()
        self.event_queue: queue.Queue = queue.Queue(maxsize=10)

        # Hardware & Model Configuration
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.confidence_threshold = 0.35
        # COCO IDs: 0: person, 2: car, 3: motorcycle, 5: bus, 7: truck
        self.target_class_ids = [0, 2, 3, 5, 7]
        self.model_name = "yolov8n.pt"
        self.model: Optional[YOLO] = None

        # Frame buffers & Telemetry
        self.latest_raw_frame: Optional[np.ndarray] = None
        self.latest_processed_frame: Optional[np.ndarray] = None
        self.latest_jpeg: Optional[bytes] = None
        self.is_connected = False
        self.capture_fps = 0.0
        self.infer_fps = 0.0
        self.actual_fps = 0.0  # Display FPS
        self.inference_ms = 0.0
        self.active_tracks: List[Dict[str, Any]] = []
        self.detection_counts: Dict[str, int] = {"person": 0, "vehicle": 0, "total": 0}
        self.frame_count = 0
        self.camera_code = "CAM-00"
        self.zones: List[Dict[str, Any]] = []
        
        # Configurable Resolutions & Target Rates
        self.processing_target_fps = max(5, min(30, settings.TARGET_INFERENCE_FPS))
        self.inference_width = settings.INFERENCE_WIDTH
        self.inference_height = settings.INFERENCE_HEIGHT

        # ANPR & Biometrics Caches (for background processing)
        self.anpr_cache: Dict[int, Dict[str, Any]] = {}
        self.last_anpr_time: Dict[int, float] = {}
        self.anpr_evaluating: Set[int] = set()
        self.global_track_map: Dict[int, str] = {}
        self.face_cache: Dict[int, Dict[str, Any]] = {}
        self.last_face_time: Dict[int, float] = {}
        self.face_evaluating: Set[int] = set()

        self._load_model()
        self.reload_zones()

    def _find_model_path(self) -> str:
        candidates = [
            Path(self.model_name),
            Path(__file__).resolve().parent.parent.parent / self.model_name,
            Path(__file__).resolve().parent.parent.parent.parent / self.model_name,
        ]
        for p in candidates:
            if p.exists():
                return str(p)
        return self.model_name

    def _load_model(self):
        try:
            model_path = self._find_model_path()
            logger.info(f"Loading YOLOv8 model from: {model_path} on device: {self.device}")
            self.model = YOLO(model_path)
            self.model.to(self.device)
            logger.info("YOLOv8 & ByteTrack model initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}", exc_info=True)
            self.model = None

    def start(self):
        if self.is_running:
            return
        self.is_running = True

        # 1. Start dedicated Capture Thread
        self.capture_thread = threading.Thread(target=self._capture_worker, daemon=True, name="CaptureWorker")
        self.capture_thread.start()

        # 2. Start dedicated Inference & Annotation Thread
        self.processing_thread = threading.Thread(target=self._processing_worker, daemon=True, name="InferenceWorker")
        self.processing_thread.start()

        # 3. Start decoupled Async Protection Worker
        self.async_worker_thread = threading.Thread(target=self._async_worker, daemon=True, name="AsyncProtectionWorker")
        self.async_worker_thread.start()

        logger.info(f"Video Pipeline started on source: {self.source} (Target FPS: {self.processing_target_fps})")

    def stop(self):
        self.is_running = False
        self.new_frame_event.set()
        with self.frame_lock:
            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None
        self.is_connected = False
        logger.info("Video Pipeline stopped and camera released.")

    def switch_source(self, new_source: Union[int, str]) -> Dict[str, Any]:
        """
        Safely switches the video source:
        1. Verifies the candidate source before touching the current stream.
        2. Swaps the capture atomically only if valid frames are verified.
        3. If candidate fails, keeps the previous working stream untouched.
        """
        logger.info(f"Safe switch requested: Current '{self.source}' -> Candidate '{new_source}'")
        
        # If already active and connected, return success immediately
        if str(new_source) == str(self.source) and self.is_connected:
            return {
                "success": True,
                "source": str(self.source),
                "already_active": True,
                "resolution": f"{self.inference_width}x{self.inference_height}",
                "is_illuminated": True
            }

        # Test candidate source
        test_res = VideoSource.test_source(
            new_source, 
            timeout_seconds=2.5,
            active_source=self.source,
            active_telemetry=self.get_telemetry()
        )
        if not test_res.get("success"):
            err_msg = test_res.get("error", "Candidate camera could not be opened")
            logger.warning(f"Safe switch rejected: {err_msg}. Keeping current source: {self.source}")
            return {
                "success": False,
                "error": err_msg,
                "current_source": str(self.source)
            }

        # Create new active capture handle
        new_cap = VideoSource.create_capture(new_source, width=self.inference_width, height=self.inference_height)
        if new_cap is None or not new_cap.isOpened():
            return {
                "success": False,
                "error": "Failed to create verified capture instance",
                "current_source": str(self.source)
            }

        # Atomic swap under lock
        with self.frame_lock:
            old_cap = self.cap
            self.cap = new_cap
            self.source = new_source
            self.is_connected = True
            self.active_tracks = []

        # Release old capture safely in background
        if old_cap is not None:
            try:
                old_cap.release()
            except Exception:
                pass

        logger.info(f"Safe switch successful. Active source is now: {self.source} ({test_res.get('resolution')})")
        return {
            "success": True,
            "source": str(self.source),
            "resolution": test_res.get("resolution"),
            "is_illuminated": test_res.get("is_illuminated", True)
        }

    def set_config(self, confidence: Optional[float] = None, source: Optional[Any] = None, processing_fps: Optional[int] = None):
        with self.lock:
            if confidence is not None:
                self.confidence_threshold = max(0.1, min(0.95, float(confidence)))
            if processing_fps is not None:
                self.processing_target_fps = max(5, min(30, int(processing_fps)))

        if source is not None and str(source) != str(self.source):
            self.switch_source(source)

    def reload_zones(self):
        try:
            from app.database import SessionLocal
            from app.models.models import Zone
            db = SessionLocal()
            db_zones = db.query(Zone).all()
            zones_data = []
            for z in db_zones:
                if not z.camera_code or z.camera_code in [self.camera_code, "CAM-00", "0", "RESTRICTED-Z01"]:
                    zones_data.append({
                        "id": z.id,
                        "name": z.name,
                        "type": z.type,
                        "color": z.color or "#EF4444",
                        "threat_weight": z.threat_weight or 30,
                        "points_json": z.points_json or []
                    })
            with self.lock:
                self.zones = zones_data
            db.close()
        except Exception as e:
            logger.warning(f"Failed to reload zones: {e}")

    def _generate_fallback_frame(self, message: str = "CAMERA UNAVAILABLE — CONNECTING") -> np.ndarray:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame[:, :] = (20, 15, 10)
        for y in range(0, 480, 40):
            cv2.line(frame, (0, y), (640, y), (35, 28, 20), 1)
        for x in range(0, 640, 40):
            cv2.line(frame, (x, 0), (x, 480), (35, 28, 20), 1)

        pulse = int(15 + 10 * np.sin(time.time() * 3))
        cv2.circle(frame, (320, 240), 60 + pulse, (60, 40, 20), 1)
        cv2.circle(frame, (320, 240), 40, (0, 165, 255), 2)
        cv2.circle(frame, (320, 240), 4, (0, 165, 255), -1)

        cv2.putText(frame, "TEJAS SENSOR OFFLINE", (220, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        cv2.putText(frame, message, (180, 340), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, ts, (20, 460), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 100, 100), 1)
        return frame

    # ---------------------------------------------------------
    # WORKER 1: Real-time Camera Frame Acquisition Thread
    # ---------------------------------------------------------
    def _capture_worker(self):
        last_t = time.time()
        reconnect_timer = 0.0

        while self.is_running:
            # Reconnect handling
            if self.cap is None or not self.cap.isOpened():
                if time.time() - reconnect_timer > 2.5:
                    reconnect_timer = time.time()
                    with self.frame_lock:
                        self.cap = VideoSource.create_capture(self.source, width=self.inference_width, height=self.inference_height)
                        self.is_connected = (self.cap is not None and self.cap.isOpened())
                time.sleep(0.05)
                continue

            # Read frame
            ret, raw = self.cap.read()
            if ret and raw is not None and raw.size > 0:
                self.is_connected = True
                with self.frame_lock:
                    self.latest_raw_frame = raw
                self.new_frame_event.set()

                # Measure capture FPS
                now = time.time()
                dt = now - last_t
                last_t = now
                if dt > 0:
                    inst_fps = 1.0 / dt
                    self.capture_fps = round(self.capture_fps * 0.85 + inst_fps * 0.15, 1)
            else:
                logger.warning(f"Frame read failure on source {self.source}. Retrying capture...")
                self.is_connected = False
                with self.frame_lock:
                    if self.cap is not None:
                        try:
                            self.cap.release()
                        except Exception:
                            pass
                        self.cap = None
                time.sleep(0.1)

    # ---------------------------------------------------------
    # WORKER 2: Decoupled AI Inference & HUD Annotation Thread
    # ---------------------------------------------------------
    def _processing_worker(self):
        last_inf_t = time.time()

        while self.is_running:
            loop_start = time.time()
            target_delay = 1.0 / max(5, self.processing_target_fps)

            # Wait for fresh frame from capture worker
            self.new_frame_event.wait(timeout=0.1)
            self.new_frame_event.clear()

            with self.frame_lock:
                frame = self.latest_raw_frame.copy() if self.latest_raw_frame is not None else None

            if frame is None:
                frame = self._generate_fallback_frame(f"SOURCE [{self.source}] CONNECTING...")
                tracks_data = []
                inf_time_ms = 0.0
            else:
                # Resize if frame dimensions differ from configured inference resolution
                h, w = frame.shape[:2]
                if w != self.inference_width or h != self.inference_height:
                    frame = cv2.resize(frame, (self.inference_width, self.inference_height))

                # Run real YOLOv8 detection & ByteTrack tracking
                tracks_data, inf_time_ms = self._run_inference_and_tracking(frame)

                # Measure Inference FPS
                now = time.time()
                dt = now - last_inf_t
                last_inf_t = now
                if dt > 0:
                    inst_infer_fps = 1.0 / dt
                    self.infer_fps = round(self.infer_fps * 0.85 + inst_infer_fps * 0.15, 1)
                    self.actual_fps = self.infer_fps

                # Dispatch to decoupled asynchronous protection queue (never blocks video)
                if settings.ENABLE_ASYNC_PROTECTION and len(tracks_data) > 0:
                    try:
                        with self.lock:
                            active_z = list(self.zones)
                        self.event_queue.put_nowait({
                            "camera_code": self.camera_code,
                            "tracks": tracks_data,
                            "zones": active_z,
                            "shape": frame.shape,
                            "frame": frame.copy()
                        })
                    except queue.Full:
                        pass  # Discard if queue is saturated to preserve real-time video

            # Render Tactical HUD
            annotated_frame = self._render_tactical_hud(frame, tracks_data, inf_time_ms)

            # Encode to JPEG buffer
            ret_enc, jpeg_buf = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
            if ret_enc:
                with self.lock:
                    self.latest_jpeg = jpeg_buf.tobytes()
                    self.latest_processed_frame = annotated_frame

            # Throttle to TARGET_INFERENCE_FPS to prevent CPU starvation
            elapsed = time.time() - loop_start
            sleep_time = max(0.001, target_delay - elapsed)
            time.sleep(sleep_time)

    # ---------------------------------------------------------
    # WORKER 3: Decoupled Asynchronous Protection Worker
    # ---------------------------------------------------------
    def _async_worker(self):
        """Processes threat events, biometrics, and DB inserts completely out-of-band."""
        while self.is_running:
            try:
                item = self.event_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            try:
                # 1. Event Engine
                from app.services.event_engine import event_engine
                event_engine.process_frame(item["camera_code"], item["tracks"], item["zones"], item["shape"])

                # 2. Async Face Recognition for Person Tracks
                for ent in item["tracks"]:
                    t_id = ent.get("track_id", -1)
                    c_name = ent.get("class_name", "")
                    if t_id >= 0 and c_name.lower() == "person":
                        self._trigger_face_scan(item["frame"], t_id, ent["box"])

            except Exception as e:
                logger.debug(f"Async protection worker error: {e}")
            finally:
                self.event_queue.task_done()

    def _run_inference_and_tracking(self, frame: np.ndarray) -> tuple[List[Dict[str, Any]], float]:
        if self.model is None:
            return [], 0.0

        t0 = time.perf_counter()
        active_tracks = []
        person_count = 0
        vehicle_count = 0

        try:
            results = self.model.track(
                frame,
                persist=True,
                tracker="bytetrack.yaml",
                conf=self.confidence_threshold,
                classes=self.target_class_ids,
                device=self.device,
                verbose=False
            )

            inf_time_ms = (time.perf_counter() - t0) * 1000.0

            if results and len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    cls_name = self.model.names.get(cls_id, f"class_{cls_id}")
                    conf = float(box.conf[0].item())
                    track_id = int(box.id[0].item()) if box.id is not None else -1
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                    if cls_name == "person":
                        person_count += 1
                    else:
                        vehicle_count += 1

                    active_tracks.append({
                        "track_id": track_id,
                        "class_name": cls_name,
                        "confidence": round(conf, 2),
                        "box": [x1, y1, x2, y2]
                    })

            self.inference_ms = round(inf_time_ms, 1)
            self.detection_counts = {
                "person": person_count,
                "vehicle": vehicle_count,
                "total": person_count + vehicle_count
            }
            self.active_tracks = active_tracks
            return active_tracks, inf_time_ms

        except Exception as e:
            logger.error(f"Inference error: {e}", exc_info=True)
            return [], 0.0

    def _trigger_face_scan(self, frame_copy: np.ndarray, track_id: int, box: List[int]):
        def _face_worker():
            try:
                from app.services.face_service import face_service
                x1, y1, x2, y2 = box
                h_f, w_f = frame_copy.shape[:2]
                pad_w = int((x2 - x1) * 0.2)
                pad_h = int((y2 - y1) * 0.2)
                crop_x1 = max(0, x1 - pad_w)
                crop_y1 = max(0, y1 - pad_h)
                crop_x2 = min(w_f, x2 + pad_w)
                crop_y2 = min(h_f, y2 + pad_h)
                crop = frame_copy[crop_y1:crop_y2, crop_x1:crop_x2]
                if crop.size > 0:
                    res = face_service.recognize_face(crop)
                    self.face_cache[track_id] = res
            except Exception as e:
                logger.debug(f"Face recognition worker error: {e}")

        threading.Thread(target=_face_worker, daemon=True).start()

    def _render_tactical_hud(self, frame: np.ndarray, tracks: List[Dict[str, Any]], inf_time: float) -> np.ndarray:
        canvas = frame.copy()
        h, w = canvas.shape[:2]

        # Draw zones if available
        with self.lock:
            current_zones = list(self.zones)
        for zone in current_zones:
            pts = zone.get("points_json", [])
            if pts and len(pts) >= 3:
                parsed_pts = []
                for p in pts:
                    if isinstance(p, dict):
                        px = float(p.get("x", 0))
                        py = float(p.get("y", 0))
                    elif isinstance(p, (list, tuple)) and len(p) >= 2:
                        px = float(p[0])
                        py = float(p[1])
                    else:
                        continue
                    # Normalize if given as percentage 0..100
                    if px > 1.0:
                        px /= 100.0
                    if py > 1.0:
                        py /= 100.0
                    parsed_pts.append([int(px * w), int(py * h)])

                if len(parsed_pts) >= 3:
                    poly_pts = np.array(parsed_pts, np.int32).reshape((-1, 1, 2))
                    cv2.polylines(canvas, [poly_pts], isClosed=True, color=(0, 165, 255), thickness=2)

        # Draw target tracking boxes
        for trk in tracks:
            x1, y1, x2, y2 = trk["box"]
            cls_name = trk["class_name"]
            track_id = trk.get("track_id", -1)
            conf = trk.get("confidence", 0.0)

            box_color = (0, 255, 128) if cls_name == "person" else (255, 180, 0)
            cv2.rectangle(canvas, (x1, y1), (x2, y2), box_color, 2)

            label = f"{cls_name.upper()} #{track_id} ({int(conf * 100)}%)" if track_id >= 0 else f"{cls_name.upper()} ({int(conf * 100)}%)"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
            cv2.rectangle(canvas, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, max(0, y1)), box_color, -1)
            cv2.putText(canvas, label, (x1 + 3, max(th + 2, y1 - 3)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 0), 1, cv2.LINE_AA)

        # Header bar
        header_bg = np.zeros((28, w, 3), dtype=np.uint8)
        header_bg[:] = (15, 11, 8)
        canvas[0:28, 0:w] = cv2.addWeighted(canvas[0:28, 0:w], 0.3, header_bg, 0.7, 0)

        status_color = (0, 255, 128) if self.is_connected else (0, 0, 255)
        cv2.circle(canvas, (14, 14), 4, status_color, -1)
        source_label = f"SOURCE [{self.source}]" if self.is_connected else "SOURCE OFFLINE"
        cv2.putText(canvas, f"TEJAS INGEST: {source_label}", (26, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (240, 240, 240), 1, cv2.LINE_AA)

        res_str = f"{w}x{h} | DEV: {self.device.upper()} | ZONES: {len(current_zones)}"
        (rw, _), _ = cv2.getTextSize(res_str, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
        cv2.putText(canvas, res_str, (w - rw - 12, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (180, 180, 180), 1, cv2.LINE_AA)

        # Footer bar
        footer_bg = np.zeros((24, w, 3), dtype=np.uint8)
        footer_bg[:] = (15, 11, 8)
        canvas[h-24:h, 0:w] = cv2.addWeighted(canvas[h-24:h, 0:w], 0.3, footer_bg, 0.7, 0)

        footer_text = f"MODEL: YOLOv8-N | TRACKER: ByteTrack | CAP: {self.capture_fps:.1f} FPS | INF: {self.infer_fps:.1f} FPS | LAT: {self.inference_ms:.1f}ms | TARGETS: {len(tracks)}"
        cv2.putText(canvas, footer_text, (12, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 215, 255), 1, cv2.LINE_AA)

        return canvas

    def get_telemetry(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "source": str(self.source),
                "is_connected": self.is_connected,
                "fps": self.capture_fps,
                "infer_fps": self.infer_fps,
                "inference_ms": self.inference_ms,
                "device": self.device,
                "model": "YOLOv8-N (Ultralytics)",
                "tracker": "ByteTrack",
                "confidence_threshold": self.confidence_threshold,
                "target_inference_fps": self.processing_target_fps,
                "counts": self.detection_counts,
                "active_tracks": self.active_tracks,
                "camera_code": self.camera_code,
                "zones": self.zones,
                "target_classes": ["person", "car", "motorcycle", "bus", "truck"]
            }

    def generate_mjpeg_stream(self):
        while self.is_running:
            with self.lock:
                jpeg = self.latest_jpeg

            if jpeg is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
                )
            time.sleep(0.033)  # ~30 FPS delivery

# Global pipeline instance
pipeline = VideoPipelineService()
