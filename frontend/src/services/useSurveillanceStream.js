import { useState, useEffect, useCallback, useRef } from 'react';
import { wsService } from './websocket';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export function useSurveillanceStream() {
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeThreat, setActiveThreat] = useState({
    score: 10,
    severity: 'LOW',
    severityColor: '#10B981',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    entity: 'MONITORING IDLE',
    factors: []
  });
  const [isConnected, setIsConnected] = useState(false);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [lastAnprDetection, setLastAnprDetection] = useState(null);

  const getSeverityMeta = (score, sev) => {
    if (score >= 80 || sev === 'CRITICAL') {
      return {
        color: '#EF4444',
        badge: 'bg-red-500/10 text-red-400 border-red-500/30'
      };
    }
    if (score >= 60 || sev === 'HIGH') {
      return {
        color: '#F97316',
        badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
      };
    }
    if (score >= 30 || sev === 'MEDIUM') {
      return {
        color: '#F59E0B',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      };
    }
    return {
      color: '#10B981',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    };
  };

  const fetchInitialData = useCallback(async () => {
    try {
      const [alertsRes, incRes, evtRes] = await Promise.all([
        fetch(`${API_BASE}/alerts`),
        fetch(`${API_BASE}/incidents`),
        fetch(`${API_BASE}/events?limit=30`)
      ]);

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data);
      }
      if (incRes.ok) {
        const data = await incRes.json();
        setIncidents(data);
        if (data.length > 0) {
          const latest = data[0];
          const meta = getSeverityMeta(latest.threat_score, latest.severity);
          setActiveThreat({
            score: latest.threat_score,
            severity: latest.severity,
            severityColor: meta.color,
            badgeClass: meta.badge,
            entity: latest.target_entity,
            factors: latest.threat_factors || []
          });
        }
      }
      if (evtRes.ok) {
        const data = await evtRes.json();
        setEvents(data);
      }
    } catch (err) {
      console.warn("Surveillance stream REST sync warning:", err);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();

    // Ensure WebSocket is connected
    wsService.connect();

    // Subscribe to live WebSocket messages
    const unsubscribe = wsService.subscribe((msg) => {
      setIsConnected(true);

      if (msg.type === 'CORRELATED_EVENT') {
        const { event, correlation, alert, incident } = msg;

        // 1. Update Latest Events
        if (event) {
          setEvents(prev => [event, ...prev.slice(0, 49)]);
        }

        // 2. Update Active Threat Assessment
        if (correlation) {
          const meta = getSeverityMeta(correlation.threat_score, correlation.severity);
          setActiveThreat({
            score: correlation.threat_score,
            severity: correlation.severity,
            severityColor: meta.color,
            badgeClass: meta.badge,
            entity: correlation.entity_id || 'TRACKED ENTITY',
            factors: correlation.factors || []
          });
        }

        // 3. Prepend New Alert if generated
        if (alert) {
          setAlerts(prev => {
            const exists = prev.some(a => a.id === alert.id);
            if (exists) return prev;
            return [alert, ...prev];
          });
          setNewAlertCount(c => c + 1);
        }

        // 4. Update Incidents
        if (incident) {
          setIncidents(prev => {
            const idx = prev.findIndex(i => i.id === incident.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = incident;
              return updated;
            }
            return [incident, ...prev];
          });
        }
      } else if (msg.type === 'ANPR_DETECTION') {
        if (msg.data) {
          setLastAnprDetection(msg.data);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchInitialData]);

  return {
    alerts,
    incidents,
    events,
    activeThreat,
    isConnected,
    newAlertCount,
    lastAnprDetection,
    refetch: fetchInitialData
  };
}
