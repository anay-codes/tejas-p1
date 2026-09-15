import React from 'react';
import { AlertTriangle, ShieldCheck, Info, HelpCircle } from 'lucide-react';

export default function ThreatIntelPanel({ threatAssessment, activeEntity = "PERSON #27" }) {
  const { score, severity, severityColor, badgeClass, factors } = threatAssessment || {
    score: 82,
    severity: 'HIGH',
    severityColor: '#EF4444',
    badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30',
    factors: []
  };

  return (
    <div className="tactical-card rounded-xl p-4 flex flex-col justify-between border border-[#1E2D48] relative overflow-hidden">
      {/* Decorative gradient aura */}
      <div 
        className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-500"
        style={{ backgroundColor: severityColor }}
      />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E2D48]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <AlertTriangle className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Threat Evaluation Engine</h3>
              <p className="text-[10px] text-slate-400 font-mono">Target: {activeEntity} (Correlated Incident)</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 text-[11px] font-bold font-mono tracking-wider rounded-md border ${badgeClass}`}>
            {severity} RISK
          </span>
        </div>

        {/* Score Radial / Gauge Display */}
        <div className="py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span 
              className="text-4xl font-extrabold font-mono tracking-tight transition-colors duration-300"
              style={{ color: severityColor }}
            >
              {score}
            </span>
            <span className="text-slate-500 font-mono text-base font-bold">/ 100</span>
          </div>

          <div className="flex-1 max-w-[200px]">
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span>0 LOW</span>
              <span>60 HIGH</span>
              <span>100</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800 p-0.5">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, Math.max(5, score))}%`,
                  backgroundColor: severityColor 
                }}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Explainability Breakdown */}
        <div className="space-y-2 mt-1">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-400 pb-1 border-b border-slate-800/60">
            <span>OBSERVED FACTOR</span>
            <span>WEIGHT</span>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {factors && factors.length > 0 ? (
              factors.map((f, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${f.delta > 0 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <span className="text-slate-300 font-medium">{f.name}</span>
                  </div>
                  <span className={`font-mono font-bold ${f.delta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {f.delta > 0 ? `+${f.delta}` : f.delta}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 py-3 text-center">
                No acute threat indicators currently active.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Crucial Ethical / Operational Transparency Disclaimer */}
      <div className="mt-4 pt-3 border-t border-[#1E2D48] flex items-start gap-2 bg-[#0B111E]/80 p-2.5 rounded-lg border border-slate-800/50">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-400 leading-normal">
          <strong className="text-slate-300">Operational Notice:</strong> Threat score quantifies cumulative perimeter event risk & operational response priority, <span className="underline decoration-cyan-500/50">not</span> subjective criminal intent.
        </p>
      </div>
    </div>
  );
}
