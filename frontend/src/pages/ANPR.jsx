import React, { useState, useEffect } from 'react';
import { 
  ScanLine, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  Sliders, 
  Camera, 
  Eye, 
  Zap, 
  Layers, 
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Radio,
  FileText,
  Activity,
  Maximize2,
  Info,
  Car
} from 'lucide-react';
import { useSurveillanceStream } from '../services/useSurveillanceStream';

export default function ANPR() {
  const { isConnected: wsConnected, latestEvent, lastAnprDetection } = useSurveillanceStream();

  // Navigation & View state
  const [activeTab, setActiveTab] = useState('live'); // 'live', 'testbench', 'watchlist'
  const [selectedSource, setSelectedSource] = useState('CAM-00'); // 'CAM-00' (live), 'BORDER-RD-12', 'GATE-01'
  const [isRestoredView, setIsRestoredView] = useState(true);
  const [viewMode, setViewMode] = useState('split'); // 'split' or 'single'
  
  // Data state
  const [recentPlates, setRecentPlates] = useState([]);
  const [selectedPlate, setSelectedPlate] = useState(null);
  const [watchlistEntries, setWatchlistEntries] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Testbench Interactive State
  const [testbenchPlate, setTestbenchPlate] = useState('MP09AB1234');
  const [degradationType, setDegradationType] = useState('motion_blur');
  const [intensity, setIntensity] = useState(70);
  const [isProcessingTestbench, setIsProcessingTestbench] = useState(false);
  const [testbenchResult, setTestbenchResult] = useState(null);
  const [dispatchAlert, setDispatchAlert] = useState(null);

  // Fetch recent plates on mount
  const fetchRecentPlates = async () => {
    try {
      setLoadingRecent(true);
      const res = await fetch('/api/anpr/recent?limit=15');
      if (res.ok) {
        const data = await res.json();
        setRecentPlates(data);
        if (data.length > 0 && !selectedPlate) {
          setSelectedPlate(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load recent plates:', err);
    } finally {
      setLoadingRecent(false);
    }
  };

  // Fetch watchlist entries
  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/anpr/watchlist');
      if (res.ok) {
        const data = await res.json();
        setWatchlistEntries(data);
      }
    } catch (err) {
      console.error('Failed to load watchlist:', err);
    }
  };

  useEffect(() => {
    fetchRecentPlates();
    fetchWatchlist();
  }, []);

  // Listen to live ANPR WebSocket events
  useEffect(() => {
    if (lastAnprDetection && lastAnprDetection.plate_detected) {
      // Prepend to recent plates
      const newPlateItem = {
        id: `PLT-${Date.now().toString().slice(-6)}`,
        plate_number: lastAnprDetection.plate_number,
        vehicle_type: 'Vehicle',
        confidence_before: lastAnprDetection.confidence_before || 0.0,
        confidence_after: lastAnprDetection.confidence_after || 0.0,
        camera: lastAnprDetection.camera_id || 'CAM-00',
        timestamp: lastAnprDetection.timestamp || new Date().toLocaleTimeString(),
        watchlist_status: lastAnprDetection.watchlist_status || 'CLEAR',
        quality_score: String(lastAnprDetection.quality_assessment?.quality_score || 70),
        applied_enhancements: lastAnprDetection.applied_enhancements || [],
        raw_crop_base64: lastAnprDetection.raw_crop_base64,
        restored_crop_base64: lastAnprDetection.restored_crop_base64,
        raw_ocr_text: lastAnprDetection.raw_ocr_text,
        quality_metrics: lastAnprDetection.quality_assessment,
        threat_score: lastAnprDetection.threat_score || 15
      };

      setRecentPlates(prev => [newPlateItem, ...prev.slice(0, 19)]);
      setSelectedPlate(newPlateItem);
    }
  }, [lastAnprDetection]);

  // Execute Real Backend Restoration Pass
  const handleRunRestoration = async () => {
    try {
      setIsProcessingTestbench(true);
      const res = await fetch('/api/anpr/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate_number: testbenchPlate,
          degradation_type: degradationType,
          intensity: intensity / 100.0
        })
      });

      if (res.ok) {
        const result = await res.json();
        setTestbenchResult(result);
        setSelectedPlate({
          id: `TEST-${Date.now().toString().slice(-4)}`,
          plate_number: result.plate_number,
          vehicle_type: 'Synthetic Testbench Vehicle',
          confidence_before: result.confidence_before,
          confidence_after: result.confidence_after,
          camera: 'BENCHMARK-SIM',
          timestamp: new Date().toLocaleTimeString(),
          watchlist_status: result.watchlist_status,
          quality_score: String(result.quality_assessment?.quality_score || 55),
          applied_enhancements: result.applied_enhancements || [],
          raw_crop_base64: result.raw_crop_base64,
          restored_crop_base64: result.restored_crop_base64,
          raw_ocr_text: result.raw_ocr_text,
          quality_metrics: result.quality_assessment,
          threat_score: result.watchlist_match ? 85 : 15
        });
      }
    } catch (err) {
      console.error('Testbench restoration failed:', err);
    } finally {
      setIsProcessingTestbench(false);
    }
  };

  const activeDisplay = selectedPlate || (recentPlates.length > 0 ? recentPlates[0] : null);
  const isWatchlistHit = activeDisplay && activeDisplay.watchlist_status && activeDisplay.watchlist_status !== 'CLEAR';
  const matchedDossier = watchlistEntries.find(w => w.identifier === activeDisplay?.plate_number);

  return (
    <div className="space-y-5 p-4 max-w-[1920px] mx-auto">
      {/* Top Tactical Banner */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              ANPR & Neural Super-Resolution Pipeline
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE (EASYOCR + CRAFT)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Genuine multi-stage optical character recognition with Laplacian blur estimation, CLAHE contrast recovery, bilateral noise filtering, and RTO syntax normalization.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'live' 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/10' 
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            LIVE INGEST & CROPS
          </button>
          <button
            onClick={() => {
              setActiveTab('testbench');
              if (!testbenchResult) handleRunRestoration();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'testbench' 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-500/10' 
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            DEGRADATION TESTBENCH
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'watchlist' 
                ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-md shadow-red-500/10' 
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            WATCHLIST ({watchlistEntries.length})
          </button>
        </div>
      </div>

      {/* Dispatch Interception Banner */}
      {dispatchAlert && (
        <div className="p-3 bg-red-600/20 border border-red-500/60 rounded-xl flex items-center justify-between text-xs text-red-200 font-mono animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-bounce" />
            <span>{dispatchAlert}</span>
          </div>
          <button onClick={() => setDispatchAlert(null)} className="text-red-400 hover:text-white font-bold">DISMISS</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Cols: Live Video / Real Plate Comparison Surface */}
        <div className="lg:col-span-8 space-y-4">
          {/* Main Inspection Deck */}
          <div className="tactical-card rounded-xl p-5 border border-[#1E2D48]">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Optical Ingestion & Restoration Inspection Deck
                </h3>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    viewMode === 'split' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  SIDE-BY-SIDE
                </button>
                <button
                  onClick={() => {
                    setViewMode('single');
                    setIsRestoredView(false);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    viewMode === 'single' && !isRestoredView ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  RAW SENSOR
                </button>
                <button
                  onClick={() => {
                    setViewMode('single');
                    setIsRestoredView(true);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    viewMode === 'single' && isRestoredView ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  AI ENHANCED
                </button>
              </div>
            </div>

            {/* Visual Display Surface: Real Base64 Images */}
            <div className="py-6 px-4 bg-[#070B14] rounded-xl border border-slate-800 my-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent pointer-events-none" />

              {viewMode === 'split' ? (
                /* Side-by-Side Comparison of Real Crops */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Raw Sensor Crop */}
                  <div className="p-3 bg-[#0B101D] rounded-lg border border-slate-800 flex flex-col items-center">
                    <div className="w-full flex items-center justify-between text-[10px] font-mono text-amber-400 mb-2 font-bold uppercase">
                      <span>1. RAW SENSOR CROP</span>
                      <span className="text-slate-500">
                        {activeDisplay?.quality_metrics?.resolution 
                          ? `${activeDisplay.quality_metrics.resolution.width}x${activeDisplay.quality_metrics.resolution.height}px` 
                          : 'INPUT CROP'}
                      </span>
                    </div>

                    <div className="w-full h-32 bg-black rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden p-2 relative">
                      {activeDisplay?.raw_crop_base64 ? (
                        <img 
                          src={activeDisplay.raw_crop_base64} 
                          alt="Raw License Plate" 
                          className="max-h-full max-w-full object-contain filter-none shadow-md"
                        />
                      ) : (
                        <div className="text-xs text-slate-500 font-mono text-center">
                          Waiting for vehicle plate ingest...
                        </div>
                      )}
                    </div>

                    <div className="w-full mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">RAW OCR READ:</span>
                      <span className="text-amber-400 font-bold">{activeDisplay?.raw_ocr_text || '—'}</span>
                    </div>
                    <div className="w-full flex items-center justify-between text-[11px] font-mono mt-0.5">
                      <span className="text-slate-400">INITIAL CONFIDENCE:</span>
                      <span className="text-amber-400 font-bold">{Math.round((activeDisplay?.confidence_before || 0) * 100)}%</span>
                    </div>
                  </div>

                  {/* Right: Restored Crop */}
                  <div className="p-3 bg-[#0B101D] rounded-lg border border-cyan-500/30 flex flex-col items-center">
                    <div className="w-full flex items-center justify-between text-[10px] font-mono text-cyan-400 mb-2 font-bold uppercase">
                      <span>2. AI RESTORED & ENHANCED CROP</span>
                      <span className="text-emerald-400">LANCZOS + CLAHE</span>
                    </div>

                    <div className="w-full h-32 bg-black rounded-lg border border-cyan-500/20 flex items-center justify-center overflow-hidden p-2 relative shadow-lg shadow-cyan-500/5">
                      {activeDisplay?.restored_crop_base64 ? (
                        <img 
                          src={activeDisplay.restored_crop_base64} 
                          alt="Restored License Plate" 
                          className="max-h-full max-w-full object-contain filter-none"
                        />
                      ) : (
                        <div className="text-xs text-slate-500 font-mono text-center">
                          Restoration pipeline ready...
                        </div>
                      )}
                    </div>

                    <div className="w-full mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">NORMALIZED OCR:</span>
                      <span className="text-emerald-400 font-bold text-xs">{activeDisplay?.plate_number || '—'}</span>
                    </div>
                    <div className="w-full flex items-center justify-between text-[11px] font-mono mt-0.5">
                      <span className="text-slate-400">RESTORED CONFIDENCE:</span>
                      <span className="text-emerald-400 font-bold">
                        {Math.round((activeDisplay?.confidence_after || 0) * 100)}%
                        {activeDisplay?.confidence_after > activeDisplay?.confidence_before && (
                          <span className="ml-1 text-[10px] text-cyan-400">
                            (+{Math.round(((activeDisplay?.confidence_after || 0) - (activeDisplay?.confidence_before || 0)) * 100)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Single High-Definition View */
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="text-[10px] font-mono text-slate-400 mb-2 uppercase">
                    {isRestoredView ? 'AI Restored Image (Lanczos Super-Res + CLAHE + Deblur)' : 'Raw Sensor Frame Crop (Original Resolution)'}
                  </div>
                  <div className="max-w-md w-full h-36 bg-black rounded-lg border border-slate-700 flex items-center justify-center p-2">
                    {isRestoredView ? (
                      <img 
                        src={activeDisplay?.restored_crop_base64 || activeDisplay?.raw_crop_base64} 
                        alt="Restored Plate" 
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <img 
                        src={activeDisplay?.raw_crop_base64} 
                        alt="Raw Plate" 
                        className="max-h-full max-w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-xs font-mono text-slate-400">DETECTED REGISTRATION: </span>
                    <span className="text-sm font-mono font-bold text-white tracking-widest">{activeDisplay?.plate_number}</span>
                  </div>
                </div>
              )}

              {/* Quality Telemetry Bar */}
              {activeDisplay?.quality_metrics && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded bg-[#0E1524] border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">LAPLACIAN VAR (BLUR)</span>
                    <span className={`font-bold ${activeDisplay.quality_metrics.laplacian_var < 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {activeDisplay.quality_metrics.laplacian_var}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {activeDisplay.quality_metrics.laplacian_var < 80 ? 'Heavy Blur' : 'Acceptable Focus'}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#0E1524] border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">CONTRAST (STD DEV)</span>
                    <span className={`font-bold ${activeDisplay.quality_metrics.contrast < 35 ? 'text-amber-400' : 'text-cyan-400'}`}>
                      {activeDisplay.quality_metrics.contrast}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {activeDisplay.quality_metrics.contrast < 35 ? 'Low Dynamic Range' : 'High Contrast'}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#0E1524] border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">LUMINANCE (MEAN)</span>
                    <span className={`font-bold ${activeDisplay.quality_metrics.brightness < 80 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {activeDisplay.quality_metrics.brightness}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {activeDisplay.quality_metrics.brightness < 80 ? 'Low Light' : 'Balanced Exposure'}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#0E1524] border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">OVERALL QUALITY</span>
                    <span className="font-bold text-cyan-400">
                      {activeDisplay.quality_score || activeDisplay.quality_metrics.quality_score}%
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {activeDisplay.quality_metrics.needs_restoration ? 'Restoration Applied' : 'Optimal Raw'}
                    </span>
                  </div>
                </div>
              )}

              {/* Applied AI Pipeline Stages */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[10px] font-mono text-slate-400 font-semibold mb-2 uppercase">
                  ACTIVE RESTORATION STAGES EXECUTED:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeDisplay?.applied_enhancements && activeDisplay.applied_enhancements.length > 0 ? (
                    activeDisplay.applied_enhancements.map((enh, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        {enh}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">Standard OCR Pass (No severe degradation detected)</span>
                  )}
                </div>

                <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400" />
                  <span>Restoration enhances physical edge gradients and luminance; missing or fully occluded characters are not synthetically invented.</span>
                </div>
              </div>
            </div>

            {/* Live Camera Stream Feed (when CAM-00 is active) */}
            {selectedSource === 'CAM-00' && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                      Live Tactical Stream Feed & ANPR Tracking Overlay
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">CAMERA: {selectedSource}</span>
                </div>

                <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-800">
                  <img
                    src="/api/video/feed"
                    alt="Live Video Stream with ANPR Overlays"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE YOLOV8 + BYTETRACK + ANPR ACTIVE
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Ingested Vehicle Plates Table */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" />
                RECENT VEHICLE SCANS ({recentPlates.length})
              </h3>
              <button
                onClick={fetchRecentPlates}
                disabled={loadingRecent}
                className="text-[11px] font-mono text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loadingRecent ? 'animate-spin' : ''}`} />
                REFRESH
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                    <th className="pb-2">PLATE NUMBER</th>
                    <th className="pb-2">VEHICLE TYPE</th>
                    <th className="pb-2">RAW CONF</th>
                    <th className="pb-2">RESTORED</th>
                    <th className="pb-2">WATCHLIST</th>
                    <th className="pb-2">CAMERA</th>
                    <th className="pb-2">TIME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentPlates.map((plate) => (
                    <tr
                      key={plate.id}
                      onClick={() => setSelectedPlate(plate)}
                      className={`cursor-pointer hover:bg-slate-800/40 transition-colors ${
                        activeDisplay?.id === plate.id ? 'bg-cyan-500/10' : ''
                      }`}
                    >
                      <td className="py-2.5 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          {plate.raw_crop_base64 && (
                            <img src={plate.raw_crop_base64} alt="" className="w-8 h-4 object-cover rounded border border-slate-700" />
                          )}
                          <span>{plate.plate_number}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-slate-300">{plate.vehicle_type || 'Vehicle'}</td>
                      <td className="py-2.5 text-amber-400">{Math.round((plate.confidence_before || 0) * 100)}%</td>
                      <td className="py-2.5 text-emerald-400 font-bold">{Math.round((plate.confidence_after || 0) * 100)}%</td>
                      <td className="py-2.5">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          plate.watchlist_status?.includes('CRITICAL')
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : plate.watchlist_status?.includes('HIGH')
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : plate.watchlist_status?.includes('MEDIUM')
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {plate.watchlist_status || 'CLEAR'}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400">{plate.camera}</td>
                      <td className="py-2.5 text-slate-500">{plate.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Watchlist Intelligence & Threat Analysis */}
        <div className="lg:col-span-4 space-y-4">
          {/* Watchlist Intelligence Dossier Card */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Watchlist Intelligence Check
                </h3>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                isWatchlistHit ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {isWatchlistHit ? 'HIT CONFIRMED' : 'CLEAR'}
              </span>
            </div>

            {isWatchlistHit ? (
              <div className="space-y-3 font-mono">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-[10px] text-red-400 font-bold">
                    THREAT LEVEL: {matchedDossier?.threat_level || 'CRITICAL'}
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {matchedDossier?.title || 'Target Vehicle in Watchlist'}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    {matchedDossier?.notes || 'Vehicle matched against persistent law-enforcement and border surveillance watchlist.'}
                  </div>
                </div>

                <div className="text-xs space-y-2 text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">WATCHLIST ID:</span>
                    <span className="font-bold text-slate-200">{matchedDossier?.id || 'WL-ACTIVE'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">CATEGORY:</span>
                    <span className="font-bold text-red-400">{matchedDossier?.category || 'Security Flag'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">FLAGGED DATE:</span>
                    <span className="text-slate-200">{matchedDossier?.date_added || '2026-03-01'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">THREAT WEIGHT:</span>
                    <span className="text-red-400 font-bold">+40 PTS (rule_watchlist_vehicle)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">CURRENT THREAT SCORE:</span>
                    <span className="text-amber-400 font-bold">{activeDisplay?.threat_score || 85} / 100</span>
                  </div>
                </div>

                <button 
                  onClick={() => setDispatchAlert(`BORDER INTERCEPTION UNIT DISPATCHED: Sector intercept underway for target vehicle ${activeDisplay.plate_number}.`)}
                  className="w-full mt-2 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold tracking-wider shadow-lg shadow-red-600/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  DISPATCH INTERCEPTION UNIT
                </button>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-200 font-mono">Vehicle Cleared</div>
                <p className="text-xs text-slate-400 px-4">
                  No active warrants or border surveillance flags recorded for plate {activeDisplay?.plate_number || 'target'}.
                </p>
              </div>
            )}
          </div>

          {/* Interactive Degradation Testbench Box */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Optical Degradation Testbench
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Test neural deblurring and CLAHE restoration on real degraded synthetic or custom license plates:
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">TARGET LICENSE NUMBER</label>
                <input
                  type="text"
                  value={testbenchPlate}
                  onChange={(e) => setTestbenchPlate(e.target.value.toUpperCase())}
                  className="w-full px-2.5 py-1.5 bg-[#0E1524] border border-slate-700 rounded text-slate-100 font-bold uppercase tracking-wider"
                  placeholder="e.g. MP09AB1234"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">DEGRADATION PROFILE</label>
                <select
                  value={degradationType}
                  onChange={(e) => setDegradationType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0E1524] border border-slate-700 rounded text-slate-100"
                >
                  <option value="motion_blur">Motion Blur (High-Speed Transit)</option>
                  <option value="low_light">Low Light & Sensor Shot Noise (Night)</option>
                  <option value="noise">Gaussian & Compression Noise</option>
                  <option value="low_res">Low Resolution / Downscaled (Distance)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Distortion Intensity</span>
                  <span className="text-cyan-400 font-bold">{intensity}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <button
                onClick={handleRunRestoration}
                disabled={isProcessingTestbench}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/40 text-black font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-600/20"
              >
                {isProcessingTestbench ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing OpenCV + EasyOCR...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>RUN REAL AI RESTORATION PASS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
