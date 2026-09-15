import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertOctagon, 
  ArrowRight, 
  Filter, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Search, 
  Radio,
  Zap,
  Play,
  RefreshCw,
  Camera,
  Check,
  Eye
} from 'lucide-react';
import { apiClient } from '../services/api';
import { wsService } from '../services/websocket';

export default function Incidents() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState(null);

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getIncidents(filterStatus, filterSeverity);
      setIncidents(data || []);
    } catch (err) {
      console.error("Failed to fetch incidents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();

    // Subscribe to real-time incident broadcasts
    const unsubscribe = wsService.subscribe((msg) => {
      if (msg.type === 'NEW_INCIDENT' || msg.type === 'INCIDENT_UPDATED' || msg.type === 'CORRELATED_EVENT') {
        fetchIncidents();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [filterStatus, filterSeverity]);

  const handleQuickStatus = async (e, incidentId, targetStatus) => {
    e.stopPropagation(); // prevent row navigation
    try {
      await apiClient.updateIncidentStatus(
        incidentId, 
        targetStatus, 
        "Duty Operator", 
        null, 
        `Quick action to ${targetStatus}`
      );
      await fetchIncidents();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleTriggerTest = async (targetType = "PERSON") => {
    setIsTriggering(true);
    setTriggerFeedback(null);
    try {
      const res = await apiClient.triggerTestIncident({
        camera_id: "CAM-00",
        target_type: targetType,
        threat_scenario: targetType === "PERSON" ? "RESTRICTED_ZONE_ENTRY" : "WATCHLIST_VEHICLE"
      });
      if (res && res.success) {
        setTriggerFeedback(`Generated ${res.incident_id} (${res.title}) with evidence`);
        await fetchIncidents();
        setTimeout(() => setTriggerFeedback(null), 5000);
      }
    } catch (err) {
      console.error("Failed to trigger test incident:", err);
    } finally {
      setIsTriggering(false);
    }
  };

  const filtered = incidents.filter(inc => {
    const target = inc.target_entity || '';
    const title = inc.title || '';
    const cam = inc.primary_camera || '';
    const id = inc.id || '';
    const q = searchQuery.toLowerCase();
    return title.toLowerCase().includes(q) ||
           target.toLowerCase().includes(q) ||
           cam.toLowerCase().includes(q) ||
           id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5 p-4 max-w-[1920px] mx-auto">
      {/* Top Header Card */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0B1220] via-[#0D182E] to-[#0B1220]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              Operational Incident Management & Evidence Dossier
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 pl-9 font-mono">
            Correlated threat incidents automatically created from perimeter intrusions, watchlist matches, and multi-camera transitions with physical evidence capture.
          </p>
        </div>

        {/* Action Controls & Test Triggers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleTriggerTest("PERSON")}
            disabled={isTriggering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-mono text-xs font-bold shadow-lg shadow-red-600/20 transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isTriggering ? 'Triggering...' : 'Trigger Test Intrusion'}</span>
          </button>

          <button
            onClick={() => handleTriggerTest("VEHICLE")}
            disabled={isTriggering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/80 hover:bg-orange-500 text-white font-mono text-xs font-bold shadow-lg shadow-orange-600/20 transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Watchlist Hit</span>
          </button>

          <button
            onClick={fetchIncidents}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {triggerFeedback && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <strong>System Notification:</strong> {triggerFeedback}
          </span>
          <span className="text-[10px] text-emerald-400/80">PERSISTED TO DATABASE</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
          <span className="text-slate-500 text-[11px] mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> STATUS:
          </span>
          {['ALL', 'NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                filterStatus === st
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Severity & Search Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ID, entity, camera..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-400 w-56"
            />
          </div>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="tactical-card rounded-xl border border-[#1E2D48] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono">
            <thead>
              <tr className="bg-[#0E1524] border-b border-[#1E2D48] text-[11px] uppercase text-slate-400">
                <th className="py-3 px-4">INCIDENT ID / TITLE</th>
                <th className="py-3 px-4">TARGET ENTITY</th>
                <th className="py-3 px-4">THREAT SCORE</th>
                <th className="py-3 px-4">SEVERITY</th>
                <th className="py-3 px-4">PRIMARY CAMERA</th>
                <th className="py-3 px-4">LIFECYCLE STATUS</th>
                <th className="py-3 px-4">TIMESTAMP</th>
                <th className="py-3 px-4 text-right">OPERATOR ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D48] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p>No incidents match the active filters.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Click "Trigger Test Intrusion" above to generate a live operational incident.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => {
                  const isCritical = inc.severity === 'CRITICAL' || inc.threat_score >= 80;
                  const isHigh = inc.severity === 'HIGH' || inc.threat_score >= 60;
                  return (
                    <tr 
                      key={inc.id} 
                      onClick={() => navigate(`/incidents/${inc.id}`)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">
                          {inc.id}
                        </div>
                        <div className="text-slate-400 text-[11px] truncate max-w-xs">{inc.title}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 font-semibold">
                        {inc.target_entity}
                      </td>

                      <td className="py-3.5 px-4 font-bold">
                        <span className={isCritical ? 'text-red-400' : isHigh ? 'text-orange-400' : 'text-amber-400'}>
                          {inc.threat_score} / 100
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                          isCritical
                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : isHigh
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        }`}>
                          {inc.severity}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                        <span>{inc.primary_camera}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                          inc.status === 'NEW'
                            ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                            : inc.status === 'ACKNOWLEDGED'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : inc.status === 'INVESTIGATING'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {inc.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {inc.timestamp}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inc.status === 'NEW' && (
                            <button
                              onClick={(e) => handleQuickStatus(e, inc.id, 'ACKNOWLEDGED')}
                              className="px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] font-bold shadow transition-colors"
                              title="Acknowledge Incident"
                            >
                              Ack
                            </button>
                          )}

                          {inc.status === 'ACKNOWLEDGED' && (
                            <button
                              onClick={(e) => handleQuickStatus(e, inc.id, 'INVESTIGATING')}
                              className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold shadow transition-colors"
                              title="Start Investigation"
                            >
                              Investigate
                            </button>
                          )}

                          {inc.status === 'INVESTIGATING' && (
                            <button
                              onClick={(e) => handleQuickStatus(e, inc.id, 'RESOLVED')}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow transition-colors"
                              title="Mark Resolved"
                            >
                              Resolve
                            </button>
                          )}

                          <button 
                            onClick={() => navigate(`/incidents/${inc.id}`)}
                            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 pl-1 group-hover:translate-x-1 transition-transform"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Dossier</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
