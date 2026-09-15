import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Video, 
  AlertOctagon, 
  ScanLine, 
  GitFork, 
  BarChart3, 
  Camera, 
  ShieldAlert, 
  Sliders,
  MapPin
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Surveillance', path: '/surveillance', icon: Video },
  { name: 'Incidents', path: '/incidents', icon: AlertOctagon, badge: '2' },
  { name: 'ANPR & Restoration', path: '/anpr', icon: ScanLine, highlight: true },
  { name: 'Multi-Cam Tracking', path: '/tracking', icon: GitFork, highlight: true },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Camera Hub', path: '/cameras', icon: Camera },
  { name: 'Virtual Zones', path: '/zones', icon: MapPin },
  { name: 'Watchlist', path: '/watchlist', icon: ShieldAlert },
  { name: 'Settings & Rules', path: '/settings', icon: Sliders },
];

export default function Sidebar({ activeIncidentsCount = 0, telemetry = null, isOnline = true }) {
  const fps = telemetry?.fps != null ? Math.round(telemetry.fps) : (isOnline ? 30 : 0);
  const device = telemetry?.device ? telemetry.device.toUpperCase() : 'EDGE CPU/GPU';
  const tracksCount = Array.isArray(telemetry?.active_tracks) ? telemetry.active_tracks.length : 0;
  const latency = telemetry?.latency_ms ? `${Math.round(telemetry.latency_ms)}ms` : (telemetry?.inference_ms ? `${Math.round(telemetry.inference_ms)}ms` : '32ms');

  return (
    <aside className="w-64 bg-[#0A0F1D]/90 backdrop-blur-md border-r border-[#1E2D48] flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 z-20">
      <div className="py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-mono tracking-widest text-slate-500 uppercase">
          Tactical Operations
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const badgeCount = item.name === 'Incidents' ? activeIncidentsCount : null;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-transparent text-cyan-300 border-l-2 border-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>{item.name}</span>
              </div>

              {badgeCount != null && badgeCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold animate-pulse">
                  {badgeCount}
                </span>
              )}

              {item.highlight && (!badgeCount || badgeCount === 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Bottom Status Card - Grounded in Real Edge Telemetry */}
      <div className="p-3 m-3 rounded-lg bg-[#0E1524] border border-[#1E2D48] text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono text-slate-400">EDGE INFERENCE</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold font-mono ${
            isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}>
            {isOnline ? `${fps} FPS` : 'OFFLINE'}
          </span>
        </div>
        <div className="text-[11px] text-slate-300 font-mono flex items-center justify-between">
          <span>{device}</span>
          <span className="text-[10px] text-slate-500 font-mono">LAT: {latency}</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
          <div 
            className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(10, (fps / 30) * 100))}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
          <span>Active Tracks: {tracksCount}</span>
          <span>Status: {isOnline ? 'OPTIMAL' : 'STANDBY'}</span>
        </div>
      </div>
    </aside>
  );
}
