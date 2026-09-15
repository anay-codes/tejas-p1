import React from 'react';
import { Play, ShieldAlert, Car, UserCheck, Package, RotateCcw } from 'lucide-react';
import { simulator } from '../../services/demoSimulator';

export default function ScenarioBar({ activeScenario = 'infiltration' }) {
  const scenarios = [
    {
      id: 'infiltration',
      label: '1. Night Infiltration & Fence Breach',
      desc: 'Person #27 handoff across 4 cameras -> 82/100 Threat',
      icon: ShieldAlert,
      color: 'hover:border-red-500/50 hover:bg-red-500/10'
    },
    {
      id: 'watchlist_vehicle',
      label: '2. Watchlist Vehicle (ANPR Hit)',
      desc: 'Black Scorpio MP09AB1234 -> Super-Res & OCR Match',
      icon: Car,
      color: 'hover:border-orange-500/50 hover:bg-orange-500/10'
    },
    {
      id: 'authorized_guard',
      label: '3. Friendly Guard Override',
      desc: 'Facial & RFID match -> -30 Threat Score Override (Secure)',
      icon: UserCheck,
      color: 'hover:border-emerald-500/50 hover:bg-emerald-500/10'
    },
    {
      id: 'abandoned_object',
      label: '4. Abandoned Object (Dwell > 120s)',
      desc: 'Suspicious unattended item detected in depot yard',
      icon: Package,
      color: 'hover:border-amber-500/50 hover:bg-amber-500/10'
    }
  ];

  return (
    <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-200">
            SIH Interactive Demonstration Scenarios
          </span>
        </div>
        <button
          onClick={() => simulator.reset()}
          className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
          title="Reset Simulation Scenario"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isActive = activeScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => simulator.triggerScenario(sc.id)}
              className={`p-2 rounded-lg border text-left transition-all ${
                isActive
                  ? 'bg-cyan-500/15 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                  : `bg-[#0E1524] border-slate-800/80 ${sc.color}`
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span className={`text-xs font-bold font-mono ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                  {sc.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">{sc.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
