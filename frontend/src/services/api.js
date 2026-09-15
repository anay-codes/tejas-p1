// TEJAS API Client Service with Automatic Local Fallback

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const apiClient = {
  async getCameras() {
    try {
      const res = await fetch(`${BASE_URL}/cameras`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable, using simulated data");
    }
    return null;
  },

  async restorePlate(plateNumber, intensity = 0.75) {
    try {
      const res = await fetch(`${BASE_URL}/anpr/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate_number: plateNumber, intensity })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable, using simulated data");
    }
    return null;
  },

  async calculateThreat(factors, customWeights = null) {
    try {
      const res = await fetch(`${BASE_URL}/threat-rules/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factors, custom_weights: customWeights })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable, using simulated data");
    }
    return null;
  },

  async ingestEvent(eventData) {
    try {
      const res = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable, using simulated data");
    }
    return null;
  },

  async getIncidents(status = null, severity = null) {
    try {
      const params = new URLSearchParams();
      if (status && status !== 'ALL') params.append('status', status);
      if (severity && severity !== 'ALL') params.append('severity', severity);
      const url = `${BASE_URL}/incidents${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getIncidents");
    }
    return [];
  },

  async getIncidentDetail(incidentId) {
    try {
      const res = await fetch(`${BASE_URL}/incidents/${incidentId}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getIncidentDetail");
    }
    return null;
  },

  async updateIncidentStatus(incidentId, status, user = "Duty Operator", resolutionNotes = null, comment = null) {
    try {
      const res = await fetch(`${BASE_URL}/incidents/${incidentId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          user, 
          resolution_notes: resolutionNotes,
          comment 
        })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for updateIncidentStatus");
    }
    return null;
  },

  async addIncidentNote(incidentId, note, user = "Duty Operator") {
    try {
      const res = await fetch(`${BASE_URL}/incidents/${incidentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, user })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for addIncidentNote");
    }
    return null;
  },

  async triggerTestIncident(payload = {}) {
    try {
      const res = await fetch(`${BASE_URL}/incidents/test-trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for triggerTestIncident");
    }
    return null;
  },

  async getGlobalTracks() {
    try {
      const res = await fetch(`${BASE_URL}/tracking/global-tracks`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable");
    }
    return [];
  },

  async getGlobalTrackDetail(trackId) {
    try {
      const res = await fetch(`${BASE_URL}/tracking/global-tracks/${trackId}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable");
    }
    return null;
  },

  async getTrackingConfig() {
    try {
      const res = await fetch(`${BASE_URL}/tracking/config`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable");
    }
    return { similarity_threshold: 0.72, max_transit_seconds: 180.0 };
  },

  async updateTrackingConfig(similarityThreshold, maxTransitSeconds) {
    try {
      const res = await fetch(`${BASE_URL}/tracking/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          similarity_threshold: similarityThreshold,
          max_transit_seconds: maxTransitSeconds
        })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable");
    }
    return null;
  },

  async simulateTransit(payload) {
    try {
      const res = await fetch(`${BASE_URL}/tracking/simulate-transit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable");
    }
    return null;
  },

  // Face Recognition Subsystem APIs
  async getFaceConfig() {
    try {
      const res = await fetch(`${BASE_URL}/face/config`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getFaceConfig");
    }
    return { enabled: true, similarity_threshold: 0.40, min_quality_score: 0.35 };
  },

  async updateFaceConfig(payload) {
    try {
      const res = await fetch(`${BASE_URL}/face/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for updateFaceConfig");
    }
    return null;
  },

  async getEnrolledFaces(category = null) {
    try {
      const url = category && category !== 'ALL' 
        ? `${BASE_URL}/face/enrolled?category=${encodeURIComponent(category)}`
        : `${BASE_URL}/face/enrolled`;
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getEnrolledFaces");
    }
    return [];
  },

  async enrollFace(payload) {
    try {
      const res = await fetch(`${BASE_URL}/face/enrolled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
      const err = await res.json().catch(() => ({ detail: "Enrollment failed" }));
      throw new Error(err.detail || "Enrollment failed");
    } catch (e) {
      console.warn("Error in enrollFace:", e);
      throw e;
    }
  },

  async deleteEnrolledFace(faceId, user = 'Duty Operator') {
    try {
      const res = await fetch(`${BASE_URL}/face/enrolled/${faceId}?user=${encodeURIComponent(user)}`, {
        method: 'DELETE'
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for deleteEnrolledFace");
    }
    return null;
  },

  async testFaceRecognition(payload) {
    try {
      const res = await fetch(`${BASE_URL}/face/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for testFaceRecognition");
    }
    return null;
  },

  // Watchlist Endpoints
  async getWatchlist() {
    try {
      const res = await fetch(`${BASE_URL}/watchlist`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getWatchlist");
    }
    return [];
  },

  async addWatchlistEntry(entry) {
    try {
      const res = await fetch(`${BASE_URL}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for addWatchlistEntry");
    }
    return null;
  },

  async deleteWatchlistEntry(id) {
    try {
      const res = await fetch(`${BASE_URL}/watchlist/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for deleteWatchlistEntry");
    }
    return null;
  },

  // Analytics, Zones, Alerts & Events Endpoints
  async getAnalyticsSummary() {
    try {
      const res = await fetch(`${BASE_URL}/analytics/summary`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getAnalyticsSummary");
    }
    return null;
  },

  async getHourlyAnalytics() {
    try {
      const res = await fetch(`${BASE_URL}/analytics/hourly`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getHourlyAnalytics");
    }
    return [];
  },

  async getCameraHotspots() {
    try {
      const res = await fetch(`${BASE_URL}/analytics/hotspots`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getCameraHotspots");
    }
    return [];
  },

  async getZones() {
    try {
      const res = await fetch(`${BASE_URL}/zones`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getZones");
    }
    return [];
  },

  async getAlerts() {
    try {
      const res = await fetch(`${BASE_URL}/alerts`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getAlerts");
    }
    return [];
  },

  async getEvents(limit = 40) {
    try {
      const res = await fetch(`${BASE_URL}/events?limit=${limit}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getEvents");
    }
    return [];
  },

  async getThreatRules() {
    try {
      const res = await fetch(`${BASE_URL}/threat-rules`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for getThreatRules");
    }
    return [];
  },

  async updateThreatRule(ruleId, weight, enabled = true) {
    try {
      const res = await fetch(`${BASE_URL}/threat-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight, enabled })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend API unavailable for updateThreatRule");
    }
    return null;
  }
};
