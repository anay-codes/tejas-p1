import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck, Activity, Moon, RefreshCw } from 'lucide-react';
import { ANALYTICS_DATA } from '../data/mockData';
import { apiClient } from '../services/api';

export default function Analytics() {
  const [hourlyThreats, setHourlyThreats] = useState(ANALYTICS_DATA.hourlyThreats);
  const [eventTypesBreakdown, setEventTypesBreakdown] = useState(ANALYTICS_DATA.eventTypesBreakdown);
  const [cameraIncidentRankings, setCameraIncidentRankings] = useState(ANALYTICS_DATA.cameraIncidentRankings);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [hourly, hotspots, summary] = await Promise.all([
        apiClient.getHourlyAnalytics(),
        apiClient.getCameraHotspots(),
        apiClient.getAnalyticsSummary()
      ]);

      if (hourly && hourly.length > 0) {
        setHourlyThreats(hourly);
      }
      if (hotspots && hotspots.length > 0) {
        setCameraIncidentRankings(hotspots);
      }
      if (summary?.threat_distribution) {
        const dist = summary.threat_distribution;
        const total = (dist.critical || 0) + (dist.high || 0) + (dist.medium || 0) + (dist.low || 0);
        if (total > 0) {
          setEventTypesBreakdown([
            { name: 'Critical Breach', count: dist.critical || 0, color: '#EF4444' },
            { name: 'High Threat', count: dist.high || 0, color: '#F97316' },
            { name: 'Medium Advisory', count: dist.medium || 0, color: '#F59E0B' },
            { name: 'Routine / Normal', count: dist.low || 0, color: '#10B981' }
          ]);
        }
      }
    } catch (e) {
      console.warn("Analytics fetch failed, using fallback:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-5 p-4 max-w-[1920px] mx-auto">
      {/* Top Banner */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              Surveillance & Threat Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated spatio-temporal trends, perimeter intrusion hotspots, and diurnal risk variance.
          </p>
        </div>

        {/* Time Window Selector & Refresh */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E1524] hover:bg-slate-800 text-slate-300 border border-slate-700 font-mono text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live Telemetry</span>
          </button>
          <div className="bg-slate-900 rounded-lg p-1 border border-slate-800 flex text-xs font-mono">
            <button className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold">24 HOURS</button>
            <button className="px-2.5 py-1 rounded text-slate-400 hover:text-white">7 DAYS</button>
            <button className="px-2.5 py-1 rounded text-slate-400 hover:text-white">30 DAYS</button>
          </div>
        </div>
      </div>

      {/* Primary Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Events Over 24 Hours by Severity (8 Cols) */}
        <div className="lg:col-span-8 tactical-card rounded-xl p-5 border border-[#1E2D48]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Threat Activity Over Time (24h Window)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
              <Moon className="w-3 h-3" />
              Peak Night Infiltration Risk: 02:00 - 05:00
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyThreats}>
                <defs>
                  <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D48" />
                <XAxis dataKey="hour" stroke="#64748B" fontSize={11} fontFamiliy="JetBrains Mono" />
                <YAxis stroke="#64748B" fontSize={11} fontFamiliy="JetBrains Mono" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E1524', 
                    borderColor: '#1E2D48', 
                    borderRadius: '8px', 
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono' 
                  }} 
                />
                <Area type="monotone" dataKey="critical" stroke="#EF4444" fillOpacity={1} fill="url(#colorCritical)" name="Critical" />
                <Area type="monotone" dataKey="high" stroke="#F97316" fillOpacity={1} fill="url(#colorHigh)" name="High" />
                <Area type="monotone" dataKey="medium" stroke="#F59E0B" fillOpacity={1} fill="url(#colorMedium)" name="Medium" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Event Classification Pie (4 Cols) */}
        <div className="lg:col-span-4 tactical-card rounded-xl p-5 border border-[#1E2D48]">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Event Types Distribution
            </h3>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={eventTypesBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {eventTypesBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E1524', 
                    borderColor: '#1E2D48', 
                    borderRadius: '8px', 
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono' 
                  }} 
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lower Analytics: Hotspot Camera Rankings */}
      <div className="tactical-card rounded-xl p-5 border border-[#1E2D48]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-4">
          PERIMETER NODE INCIDENT DENSITY RANKING
        </h3>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cameraIncidentRankings} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D48" />
              <XAxis type="number" stroke="#64748B" fontSize={11} />
              <YAxis dataKey="camera" type="category" stroke="#64748B" fontSize={11} width={120} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0E1524', 
                  borderColor: '#1E2D48', 
                  borderRadius: '8px', 
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono' 
                }} 
              />
              <Bar dataKey="incidents" fill="#06B6D4" radius={[0, 4, 4, 0]} name="Total Incidents" />
              <Bar dataKey="avgThreat" fill="#EF4444" radius={[0, 4, 4, 0]} name="Avg Threat Score" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
