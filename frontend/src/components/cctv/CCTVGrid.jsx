import React, { useState } from 'react';
import CameraFeedCanvas from './CameraFeedCanvas';
import { Grid2X2, Grid3X3, Maximize2, ShieldCheck } from 'lucide-react';

export default function CCTVGrid({ cameras = [], entities = [], zones = [], tick = 0, isLiveMode = false, telemetry = null }) {
  const [layout, setLayout] = useState('2x2'); // '2x2' or 'all'
  const [focusedCamera, setFocusedCamera] = useState(null);

  const displayedCameras = layout === '2x2' ? cameras.slice(0, 4) : cameras;

  return (
    <div className="space-y-3">
      {/* CCTV Grid Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-bold tracking-wider text-slate-200 font-mono uppercase">
              {isLiveMode ? 'REAL HARDWARE CCTV MATRIX' : 'LIVE TACTICAL FEEDS'} ({displayedCameras.length} CHANNELS)
            </h2>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
            isLiveMode 
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-bold' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {isLiveMode ? 'WEBCAM + YOLOv8 + BYTETRACK' : 'AUTO-CORRELATION ACTIVE'}
          </span>
        </div>

        {/* Layout Switcher */}
        <div className="flex items-center gap-1 bg-[#131D31] p-1 rounded-lg border border-[#1E2D48]">
          <button
            onClick={() => setLayout('2x2')}
            className={`p-1.5 rounded text-xs transition-colors ${
              layout === '2x2' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
            title="2x2 Primary Tactical Feeds"
          >
            <Grid2X2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayout('all')}
            className={`p-1.5 rounded text-xs transition-colors ${
              layout === 'all' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
            title="View All Perimeter Feeds"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Canvas Container */}
      <div className={`grid gap-3.5 ${layout === '2x2' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {displayedCameras.map((cam, idx) => {
          const isThisLive = isLiveMode && (cam.code === 'CAM-00' || cam.code === 'RESTRICTED-Z01' || idx === 0);
          return (
            <CameraFeedCanvas
              key={cam.id}
              camera={cam}
              entities={entities}
              zones={zones}
              tick={tick}
              isLive={isThisLive}
              telemetry={telemetry}
              onSelect={(selected) => setFocusedCamera(selected)}
            />
          );
        })}
      </div>


      {/* Focused Camera Modal */}
      {focusedCamera && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="tactical-card max-w-4xl w-full rounded-2xl overflow-hidden border border-cyan-500/40 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono font-bold text-slate-100 text-sm">
                  {focusedCamera.code} — {focusedCamera.name}
                </span>
              </div>
              <button
                onClick={() => setFocusedCamera(null)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
              >
                CLOSE [ESC]
              </button>
            </div>
            <div className="aspect-video w-full">
              <CameraFeedCanvas
                camera={focusedCamera}
                entities={entities}
                zones={zones}
                tick={tick}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
