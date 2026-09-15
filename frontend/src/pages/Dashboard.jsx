import React, { useState, useEffect, useCallback } from 'react';
import KPIStatsRow from '../components/common/KPIStatsRow';
import ScenarioBar from '../components/threat/ScenarioBar';
import CCTVGrid from '../components/cctv/CCTVGrid';
import ThreatIntelPanel from '../components/threat/ThreatIntelPanel';
import RealtimeAlertStream from '../components/threat/RealtimeAlertStream';
import EventTimeline from '../components/threat/EventTimeline';
import TacticalMapLeaflet from '../components/map/TacticalMapLeaflet';
import { simulator } from '../services/demoSimulator';
import { useSurveillanceStream } from '../services/useSurveillanceStream';
import { useVideoTelemetry } from '../services/useVideoTelemetry';
import { apiClient } from '../services/api';
import { Shield, Radio, Video, Activity, Zap, Cpu } from 'lucide-react';

export default function Dashboard() {
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [simState, setSimState] = useState(simulator.getState());
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [dbCameras, setDbCameras] = useState([]);

  // Real-time Hardware Surveillance Stream
  const { alerts, incidents, events, activeThreat, isConnected } = useSurveillanceStream();
  const { telemetry } = useVideoTelemetry();

  const loadBackendData = useCallback(async () => {
    try {
      const [summary, cams] = await Promise.all([
        apiClient.getAnalyticsSummary(),
        apiClient.getCameras()
      ]);
      if (summary) setAnalyticsSummary(summary);
      if (cams && cams.length > 0) setDbCameras(cams);
    } catch (e) {
      console.warn("Error fetching dashboard analytics:", e);
    }
  }, []);

  useEffect(() => {
    loadBackendData();
    const interval = setInterval(loadBackendData, 5000);
    return () => clearInterval(interval);
  }, [loadBackendData]);

  useEffect(() => {
    const unsubscribe = simulator.subscribe((state) => {
      setSimState(state);
    });
    return () => unsubscribe();
  }, []);

  // Compute live or simulated values
  const activeScore = isLiveMode ? activeThreat.score : simState.threatAssessment.score;
  const currentAlerts = isLiveMode ? alerts : simState.alerts;
  const currentIncident = isLiveMode 
    ? (incidents.length > 0 ? incidents[0] : null) 
    : simState.incident;
  const currentThreatAssessment = isLiveMode ? activeThreat : simState.threatAssessment;
  const activeEntityLabel = isLiveMode ? activeThreat.entity : simState.entities[0].label;

  const realLatency = telemetry?.latency_ms 
    ? `${Math.round(telemetry.latency_ms)}ms` 
    : (telemetry?.inference_ms ? `${Math.round(telemetry.inference_ms)}ms` : '28ms');

  const camerasList = (dbCameras.length > 0) ? dbCameras : simState.cameras;
  const totalCamsCount = analyticsSummary?.total_cameras ?? camerasList.length;
  const onlineCamsCount = analyticsSummary?.online_cameras ?? camerasList.filter(c => c.status === 'ONLINE').length;
  const activeThreatsCount = analyticsSummary?.active_threats ?? (activeScore >= 50 ? 1 : 0);
  const eventsCount = isLiveMode 
    ? (analyticsSummary?.events_today ?? events.length) 
    : simState.tick;

  return (
    <div className="space-y-4 p-4 max-w-[1920px] mx-auto">
      {/* Top Operations Mode Selector */}
      <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${
            isLiveMode 
              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' 
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <Radio className={`w-5 h-5 ${isLiveMode ? 'animate-pulse text-cyan-400' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
                OPERATIONAL COMMAND CENTER
              </h1>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                isLiveMode 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                {isLiveMode ? '● REAL HARDWARE PIPELINE' : '○ DEMO SIMULATOR'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isLiveMode 
                ? 'Streaming live from physical laptop camera through YOLOv8, ByteTrack, Virtual Fence, Threat Engine, and WebSockets.'
                : 'Running synthetic tactical border scenarios for offline demonstration and rehearsal.'}
            </p>
          </div>
        </div>

        {/* Mode Toggle Controls */}
        <div className="flex items-center gap-2 bg-[#0E1524] p-1 rounded-xl border border-slate-800 font-mono text-xs">
          <button
            onClick={() => setIsLiveMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              isLiveMode 
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Real Hardware (AI)</span>
          </button>
          <button
            onClick={() => setIsLiveMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              !isLiveMode 
                ? 'bg-slate-700 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Demo Scenarios</span>
          </button>
        </div>
      </div>

      {/* Top Section: KPIs */}
      <KPIStatsRow
        totalCameras={totalCamsCount}
        onlineCameras={onlineCamsCount}
        activeThreats={activeThreatsCount}
        eventsToday={eventsCount}
        eventsSubtitle={isLiveMode ? 'Live Audit Events Logged' : 'Synthetic Scenarios Ticked'}
        inferenceLatency={isLiveMode ? realLatency : '14ms'}
        inferenceSubtitle={isLiveMode ? `YOLOv8 + ByteTrack (${telemetry?.device?.toUpperCase() || 'CPU'})` : 'Synthetic Model Bench'}
      />

      {/* Interactive Demo Scenario Bar (strictly labeled in Demo Simulator mode) */}
      {!isLiveMode && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
            <span>[DEMO SIMULATOR ACTIVE]</span>
            <span className="text-slate-400">— Synthetic Scenario Injection Controls</span>
          </div>
          <ScenarioBar activeScenario={simState.activeScenario} />
        </div>
      )}

      {/* Main Operations Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: 4-Grid CCTV Centerpiece (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <CCTVGrid
            cameras={camerasList}
            entities={simState.entities}
            zones={simState.zones}
            tick={simState.tick}
            isLiveMode={isLiveMode}
            telemetry={telemetry}
          />
        </div>

        {/* Right Column: Threat Intelligence & Live Alerts (4 Cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          {/* Real-time Explainable Threat Scoring Panel */}
          <ThreatIntelPanel
            threatAssessment={currentThreatAssessment}
            activeEntity={activeEntityLabel}
          />

          {/* Real-time Live Alert Stream */}
          <div className="flex-1 min-h-[340px]">
            <RealtimeAlertStream alerts={currentAlerts} />
          </div>
        </div>
      </div>

      {/* Lower Tactical Row: Timeline & Tactical Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Correlated Event Timeline (5 Cols) */}
        <div className="lg:col-span-5">
          <EventTimeline incident={currentIncident} events={events} />
        </div>

        {/* Tactical Geographic Map (7 Cols) */}
        <div className="lg:col-span-7">
          <TacticalMapLeaflet activeThreat={currentThreatAssessment} />
        </div>
      </div>
    </div>
  );
}

