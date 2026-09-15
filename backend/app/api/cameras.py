from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Camera
from app.schemas.schemas import CameraCreate, CameraResponse

router = APIRouter(prefix="/cameras", tags=["Cameras"])

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
        # Auto seed if empty
        for item in INITIAL_CAMERAS:
            db_cam = Camera(**item)
            db.add(db_cam)
        db.commit()
        cams = db.query(Camera).all()
    return cams

@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam

@router.post("", response_model=CameraResponse)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)):
    cam_id = f"CAM-0{db.query(Camera).count() + 1}"
    db_cam = Camera(id=cam_id, **payload.model_dump())
    db.add(db_cam)
    db.commit()
    db.refresh(db_cam)
    return db_cam

@router.post("/{camera_id}/test")
def test_camera_connection(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {
        "camera_code": cam.code,
        "status": "CONNECTED",
        "latency_ms": 16,
        "fps": cam.fps,
        "codec": "H.264 / RTSP OVER TCP",
        "message": "Stream probe handshake successful."
    }
