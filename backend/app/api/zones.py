from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Zone
from app.schemas.schemas import ZoneCreate, ZoneResponse

router = APIRouter(prefix="/zones", tags=["Zones"])

INITIAL_ZONES = [
    {
        "id": "ZONE-01",
        "name": "Sector B Restricted Perimeter",
        "type": "RESTRICTED",
        "color": "#EF4444",
        "camera_code": "RESTRICTED-Z01",
        "threat_weight": 30,
        "points_json": [{"x": 15, "y": 35}, {"x": 85, "y": 30}, {"x": 90, "y": 85}, {"x": 10, "y": 85}],
        "rule_triggers": ["Intrusion", "Loitering > 60s"]
    },
    {
        "id": "ZONE-02",
        "name": "Ammunition Storage Buffer",
        "type": "SENSITIVE",
        "color": "#F59E0B",
        "camera_code": "BOP-04",
        "threat_weight": 20,
        "points_json": [{"x": 30, "y": 25}, {"x": 80, "y": 25}, {"x": 80, "y": 75}, {"x": 30, "y": 75}],
        "rule_triggers": ["Directional Vector", "Unattended Object"]
    },
    {
        "id": "ZONE-03",
        "name": "North Outpost Approach Line",
        "type": "BORDER",
        "color": "#06B6D4",
        "camera_code": "BOP-03",
        "threat_weight": 15,
        "points_json": [{"x": 5, "y": 60}, {"x": 95, "y": 55}, {"x": 95, "y": 95}, {"x": 5, "y": 95}],
        "rule_triggers": ["Night Motion", "Human Entry"]
    }
]

@router.get("", response_model=List[ZoneResponse])
def get_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    if not zones:
        for item in INITIAL_ZONES:
            db.add(Zone(**item))
        db.commit()
        zones = db.query(Zone).all()
    return zones

@router.post("", response_model=ZoneResponse)
def create_zone(payload: ZoneCreate, db: Session = Depends(get_db)):
    zone_id = f"ZONE-{uuid.uuid4().hex[:6].upper()}"
    db_zone = Zone(id=zone_id, **payload.model_dump())
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    try:
        from app.services.video_pipeline import pipeline
        pipeline.reload_zones()
    except Exception:
        pass
    return db_zone

@router.delete("/{zone_id}")
def delete_zone(zone_id: str, db: Session = Depends(get_db)):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    db.delete(zone)
    db.commit()
    try:
        from app.services.video_pipeline import pipeline
        pipeline.reload_zones()
    except Exception:
        pass
    return {"status": "DELETED", "id": zone_id}

