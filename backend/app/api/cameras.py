import logging
import time
from typing import List, Dict, Any, Optional
import cv2
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Camera
from app.schemas.schemas import CameraCreate, CameraUpdate, CameraResponse
from app.services.camera_manager import camera_manager
from app.services.reid_service import reid_service

logger = logging.getLogger("tejas.api.cameras")

router = APIRouter(prefix="/cameras", tags=["Cameras"])


class ProbeRequest(BaseModel):
    stream_url: str
    stream_type: str = "RTSP"  # WEBCAM, RTSP, DEMO_MP4, MP4


def probe_video_source(source_str: str, source_type: str = "RTSP") -> Dict[str, Any]:
    """Tests actual camera connection using OpenCV VideoCapture with failure isolation."""
    import os
    start = time.time()
    parsed_source: Any = source_str
    st = (source_type or "").upper()

    if st in ("WEBCAM", "LOCAL_CAM", "0", "1") or str(source_str).isdigit():
        try:
            parsed_source = int(source_str) if str(source_str).isdigit() else 0
        except Exception:
            parsed_source = 0
    else:
        # For network streams, set low 2.5s socket timeout
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;2500000"

    try:
        cap = cv2.VideoCapture(parsed_source)
        if not cap.isOpened():
            latency = round((time.time() - start) * 1000, 1)
            return {
                "status": "UNREACHABLE",
                "connected": False,
                "latency_ms": latency,
                "fps": 0.0,
                "resolution": "--",
                "message": f"Could not connect to {source_type} stream at '{source_str}'."
            }

        ret, frame = cap.read()
        latency = round((time.time() - start) * 1000, 1)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or (frame.shape[1] if ret and frame is not None else 0))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or (frame.shape[0] if ret and frame is not None else 0))
        cap.release()

        if not ret or frame is None or frame.size == 0:
            return {
                "status": "FRAME_ERROR",
                "connected": False,
                "latency_ms": latency,
                "fps": 0.0,
                "resolution": "--",
                "message": "Stream connected but failed to return a valid frame."
            }

        return {
            "status": "CONNECTED",
            "connected": True,
            "latency_ms": latency,
            "fps": round(fps, 1),
            "resolution": f"{w}x{h}",
            "codec": f"{st} / OPENCV",
            "message": f"Stream probe verified: {w}x{h} @ {round(fps, 1)} FPS ({latency}ms latency)."
        }
    except Exception as e:
        latency = round((time.time() - start) * 1000, 1)
        return {
            "status": "PROBE_EXCEPTION",
            "connected": False,
            "latency_ms": latency,
            "fps": 0.0,
            "resolution": "--",
            "message": f"Stream probe error: {str(e)}"
        }


INITIAL_CAMERAS = [
    {
        "id": "CAM-01",
        "code": "BOP-03",
        "name": "Border Outpost 03 (North Perimeter)",
        "location": "Sector A - Post 3",
        "lat": 32.7266,
        "lng": 74.8570,
        "status": "ONLINE",
        "fps": 30,
        "resolution": "1920x1080",
        "stream_type": "RTSP",
        "stream_url": "rtsp://192.168.1.101:554/ch0",
        "ai_enabled": True
    },
    {
        "id": "CAM-02",
        "code": "BORDER-RD-12",
        "name": "Patrol Road Checkpoint 12",
        "location": "Sector A - Road Access",
        "lat": 32.7289,
        "lng": 74.8612,
        "status": "ONLINE",
        "fps": 30,
        "resolution": "1920x1080",
        "stream_type": "RTSP",
        "stream_url": "rtsp://192.168.1.102:554/ch0",
        "ai_enabled": True
    },
    {
        "id": "CAM-03",
        "code": "BOP-04",
        "name": "Border Outpost 04 (Ammunition Depot)",
        "location": "Sector B - High Security",
        "lat": 32.7315,
        "lng": 74.8645,
        "status": "ONLINE",
        "fps": 28,
        "resolution": "1920x1080",
        "stream_type": "RTSP",
        "stream_url": "rtsp://192.168.1.103:554/ch0",
        "ai_enabled": True
    },
    {
        "id": "CAM-04",
        "code": "RESTRICTED-Z01",
        "name": "Restricted Zone Tactical Camera",
        "location": "Sector B - Perimeter Gate 4",
        "lat": 32.7340,
        "lng": 74.8680,
        "status": "ONLINE",
        "fps": 30,
        "resolution": "1920x1080",
        "stream_type": "RTSP",
        "stream_url": "rtsp://192.168.1.104:554/ch0",
        "ai_enabled": True
    },
    {
        "id": "CAM-05",
        "code": "GATE-01",
        "name": "Main Entry Logistics Gate",
        "location": "Sector C - Commercial Entry",
        "lat": 32.7210,
        "lng": 74.8510,
        "status": "ONLINE",
        "fps": 30,
        "resolution": "1920x1080",
        "stream_type": "RTSP",
        "stream_url": "rtsp://192.168.1.105:554/ch0",
        "ai_enabled": True
    },
    {
        "id": "CAM-06",
        "code": "WAREHOUSE-E",
        "name": "Supply Depot Yard East",
        "location": "Sector C - Logistics Depot",
        "lat": 32.7245,
        "lng": 74.8540,
        "status": "ONLINE",
        "fps": 25,
        "resolution": "1280x720",
        "stream_type": "RTSP",
        "stream_url": "rtsp://192.168.1.106:554/ch0",
        "ai_enabled": True
    }
]


