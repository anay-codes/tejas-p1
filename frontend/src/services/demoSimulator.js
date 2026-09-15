// TEJAS Demo Event & Scenario Simulation Service
import { CAMERAS, VIRTUAL_ZONES, INITIAL_THREAT_RULES, SAMPLE_INCIDENTS, ANPR_SAMPLES } from '../data/mockData';
import { calculateThreatScore } from '../utils/threatEvaluator';

class DemoSimulationEngine {
  constructor() {
    this.listeners = new Set();
    this.stage = 0;
    this.activeScenario = 'infiltration'; // 'infiltration', 'watchlist_vehicle', 'authorized_guard', 'abandoned_object'
    this.isRunning = true;
    this.intervalId = null;
    this.tick = 0;

    // Active state
    this.entities = [
      {
        id: "ent-27",
        label: "PERSON #27",
        type: "PERSON",
        cameraCode: "BOP-03",
        x: 80,
        y: 110,
        width: 44,
        height: 88,
        confidence: 0.94,
        threatScore: 25,
        status: "TRACKING_ACTIVE",
        trail: [{ x: 60, y: 130 }, { x: 70, y: 120 }, { x: 80, y: 110 }]
      },
      {
        id: "ent-08",
        label: "VEHICLE #08",
        type: "VEHICLE",
        cameraCode: "BORDER-RD-12",
        x: 180,
        y: 90,
        width: 85,
        height: 55,
        confidence: 0.91,
        threatScore: 40,
        status: "ANPR_CAPTURING",
        trail: [{ x: 120, y: 90 }, { x: 150, y: 90 }, { x: 180, y: 90 }]
      },
      {
        id: "ent-14",
        label: "PERSON #14 (GUARD)",
        type: "PERSON",
        cameraCode: "GATE-01",
        x: 140,
        y: 100,
        width: 40,
        height: 82,
        confidence: 0.96,
        threatScore: 10,
        status: "AUTHORIZED",
        trail: [{ x: 130, y: 100 }, { x: 140, y: 100 }]
      }
    ];

    this.activeFactors = [
      INITIAL_THREAT_RULES.find(r => r.id === 'rule_unverified_identity')
    ].filter(Boolean);

    this.alerts = [
      {
        id: "ALT-001",
        title: "Perimeter Approach Detected",
        camera: "BOP-03",
        severity: "LOW",
        timestamp: "Just now",
        threatScore: 25,
        message: "Unverified entity detected on outer berm"
      }
    ];

    this.currentIncident = SAMPLE_INCIDENTS[0];
    this.rulesConfig = { ...INITIAL_THREAT_RULES.reduce((acc, r) => ({ ...acc, [r.id]: r.weight }), {}) };
    this.anprQueue = [...ANPR_SAMPLES];

    this.start();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (err) {
        console.error("Simulation listener error:", err);
      }
    });
  }

  getState() {
    const threatAssessment = calculateThreatScore(this.activeFactors, this.rulesConfig);
    return {
      stage: this.stage,
      activeScenario: this.activeScenario,
      isRunning: this.isRunning,
      entities: this.entities,
      threatAssessment,
      alerts: this.alerts,
      cameras: CAMERAS,
      zones: VIRTUAL_ZONES,
      incident: this.currentIncident,
      tick: this.tick,
      latestANPR: this.anprQueue[0]
    };
  }

  start() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isRunning = true;
    this.intervalId = setInterval(() => this.step(), 2500);
  }

  pause() {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.notify();
  }

  resume() {
    this.start();
    this.notify();
  }

  reset() {
    this.stage = 0;
    this.tick = 0;
    this.activeFactors = [INITIAL_THREAT_RULES.find(r => r.id === 'rule_unverified_identity')].filter(Boolean);
    this.entities[0] = {
      ...this.entities[0],
      cameraCode: "BOP-03",
      x: 80,
      y: 110,
      threatScore: 25,
      status: "TRACKING_ACTIVE",
      trail: [{ x: 60, y: 130 }, { x: 80, y: 110 }]
    };
    this.alerts = [
      {
        id: `ALT-${Date.now()}`,
        title: "Perimeter System Reset",
        camera: "BOP-03",
        severity: "LOW",
        timestamp: new Date().toLocaleTimeString(),
        threatScore: 25,
        message: "Perimeter scanning online. No active breaches."
      }
    ];
    this.notify();
  }

  triggerScenario(scenarioName) {
    this.activeScenario = scenarioName;
    this.tick = 0;

    if (scenarioName === 'infiltration') {
      this.reset();
    } else if (scenarioName === 'watchlist_vehicle') {
      this.entities[1].cameraCode = 'BORDER-RD-12';
      this.entities[1].threatScore = 75;
      this.activeFactors = [
        INITIAL_THREAT_RULES.find(r => r.id === 'rule_watchlist_vehicle'),
        INITIAL_THREAT_RULES.find(r => r.id === 'rule_night_movement'),
        INITIAL_THREAT_RULES.find(r => r.id === 'rule_movement_sensitive')
      ].filter(Boolean);
      this.addAlert({
        id: `ALT-${Date.now()}`,
        title: "ANPR Watchlist Match: MP09AB1234",
        camera: "BORDER-RD-12",
        severity: "CRITICAL",
        timestamp: new Date().toLocaleTimeString(),
        threatScore: 75,
        message: "Black Scorpio SUV matched National Security Watchlist entry #WL-001. AI Super-resolution verified."
      });
    } else if (scenarioName === 'authorized_guard') {
      this.entities[2].cameraCode = 'GATE-01';
      this.activeFactors = [
        INITIAL_THREAT_RULES.find(r => r.id === 'rule_authorized_personnel')
      ].filter(Boolean);
      this.addAlert({
        id: `ALT-${Date.now()}`,
        title: "Authorized Friendly Patrol Verified",
        camera: "GATE-01",
        severity: "LOW",
        timestamp: new Date().toLocaleTimeString(),
        threatScore: 0,
        message: "Officer J. Rawat facial biometrics and RFID confirmed. Threat score overridden to SECURE."
      });
    } else if (scenarioName === 'abandoned_object') {
      this.activeFactors = [
        INITIAL_THREAT_RULES.find(r => r.id === 'rule_night_movement'),
        INITIAL_THREAT_RULES.find(r => r.id === 'rule_loitering')
      ].filter(Boolean);
      this.addAlert({
        id: `ALT-${Date.now()}`,
        title: "Unattended Object Dwell Threshold Exceeded",
        camera: "WAREHOUSE-E",
        severity: "MEDIUM",
        timestamp: new Date().toLocaleTimeString(),
        threatScore: 48,
        message: "Suspicious package unattended at East Yard for >120s. Inspection protocol initiated."
      });
    }

    this.notify();
  }

  updateRuleWeight(ruleId, weight) {
    this.rulesConfig[ruleId] = weight;
    this.notify();
  }

  step() {
    this.tick++;

    // Minor position jitter for realistic animation on canvas
    const p27 = this.entities[0];
    if (p27) {
      p27.x += (Math.random() * 8 - 3);
      p27.y += (Math.random() * 6 - 2);
      if (p27.x > 340) p27.x = 80;
      if (p27.y > 180) p27.y = 80;
      p27.trail.push({ x: p27.x, y: p27.y });
      if (p27.trail.length > 8) p27.trail.shift();
    }

    // Progression of the core SIH Scenario:
    if (this.activeScenario === 'infiltration') {
      const stageCycle = this.tick % 5;
      this.stage = stageCycle;

      if (stageCycle === 0) {
        p27.cameraCode = "BOP-03";
        p27.status = "TRACKING_ACTIVE";
        this.activeFactors = [
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_unverified_identity')
        ].filter(Boolean);
      } 
      else if (stageCycle === 1) {
        p27.cameraCode = "BORDER-RD-12";
        p27.status = "NIGHT_MOTION_FLAGGED";
        this.activeFactors = [
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_unverified_identity'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_night_movement')
        ].filter(Boolean);

        this.addAlert({
          id: `ALT-${Date.now()}`,
          title: "Night Movement Flagged",
          camera: "BORDER-RD-12",
          severity: "MEDIUM",
          timestamp: new Date().toLocaleTimeString(),
          threatScore: 40,
          message: "Person #27 logged moving in blackout transit corridor"
        });
      }
      else if (stageCycle === 2) {
        p27.cameraCode = "BOP-04";
        p27.status = "LOITERING_WARNING";
        this.activeFactors = [
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_unverified_identity'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_night_movement'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_loitering')
        ].filter(Boolean);

        this.addAlert({
          id: `ALT-${Date.now()}`,
          title: "Loitering Threshold Exceeded (120s)",
          camera: "BOP-04",
          severity: "MEDIUM",
          timestamp: new Date().toLocaleTimeString(),
          threatScore: 55,
          message: "Entity halted in blind sector foliage without transit progress"
        });
      }
      else if (stageCycle === 3) {
        p27.cameraCode = "BOP-04";
        p27.status = "HEADING_TOWARD_DEPOT";
        this.activeFactors = [
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_unverified_identity'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_night_movement'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_loitering'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_movement_sensitive')
        ].filter(Boolean);

        this.addAlert({
          id: `ALT-${Date.now()}`,
          title: "Kinematic Vector: Heading to Sensitive Buffer",
          camera: "BOP-04",
          severity: "HIGH",
          timestamp: new Date().toLocaleTimeString(),
          threatScore: 75,
          message: "Trajectory vector points continuously toward ammunition depot"
        });
      }
      else if (stageCycle === 4) {
        p27.cameraCode = "RESTRICTED-Z01";
        p27.status = "ZONE_BREACH_CRITICAL";
        p27.threatScore = 82;
        this.activeFactors = [
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_unverified_identity'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_night_movement'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_loitering'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_movement_sensitive'),
          INITIAL_THREAT_RULES.find(r => r.id === 'rule_restricted_intrusion')
        ].filter(Boolean);

        this.addAlert({
          id: `ALT-${Date.now()}`,
          title: "CRITICAL: Virtual Fence Intrusion",
          camera: "RESTRICTED-Z01",
          severity: "CRITICAL",
          timestamp: new Date().toLocaleTimeString(),
          threatScore: 82,
          message: "Person #27 breached polygonal restricted zone! QRT response dispatched"
        });
      }
    }

    this.notify();
  }

  addAlert(newAlert) {
    this.alerts = [newAlert, ...this.alerts.slice(0, 9)];
  }
}

export const simulator = new DemoSimulationEngine();
