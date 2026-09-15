import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Maximize2, Shield, Eye, Radio, Sparkles, RefreshCw, AlertTriangle, Video, CheckCircle2 } from 'lucide-react';
import { renderCCTVFrame } from '../../utils/canvasRenderer';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const LIVE_FEED_URL = `${API_BASE}/video/feed`;

export default function CameraFeedCanvas({ 
  camera, 
  entities = [], 
  zones = [], 
  tick = 0,
  onSelect = null,
  isFocused = false,
  isLive = false,
  telemetry = null
}) {
  const canvasRef = useRef(null);
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());
  const [retryCount, setRetryCount] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Only run canvas loop if not running in real video mode
    if (isLive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId;
    const render = () => {
      renderCCTVFrame(canvas, camera, entities, zones, tick);
      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [camera, entities, zones, tick, isLive]);

  // Handle transient image stream errors with auto-recovery
  const handleStreamError = useCallback(() => {
    if (retryCount < 3) {
      setIsReconnecting(true);
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setStreamKey(Date.now());
        setIsReconnecting(false);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setStreamError(true);
      setIsReconnecting(false);
    }
  }, [retryCount]);

  const handleManualRetry = () => {
    setStreamError(false);
    setRetryCount(0);
    setIsReconnecting(false);
    setStreamKey(Date.now());
  };

  // AI Pipeline tags
  const aiTags = [
    { label: isLive ? 'YOLOv8-N (Real)' : 'Person Det', active: true },
    { label: isLive ? 'ByteTrack' : 'Tracking', active: true },
    { label: isLive ? `${telemetry?.device?.toUpperCase() || 'CPU'}` : 'Zone Fence', active: true },
    { label: isLive ? `CAP: ${telemetry?.fps || 0} FPS` : 'Sim', active: true },
    { label: isLive ? `INF: ${telemetry?.infer_fps || 0} FPS` : 'OSD', active: true },
    { label: isLive ? `LAT: ${telemetry?.inference_ms || 0}ms` : 'HUD', active: true }
  ];

  return (
    <div className="group tactical-card rounded-xl overflow-hidden border border-[#1E2D48] relative flex flex-col transition-all duration-200 hover:border-cyan-500/40">
      {/* Feed Area */}
      <div className="relative aspect-video bg-black w-full overflow-hidden flex items-center justify-center">
        {isLive ? (
          streamError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#070B14] w-full h-full">
              <AlertTriangle className="w-8 h-8 text-amber-400 animate-bounce" />
              <div className="text-xs font-mono text-slate-300 font-bold">
                CAMERA STREAM DISCONNECTED
              </div>
              <p className="text-[11px] font-mono text-slate-500 max-w-sm">
                Target camera device ({telemetry?.source ?? 'Default'}) is not delivering frames. Use "+ Add / Switch Camera" to select an active source.
              </p>
              <button
                onClick={handleManualRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconnect Stream</span>
              </button>
            </div>
          ) : (
            <>
              <img
                key={streamKey}
                src={`${LIVE_FEED_URL}?t=${streamKey}`}
                alt="TEJAS Live YOLOv8 Stream"
                className="w-full h-full object-contain bg-black"
                onError={handleStreamError}
                onLoad={() => {
                  setStreamError(false);
                  setRetryCount(0);
                  setIsReconnecting(false);
                }}
              />
              {isReconnecting && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/90 text-black font-mono text-[10px] font-bold shadow-lg z-20 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>STREAM SYNCING...</span>
                </div>
              )}
            </>
          )
        ) : (
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="w-full h-full object-cover"
          />
        )}

        {/* Live Indicator Pill in Corner */}
        {isLive && !streamError && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600/90 text-white font-mono text-[10px] font-extrabold shadow-lg z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>LIVE HARDWARE INGEST</span>
          </div>
        )}

        {/* Tactical Crosshair / Corner Reticles */}
        <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between opacity-60">
          <div className="flex justify-between">
            <div className="w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
            <div className="w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
          </div>
          <div className="flex justify-between">
            <div className="w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
            <div className="w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
          </div>
        </div>
      </div>

      {/* Camera Meta & Telemetry Sub-bar */}
      <div className="p-3 bg-[#0B111E] border-t border-[#1E2D48] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-slate-200">
            {isLive ? `ACTIVE SOURCE: ${telemetry?.source ?? '0'}` : (camera?.name || 'CAM-01')}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {isLive ? `${telemetry?.active_tracks?.length || 0} Tracks` : (camera?.location || 'Sector A')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {aiTags.map((tag, idx) => (
            <span 
              key={idx}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                tag.active 
                  ? 'bg-cyan-950/60 border-cyan-800/80 text-cyan-300 font-semibold' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-500'
              }`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
