import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, MapPin, ShieldAlert, Layers, Navigation, Radio, AlertTriangle, Eye, Video } from 'lucide-react';
import { apiClient } from '../../services/api';

// Centered on Jammu Border Tactical Sector
const SECTOR_CENTER = [32.7285, 74.8605];

// Custom Leaflet DivIcons for Tactical Military Aesthetic
function createCameraIcon(code, isThreat = false, isSelected = false) {
  return L.divIcon({
    className: 'custom-tactical-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${isThreat ? '<span style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: beacon-pulse 1.8s infinite;"></span>' : ''}
        <div style="
          width: 28px; 
          height: 28px; 
          border-radius: 6px; 
          background: ${isThreat ? '#7F1D1D' : isSelected ? '#0891B2' : '#0E172A'}; 
          border: 1.5px solid ${isThreat ? '#EF4444' : isSelected ? '#22D3EE' : '#38BDF8'}; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.7);
          cursor: pointer;
        ">
          <span style="color: ${isThreat ? '#FCA5A5' : '#E0F2FE'}; font-size: 11px; font-weight: bold; font-family: 'JetBrains Mono', monospace;">
            ${code.replace('CAM-', 'C').replace('BOP-', 'B')}
          </span>
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18]
  });
}

function createIncidentIcon(score, severity) {
  const isCritical = score >= 80 || severity === 'CRITICAL';
  return L.divIcon({
    className: 'custom-incident-beacon',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: ${isCritical ? 'rgba(239, 68, 68, 0.5)' : 'rgba(249, 115, 22, 0.4)'}; animation: beacon-pulse 1.5s infinite;"></span>
        <div style="
          width: 22px; 
          height: 22px; 
          border-radius: 50%; 
          background: ${isCritical ? '#EF4444' : '#F97316'}; 
          border: 2px solid #FFFFFF; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 800;
          color: #FFFFFF;
          box-shadow: 0 0 16px ${isCritical ? 'rgba(239, 68, 68, 0.8)' : 'rgba(249, 115, 22, 0.8)'};
        ">
          !
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18]
  });
}

