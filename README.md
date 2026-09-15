# TEJAS — Threat Evaluation & Joint AI Surveillance

> **Tagline:** *From CCTV to Border Intelligence*  
> **Smart India Hackathon (SIH) — Autonomous AI Surveillance & Tactical Threat Intelligence Platform**

---

## 1. Executive Summary

**TEJAS** is an AI-driven, software-defined surveillance platform that transforms existing IP-based CCTV infrastructure into an intelligent border and perimeter surveillance network. 

Rather than functioning as an isolated collection of disconnected object detectors, TEJAS correlates observations across multiple sensor nodes into a unified **Contextual Threat Evaluation Engine** with mathematical explainability.

```
                  EXISTING CCTV INFRASTRUCTURE
                               │
                         RTSP / VIDEO
                               │
                               ▼
                        VIDEO INGESTION
                               │
                               ▼
                      AI INFERENCE ENGINE
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
          PERSON            VEHICLE              FACE
        DETECTION          DETECTION          DETECTION
            │                  │                  │
            ▼                  ▼                  ▼
         TRACKING             ANPR           RECOGNITION
      (ByteTrack / Re-ID)      │
            │                  ▼
            │          PLATE RESTORATION
            │           (Super-Res GAN)
            │                  │
            │                  ▼
            │                 OCR
            │
            └──────────────────┬──────────────────┘
                               ▼
                          EVENT ENGINE
                               │
                               ▼
                       EVENT CORRELATION
                               │
                               ▼
                    THREAT EVALUATION ENGINE
                        (0 - 100 Score)
                               │
                               ▼
                          ALERT ENGINE
                               │
                     ┌─────────┴─────────┐
                     ▼                   ▼
             FASTAPI REST API       WebSockets
                     │                   │
                     └─────────┬─────────┘
                               ▼
                   TEJAS TACTICAL COMMAND UI
```

---

## 2. Core Innovation: The Threat Evaluation Engine

Traditional surveillance systems flood security operators with false positives by alerting on every isolated detection. TEJAS solves this by **correlating multi-camera events into incidents** and generating a unified, explainable threat score from **0 to 100**:

```
Person detected on Outer Berm
        ↓
Cross-Camera Handoff confirmed
        ↓
Night-Time Curfew Movement (+15)
        ↓
Loitering Detected near Depot (+15)
        ↓
Kinematic Vector toward Sensitive Bunker (+20)
        ↓
Virtual Polygon Fence Intrusion (+30)
        ↓
Unknown Identity (+2)
        ↓
--------------------------------------------------
THREAT EVALUATION: 82 / 100  [HIGH RISK / CRITICAL]
        ↓
REAL-TIME OPERATOR DISPATCH ALERT
```

### Threat Scoring Weights (Configurable)
| Factor | Default Delta | Category | Description |
|---|---|---|---|
| **Restricted-Zone Intrusion** | `+30` | Spatial | Crossing virtual polygonal fence lines |
| **Movement Toward Sensitive Zone** | `+20` | Kinematic | Trajectory vector points continuously toward sensitive depot |
| **Watchlist Vehicle Detected** | `+40` | Intelligence | ANPR match against high-priority law enforcement database |
| **Night-Time Movement** | `+15` | Temporal | Movement logged during designated blackout hours (21:00 - 05:00) |
| **Loitering Detection** | `+15` | Behavioral | Stationary dwell time exceeding threshold (120s) without transit |
| **Unknown / Unverified Identity** | `+10` | Identity | Biometric signature not verified against authorized registry |
| **Authorized Personnel Verification** | `-30` | Override | Valid friendly RFID / facial credential override |

> **Ethical Note:** Threat scores quantify situational event risk and operational priority, not subjective human intent.

---

## 3. Technology Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, Recharts, Leaflet
- **Backend:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy, WebSockets, JWT Authentication
- **Database:** PostgreSQL (with automatic zero-config SQLite fallback for local developer setups)
- **Computer Vision & Tracking:** YOLOv8, ByteTrack, OpenCV, NumPy, Pillow
- **ANPR Super-Resolution:** Neural deblurring filter, 4x bicubic super-resolution, CLAHE contrast enhancement, PaddleOCR
- **Orchestration:** Docker, Docker Compose

---

## 4. Key Features & Interfaces

| Route | Interface | Description |
|---|---|---|
| `/dashboard` | **Tactical Command Center** | 4-grid CCTV centerpiece with live bounding boxes, real-time explainable Threat HUD, live alert stream, event timeline, and perimeter map. |
| `/anpr` | **ANPR & Super-Resolution** | Interactive testbench comparing raw degraded license plates vs AI-enhanced plates with verifiable OCR confidence gains. |
| `/tracking` | **Multi-Camera Tracking** | Cross-camera entity re-identification displaying sequential transit handoffs (`BOP-03` → `BORDER-RD-12` → `BOP-04` → `RESTRICTED-Z01`). |
| `/zones` | **Virtual Fence Manager** | Interactive polygonal boundary editor with custom threat weights and camera associations. |
| `/incidents` | **Incident Investigation** | Correlated dossiers with visual evidence snapshots, audit trails, and operator workflow actions (*Acknowledge, Investigate, Resolve, Escalate*). |
| `/analytics` | **Surveillance Analytics** | Diurnal risk graphs, peak night activity windows, and perimeter hotspot rankings powered by Recharts. |
| `/cameras` | **Camera Ingestion Hub** | RTSP stream registration, latency ping tests, and telemetry monitoring. |
| `/watchlist` | **Security Watchlist** | Registry of high-priority vehicles and suspects with automated ANPR matching. |
| `/settings` | **Threat Engine Calibration** | Dynamic sliders to reweight threat factors with instant real-time simulation updates. |

---

## 5. Running the Application Locally

### Prerequisites
- Node.js LTS (v20+ or v24)
- Python 3.11+

### Step 1: Start the Frontend (Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend will be running live at:* **`http://localhost:5173`**

### Step 2: Start the Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python run.py

# On Linux/macOS:
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```
*Backend API and Swagger Docs will be available at:* **`http://localhost:8000/docs`**

---

## 6. Docker Deployment

Deploy the entire stack (PostgreSQL + FastAPI + Vite) in one command:
```bash
docker-compose up --build
```

---

## 7. SIH 2-Minute Demonstration Script

1. **Dashboard Overview:** Open `http://localhost:5173`. Point out the 4-grid live CCTV centerpiece with simulated bounding boxes, tracking vectors, and the operational HUD (`ALL SYSTEMS OPERATIONAL`).
2. **Observe Threat Escalation:** Watch as the simulated scenario progresses:
   - Person detected on `BOP-03`
   - Transit across `BORDER-RD-12` during night hours
   - Loitering near `BOP-04`
   - Direct advance into `RESTRICTED-Z01` virtual fence
   - Threat score surges to **82 / 100 (HIGH RISK)** with real-time mathematical factor explainability.
3. **ANPR & Super-Resolution (`/anpr`):** Switch between degraded raw ingest vs AI-restored plate. Show the verifiable OCR confidence jump from **32% to 94%**, triggering the critical watchlist alert for plate `MP09AB1234`.
4. **Multi-Camera Re-ID (`/tracking`):** Show the continuous sequential timeline of Person #27 transitioning between 4 non-overlapping CCTV camera nodes.
5. **Incident Action (`/incidents`):** Click the critical alert, open the incident dossier, review the chain of evidence, and demonstrate operator workflow (*Investigate* / *Mark Resolved*).
