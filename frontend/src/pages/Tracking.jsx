import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  Clock, 
  MapPin, 
  ShieldAlert, 
  ArrowRight, 
  Eye, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Play,
  RotateCcw,
  Sliders,
  Shield,
  Zap,
  Camera,
  Activity,
  Layers,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../services/api';
import { wsService } from '../services/websocket';

export default function Tracking() {
  // Global tracks state
  const [globalTracks, setGlobalTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [trackDossier, setTrackDossier] = useState(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  // Engine config state
  const [config, setConfig] = useState({ similarity_threshold: 0.72, max_transit_seconds: 180.0 });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState(null);

  // Simulation Lab state
  const [simPayload, setSimPayload] = useState({
    from_camera: 'CAM-00',
    to_camera: 'CAM-02',
    transit_seconds: 12.5,
    subject_type: 'PERSON',
    should_match: true,
    subject_outfit: 'navy_jacket_dark_jeans'
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  // Load global tracks and config on mount
  useEffect(() => {
    fetchGlobalTracks();
    fetchConfig();

    // Subscribe to real-time WebSocket events for cross-camera handoffs
    const unsubscribe = wsService.subscribe((msg) => {
      if (msg.type === 'MULTI_CAMERA_HANDOFF' || msg.type === 'CROSS_CAMERA_HANDOFF') {
        console.log("Real-time Multi-Camera Handoff received:", msg);
        fetchGlobalTracks();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch track dossier when selected track changes
  useEffect(() => {
    if (selectedTrackId) {
      fetchTrackDossier(selectedTrackId);
    } else {
      setTrackDossier(null);
    }
  }, [selectedTrackId]);

  const fetchGlobalTracks = async () => {
    setIsLoadingTracks(true);
    try {
      const tracks = await apiClient.getGlobalTracks();
      if (tracks && tracks.length > 0) {
        setGlobalTracks(tracks);
        // Select first if none selected
        if (!selectedTrackId) {
          setSelectedTrackId(tracks[0].id);
        }
      } else {
        setGlobalTracks([]);
      }
    } catch (err) {
      console.error("Failed to load global tracks:", err);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const fetchTrackDossier = async (trackId) => {
    try {
      const dossier = await apiClient.getGlobalTrackDetail(trackId);
      setTrackDossier(dossier);
    } catch (err) {
      console.error("Failed to fetch track dossier:", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const cfg = await apiClient.getTrackingConfig();
      if (cfg) setConfig(cfg);
    } catch (err) {
      console.error("Failed to load tracking config:", err);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const updated = await apiClient.updateTrackingConfig(
        config.similarity_threshold,
        config.max_transit_seconds
      );
      if (updated) {
        setConfigFeedback("Re-ID parameters updated successfully");
        setTimeout(() => setConfigFeedback(null), 3500);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimResult(null);
    try {
      const result = await apiClient.simulateTransit(simPayload);
      setSimResult(result);
      // Refresh global tracks list to show the new or updated identity
      await fetchGlobalTracks();
      if (result && result.global_track_id) {
        setSelectedTrackId(result.global_track_id);
      }
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-5 p-4 max-w-[1920px] mx-auto">
      {/* Top Banner */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0B1220] via-[#0D182E] to-[#0B1220]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <GitFork className="w-5 h-5" />
            </div>
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              Multi-Camera Entity Re-Identification & Cross-Node Transit Tracking
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 pl-9">
            Extracts 3-stripe physiological color/texture histograms and temporal constraints to match identities across non-overlapping CCTV nodes.
          </p>
        </div>

        {/* Status Indicators & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E1524] border border-slate-800 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-300">Re-ID Engine:</span>
            <span className="text-emerald-400 font-bold">ONLINE (Torch/OpenCV)</span>
          </div>
          <button
            onClick={fetchGlobalTracks}
            disabled={isLoadingTracks}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTracks ? 'animate-spin' : ''}`} />
            <span>Refresh Tracks</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Global Identity Registry & Config */}
        <div className="lg:col-span-4 space-y-4">
          {/* Active Global Identifiers Card */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Global Unified Identities ({globalTracks.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                PERSISTENT DB
              </span>
            </div>

            {globalTracks.length === 0 ? (
              <div className="text-center py-8 text-slate-500 font-mono text-xs space-y-2">
                <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No active global tracks recorded yet.</p>
                <p className="text-[10px] text-slate-600">Run the Cross-Camera Transit Lab below or ingest video feeds to generate identities.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {globalTracks.map((trk) => {
                  const isSelected = selectedTrackId === trk.id;
                  return (
                    <div
                      key={trk.id}
                      onClick={() => setSelectedTrackId(trk.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                          : 'bg-[#0E1524] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-cyan-400">
                          {trk.id}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          trk.threat_score >= 60 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                            : trk.threat_score >= 30
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          THREAT: {trk.threat_score}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-slate-300 font-mono">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Camera className="w-3.5 h-3.5 text-slate-500" />
                          {trk.current_camera}
                        </span>
                        <span className="text-[11px] text-emerald-400 font-semibold">
                          {trk.total_handoffs} Camera Handoff{trk.total_handoffs !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>First: {trk.first_seen_camera}</span>
                        <span>{trk.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Re-ID Engine Sensitivity & Threshold Controls */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Re-ID Sensitivity & Constraints
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Cosine Metric</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Cosine Similarity Threshold:</span>
                  <span className="text-cyan-400 font-bold">{(config.similarity_threshold * 100).toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.01"
                  value={config.similarity_threshold}
                  onChange={(e) => setConfig({ ...config, similarity_threshold: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>Permissive (50%)</span>
                  <span>Default (72%)</span>
                  <span>Strict (95%)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Max Transit Window:</span>
                  <span className="text-amber-400 font-bold">{config.max_transit_seconds}s</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={config.max_transit_seconds}
                  onChange={(e) => setConfig({ ...config, max_transit_seconds: parseFloat(e.target.value) })}
                  className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>Fast (10s)</span>
                  <span>Nominal (180s)</span>
                  <span>Extended (300s)</span>
                </div>
              </div>

              {configFeedback && (
                <div className="p-2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{configFeedback}</span>
                </div>
              )}

              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="w-full py-2 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/20"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{isSavingConfig ? 'Saving Calibration...' : 'Update Re-ID Hyperparameters'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right Column: Track Dossier & Cross-Camera Handoff Timeline */}
        <div className="lg:col-span-8 space-y-4">
          {trackDossier ? (
            <div className="tactical-card rounded-xl p-5 border border-[#1E2D48] space-y-4">
              {/* Dossier Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold font-mono text-slate-100">{trackDossier.id}</h2>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {trackDossier.entity_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      First Origin: {trackDossier.first_seen_camera} • Current Node: <strong className="text-cyan-400">{trackDossier.current_camera}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-400">TOTAL HANDOFFS</div>
                    <div className="text-sm font-mono font-bold text-emerald-400">{trackDossier.total_handoffs} Nodes</div>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-800" />
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-400">THREAT SCORE</div>
                    <div className={`text-sm font-mono font-bold ${
                      trackDossier.threat_score >= 60 ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {trackDossier.threat_score} / 100
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Camera Progression Breadcrumb */}
              <div>
                <div className="text-xs font-mono text-slate-400 mb-2 flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CAMERA TRANSIT PROGRESSION BREADCRUMB:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#0E1524] border border-slate-800 font-mono text-xs">
                  {trackDossier.movement_path && trackDossier.movement_path.length > 0 ? (
                    trackDossier.movement_path.map((node, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200">
                          <Camera className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-bold text-cyan-300">{node.camera_id}</span>
                          <span className="text-[10px] text-slate-400">({node.timestamp})</span>
                        </div>
                        {idx < trackDossier.movement_path.length - 1 && (
                          <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200">
                      <Camera className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-bold text-cyan-300">{trackDossier.current_camera}</span>
                      <span className="text-[10px] text-slate-400">(Initial sighting)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Handoff History Records */}
              <div>
                <div className="text-xs font-mono text-slate-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CROSS-CAMERA HANDOFF EVENTS & APPEARANCE METRICS:</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {trackDossier.handoffs?.length || 0} transition{trackDossier.handoffs?.length !== 1 ? 's' : ''} logged
                  </span>
                </div>

                {trackDossier.handoffs && trackDossier.handoffs.length > 0 ? (
                  <div className="space-y-3">
                    {trackDossier.handoffs.map((h, i) => (
                      <div 
                        key={h.id || i}
                        className="p-3.5 rounded-lg bg-[#0E1524] border border-slate-800 hover:border-slate-700 transition-all font-mono"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">
                              TRANSIT #{i + 1}
                            </span>
                            <span className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                              {h.from_camera} <ArrowRight className="w-3.5 h-3.5 text-cyan-400" /> {h.to_camera}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400">Transit Delay: <strong className="text-amber-400">{h.transition_time_seconds}s</strong></span>
                            <span className="text-slate-400">Similarity: <strong className="text-emerald-400">{(h.similarity_score * 100).toFixed(1)}%</strong></span>
                          </div>
                        </div>

                        {/* Snapshot Display if available */}
                        {h.snapshot_base64 && (
                          <div className="mt-2 flex items-center gap-3">
                            <img 
                              src={`data:image/jpeg;base64,${h.snapshot_base64}`} 
                              alt="Handoff Subject Evidence" 
                              className="w-14 h-28 object-cover rounded border border-cyan-500/40 bg-black"
                            />
                            <div className="text-xs text-slate-400 space-y-1">
                              <div className="text-slate-200 font-semibold">Optical Sensor Evidence Captured</div>
                              <div>Resolution: Normalized 160x80 crop</div>
                              <div>Descriptor: 3-Stripe HSV & Lab Color/Texture Vector</div>
                              <div className="text-emerald-400">Cross-camera correlation verified</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-[#0E1524] border border-slate-800 text-slate-500 text-xs font-mono text-center">
                    Single-node sighting so far. A cross-camera transition will appear here once the entity enters another node's field of view.
                  </div>
                )}
              </div>

              {/* Threat Engine Correlation Context */}
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 font-mono text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-red-300 font-bold">Threat Engine Correlation Context:</div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Identity continuity across nodes triggers the <strong className="text-white">Multi-Camera Transit Rule (+20 pts)</strong>.
                    If the subject subsequently breaches a restricted zone on any perimeter node, the incident is automatically escalated to high priority with cross-camera timeline evidence.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="tactical-card rounded-xl p-8 border border-[#1E2D48] text-center text-slate-500 font-mono space-y-3">
              <Eye className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm text-slate-300 font-bold">No Global Track Selected</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Select an existing identity from the registry on the left, or launch the interactive Multi-Camera Transit Lab below.
              </p>
            </div>
          )}

          {/* Interactive Multi-Camera Re-ID Lab */}
          <div className="tactical-card rounded-xl p-5 border border-[#1E2D48] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Real Cross-Camera Re-ID Transit Lab & Verification
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                LIVE HARDWARE/ALGO TEST
              </span>
            </div>

            <p className="text-xs text-slate-400 font-mono">
              Simulate or verify physical transit across non-overlapping camera sectors. Ingests genuine optical crops, computes feature vectors, and evaluates whether the system correctly associates or rejects the identity.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Origin Node:</label>
                <select
                  value={simPayload.from_camera}
                  onChange={(e) => setSimPayload({ ...simPayload, from_camera: e.target.value })}
                  className="w-full bg-[#0E1524] border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  <option value="CAM-00">CAM-00 (Laptop Webcam)</option>
                  <option value="CAM-01">CAM-01 (Sector Alpha)</option>
                  <option value="CAM-02">CAM-02 (Perimeter North)</option>
                  <option value="CAM-03">CAM-03 (Storage Facility)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Destination Node:</label>
                <select
                  value={simPayload.to_camera}
                  onChange={(e) => setSimPayload({ ...simPayload, to_camera: e.target.value })}
                  className="w-full bg-[#0E1524] border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  <option value="CAM-02">CAM-02 (Perimeter North)</option>
                  <option value="CAM-00">CAM-00 (Laptop Webcam)</option>
                  <option value="CAM-01">CAM-01 (Sector Alpha)</option>
                  <option value="CAM-03">CAM-03 (Storage Facility)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Subject Outfit:</label>
                <select
                  value={simPayload.subject_outfit}
                  onChange={(e) => setSimPayload({ ...simPayload, subject_outfit: e.target.value })}
                  className="w-full bg-[#0E1524] border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  <option value="navy_jacket_dark_jeans">Navy Tactical Jacket / Jeans</option>
                  <option value="red_hoodie_khaki">Red Hoodie / Khaki Pants</option>
                  <option value="grey_overcoat">Grey Overcoat / Black Trousers</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Test Scenario:</label>
                <select
                  value={simPayload.should_match ? 'true' : 'false'}
                  onChange={(e) => setSimPayload({ ...simPayload, should_match: e.target.value === 'true' })}
                  className="w-full bg-[#0E1524] border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  <option value="true">Same Person (True Association)</option>
                  <option value="false">Different Person (False Intrusion Reject)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <span>Simulated Transit Delay:</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  step="0.5"
                  value={simPayload.transit_seconds}
                  onChange={(e) => setSimPayload({ ...simPayload, transit_seconds: parseFloat(e.target.value) || 10 })}
                  className="w-20 bg-[#0E1524] border border-slate-700 rounded px-2 py-1 text-cyan-400 font-bold text-center"
                />
                <span>seconds</span>
              </div>

              <button
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="w-full sm:w-auto px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30"
              >
                <Play className="w-4 h-4" />
                <span>{isSimulating ? 'Extracting & Correlating Embeddings...' : 'Run Real Multi-Camera Transit Test'}</span>
              </button>
            </div>

            {/* Simulation Results Breakdown */}
            {simResult && (
              <div className="mt-4 p-4 rounded-xl bg-[#080D18] border border-cyan-500/30 font-mono space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    {simResult.is_matched ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    )}
                    <span className="text-sm font-bold text-slate-100">
                      {simResult.is_matched ? 'CONFIRMED MULTI-CAMERA ASSOCIATION' : 'DISMISSED AS DISTINCT IDENTITY'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    simResult.is_matched ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {simResult.is_matched ? 'LINKED' : 'UNLINKED'}
                  </span>
                </div>

                <div className="text-xs text-slate-300">{simResult.message}</div>

                {/* Side-by-side Optical Crop Evidence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-[#0E1524] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold text-cyan-400">CAMERA A: {simResult.camera_a}</span>
                      <span>{simResult.camera_a_timestamp}</span>
                    </div>
                    {simResult.camera_a_snapshot_b64 && (
                      <div className="flex items-center gap-3">
                        <img 
                          src={`data:image/jpeg;base64,${simResult.camera_a_snapshot_b64}`} 
                          alt="Camera A Subject"
                          className="w-16 h-32 object-cover rounded border border-cyan-500/40 bg-black"
                        />
                        <div className="text-[11px] text-slate-400 space-y-1">
                          <div className="text-slate-200 font-semibold">Origin Crop Extracted</div>
                          <div>3-Stripe Histogram: Head, Torso, Legs</div>
                          <div>Descriptor: 192-D L2-Normalized</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-[#0E1524] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold text-emerald-400">CAMERA B: {simResult.camera_b}</span>
                      <span>{simResult.camera_b_timestamp}</span>
                    </div>
                    {simResult.camera_b_snapshot_b64 && (
                      <div className="flex items-center gap-3">
                        <img 
                          src={`data:image/jpeg;base64,${simResult.camera_b_snapshot_b64}`} 
                          alt="Camera B Subject"
                          className="w-16 h-32 object-cover rounded border border-emerald-500/40 bg-black"
                        />
                        <div className="text-[11px] text-slate-400 space-y-1">
                          <div className="text-slate-200 font-semibold">Destination Crop Extracted</div>
                          <div>Measured Similarity: <strong className="text-emerald-400 font-bold">{simResult.match_confidence_pct}%</strong></div>
                          <div>Threshold Required: <strong>{(simResult.similarity_threshold * 100).toFixed(1)}%</strong></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quantitative Metric Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Re-ID Feature Cosine Distance:</span>
                    <span className="font-bold text-cyan-300">{simResult.match_confidence_pct}% Match</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden relative border border-slate-800">
                    {/* Threshold line */}
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10" 
                      style={{ left: `${simResult.similarity_threshold * 100}%` }} 
                      title={`Threshold: ${(simResult.similarity_threshold * 100).toFixed(1)}%`}
                    />
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        simResult.is_matched ? 'bg-gradient-to-r from-cyan-500 to-emerald-400' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, simResult.match_confidence_pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0% (Dissimilar)</span>
                    <span className="text-amber-400">Threshold: {(simResult.similarity_threshold * 100).toFixed(1)}%</span>
                    <span>100% (Identical)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
