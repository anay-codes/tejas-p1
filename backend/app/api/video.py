from typing import Optional, Any, Dict, List
from fastapi import APIRouter, Response, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.services.video_pipeline import pipeline
from app.services.video_source import VideoSource

router = APIRouter(prefix="/video", tags=["Video Pipeline & Live Streams"])

class VideoConfigRequest(BaseModel):
    confidence: Optional[float] = Field(None, ge=0.1, le=0.95, description="Detection confidence threshold")
    source: Optional[Any] = Field(None, description="Camera index (0) or RTSP / video path")
    processing_fps: Optional[int] = Field(None, ge=5, le=30, description="Target processing FPS")

class VideoTestRequest(BaseModel):
    source: Any = Field(..., description="Camera device index (e.g. 0, 1), RTSP URL, or video file path")

class VideoSwitchRequest(BaseModel):
    source: Any = Field(..., description="Verified camera source to switch active ingestion to")

@router.get("/feed")
def get_live_video_feed():
    """
    Real-time MJPEG live stream endpoint.
    Streams annotated frames with YOLOv8 detection boxes and ByteTrack IDs.
    """
    if not pipeline.is_running:
        pipeline.start()
    return StreamingResponse(
        pipeline.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/telemetry")
def get_video_telemetry():
    """
    Returns real-time inference telemetry: FPS, inference time, detected counts,
    and active tracking objects with stable track IDs.
    """
    return pipeline.get_telemetry()

@router.get("/status")
def get_video_status():
    """
    Returns the hardware and connection status of the active video pipeline.
    """
    return {
        "status": "OPERATIONAL" if pipeline.is_connected else "OFFLINE",
        "is_running": pipeline.is_running,
        "is_connected": pipeline.is_connected,
        "source": str(pipeline.source),
        "device": pipeline.device,
        "model": pipeline.model_name,
        "actual_fps": pipeline.actual_fps,
        "infer_fps": pipeline.infer_fps,
        "capture_fps": pipeline.capture_fps,
        "inference_ms": pipeline.inference_ms
    }

@router.get("/discover")
def discover_camera_sources() -> List[Dict[str, Any]]:
    """
    Discovers available local camera hardware devices (indices 0..3) with resolutions
    and active illumination status without disrupting the running pipeline.
    """
    return VideoSource.probe_local_cameras(
        max_indices=4,
        active_source=pipeline.source if pipeline.is_running else None,
        active_telemetry=pipeline.get_telemetry() if pipeline.is_running else None
    )

@router.post("/test")
def test_camera_source(payload: VideoTestRequest) -> Dict[str, Any]:
    """
    Safely tests any camera source (Webcam index, RTSP URL, or MP4) before switching.
    Does NOT affect the currently running video stream.
    """
    src = payload.source
    if isinstance(src, str) and src.isdigit():
        src = int(src)
    return VideoSource.test_source(
        src, 
        timeout_seconds=3.0,
        active_source=pipeline.source if pipeline.is_running else None,
        active_telemetry=pipeline.get_telemetry() if pipeline.is_running else None
    )

@router.post("/switch")
def switch_camera_source(payload: VideoSwitchRequest) -> Dict[str, Any]:
    """
    Safely switches the active video pipeline to a new camera source.
    Pre-verifies the candidate first; if it fails, the previous working stream stays active.
    """
    src = payload.source
    if isinstance(src, str) and src.isdigit():
        src = int(src)

    if not pipeline.is_running:
        pipeline.start()

    res = pipeline.switch_source(src)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to switch camera source"))
    return res

@router.post("/config")
def update_video_config(payload: VideoConfigRequest):
    """
    Dynamically adjusts video pipeline parameters (confidence, processing FPS, source).
    """
    src = payload.source
    if src is not None and isinstance(src, str) and src.isdigit():
        src = int(src)

    pipeline.set_config(
        confidence=payload.confidence,
        source=src,
        processing_fps=payload.processing_fps
    )
    return {
        "message": "Configuration updated successfully",
        "telemetry": pipeline.get_telemetry()
    }

@router.post("/start")
def start_video_pipeline():
    if not pipeline.is_running:
        pipeline.start()
    return {"message": "Video pipeline started", "status": "RUNNING"}

@router.post("/stop")
def stop_video_pipeline():
    if pipeline.is_running:
        pipeline.stop()
    return {"message": "Video pipeline stopped", "status": "STOPPED"}
