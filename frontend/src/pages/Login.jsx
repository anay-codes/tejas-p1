import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, Lock, User, ArrowRight } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('operator.rawat');
  const [password, setPassword] = useState('••••••••••••');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#080C14] flex items-center justify-center p-4 relative overflow-hidden hud-grid">
      {/* Background glow effects */}
      <div className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20" />
      <div className="absolute w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20" />

      <div className="tactical-card max-w-md w-full rounded-2xl p-8 border border-[#1E2D48] relative z-10 shadow-2xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <Shield className="w-7 h-7 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wider font-mono">
            TEJAS
          </h1>
          <p className="text-xs text-cyan-400 font-mono tracking-widest mt-0.5">
            THREAT EVALUATION & JOINT AI SURVEILLANCE
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            Secure Command Centre Terminal Authentication
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Operator Identifier / Call-sign
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#0E1524] border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              Security Passcode / Token
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#0E1524] border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold tracking-wider uppercase text-xs shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all group"
          >
            <span>Authenticate Session</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        {/* Credentials hints for reviewer */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[10px] font-mono text-slate-500">
          AUTHORIZED ROLES: ADMIN / CHIEF OPERATOR / DISPATCHER
        </div>
      </div>
    </div>
  );
}
