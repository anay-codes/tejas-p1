import React, { useState, useEffect } from 'react';
import { Shield, Radio, Play, Pause, RotateCcw, Bell, User, Clock, AlertTriangle } from 'lucide-react';

export default function Navbar({ 
  isConnected = true, 
  activeIncidentsCount = 0, 
  currentScore = 10,
  severity = 'LOW'
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }) + ' IST');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityStyle = (score, sev) => {
    if (score >= 80 || sev === 'CRITICAL') {
      return { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', label: 'CRITICAL ALERT' };
    }
    if (score >= 60 || sev === 'HIGH') {
      return { bg: 'bg-orange-500/15', border: 'border-orange-500/40', text: 'text-orange-400', label: 'HIGH RISK' };
    }
    if (score >= 30 || sev === 'MEDIUM') {
      return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'MEDIUM ADVISORY' };
    }
    return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'SECURE / NORMAL' };
  };

  const sevStyle = getSeverityStyle(currentScore, severity);

  return (
    <header className="h-16 bg-[#080E1B]/95 backdrop-blur-md border-b border-[#1E2D48] px-4 flex items-center justify-between z-30 sticky top-0 shadow-lg">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
          <Shield className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-wider text-white font-mono">TEJAS</span>
            <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
              COMMAND & CONTROL
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block tracking-wide">
            Threat Evaluation & Joint AI Surveillance • <span className="text-cyan-400/90 italic">Border Intelligence Platform</span>
          </p>
        </div>
      </div>

      {/* Operational Status HUD */}
      <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
        {/* Backend & WebSocket Health Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-md border ${
          isConnected 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          <span className="relative flex h-2 w-2">
            {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="font-semibold tracking-wider">
            {isConnected ? 'LIVE TELEMETRY ACTIVE' : 'CONNECTING SEC-NET'}
          </span>
        </div>

        {/* Real Clock */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#0F182A] border border-[#1E2D48] text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold">{timeStr}</span>
        </div>

        {/* Threat Level Meter */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-md border ${sevStyle.bg} ${sevStyle.border} ${sevStyle.text}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="font-bold">THREAT: {currentScore}/100</span>
          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-black/40 border border-current">
            {sevStyle.label}
          </span>
        </div>
      </div>

      {/* Incidents & Operator Profile */}
      <div className="flex items-center gap-3">
        {/* Active Incidents Quick Badge */}
        <a
          href="/incidents"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0F182A] hover:bg-[#16233B] border border-[#1E2D48] hover:border-cyan-500/40 transition-all font-mono text-xs"
        >
          <Bell className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300 hidden sm:inline">INCIDENTS</span>
          <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${
            activeIncidentsCount > 0 
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            {activeIncidentsCount}
          </span>
        </a>

        {/* Operator Identity */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#1E2D48]">
          <div className="w-8 h-8 rounded-full bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs shadow-inner">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden xl:block text-left text-xs">
            <div className="font-semibold text-slate-200 leading-tight">Cmdr. R. Verma</div>
            <div className="text-[10px] text-cyan-400 font-mono">SECTOR COMMANDER • L4</div>
          </div>
        </div>
      </div>
    </header>
  );
}
