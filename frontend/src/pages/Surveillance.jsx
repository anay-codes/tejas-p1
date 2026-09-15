import React, { useState, useEffect, useCallback } from 'react';
import CameraFeedCanvas from '../components/cctv/CameraFeedCanvas';
import { 
  Video, 
  ZoomIn, 
  ZoomOut, 
  Sun, 
  Moon, 
  Shield, 
  Radio, 
  Cpu, 
  Activity, 
  Users, 
  Car, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Camera,
  Plus,
  X,
  Layers,
  Settings,
  Tv,
  Check
} from 'lucide-react';
import { simulator } from '../services/demoSimulator';
import { useVideoTelemetry } from '../services/useVideoTelemetry';
import { useSurveillanceStream } from '../services/useSurveillanceStream';
import { apiClient } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function Surveillance() {
  const [simState, setSimState] = useState(simulator.getState());
  const [dbCameras, setDbCameras] = useState([]);
  const [selectedCam, setSelectedCam] = useState(simState.cameras[0]);
  const [nightVision, setNightVision] = useState(false);
  const [ptzZoom, setPtzZoom] = useState(1.0);
  
  // Real video & AI pipeline state
  const [isLiveWebcam, setIsLiveWebcam] = useState(true);
  const { telemetry, isBackendOnline, updateConfig } = useVideoTelemetry(isLiveWebcam, 800);
  const { alerts, activeThreat } = useSurveillanceStream();

  const [confThreshold, setConfThreshold] = useState(0.35);
  const [targetFps, setTargetFps] = useState(15);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // + Add / Switch Camera Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('standalone'); // 'standalone' | 'connected'
  const [standaloneType, setStandaloneType] = useState('local'); // 'local' | 'rtsp' | 'file'
  const [selectedLocalIndex, setSelectedLocalIndex] = useState('0');
  const [customRtspUrl, setCustomRtspUrl] = useState('rtsp://admin:admin@192.168.1.2:8554/stream');
  const [customFilePath, setCustomFilePath] = useState('test_video.mp4');
  const [discoveredCameras, setDiscoveredCameras] = useState([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [switchStatus, setSwitchStatus] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    async function loadCams() {
      try {
        const cams = await apiClient.getCameras();
        if (cams && cams.length > 0) {
          setDbCameras(cams);
          setSelectedCam(cams[0]);
        }
      } catch (err) {
        console.warn("Failed to load cameras in Surveillance:", err);
      }
    }
    loadCams();
  }, []);

  useEffect(() => {
    const unsub = simulator.subscribe((state) => {
      setSimState(state);
    });
    return () => unsub();
  }, []);

  const activeCameras = dbCameras.length > 0 ? dbCameras : simState.cameras;

  // Auto-discover local camera hardware
  const fetchDiscoveredCameras = useCallback(async () => {
    setIsDiscovering(true);
    try {
      const res = await fetch(`${API_BASE}/video/discover`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveredCameras(data);
        if (data.length > 0 && !selectedLocalIndex) {
          setSelectedLocalIndex(String(data[0].index));
        }
      }
    } catch (err) {
      console.warn("Camera discovery error:", err);
    } finally {
      setIsDiscovering(false);
    }
  }, [selectedLocalIndex]);

  const handleOpenModal = () => {
    setIsCameraModalOpen(true);
    setTestResult(null);
    setSwitchStatus(null);
    fetchDiscoveredCameras();
  };

  const getCandidateSource = () => {
    if (standaloneType === 'local') return selectedLocalIndex;
    if (standaloneType === 'rtsp') return customRtspUrl;
    return customFilePath;
  };

  const handleTestSource = async (candidateSource = null) => {
    const src = candidateSource !== null ? candidateSource : getCandidateSource();
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/video/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSwitchSource = async (candidateSource = null) => {
    const src = candidateSource !== null ? candidateSource : getCandidateSource();
    setIsSwitching(true);
    setSwitchStatus(null);
    try {
      const res = await fetch(`${API_BASE}/video/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSwitchStatus({ success: true, message: `Successfully switched to Source [${data.source}] (${data.resolution})` });
        setTimeout(() => {
          setIsCameraModalOpen(false);
        }, 1200);
      } else {
        setSwitchStatus({ success: false, message: data.detail || data.error || 'Switch failed' });
      }
    } catch (err) {
      setSwitchStatus({ success: false, message: err.message });
    } finally {
      setIsSwitching(false);
    }
  };

  const handleConfidenceChange = async (e) => {
    const val = parseFloat(e.target.value);
    setConfThreshold(val);
    setIsUpdatingConfig(true);
    await updateConfig({ confidence: val });
    setIsUpdatingConfig(false);
  };

  const handleFpsChange = async (e) => {
    const val = parseInt(e.target.value, 10);
    setTargetFps(val);
    setIsUpdatingConfig(true);
    await updateConfig({ processing_fps: val });
    setIsUpdatingConfig(false);
  };

  return (
    <div className="space-y-4 p-4 max-w-[1920px] mx-auto">
      {/* Top Banner with Stream Source Toggle & Add Camera */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              Perimeter Surveillance & Live AI Ingestion
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time camera ingestion with YOLOv8 object detection, ByteTrack multi-object tracking, and safe device management.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* + ADD / SWITCH CAMERA BUTTON */}
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all border border-cyan-400/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ ADD / SWITCH CAMERA</span>
          </button>

          {/* Tactical Stream Source Mode Toggle */}
          <div className="flex items-center gap-1 bg-[#0B111E] p-1 rounded-lg border border-slate-700/80">
            <button
              onClick={() => setIsLiveWebcam(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                isLiveWebcam 
                  ? 'bg-cyan-700 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveWebcam ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>LIVE INGEST [{telemetry?.source ?? '0'}]</span>
            </button>
            
            <button
              onClick={() => setIsLiveWebcam(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                !isLiveWebcam 
                  ? 'bg-slate-700 text-slate-100' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>SIM MATRIX</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Hardware Telemetry HUD Bar */}
      {isLiveWebcam && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-400">STREAM CAPTURE</div>
                <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                  {telemetry ? `${telemetry.fps} FPS` : '--'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">Hardware Intake</div>
              </div>
              <Activity className="w-5 h-5 text-cyan-400/60" />
            </div>

            <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-400">INFERENCE RATE</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                  {telemetry ? `${telemetry.infer_fps || telemetry.fps} FPS` : '--'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">Target: {telemetry?.target_inference_fps || targetFps} FPS</div>
              </div>
              <Cpu className="w-5 h-5 text-emerald-400/60" />
            </div>

            <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-400">INFERENCE LATENCY</div>
                <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">
                  {telemetry ? `${telemetry.inference_ms} ms` : '--'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">{telemetry?.device?.toUpperCase() || 'CPU'} Engine</div>
              </div>
              <Activity className="w-5 h-5 text-cyan-400/60" />
            </div>

            <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-400">ACTIVE DETECTIONS</div>
                <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                  {telemetry?.counts?.total || 0} Targets
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {telemetry?.counts?.person || 0} People • {telemetry?.counts?.vehicle || 0} Vehicles
                </div>
              </div>
              <Users className="w-5 h-5 text-amber-400/60" />
            </div>

            <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-400">CURRENT SOURCE</div>
                <div className="text-sm font-bold font-mono text-slate-200 mt-0.5 truncate max-w-[120px]">
                  {telemetry?.source ?? '0'}
                </div>
                <div className="text-[10px] font-mono text-emerald-400">
                  {telemetry?.is_connected ? 'CONNECTED' : 'STANDBY'}
                </div>
              </div>
              <Camera className="w-5 h-5 text-emerald-400/60" />
            </div>
          </div>
        </div>
      )}

      {/* Main Stream Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: Video Stream Area */}
        <div className="lg:col-span-8 space-y-3">
          <div className={`rounded-xl overflow-hidden border border-[#1E2D48] ${nightVision ? 'hue-rotate-90 saturate-200' : ''}`}>
            <CameraFeedCanvas
              camera={selectedCam}
              entities={simState.entities}
              zones={simState.zones}
              tick={simState.tick}
              isLive={isLiveWebcam}
              telemetry={telemetry}
            />
          </div>

          {/* Interactive Live AI Tuning Bar */}
          {isLiveWebcam && (
            <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-slate-200">REAL-TIME INFERENCE & CALIBRATION</span>
                </div>
                {isUpdatingConfig && (
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Updating...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Confidence Threshold:</span>
                    <span className="text-cyan-400 font-bold">{Math.round(confThreshold * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.15"
                    max="0.85"
                    step="0.05"
                    value={confThreshold}
                    onChange={handleConfidenceChange}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Target Inference FPS:</span>
                    <span className="text-emerald-400 font-bold">{targetFps} FPS</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="5"
                    value={targetFps}
                    onChange={handleFpsChange}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={handleOpenModal}
                    className="w-full py-1.5 px-3 rounded bg-cyan-900/60 border border-cyan-700 text-cyan-200 hover:bg-cyan-800 text-xs font-bold transition-all text-center"
                  >
                    Switch Source...
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Telemetry / Stream Selector */}
        <div className="lg:col-span-4 space-y-3">
          {isLiveWebcam ? (
            /* Live Detected Entities & Track IDs Dossier */
            <div className="tactical-card rounded-xl p-4 border border-[#1E2D48] flex flex-col h-full">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                    Active Detections & ByteTrack IDs
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  {telemetry?.active_tracks?.length || 0} TRACKED
                </span>
              </div>

              <div className="space-y-2 flex-1 max-h-[480px] overflow-y-auto pr-1">
                {telemetry?.active_tracks && telemetry.active_tracks.length > 0 ? (
                  telemetry.active_tracks.map((track, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#0E1524] border border-slate-800 text-xs font-mono space-y-1 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${track.class_name === 'person' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
                          <span className="font-bold text-slate-200">
                            {track.class_name.toUpperCase()}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold text-[10px]">
                          {track.track_id >= 0 ? `TRACK ID #${track.track_id}` : 'INITIALIZING'}
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                        <span>CONFIDENCE:</span>
                        <span className="text-emerald-400 font-bold">{Math.round(track.confidence * 100)}%</span>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>BOUNDING BOX:</span>
                        <span>[{track.box.join(', ')}]</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center space-y-2 text-slate-500 font-mono text-xs">
                    <Camera className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                    <div>No entities currently in view</div>
                    <p className="text-[10px] text-slate-600">
                      Bring a target or person in camera view to observe real-time YOLOv8 bounding boxes & ByteTrack ID assignment.
                    </p>
                  </div>
                )}
              </div>

              {/* Hardware Status Pill */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 text-[10px] font-mono text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>INGESTION STATUS:</span>
                  <span className={telemetry?.is_connected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {telemetry?.is_connected ? 'OPERATIONAL' : 'CONNECTING'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ACTIVE MODEL:</span>
                  <span className="text-slate-300">YOLOv8-N + ByteTrack</span>
                </div>
              </div>
            </div>
          ) : (
            /* Fallback Multi-Camera Stream Selector */
            <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-3">
                REGISTERED CCTV MATRIX ({activeCameras.length})
              </h3>

              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {activeCameras.map((cam) => {
                  const isSelected = selectedCam.id === cam.id;
                  return (
                    <div
                      key={cam.id}
                      onClick={() => setSelectedCam(cam)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                          : 'bg-[#0E1524] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-xs text-white">{cam.code}</span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-mono rounded ${
                          cam.activeThreats > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                        }`}>
                          {cam.activeThreats > 0 ? 'THREAT' : 'ONLINE'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">{cam.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        {cam.location} • {cam.fps} FPS
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* + ADD / SWITCH CAMERA MODAL DIALOG                                        */}
      {/* ========================================================================= */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0B111E] border border-cyan-500/50 rounded-2xl w-full max-w-2xl shadow-2xl shadow-cyan-900/30 overflow-hidden text-mono text-xs">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#070B14]">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
                  Camera Ingestion & Hardware Switcher
                </h2>
              </div>
              <button
                onClick={() => setIsCameraModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 bg-[#0E1524]">
              <button
                onClick={() => { setModalTab('standalone'); setTestResult(null); setSwitchStatus(null); }}
                className={`flex-1 py-2.5 px-4 font-mono text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
                  modalTab === 'standalone'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>A. STANDALONE CAMERA (Local / RTSP / File)</span>
              </button>
              <button
                onClick={() => { setModalTab('connected'); setTestResult(null); setSwitchStatus(null); }}
                className={`flex-1 py-2.5 px-4 font-mono text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${
                  modalTab === 'connected'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>B. CONNECTED NODES ({dbCameras.length})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {modalTab === 'standalone' ? (
                <div className="space-y-4">
                  {/* Source Type Selector */}
                  <div className="flex gap-2 p-1 bg-[#070B14] rounded-lg border border-slate-800">
                    <button
                      onClick={() => { setStandaloneType('local'); setTestResult(null); }}
                      className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-semibold transition-all ${
                        standaloneType === 'local' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Windows / Local Camera
                    </button>
                    <button
                      onClick={() => { setStandaloneType('rtsp'); setTestResult(null); }}
                      className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-semibold transition-all ${
                        standaloneType === 'rtsp' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      IP / RTSP URL
                    </button>
                    <button
                      onClick={() => { setStandaloneType('file'); setTestResult(null); }}
                      className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-semibold transition-all ${
                        standaloneType === 'file' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Video File (MP4)
                    </button>
                  </div>

                  {/* Windows Local Camera Selection */}
                  {standaloneType === 'local' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-slate-300 font-mono text-xs">
                        <span>Discovered Windows Camera Hardware:</span>
                        <button
                          onClick={fetchDiscoveredCameras}
                          disabled={isDiscovering}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                        >
                          <RefreshCw className={`w-3 h-3 ${isDiscovering ? 'animate-spin' : ''}`} />
                          <span>Rescan Hardware</span>
                        </button>
                      </div>

                      {discoveredCameras.length > 0 ? (
                        <div className="space-y-2">
                          {discoveredCameras.map((dev) => {
                            const isSelected = selectedLocalIndex === String(dev.index);
                            return (
                              <div
                                key={dev.index}
                                onClick={() => setSelectedLocalIndex(String(dev.index))}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-950/50'
                                    : 'bg-[#0E1524] border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full ${dev.is_illuminated ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                  <div>
                                    <div className="font-bold text-slate-100">{dev.name}</div>
                                    <div className="text-[10px] text-slate-400">
                                      Index {dev.index} • Resolution: {dev.resolution} • {dev.is_illuminated ? 'Illuminated Frame' : 'Dark/Standby Frame'}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSelectedLocalIndex(String(dev.index)); handleTestSource(dev.index); }}
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                                  >
                                    Test
                                  </button>
                                  {isSelected && (
                                    <span className="p-1 rounded-full bg-cyan-500 text-black">
                                      <Check className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center text-slate-400">
                          {isDiscovering ? 'Scanning for camera devices...' : 'No cameras automatically detected. Enter index manually.'}
                        </div>
                      )}

                      <div>
                        <label className="block text-slate-400 mb-1 text-[11px]">Or Manual Camera Device Index:</label>
                        <input
                          type="number"
                          min="0"
                          max="8"
                          value={selectedLocalIndex}
                          onChange={(e) => setSelectedLocalIndex(e.target.value)}
                          className="w-full bg-[#070B14] border border-slate-700 rounded-lg p-2 text-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* RTSP Stream Selection */}
                  {standaloneType === 'rtsp' && (
                    <div className="space-y-2">
                      <label className="block text-slate-400 text-[11px]">RTSP Stream URL:</label>
                      <input
                        type="text"
                        value={customRtspUrl}
                        onChange={(e) => setCustomRtspUrl(e.target.value)}
                        placeholder="rtsp://admin:password@192.168.1.100:554/stream"
                        className="w-full bg-[#070B14] border border-slate-700 rounded-lg p-2 text-white font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        Supports standard RTSP / RTSPS camera streams with low-latency FFMPEG transport.
                      </p>
                    </div>
                  )}

                  {/* Video File Selection */}
                  {standaloneType === 'file' && (
                    <div className="space-y-2">
                      <label className="block text-slate-400 text-[11px]">Video File Path (MP4/MKV):</label>
                      <input
                        type="text"
                        value={customFilePath}
                        onChange={(e) => setCustomFilePath(e.target.value)}
                        placeholder="C:\videos\surveillance_test.mp4"
                        className="w-full bg-[#070B14] border border-slate-700 rounded-lg p-2 text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Connected Camera Nodes Tab */
                <div className="space-y-2">
                  <p className="text-slate-400 text-[11px]">
                    Select an existing registered node from your security matrix:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {dbCameras.map((node) => (
                      <div
                        key={node.id}
                        onClick={() => handleSwitchSource(node.stream_url || node.code)}
                        className="p-3 rounded-xl bg-[#0E1524] border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition-all flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-white text-xs">{node.code}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            {node.status || 'ACTIVE'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-1">{node.name}</div>
                        <div className="text-[10px] text-slate-500 mt-1 truncate">
                          {node.stream_url || node.location || 'Local Pipeline'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Result Banner */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
                  testResult.success 
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' 
                    : 'bg-red-950/40 border-red-500/50 text-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                    <span>
                      {testResult.success 
                        ? `Tested Source [${testResult.source}]: ${testResult.resolution} @ ~${testResult.fps} FPS (${testResult.is_illuminated ? 'Illuminated' : 'Dark/Standby'})`
                        : `Test Failed: ${testResult.error}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Switch Status Banner */}
              {switchStatus && (
                <div className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
                  switchStatus.success 
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300' 
                    : 'bg-red-950/40 border-red-500/50 text-red-300'
                }`}>
                  <span>{switchStatus.message}</span>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-[#070B14] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleTestSource()}
                disabled={isTesting || isSwitching}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Test Connection First</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchSource()}
                  disabled={isSwitching}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-all"
                >
                  {isSwitching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying & Switching...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Activate Ingestion Stream</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
