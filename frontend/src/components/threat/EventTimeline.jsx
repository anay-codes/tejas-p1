import React from 'react';
import { Clock, ShieldAlert, GitCommit, ArrowDown } from 'lucide-react';

export default function EventTimeline({ incident = null, events = [] }) {
  // Format from incident timeline or recent live events
  let timelineItems = [];
  if (incident?.timeline && incident.timeline.length > 0) {
    timelineItems = incident.timeline.map(t => ({
      time: typeof t === 'string' ? '' : (t.time || t.timestamp || ''),
      camera: t.camera || t.camera_id || incident.camera_id || 'SECTOR-CAM',
      event: typeof t === 'string' ? t : (t.event || t.description || JSON.stringify(t))
    }));
  } else if (events && events.length > 0) {
    timelineItems = events.slice(0, 5).map(e => ({
      time: e.timestamp ? new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false }) : 'LIVE',
      camera: e.camera_id || 'CAM-00',
      event: `${e.event_type || 'DETECTION'} • Track #${e.track_id ?? 'N/A'} (${e.object_type || 'target'}) - Conf: ${e.confidence ? Math.round(e.confidence * 100) : 90}%`
    }));
  }

  return (
    <div className="tactical-card rounded-xl p-4 border border-[#1E2D48] flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#1E2D48] mb-3">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {incident ? 'Correlated Incident Timeline' : 'Live Event Audit Timeline'}
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          {incident ? 'INCIDENT DOSSIER' : 'EVENT LOG'}
        </span>
      </div>

      <div className="relative pl-6 space-y-4 my-2 flex-1">
        {timelineItems.length > 0 ? (
          <>
            {/* Vertical linking line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-cyan-500/40 via-amber-500/50 to-red-500" />

            {timelineItems.map((item, idx) => {
              const isLatest = idx === 0 || idx === timelineItems.length - 1;
              return (
                <div key={idx} className="relative group">
                  {/* Dot marker */}
                  <div 
                    className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isLatest
                        ? 'bg-red-500 border-white ring-4 ring-red-500/30'
                        : 'bg-slate-900 border-cyan-400'
                    }`}
                  />

                  <div className="flex items-center justify-between text-[11px] font-mono mb-0.5">
                    <span className="font-bold text-cyan-400">{item.camera}</span>
                    <span className="text-slate-500">{item.time}</span>
                  </div>

                  <div className={`text-xs p-2 rounded-lg border transition-colors ${
                    isLatest 
                      ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}>
                    {item.event}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center text-slate-500">
            <Clock className="w-8 h-8 mb-2 text-slate-600 animate-pulse" />
            <span className="text-xs font-mono">SECTOR SENSORS CALIBRATED</span>
            <span className="text-[10px] text-slate-600 mt-1">No security violations recorded in current window</span>
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>CORRELATION ENGINE: ACTIVE</span>
        <span className="text-cyan-400 font-bold">{timelineItems.length > 0 ? `${timelineItems.length} EVENTS LINKED` : 'STATUS: NORMAL'}</span>
      </div>
    </div>
  );
}