@router.get("", response_model=List[CameraResponse])
def get_cameras(db: Session = Depends(get_db)):
    cams = db.query(Camera).all()
    if not cams:
        for item in INITIAL_CAMERAS:
            db_cam = Camera(**item)
            db.add(db_cam)
        db.commit()
        cams = db.query(Camera).all()
    return cams


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter((Camera.id == camera_id) | (Camera.code == camera_id)).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam


@router.post("", response_model=CameraResponse)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)):
    # Sequential ID generation
    count = db.query(Camera).count()
    cam_id = f"CAM-{count + 1:02d}"
    db_cam = Camera(id=cam_id, **payload.model_dump())
    db.add(db_cam)
    db.commit()
    db.refresh(db_cam)

    # Register into ReID topology
    reid_service.register_camera(db_cam.id)
    reid_service.register_camera(db_cam.code)

    logger.info(f"Registered new camera: {db_cam.id} ({db_cam.code}) - source={db_cam.stream_url}")
    return db_cam


@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera(camera_id: str, payload: CameraUpdate, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter((Camera.id == camera_id) | (Camera.code == camera_id)).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    update_dict = payload.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(cam, k, v)

    db.commit()
    db.refresh(cam)

    # If stream url changed and pipeline is currently running, hot-switch source
    if "stream_url" in update_dict:
        pipeline = camera_manager.get_pipeline(cam.id) or camera_manager.get_pipeline(cam.code)
        if pipeline and pipeline.is_running:
            new_src = cam.stream_url if cam.stream_type != "WEBCAM" else 0
            camera_manager.switch_source(cam.id, new_src)

    return cam


@router.delete("/{camera_id}")
def delete_camera(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter((Camera.id == camera_id) | (Camera.code == camera_id)).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Stop active pipeline if running
    camera_manager.stop_camera(cam.id)
    camera_manager.stop_camera(cam.code)

    reid_service.topology.unregister_camera(cam.id)
    reid_service.topology.unregister_camera(cam.code)

    db.delete(cam)
    db.commit()
    return {"status": "DELETED", "camera_id": camera_id}


@router.post("/probe")
def probe_arbitrary_stream(payload: ProbeRequest):
    """Tests connectivity to any stream source before creating camera."""
    return probe_video_source(payload.stream_url, payload.stream_type)


@router.post("/{camera_id}/test")
def test_camera_connection(camera_id: str, db: Session = Depends(get_db)):
    """Tests real stream connection for a registered camera."""
    cam = db.query(Camera).filter((Camera.id == camera_id) | (Camera.code == camera_id)).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    src = cam.stream_url
    if cam.stream_type == "WEBCAM" or not src:
        src = "0"

    result = probe_video_source(src, cam.stream_type)
    result["camera_code"] = cam.code
    result["camera_id"] = cam.id
    return result


@router.post("/{camera_id}/start")
def start_camera_pipeline(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter((Camera.id == camera_id) | (Camera.code == camera_id)).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    src: Any = cam.stream_url
    if cam.stream_type == "WEBCAM" or not src:
        src = 0

    pipeline = camera_manager.start_camera(cam.id, src)
    return {
        "status": "STARTED" if pipeline.is_running else "FAILED",
        "camera_id": cam.id,
        "source": str(src)
    }


@router.post("/{camera_id}/stop")
def stop_camera_pipeline(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter((Camera.id == camera_id) | (Camera.code == camera_id)).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    camera_manager.stop_camera(cam.id)
    return {"status": "STOPPED", "camera_id": cam.id}


@router.post("/{camera_id}/restart")
def restart_camera_pipeline(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter((Camera.id == camera_id) | (Camera.code == camera_id)).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    camera_manager.stop_camera(cam.id)
    time.sleep(0.5)

    src: Any = cam.stream_url
    if cam.stream_type == "WEBCAM" or not src:
        src = 0

    pipeline = camera_manager.start_camera(cam.id, src)
    return {
        "status": "RESTARTED",
        "camera_id": cam.id,
        "is_running": pipeline.is_running
    }

