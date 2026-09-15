import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit3, Shield, AlertTriangle, Layers, Save, Video } from 'lucide-react';
import { VIRTUAL_ZONES, CAMERAS } from '../data/mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function Zones() {
  const [zones, setZones] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState('CAM-00');
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneType, setNewZoneType] = useState('RESTRICTED');
  const [newZoneWeight, setNewZoneWeight] = useState(30);
  const [isSaving, setIsSaving] = useState(false);

  const fetchZonesAndCameras = async () => {
    try {
      const [zRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/zones`),
        fetch(`${API_BASE}/cameras`)
      ]);

      let loadedZones = [];
      if (zRes.ok) {
        const raw = await zRes.json();
        loadedZones = raw.map(z => ({
          id: z.id,
          name: z.name,
          type: z.type,
          color: z.color || '#EF4444',
          cameraCode: z.camera_code || 'CAM-00',
          threatWeight: z.threat_weight || 30,
          points: z.points_json || [
            { x: 15, y: 25 },
            { x: 85, y: 25 },
            { x: 85, y: 85 },
            { x: 15, y: 85 }
          ],
          ruleTriggers: z.rule_triggers || ["Intrusion"]
        }));
      }

      if (loadedZones.length === 0) {
        loadedZones = VIRTUAL_ZONES;
      }
      setZones(loadedZones);
      if (loadedZones.length > 0) {
        setSelectedZone(loadedZones[0]);
      }

      let loadedCameras = [];
      if (cRes.ok) {
        loadedCameras = await cRes.json();
      }
      // Ensure CAM-00 is in the camera list
      const hasWebcam = loadedCameras.some(c => c.code === 'CAM-00');
      if (!hasWebcam) {
        loadedCameras = [
          { id: 'CAM-00', code: 'CAM-00', name: 'Primary Laptop Webcam' },
          ...loadedCameras
        ];
      }
      setCameras(loadedCameras.length > 0 ? loadedCameras : CAMERAS);
    } catch (err) {
      console.warn("Failed to fetch zones from backend, using fallback:", err);
      setZones(VIRTUAL_ZONES);
      setSelectedZone(VIRTUAL_ZONES[0]);
      setCameras(CAMERAS);
    }
  };

  useEffect(() => {
    fetchZonesAndCameras();
  }, []);

  const handleAddZone = async (e) => {
    e.preventDefault();
    if (!newZoneName) return;

    const colors = {
      RESTRICTED: '#EF4444',
      SENSITIVE: '#F59E0B',
      BORDER: '#06B6D4',
      ENTRY: '#10B981',
      EXIT: '#3B82F6',
      CUSTOM: '#8B5CF6'
    };

    const zonePayload = {
      name: newZoneName,
      type: newZoneType,
      color: colors[newZoneType] || '#EF4444',
      camera_code: selectedCamera,
      threat_weight: Number(newZoneWeight),
      points_json: [
        { x: 20, y: 20 },
        { x: 80, y: 20 },
        { x: 80, y: 80 },
        { x: 20, y: 80 }
      ],
      rule_triggers: ["Virtual Fence Intrusion"]
    };

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zonePayload)
      });

      if (res.ok) {
        const created = await res.json();
        const mapped = {
          id: created.id,
          name: created.name,
          type: created.type,
          color: created.color,
          cameraCode: created.camera_code,
          threatWeight: created.threat_weight,
          points: created.points_json,
          ruleTriggers: created.rule_triggers
        };
        setZones(prev => [...prev, mapped]);
        setSelectedZone(mapped);
      }
    } catch (err) {
      console.error("Error creating zone:", err);
    } finally {
      setIsSaving(false);
      setIsAddingZone(false);
      setNewZoneName('');
    }
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      await fetch(`${API_BASE}/zones/${zoneId}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Error deleting zone:", err);
    }
    const updated = zones.filter(z => z.id !== zoneId);
    setZones(updated);
    if (selectedZone?.id === zoneId && updated.length > 0) {
      setSelectedZone(updated[0]);
    }
  };


  return (
    <div className="space-y-4 p-4 max-w-[1920px] mx-auto">
      {/* Top Banner */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              Virtual Fence & Polygonal Security Zones
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Define spatial boundaries, restricted perimeters, and directional tripwires calibrated to individual CCTV feeds.
          </p>
        </div>

        <button
          onClick={() => setIsAddingZone(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold shadow-lg shadow-cyan-600/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Polygon Zone</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 4 Cols: Zone List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-3">
              CONFIGURED ZONES ({zones.length})
            </h3>

            <div className="space-y-2">
              {zones.map((zone) => {
                const isSelected = selectedZone?.id === zone.id;
                return (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-800/80 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                        : 'bg-[#0E1524] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: zone.color }} 
                        />
                        <span className="font-bold text-xs text-slate-200">{zone.name}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        {zone.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2">
                      <span>Camera: <strong className="text-slate-200">{zone.cameraCode}</strong></span>
                      <span className="font-bold" style={{ color: zone.color }}>
                        +{zone.threatWeight} THREAT
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Zone Modal / Form */}
          {isAddingZone && (
            <div className="tactical-card rounded-xl p-4 border border-cyan-500/40">
              <h4 className="text-xs font-bold uppercase text-cyan-400 font-mono mb-3">
                Create Virtual Fence Boundary
              </h4>
              <form onSubmit={handleAddZone} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Zone Name</label>
                  <input
                    type="text"
                    required
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="e.g. Sector B Ammunition Perimeter"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 font-mono mb-1">Zone Type</label>
                    <select
                      value={newZoneType}
                      onChange={(e) => setNewZoneType(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs"
                    >
                      <option value="RESTRICTED">Restricted</option>
                      <option value="SENSITIVE">Sensitive</option>
                      <option value="BORDER">Border</option>
                      <option value="ENTRY">Entry</option>
                      <option value="EXIT">Exit</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-mono mb-1">Threat Delta</label>
                    <input
                      type="number"
                      value={newZoneWeight}
                      onChange={(e) => setNewZoneWeight(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-mono mb-1">Target Camera</label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs"
                  >
                    {cameras.map(c => (
                      <option key={c.id || c.code} value={c.code}>{c.code} — {c.name}</option>
                    ))}

                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold"
                  >
                    Save Zone
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingZone(false)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right 8 Cols: Interactive Polygon Zone Canvas Preview */}
        <div className="lg:col-span-8 space-y-4">
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Polygon Boundary Editor: {selectedZone ? selectedZone.name : 'Select Zone'}
                </h3>
              </div>
              {selectedZone && (
                <button
                  onClick={() => handleDeleteZone(selectedZone.id)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Zone</span>
                </button>
              )}
            </div>

            {/* Virtual Zone Visualizer Canvas */}
            <div className="relative aspect-video bg-[#070B14] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center hud-grid">
              {/* Camera reference label */}
              <div className="absolute top-3 left-3 text-[10px] font-mono text-slate-300 bg-black/70 px-2.5 py-1 rounded border border-slate-700">
                CAMERA: {selectedZone?.cameraCode} (CALIBRATED COORDINATES)
              </div>

              {/* Scaled Polygon Overlay */}
              <svg className="w-full h-full">
                {zones
                  .filter(z => z.cameraCode === selectedZone?.cameraCode)
                  .map((z) => {
                    const pointsStr = z.points.map(p => `${p.x * 6.4},${p.y * 3.6}`).join(' ');
                    const isSelected = z.id === selectedZone?.id;

                    return (
                      <g key={z.id}>
                        <polygon
                          points={pointsStr}
                          fill={z.color}
                          fillOpacity={isSelected ? 0.25 : 0.1}
                          stroke={z.color}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          strokeDasharray={isSelected ? "6 3" : "none"}
                        />
                        {/* Control vertex handles */}
                        {isSelected && z.points.map((pt, pIdx) => (
                          <circle
                            key={pIdx}
                            cx={pt.x * 6.4}
                            cy={pt.y * 3.6}
                            r={5}
                            fill="#FFFFFF"
                            stroke={z.color}
                            strokeWidth={2}
                            className="cursor-move"
                          />
                        ))}
                      </g>
                    );
                  })}
              </svg>

              <div className="absolute bottom-3 right-3 text-[10px] font-mono text-cyan-400 bg-black/70 px-2.5 py-1 rounded border border-slate-700">
                DRAG VERTICES TO RESHAPE NO-GO ZONE
              </div>
            </div>

            {/* Zone parameters */}
            {selectedZone && (
              <div className="mt-4 p-3 rounded-lg bg-[#0E1524] border border-slate-800 grid grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">ZONE TYPE:</span>
                  <span className="font-bold text-slate-200">{selectedZone.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">THREAT SCORING DELTA:</span>
                  <span className="font-bold text-red-400">+{selectedZone.threatWeight} POINTS</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">POLYGON VERTICES:</span>
                  <span className="text-cyan-400 font-bold">{selectedZone.points.length} VERTEX NODES</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