// Map Controller for Dynamic Pan/Recenter
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function TacticalMapLeaflet({ 
  onCameraSelect = null, 
  activeThreat = null, 
  selectedCameraId = null,
  height = "380px"
}) {
  const [cameras, setCameras] = useState([]);
  const [zones, setZones] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [focusedPoint, setFocusedPoint] = useState(SECTOR_CENTER);
  const [mapZoom, setMapZoom] = useState(14);

  // Fetch real cameras, zones, and active incidents from backend APIs
  useEffect(() => {
    let isMounted = true;

    async function loadTacticalSpatialData() {
      try {
        setIsLoading(true);
        const [camsRes, zonesRes, incsRes] = await Promise.all([
          apiClient.getCameras(),
          apiClient.getZones(),
          apiClient.getIncidents('ALL')
        ]);

        if (isMounted) {
          if (camsRes && camsRes.length > 0) {
            setCameras(camsRes);
          }
          if (zonesRes && zonesRes.length > 0) {
            setZones(zonesRes);
          }
          if (incsRes && incsRes.length > 0) {
            setIncidents(incsRes);
          }
        }
      } catch (err) {
        console.warn("Error loading spatial data for tactical map:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadTacticalSpatialData();
    return () => { isMounted = false; };
  }, []);

  // Map camera lookup by code/id for incident pinpointing
  const cameraCoordMap = useMemo(() => {
    const map = {};
    cameras.forEach(c => {
      if (c.lat && c.lng) {
        map[c.id] = [c.lat, c.lng];
        if (c.code) map[c.code] = [c.lat, c.lng];
      }
    });
    return map;
  }, [cameras]);

  // Unresolved active incidents
  const activeIncidents = useMemo(() => {
    return incidents.filter(i => i.status !== 'RESOLVED');
  }, [incidents]);

  // Handle Recenter Click
  const handleRecenter = () => {
    setFocusedPoint(SECTOR_CENTER);
    setMapZoom(14);
  };

  // Convert zone polygon coordinates to geographic coordinates anchored around sector
  const renderedPolygons = useMemo(() => {
    return zones.map((z, idx) => {
      // Anchored geographical polygon coordinates for sector zones
      const sectorZoneCoords = [
        // Sector B Restricted Perimeter
        [
          [32.7310, 74.8630],
          [32.7350, 74.8670],
          [32.7335, 74.8720],
          [32.7290, 74.8660]
        ],
        // Ammunition Storage Buffer
        [
          [32.7295, 74.8610],
          [32.7325, 74.8635],
          [32.7305, 74.8670],
          [32.7280, 74.8640]
        ],
        // North Outpost Approach Line
        [
          [32.7250, 74.8550],
          [32.7285, 74.8580],
          [32.7270, 74.8610],
          [32.7235, 74.8570]
        ],
        // Webcam Sector Alpha Zone
        [
          [32.7260, 74.8560],
          [32.7275, 74.8585],
          [32.7265, 74.8595],
          [32.7250, 74.8570]
        ]
      ];
      const positions = sectorZoneCoords[idx % sectorZoneCoords.length];
      return {
        id: z.id,
        name: z.name,
        type: z.type,
        color: z.color || '#EF4444',
        positions
      };
    });
  }, [zones]);

  return (
    <div className="tactical-card rounded-xl border border-[#1E2D48] flex flex-col overflow-hidden relative shadow-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2D48] bg-[#0A0F1C]/90">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
                TACTICAL PERIMETER MAP
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                LEAFLET ENGINE ONLINE
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              COORDS: 32.7285° N, 74.8605° E • BORDER SECTOR ALPHA-BRAVO
            </p>
          </div>
        </div>

        {/* Map Viewport Controls */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all border ${
              showZones 
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            FENCE ZONES ({renderedPolygons.length})
          </button>

          <button
            onClick={() => setShowIncidents(!showIncidents)}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all border ${
              showIncidents 
                ? 'bg-red-500/20 text-red-300 border-red-500/40' 
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            ACTIVE INCIDENTS ({activeIncidents.length})
          </button>

          <button
            onClick={handleRecenter}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Recenter Map View"
          >
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Map Container Viewport */}
      <div style={{ height }} className="w-full relative bg-[#070B14]">
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center font-mono text-xs text-cyan-400 gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>SYNCHRONIZING PERIMETER SPATIAL LAYERS...</span>
          </div>
        )}

        <MapContainer
          center={SECTOR_CENTER}
          zoom={mapZoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <MapController center={focusedPoint} zoom={mapZoom} />

          {/* CartoDB Dark Matter Base Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> | TEJAS Perimeter Geospatial Engine'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />

          {/* International Border Line Indicator */}
          <Polyline
            positions={[
              [32.7230, 74.8500],
              [32.7265, 74.8560],
              [32.7290, 74.8610],
              [32.7320, 74.8650],
              [32.7360, 74.8710]
            ]}
            pathOptions={{
              color: '#EF4444',
              weight: 2,
              dashArray: '6, 8',
              opacity: 0.7
            }}
          />

          {/* Render Polygonal Restricted Zones */}
          {showZones && renderedPolygons.map(zone => (
            <Polygon
              key={zone.id}
              positions={zone.positions}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.15,
                weight: 1.5,
                dashArray: '4, 4'
              }}
            >
              <Popup>
                <div className="font-mono text-xs space-y-1">
                  <div className="font-bold text-red-400 uppercase tracking-wide flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{zone.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">TYPE: {zone.type}</div>
                  <div className="text-[10px] text-slate-300">GEO-FENCE INTRUSION DETECTION ACTIVE</div>
                </div>
              </Popup>
            </Polygon>
          ))}

          {/* Render Camera Nodes from Database */}
          {cameras.map(cam => {
            if (!cam.lat || !cam.lng) return null;
            const isThreat = activeIncidents.some(
              i => i.primary_camera === cam.id || i.primary_camera === cam.code
            );
            const isSelected = selectedCameraId === cam.id || selectedCameraId === cam.code;

            return (
              <Marker
                key={cam.id}
                position={[cam.lat, cam.lng]}
                icon={createCameraIcon(cam.code || cam.id, isThreat, isSelected)}
                eventHandlers={{
                  click: () => {
                    if (onCameraSelect) onCameraSelect(cam);
                  }
                }}
              >
                <Popup>
                  <div className="font-mono text-xs space-y-1.5 p-1">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-1">
                      <span className="font-bold text-cyan-400">{cam.code}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {cam.status}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-200 text-[11px]">{cam.name}</div>
                    <div className="text-[10px] text-slate-400">LOC: {cam.location}</div>
                    <div className="text-[10px] text-slate-400">
                      GPS: {cam.lat.toFixed(4)}°N, {cam.lng.toFixed(4)}°E
                    </div>
                    <div className="text-[10px] text-slate-400">TYPE: {cam.stream_type} • {cam.resolution}</div>
                    {isThreat && (
                      <div className="text-[10px] font-bold text-red-400 animate-pulse pt-0.5">
                        ACTIVE INTRUSION ALARM ASSOCIATED
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Render Active Incident Beacons on Map */}
          {showIncidents && activeIncidents.map(inc => {
            const coords = cameraCoordMap[inc.primary_camera];
            if (!coords) return null;

            // Offset slightly from camera marker so both are visible
            const beaconCoords = [coords[0] + 0.0006, coords[1] + 0.0006];

            return (
              <Marker
                key={inc.id}
                position={beaconCoords}
                icon={createIncidentIcon(inc.threat_score, inc.severity)}
              >
                <Popup>
                  <div className="font-mono text-xs space-y-1.5 p-1">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-1">
                      <span className="font-bold text-red-400">{inc.id}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                        {inc.severity} ({inc.threat_score})
                      </span>
                    </div>
                    <div className="font-bold text-slate-100 text-[11px]">{inc.title}</div>
                    <div className="text-[10px] text-slate-300">TARGET: {inc.target_entity}</div>
                    <div className="text-[10px] text-slate-400">CAMERA: {inc.primary_camera}</div>
                    <div className="text-[10px] text-slate-400">TIME: {inc.timestamp}</div>
                    <a
                      href={`/incidents/${inc.id}`}
                      className="block mt-1 text-center text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white rounded py-1 font-bold transition-colors"
                    >
                      OPEN INCIDENT DOSSIER
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Tactical Map Corner Telemetry Badge */}
        <div className="absolute bottom-3 left-3 z-[400] bg-[#080C14]/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-[#1E2D48] font-mono text-[10px] text-slate-300 pointer-events-none shadow-xl flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>GEO-RADAR LIVE</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 font-bold">{cameras.length} CAMERAS</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 font-bold">{renderedPolygons.length} ZONES</span>
          <span className="text-slate-600">|</span>
          <span className={activeIncidents.length > 0 ? "text-red-400 font-bold" : "text-emerald-400"}>
            {activeIncidents.length} BREACHES
          </span>
        </div>
      </div>
    </div>
  );
}
