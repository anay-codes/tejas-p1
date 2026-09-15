import React, { useState, useEffect } from 'react';
import { Sliders, Save, RotateCcw, Shield, Bell, UserCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { INITIAL_THREAT_RULES } from '../data/mockData';
import { simulator } from '../services/demoSimulator';
import { apiClient } from '../services/api';

export default function Settings() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [userRole, setUserRole] = useState('ADMIN');
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [criticalThreshold, setCriticalThreshold] = useState(80);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getThreatRules();
      if (data && data.length > 0) {
        setRules(data);
      } else {
        setRules(INITIAL_THREAT_RULES);
      }
    } catch (e) {
      setRules(INITIAL_THREAT_RULES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleWeightChange = (id, newWeight) => {
    const updated = rules.map(r => r.id === id ? { ...r, weight: Number(newWeight) } : r);
    setRules(updated);
    simulator.updateRuleWeight(id, Number(newWeight));
  };

  const handleSave = async () => {
    try {
      await Promise.all(
        rules.map(r => apiClient.updateThreatRule(r.id, r.weight, r.enabled !== false))
      );
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.warn("Failed to persist rules to backend:", e);
    }
  };

  const handleResetDefaults = async () => {
    setRules(INITIAL_THREAT_RULES);
    INITIAL_THREAT_RULES.forEach(r => {
      simulator.updateRuleWeight(r.id, r.weight);
      apiClient.updateThreatRule(r.id, r.weight, true);
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-4 p-4 max-w-[1920px] mx-auto">
      {/* Top Banner */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              Threat Evaluation Engine Configuration & System Settings
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calibrate rule scoring weights, automated alarm escalation thresholds, and role-based operational permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Changes Applied
            </span>
          )}
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold shadow-lg shadow-cyan-600/30"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Rules</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: Threat Evaluation Rules Scoring Calibration */}
        <div className="lg:col-span-8 tactical-card rounded-xl p-5 border border-[#1E2D48]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-4">
            THREAT SCORING WEIGHTS CALIBRATION (0 - 100 NORMALIZED)
          </h3>

          <div className="space-y-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-3.5 rounded-lg bg-[#0E1524] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{rule.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                      {rule.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{rule.desc}</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-56">
                  <input
                    type="range"
                    min={rule.weight < 0 ? -50 : 5}
                    max={rule.weight < 0 ? 0 : 50}
                    value={rule.weight}
                    onChange={(e) => handleWeightChange(rule.id, e.target.value)}
                    className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <span className={`font-mono text-sm font-extrabold w-12 text-right ${
                    rule.weight > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {rule.weight > 0 ? `+${rule.weight}` : rule.weight}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 4 Cols: System & Operator Parameters */}
        <div className="lg:col-span-4 space-y-4">
          <div className="tactical-card rounded-xl p-5 border border-[#1E2D48]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-4">
              ALARM & ESCALATION THRESHOLDS
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">
                  Critical Alarm Score Threshold ({criticalThreshold}/100)
                </label>
                <input
                  type="range"
                  min="60"
                  max="95"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-red-400 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Audible Alarm Siren</span>
                <input
                  type="checkbox"
                  checked={audioAlerts}
                  onChange={(e) => setAudioAlerts(e.target.checked)}
                  className="w-4 h-4 rounded accent-cyan-400"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Active Role Profile</span>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-400 font-bold"
                >
                  <option value="ADMIN">ADMIN (Full Authority)</option>
                  <option value="OPERATOR">OPERATOR (Surveillance/Ack)</option>
                  <option value="VIEWER">VIEWER (Read-Only)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48] text-xs font-mono space-y-2">
            <div className="text-slate-400 uppercase text-[10px]">INTELLIGENCE ENGINE METRICS</div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-500">CORRELATION WINDOW:</span>
              <span className="text-slate-200 font-bold">300 Seconds</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-500">MAX TRACKING STALENESS:</span>
              <span className="text-slate-200 font-bold">45 Seconds</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">RE-ID EMBEDDING DISTANCE:</span>
              <span className="text-cyan-400 font-bold">Cosine ≤ 0.35</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
