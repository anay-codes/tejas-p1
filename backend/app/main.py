from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, run_sqlite_migrations
from contextlib import asynccontextmanager
from app.api import auth, cameras, events, incidents, alerts, anpr, zones, watchlist, threat_rules, analytics, video, tracking, face
from app.services.video_pipeline import pipeline
from app.services.face_service import face_service
from app.websocket.connection_manager import manager

# Create all database tables and apply migrations
Base.metadata.create_all(bind=engine)
run_sqlite_migrations()

def seed_initial_hardware_data():
    from app.database import SessionLocal
    from app.models.models import Camera, Zone
    db = SessionLocal()
    try:
        # 1. Ensure CAM-00 exists
        webcam = db.query(Camera).filter(Camera.code == "CAM-00").first()
        if not webcam:
            webcam = Camera(
                id="CAM-00",
                code="CAM-00",
                name="Primary Laptop Webcam",
                location="Tactical Command Console",
                lat=32.7266,
                lng=74.8570,
                status="ONLINE",
                fps=15,
                resolution="640x480",
                stream_type="HARDWARE",
                stream_url="0",
                ai_enabled=True
            )
            db.add(webcam)

        # 2. Ensure default calibrated virtual fence zone exists for CAM-00
        default_zone = db.query(Zone).filter(Zone.camera_code == "CAM-00").first()
        if not default_zone:
            default_zone = Zone(
                id="ZONE-00",
                name="Webcam Sector Alpha Restricted Zone",
                type="RESTRICTED",
                color="#EF4444",
                camera_code="CAM-00",
                threat_weight=30,
                points_json=[
                    {"x": 15, "y": 20},
                    {"x": 85, "y": 20},
                    {"x": 85, "y": 85},
                    {"x": 15, "y": 85}
                ],
                rule_triggers=["Perimeter Intrusion", "Loitering > 10s"]
            )
            db.add(default_zone)

        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    # Store event loop on connection manager for thread-safe WebSocket broadcasts
    manager.set_loop(asyncio.get_running_loop())
    seed_initial_hardware_data()
    pipeline.reload_zones()
    from app.database import SessionLocal
    init_db = SessionLocal()
    try:
        face_service.reload_enrolled_faces(init_db)
    finally:
        init_db.close()
    yield
    pipeline.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Threat Evaluation & Joint AI Surveillance API Platform",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(cameras.router, prefix=settings.API_V1_STR)
app.include_router(video.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)
app.include_router(incidents.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(anpr.router, prefix=settings.API_V1_STR)
app.include_router(zones.router, prefix=settings.API_V1_STR)
app.include_router(watchlist.router, prefix=settings.API_V1_STR)
app.include_router(threat_rules.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(tracking.router, prefix=settings.API_V1_STR)
app.include_router(face.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "platform": "TEJAS",
        "tagline": "From CCTV to Border Intelligence",
        "version": settings.VERSION,
        "status": "OPERATIONAL",
        "docs_url": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "TEJAS Surveillance Core",
        "version": settings.VERSION
    }

@app.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or process incoming client commands
            await websocket.send_json({"type": "ACK", "payload": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
