import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Camera, 
  User, 
  Check, 
  Send, 
  ShieldAlert,
  Download,
  Car,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Activity,
  Maximize2
} from 'lucide-react';
import { apiClient } from '../services/api';
import { wsService } from '../services/websocket';

export default function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [operatorNote, setOperatorNote] = useState('');
  const [operatorName, setOperatorName] = useState('Duty Operator');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionInput, setResolutionInput] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  // Load incident details from backend REST API
  const fetchIncidentDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getIncidentDetail(id);
      if (data) {
        setIncident(data);
        if (data.evidence && data.evidence.length > 0) {
          setSelectedEvidence(data.evidence[0]);
        }
      } else {
        setError(`Incident ${id} was not found in the tactical registry.`);
      }
    } catch (err) {
      console.error('Error fetching incident detail:', err);
      setError('Failed to connect to backend tactical registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentDetail();

    // Subscribe to real-time incident lifecycle changes
    const unsubscribe = wsService.subscribe((msg) => {
      if ((msg.type === 'INCIDENT_UPDATED' || msg.type === 'NEW_INCIDENT') && msg.data?.id === id) {
        fetchIncidentDetail();
        setFeedbackMsg(`Live Update: Incident updated by ${msg.data?.user || 'System'}`);
        setTimeout(() => setFeedbackMsg(''), 4000);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id]);

  // Handle lifecycle status change
  const handleStatusTransition = async (targetStatus, resolutionNotes = null) => {
    if (!incident) return;
    try {
      setActionLoading(true);
      const res = await apiClient.updateIncidentStatus(
        incident.id,
        targetStatus,
        operatorName,
        resolutionNotes,
        `Status transitioned to ${targetStatus}`
      );
      if (res) {
        setFeedbackMsg(`Status successfully transitioned to ${targetStatus}`);
        setIsResolveModalOpen(false);
        setResolutionInput('');
        await fetchIncidentDetail();
      } else {
        setFeedbackMsg(`Failed to transition status to ${targetStatus}`);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setFeedbackMsg('Error updating status. Please verify backend connection.');
    } finally {
      setActionLoading(false);
      setTimeout(() => setFeedbackMsg(''), 4500);
    }
  };

  // Submit operator remark to audit log
  const handleAddRemark = async (e) => {
    e?.preventDefault();
    if (!operatorNote.trim() || !incident) return;
    try {
      setActionLoading(true);
      const res = await apiClient.addIncidentNote(incident.id, operatorNote.trim(), operatorName);
      if (res) {
        setFeedbackMsg('Operator remark recorded in irreversible audit trail.');
        setOperatorNote('');
        await fetchIncidentDetail();
      } else {
        setFeedbackMsg('Failed to record operator remark.');
      }
    } catch (err) {
      console.error('Error adding remark:', err);
      setFeedbackMsg('Error submitting remark.');
    } finally {
      setActionLoading(false);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest">
          Retrieving Tactical Incident Dossier [{id}]...
        </span>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <button
          onClick={() => navigate('/incidents')}
          className="flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO INCIDENT LOG</span>
        </button>
        <div className="tactical-card p-8 rounded-xl border border-red-500/40 bg-red-950/20 text-center space-y-3">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Incident Dossier Unavailable</h2>
          <p className="text-xs font-mono text-slate-400">{error || 'Unknown error'}</p>
          <button
            onClick={fetchIncidentDetail}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-mono rounded border border-cyan-500/30 inline-flex items-center gap-2 mt-4"
          >
            <RefreshCw className="w-4 h-4" />
            RETRY DOSSIER QUERY
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'NEW':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      case 'ACKNOWLEDGED':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'INVESTIGATING':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'RESOLVED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'ESCALATED':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const evidenceItems = incident.evidence || [];
  const auditLogs = incident.audit_logs || [];
  const triggeringEvents = incident.triggering_events || [];

  return (
    <div className="space-y-4 p-4 max-w-[1920px] mx-auto">
      {/* Back button, Feedback toast & Operator Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/incidents')}
          className="flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO INCIDENT LOG</span>
        </button>

        <div className="flex items-center gap-3">
          {feedbackMsg && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
              ✓ {feedbackMsg}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span>OPERATOR:</span>
            <select
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="bg-slate-800 text-cyan-300 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-cyan-400"
            >
              <option value="Duty Operator">Duty Operator</option>
              <option value="Lead Analyst">Lead Analyst</option>
              <option value="Commander Rao">Commander Rao</option>
              <option value="QRT Unit 1">QRT Unit 1</option>
            </select>
          </div>

          <button
            onClick={fetchIncidentDetail}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh Dossier"
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary Incident Dossier Header */}
      <div className="tactical-card p-5 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
              {incident.id}
            </span>
            <span className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded border ${
              incident.severity === 'CRITICAL' || incident.severity === 'HIGH'
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}>
              {incident.severity} SEVERITY
            </span>
            <span className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded border ${getStatusBadgeStyle(incident.status)}`}>
              STATUS: {incident.status}
            </span>
            {incident.affected_track_id && (
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                TRACK: {incident.affected_track_id}
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-white mt-2 flex items-center gap-2">
            {incident.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
            <span>Primary Sensor: <strong className="text-cyan-300">{incident.primary_camera}</strong></span>
            <span>•</span>
            <span>Target: <strong className="text-slate-200">{incident.target_entity}</strong></span>
            <span>•</span>
            <span>Assigned: <strong className="text-slate-200">{incident.assigned_to || 'Duty Lead'}</strong></span>
            <span>•</span>
            <span>Logged: <strong className="text-slate-300">{incident.timestamp}</strong></span>
          </div>

          {/* ANPR Match Banner if available */}
          {incident.anpr_data && incident.anpr_data.license_plate && (
            <div className="mt-3 inline-flex items-center gap-3 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-500/40 text-xs font-mono">
              <Car className="w-4 h-4 text-red-400" />
              <span>VEHICLE IDENTIFIED:</span>
              <strong className="text-amber-300 text-sm tracking-wider font-bold">
                {incident.anpr_data.license_plate}
              </strong>
              {incident.anpr_data.watchlist_status && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/30 text-red-300 font-bold">
                  {incident.anpr_data.watchlist_status}
                </span>
              )}
              {incident.anpr_data.confidence && (
                <span className="text-slate-400">
                  ({(incident.anpr_data.confidence * 100).toFixed(1)}% Conf)
                </span>
              )}
            </div>
          )}

          {/* Resolution Summary Banner if resolved */}
          {incident.status === 'RESOLVED' && incident.resolution_notes && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-xs font-mono">
              <span className="text-emerald-400 font-bold">RESOLUTION REPORT:</span>
              <p className="text-emerald-200 mt-0.5">{incident.resolution_notes}</p>
            </div>
          )}
        </div>

        {/* Tactical Lifecycle Operator Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {incident.status === 'NEW' && (
            <button
              disabled={actionLoading}
              onClick={() => handleStatusTransition('ACKNOWLEDGED')}
              className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-900 text-xs font-mono font-bold shadow-lg shadow-amber-600/30 transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Acknowledge Incident
            </button>
          )}

          {incident.status !== 'RESOLVED' && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => handleStatusTransition('INVESTIGATING')}
                className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition-colors flex items-center gap-1.5 ${
                  incident.status === 'INVESTIGATING'
                    ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 cursor-default'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                }`}
              >
                <Activity className="w-4 h-4" />
                {incident.status === 'INVESTIGATING' ? 'Under Investigation' : 'Investigate (Dispatch)'}
              </button>

              <button
                disabled={actionLoading}
                onClick={() => handleStatusTransition('ESCALATED')}
                className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-mono font-semibold shadow-lg shadow-orange-600/30 transition-colors flex items-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                Escalate HQ
              </button>

              <button
                disabled={actionLoading}
                onClick={() => setIsResolveModalOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold shadow-lg shadow-emerald-600/30 transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Resolved
              </button>
            </>
          )}

          {incident.status === 'RESOLVED' && (
            <button
              disabled={actionLoading}
              onClick={() => handleStatusTransition('INVESTIGATING')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-semibold transition-colors"
            >
              Re-Open Investigation
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: Evidence Dossier & Triggering Events Timeline */}
        <div className="lg:col-span-7 space-y-4">
          {/* Primary Evidence Viewer */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  CAPTURED EVIDENCE DOSSIER
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {evidenceItems.length} ARTIFACT{evidenceItems.length === 1 ? '' : 'S'} LOGGED
              </span>
            </div>

            {selectedEvidence ? (
              <div className="space-y-3">
                <div className="relative aspect-video bg-[#070B14] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center hud-grid">
                  {selectedEvidence.snapshot_base64 ? (
                    <img
                      src={selectedEvidence.snapshot_base64.startsWith('data:') 
                        ? selectedEvidence.snapshot_base64 
                        : `data:image/jpeg;base64,${selectedEvidence.snapshot_base64}`}
                      alt="Tactical Evidence"
                      className="w-full h-full object-contain"
                    />
                  ) : selectedEvidence.file_path ? (
                    <img
                      src={`http://127.0.0.1:8000/api/incidents/${incident.id}/evidence/${selectedEvidence.id}/file`}
                      alt="Tactical Evidence Snapshot"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                      <Camera className="w-12 h-12 text-cyan-500/40" />
                      <span className="text-xs font-mono">DIGITAL EVIDENCE ARTIFACT STORED</span>
                    </div>
                  )}

                  {/* Tactical Reticle Overlays */}
                  <div className="absolute top-3 left-3 text-[10px] font-mono text-cyan-400 bg-black/75 px-2.5 py-1 rounded border border-cyan-500/30">
                    SENSOR: {selectedEvidence.camera_id || incident.primary_camera} • {selectedEvidence.timestamp || incident.timestamp}
                  </div>

                  <div className="absolute top-3 right-3 text-[10px] font-mono text-red-400 bg-black/75 px-2 py-1 rounded border border-red-500/30">
                    THREAT SCORE: {selectedEvidence.threat_score}
                  </div>

                  <div className="absolute bottom-3 left-3 text-[10px] font-mono text-slate-300 bg-black/75 px-2.5 py-1 rounded border border-slate-700">
                    TYPE: {selectedEvidence.evidence_type} • ID: {selectedEvidence.id}
                  </div>

                  {selectedEvidence.file_path && (
                    <a
                      href={`http://127.0.0.1:8000/api/incidents/${incident.id}/evidence/${selectedEvidence.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 px-2.5 py-1 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded text-[10px] font-mono flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Raw File
                    </a>
                  )}
                </div>

                {/* Evidence Artifact Selector Row */}
                {evidenceItems.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {evidenceItems.map((ev, idx) => (
                      <button
                        key={ev.id || idx}
                        onClick={() => setSelectedEvidence(ev)}
                        className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap transition-colors border ${
                          selectedEvidence?.id === ev.id
                            ? 'bg-cyan-600/30 text-cyan-300 border-cyan-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Artifact #{idx + 1}: {ev.evidence_type} ({ev.camera_id || 'CAM'})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-[#070B14] rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center">
                <Camera className="w-12 h-12 text-slate-600 mb-2" />
                <span className="text-xs font-mono text-slate-400">NO PHYSICAL EVIDENCE RECORDED YET</span>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  Snapshots and detection crops will appear here when captured automatically by the detection pipeline.
                </p>
              </div>
            )}
          </div>

          {/* Triggering Events & Correlation Timeline */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  TRIGGERING EVENTS & CHRONOLOGY
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {triggeringEvents.length || incident.timeline?.length || 0} EVENTS
              </span>
            </div>

            <div className="space-y-3 relative pl-6">
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-cyan-500/30" />

              {/* Display triggering events from DB if present */}
              {triggeringEvents.length > 0 ? (
                triggeringEvents.map((event, idx) => (
                  <div key={event.id || idx} className="relative">
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-900" />
                    <div className="flex items-center justify-between text-xs font-mono text-cyan-400 mb-1">
                      <span className="font-bold">{event.camera_id}</span>
                      <span className="text-slate-400">{event.timestamp}</span>
                    </div>
                    <div className="text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-300 font-mono text-[11px]">
                          {event.event_type}
                        </span>
                        {event.confidence && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Conf: {(event.confidence * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Entity: {event.entity_id || 'Unknown'} • Location: {event.location || 'Zone A'}
                      </div>
                    </div>
                  </div>
                ))
              ) : incident.timeline && incident.timeline.length > 0 ? (
                incident.timeline.map((item, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-900" />
                    <div className="flex items-center justify-between text-xs font-mono text-cyan-400 mb-1">
                      <span className="font-bold">{item.camera || incident.primary_camera}</span>
                      <span className="text-slate-400">{item.time || item.timestamp}</span>
                    </div>
                    <div className="text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      {item.event || item.description || JSON.stringify(item)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs font-mono text-slate-500 py-3">
                  No triggering event log attached.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Threat Breakdown & Irreversible Audit Trail */}
        <div className="lg:col-span-5 space-y-4">
          {/* Threat Factors Breakdown */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  THREAT SCORE ANALYSIS
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Dynamic Rule Evaluation</span>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-black font-mono ${
                  incident.threat_score >= 70 ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {incident.threat_score}
                </span>
                <span className="text-xs text-slate-500 font-mono"> / 100</span>
              </div>
            </div>

            {/* Score progress bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full transition-all duration-500 ${
                  incident.threat_score >= 70 
                    ? 'bg-gradient-to-r from-amber-500 to-red-500' 
                    : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, incident.threat_score))}%` }}
              />
            </div>

            {/* Factor list */}
            <div className="space-y-2">
              {incident.threat_factors && incident.threat_factors.length > 0 ? (
                incident.threat_factors.map((factor, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#0E1524] border border-slate-800">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-1">
                      <span>{factor.rule || factor.name || 'Threat Rule Trigger'}</span>
                      <span className="font-mono text-red-400 font-bold">
                        +{factor.delta || factor.weight || 15}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {factor.desc || factor.description || 'Threshold breached during active monitoring.'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2.5 rounded-lg bg-[#0E1524] border border-slate-800 text-xs font-mono text-slate-400">
                  Default perimeter baseline threat weighting applied.
                </div>
              )}
            </div>
          </div>

          {/* Audit Logs & Operator Actions Trail */}
          <div className="tactical-card rounded-xl p-4 border border-[#1E2D48] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  CHAIN OF CUSTODY & AUDIT LOGS
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {auditLogs.length} LOGS
              </span>
            </div>

            {/* Audit log scroll area */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {auditLogs.length > 0 ? (
                auditLogs.map((log, idx) => (
                  <div key={log.id || idx} className="p-2.5 rounded bg-slate-900/80 border border-slate-800/80 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                      <span className="text-cyan-400 font-bold">{log.user || 'System'}</span>
                      <span>{log.timestamp || log.created_at || 'Just now'}</span>
                    </div>
                    <div className="text-slate-200 text-[11px]">{log.action}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs font-mono text-slate-500 py-3 text-center">
                  No operator audit actions recorded yet.
                </div>
              )}
            </div>

            {/* Operator Remark Composer */}
            <form onSubmit={handleAddRemark} className="pt-2 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={operatorNote}
                onChange={(e) => setOperatorNote(e.target.value)}
                placeholder="Append official operator note / dispatch update..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={actionLoading || !operatorNote.trim()}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded text-xs font-mono font-bold flex items-center gap-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Post
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Resolution Dialog Modal */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="tactical-card max-w-lg w-full p-6 rounded-xl border border-emerald-500/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                COMPLETE INCIDENT RESOLUTION [{incident.id}]
              </h3>
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Provide formal resolution summary to close this tactical incident. This report will be permanently attached to the chain of custody.
            </p>

            <textarea
              rows={4}
              value={resolutionInput}
              onChange={(e) => setResolutionInput(e.target.value)}
              placeholder="e.g. Perimeter inspected by QRT Unit 1. Identified as authorized maintenance personnel with valid security credential. Threat neutralized."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !resolutionInput.trim()}
                onClick={() => handleStatusTransition('RESOLVED', resolutionInput.trim())}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-mono font-bold transition-colors"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
