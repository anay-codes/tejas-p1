import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowRight, ShieldAlert, AlertCircle, Clock } from 'lucide-react';

export default function RealtimeAlertStream({ alerts = [] }) {
  const navigate = useNavigate();

  const getSeverityStyle = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return { badge: 'bg-red-500/20 text-red-400 border-red-500/40', border: 'border-l-red-500' };
      case 'HIGH':
        return { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40', border: 'border-l-orange-500' };
      case 'MEDIUM':
        return { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40', border: 'border-l-amber-500' };
      default:
        return { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', border: 'border-l-emerald-500' };
    }
  };

  return (
    <div className="tactical-card rounded-xl p-4 border border-[#1E2D48] flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#1E2D48] mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Real-Time Alert Stream
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
          LIVE QUEUE
        </span>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1 flex-1">
        {alerts && alerts.length > 0 ? (
          alerts.map((alt) => {
            const style = getSeverityStyle(alt.severity);
            return (
              <div
                key={alt.id}
                onClick={() => {
                  const targetId = alt.incident_id || alt.incidentId;
                  if (targetId) {
                    navigate(`/incidents/${targetId}`);
                  } else {
                    navigate('/incidents');
                  }
                }}
                className={`p-2.5 rounded-lg bg-[#0E1524]/90 border border-[#1E2D48] border-l-4 ${style.border} hover:bg-slate-800/80 cursor-pointer transition-all hover:border-slate-600 group`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border ${style.badge}`}>
                    {alt.severity}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{alt.timestamp}</span>
                  </div>
                </div>

                <div className="font-semibold text-xs text-slate-200 group-hover:text-cyan-300 transition-colors">
                  {alt.title}
                </div>

                <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                  {alt.message}
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                  <span className="text-cyan-400/90">{alt.camera}</span>
                  <span className="flex items-center gap-1 text-slate-400 group-hover:text-cyan-400">
                    Investigate <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-xs text-slate-500">
            No unhandled alerts in queue.
          </div>
        )}
      </div>
    </div>
  );
}
