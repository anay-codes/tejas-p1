import datetime
import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Event, Alert, Incident
from app.schemas.schemas import EventCreate, EventResponse
from app.services.event_correlator import correlator
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/events", tags=["Events"])

@router.get("", response_model=List[EventResponse])
def get_events(limit: int = 50, db: Session = Depends(get_db)):
    events = db.query(Event).order_by(Event.created_at.desc()).limit(limit).all()
    return events

@router.post("", response_model=EventResponse)
async def ingest_event(payload: EventCreate, db: Session = Depends(get_db)):
    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    ts = datetime.datetime.utcnow().strftime("%H:%M:%S")

    db_event = Event(
        id=event_id,
        event_type=payload.event_type,
        camera_id=payload.camera_id,
        entity_id=payload.entity_id,
        timestamp=ts,
        confidence=payload.confidence,
        location=payload.location,
        metadata_json=payload.metadata_json
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    # Correlate event into incident threat score
    correlated = correlator.correlate_event({
        "event_type": payload.event_type,
        "camera_id": payload.camera_id,
        "entity_id": payload.entity_id,
        "timestamp": ts,
        "confidence": payload.confidence
    })

    # If threat score is high or critical, generate alert
    if correlated["threat_score"] >= 60:
        alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
        alert_msg = f"{payload.event_type.replace('_', ' ').title()} on {payload.camera_id} for {payload.entity_id}"
        db_alert = Alert(
            id=alert_id,
            camera=payload.camera_id,
            title=f"Elevated Risk: {payload.entity_id}",
            severity=correlated["severity"],
            threat_score=correlated["threat_score"],
            message=alert_msg,
            timestamp=ts
        )
        db.add(db_alert)
        db.commit()

    # Broadcast live update to all WebSocket clients
    await manager.broadcast({
        "type": "CORRELATED_EVENT",
        "event": {
            "id": db_event.id,
            "event_type": db_event.event_type,
            "camera_id": db_event.camera_id,
            "entity_id": db_event.entity_id,
            "timestamp": db_event.timestamp,
            "confidence": db_event.confidence
        },
        "correlation": correlated
    })

    return db_event
