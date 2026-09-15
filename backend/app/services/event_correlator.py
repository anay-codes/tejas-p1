import datetime
from typing import Dict, Any, List
from app.services.threat_engine import evaluate_threat

class EventCorrelator:
    def __init__(self):
        self.active_tracks = {}

    def correlate_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        entity_id = event_data.get("entity_id", "UNKNOWN")
        camera_id = event_data.get("camera_id", "CAM-01")
        event_type = event_data.get("event_type", "perimeter_detection")
        timestamp = event_data.get("timestamp", datetime.datetime.utcnow().strftime("%H:%M:%S"))

        if entity_id not in self.active_tracks:
            self.active_tracks[entity_id] = {
                "factors": ["rule_unverified_identity"],
                "cameras": [camera_id],
                "timeline": []
            }

        track = self.active_tracks[entity_id]
        if camera_id not in track["cameras"]:
            track["cameras"].append(camera_id)

        # Map event types to threat factors
        if "restricted" in event_type.lower() or "breach" in event_type.lower():
            if "rule_restricted_intrusion" not in track["factors"]:
                track["factors"].append("rule_restricted_intrusion")
        if "night" in event_type.lower():
            if "rule_night_movement" not in track["factors"]:
                track["factors"].append("rule_night_movement")
        if "loiter" in event_type.lower():
            if "rule_loitering" not in track["factors"]:
                track["factors"].append("rule_loitering")
        if "sensitive" in event_type.lower() or "direction" in event_type.lower():
            if "rule_movement_sensitive" not in track["factors"]:
                track["factors"].append("rule_movement_sensitive")
        if "watchlist" in event_type.lower():
            if "rule_watchlist_vehicle" not in track["factors"]:
                track["factors"].append("rule_watchlist_vehicle")

        track["timeline"].append({
            "time": timestamp,
            "camera": camera_id,
            "event": f"Observation: {event_type.replace('_', ' ').title()}"
        })

        # Calculate updated threat assessment
        assessment = evaluate_threat(track["factors"])

        return {
            "entity_id": entity_id,
            "threat_score": assessment["score"],
            "severity": assessment["severity"],
            "factors": assessment["breakdown"],
            "timeline": track["timeline"],
            "cameras_involved": track["cameras"]
        }

correlator = EventCorrelator()
