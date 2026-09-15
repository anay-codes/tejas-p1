import React from 'react';
import { Camera, ShieldCheck, AlertTriangle, Activity, Cpu } from 'lucide-react';

export default function KPIStatsRow({ 
  totalCameras = 7, 
  onlineCameras = 7, 
  activeThreats = 0, 
  eventsToday = 0, 
  eventsSubtitle = 'Live Event Stream Active',
  inferenceLatency = "28ms",
  inferenceSubtitle = "YOLOv8 + ByteTrack Engine"
}) {
  const onlinePct = totalCameras > 0 ? Math.round((onlineCameras / totalCameras) * 100) : 100;
  const stats = [
    {
      title: 'TOTAL CAMERAS',
      value: totalCameras,
      subvalue: `${onlineCameras}/${totalCameras} ONLINE (${onlinePct}%)`,
      icon: Camera,
      color: 'text-cyan-400',
      border: 'border-cyan-500/30'
    },
    {
      title: 'ACTIVE THREATS',
      value: activeThreats,
      subvalue: activeThreats > 0 ? `${activeThreats} THREAT DETECTED` : 'PERIMETER SECURE',
      icon: AlertTriangle,
      color: activeThreats > 0 ? 'text-red-400' : 'text-emerald-400',
      border: activeThreats > 0 ? 'border-red-500/40' : 'border-emerald-500/30',
      pulse: activeThreats > 0
    },
    {
      title: 'EVENTS LOGGED TODAY',
      value: eventsToday,
      subvalue: eventsSubtitle,
      icon: Activity,
      color: 'text-amber-400',
      border: 'border-amber-500/30'
    },
    {
      title: 'AI INFERENCE LATENCY',
      value: inferenceLatency,
      subvalue: inferenceSubtitle,
      icon: Cpu,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div 
            key={i} 
            className={`tactical-card p-3.5 rounded-xl border ${stat.border} flex items-center justify-between relative overflow-hidden`}
          >
            <div>
              <div className="text-[10px] font-mono tracking-wider text-slate-400 font-semibold mb-1">
                {stat.title}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-extrabold font-mono ${stat.color} ${stat.pulse ? 'animate-pulse' : ''}`}>
                  {stat.value}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                {stat.subvalue}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
              <Icon className={`w-5 h-5 ${stat.color}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
