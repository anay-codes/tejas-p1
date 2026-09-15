from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Alert
from app.schemas.schemas import AlertResponse

router = APIRouter(prefix="/alerts", tags=["Alerts"])

INITIAL_ALERTS = [
    {
        "id": "ALT-001",
        "camera": "RESTRICTED-Z01",
        "title": "CRITICAL: Virtual Fence Intrusion",
        "severity": "CRITICAL",
        "threat_score": 82,
        "message": "Person #27 breached polygonal restricted boundary. Quick response dispatched.",
        "timestamp": "10:27:09",
        "acknowledged": False
    },
    {
        "id": "ALT-002",
        "camera": "BORDER-RD-12",
        "title": "Watchlist Vehicle Detected",
        "severity": "HIGH",
        "threat_score": 75,
        "message": "ANPR plate match: MP09AB1234 on Black Scorpio SUV.",
        "timestamp": "10:14:22",
        "acknowledged": False
    }
]

@router.get("", response_model=List[AlertResponse])
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).all()
    if not alerts:
        for item in INITIAL_ALERTS:
            db.add(Alert(**item))
        db.commit()
        alerts = db.query(Alert).all()
    return alerts

@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    return {"status": "ACKNOWLEDGED", "id": alert_id}
