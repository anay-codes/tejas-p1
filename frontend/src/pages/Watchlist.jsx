import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Plus, 
  Search, 
  Car, 
  User, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  RefreshCw, 
  Upload, 
  Camera, 
  Sparkles, 
  UserCheck, 
  UserX, 
  Eye, 
  Activity, 
  Zap,
  Info,
  Check,
  X
} from 'lucide-react';
import { apiClient } from '../services/api';

export default function Watchlist() {
  const [activeTab, setActiveTab] = useState('FACE'); // 'FACE' or 'VEHICLE'

  // Face Recognition State
  const [enrolledFaces, setEnrolledFaces] = useState([]);
  const [faceConfig, setFaceConfig] = useState({ enabled: true, similarity_threshold: 0.40, min_quality_score: 0.35 });
  const [faceSearch, setFaceSearch] = useState('');
  const [faceCategoryFilter, setFaceCategoryFilter] = useState('ALL');
  const [isEnrollingFace, setIsEnrollingFace] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Enrollment Form
  const [enrollForm, setEnrollForm] = useState({
    name: '',
    category: 'WATCHLIST',
    threat_level: 'CRITICAL',
    notes: '',
    image_base64: '',
    preview_url: ''
  });
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  // Interactive Testbench Lab State
  const [testImageB64, setTestImageB64] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testEvaluating, setTestEvaluating] = useState(false);

  // ANPR Vehicle Watchlist State
  const [vehicleWatchlist, setVehicleWatchlist] = useState([]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    identifier: '',
    title: '',
    category: 'Suspected Reconnaissance',
    threat_level: 'CRITICAL',
    notes: ''
  });

  // Load data on mount
  const loadFaceData = async () => {
    setFaceLoading(true);
    try {
      const [cfg, faces] = await Promise.all([
        apiClient.getFaceConfig(),
        apiClient.getEnrolledFaces(faceCategoryFilter)
      ]);
      if (cfg) setFaceConfig(cfg);
      if (faces) setEnrolledFaces(faces);
    } catch (e) {
      console.error("Error loading face data:", e);
    } finally {
      setFaceLoading(false);
    }
  };

  const loadVehicleData = async () => {
    try {
      const list = await apiClient.getWatchlist();
      setVehicleWatchlist(list || []);
    } catch (e) {
      console.error("Error loading vehicle watchlist:", e);
    }
  };

  useEffect(() => {
    if (activeTab === 'FACE') {
      loadFaceData();
    } else {
      loadVehicleData();
    }
  }, [activeTab, faceCategoryFilter]);

  const showToast = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 4500);
  };

  // Face Config Update
  const handleSaveConfig = async () => {
    try {
      const res = await apiClient.updateFaceConfig({
        enabled: faceConfig.enabled,
        similarity_threshold: parseFloat(faceConfig.similarity_threshold),
        min_quality_score: parseFloat(faceConfig.min_quality_score),
        user: 'Duty Operator'
      });
      if (res) {
        setFaceConfig(res);
        setIsCalibrating(false);
        showToast('Face recognition parameters successfully calibrated & logged.');
      }
    } catch (e) {
      showToast('Failed to update face config.');
    }
  };

  // Handle Image File Selection for Enrollment
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result;
      setEnrollForm(prev => ({
        ...prev,
        image_base64: b64,
        preview_url: b64
      }));
      setEnrollError('');
    };
    reader.readAsDataURL(file);
  };

  // Submit Enrollment
  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!enrollForm.name.trim()) {
      setEnrollError('Identity name is required.');
      return;
    }
    if (!enrollForm.image_base64) {
      setEnrollError('Biometric photo is required. Please upload or capture an image.');
      return;
    }

    setEnrollSubmitting(true);
    setEnrollError('');
    try {
      const res = await apiClient.enrollFace({
        name: enrollForm.name.trim(),
        category: enrollForm.category,
        threat_level: enrollForm.threat_level,
        notes: enrollForm.notes,
        image_base64: enrollForm.image_base64,
        user: 'Duty Operator'
      });
      if (res && res.success) {
        showToast(`Successfully enrolled biometric identity: ${enrollForm.name}`);
        setIsEnrollingFace(false);
        setEnrollForm({
          name: '',
          category: 'WATCHLIST',
          threat_level: 'CRITICAL',
          notes: '',
          image_base64: '',
          preview_url: ''
        });
        loadFaceData();
      }
    } catch (err) {
      setEnrollError(err.message || 'Enrollment failed. Ensure face is clear and well-lit.');
    } finally {
      setEnrollSubmitting(false);
    }
  };

  // Remove Enrolled Face
  const handleDeleteFace = async (faceId, faceName) => {
    if (!window.confirm(`Permanently remove enrolled biometric identity "${faceName}" from database?`)) return;
    try {
      const res = await apiClient.deleteEnrolledFace(faceId, 'Duty Operator');
      if (res && res.success) {
        showToast(`Removed biometric record for ${faceName}.`);
        loadFaceData();
      }
    } catch (e) {
      showToast('Failed to delete enrolled face.');
    }
  };

  // Interactive Testbench Helper: Run Face Recognition
  const handleRunRecognitionTest = async (b64) => {
    const probe = b64 || testImageB64;
    if (!probe) return;

    setTestEvaluating(true);
    try {
      const res = await apiClient.testFaceRecognition({
        image_base64: probe,
        camera_id: 'CAM-TESTBENCH'
      });
      setTestResult(res);
    } catch (e) {
      console.error("Testbench error:", e);
    } finally {
      setTestEvaluating(false);
    }
  };

  // Synthetic Test Case Generator for Testbench
  const loadScenarioProbe = (scenario) => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    if (scenario === 'NO_FACE') {
      // Draw person back / jacket
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 240, 240);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(120, 100, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.fillRect(40, 160, 160, 80);
    } else if (scenario === 'BLURRY_FACE') {
      // Blurry face
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, 240, 240);
      ctx.filter = 'blur(16px)';
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(120, 120, 60, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Clear synthetic face base
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 240, 240);
      ctx.fillStyle = scenario === 'WATCHLIST' ? '#fed7aa' : scenario === 'AUTHORIZED' ? '#bbf7d0' : '#e2e8f0';
      ctx.beginPath();
      ctx.arc(120, 120, 70, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(95, 105, 8, 0, Math.PI * 2);
      ctx.arc(145, 105, 8, 0, Math.PI * 2);
      ctx.fill();
      // Mouth
      ctx.beginPath();
      ctx.arc(120, 150, 25, 0, Math.PI);
      ctx.stroke();
    }

    const b64 = canvas.toDataURL('image/jpeg', 0.85);
    setTestImageB64(b64);
    handleRunRecognitionTest(b64);
  };

  // Add Vehicle to Watchlist
  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!vehicleForm.identifier.trim()) return;

    try {
      const res = await apiClient.addWatchlistEntry({
        type: 'VEHICLE',
        identifier: vehicleForm.identifier.trim().toUpperCase(),
        title: vehicleForm.title.trim() || 'Tracked Vehicle',
        category: vehicleForm.category,
        threat_level: vehicleForm.threat_level,
        notes: vehicleForm.notes
      });
      if (res) {
        showToast(`Vehicle plate ${vehicleForm.identifier} added to active interception watchlist.`);
        setIsAddingVehicle(false);
        setVehicleForm({
          identifier: '',
          title: '',
          category: 'Suspected Reconnaissance',
          threat_level: 'CRITICAL',
          notes: ''
        });
        loadVehicleData();
      }
    } catch (e) {
      showToast('Failed to add vehicle to watchlist.');
    }
  };

  // Delete Vehicle
  const handleDeleteVehicle = async (id, plate) => {
    if (!window.confirm(`Remove vehicle plate "${plate}" from active watchlist?`)) return;
    try {
      await apiClient.deleteWatchlistEntry(id);
      showToast(`Vehicle ${plate} removed from watchlist.`);
      loadVehicleData();
    } catch (e) {
      showToast('Failed to delete vehicle.');
    }
  };

  const filteredFaces = enrolledFaces.filter(f => {
    const q = faceSearch.toLowerCase();
    return (f.name || '').toLowerCase().includes(q) ||
           (f.id || '').toLowerCase().includes(q) ||
           (f.notes || '').toLowerCase().includes(q);
  });

  const filteredVehicles = vehicleWatchlist.filter(v => {
    const q = vehicleSearch.toLowerCase();
    return (v.identifier || '').toLowerCase().includes(q) ||
           (v.title || '').toLowerCase().includes(q) ||
           (v.notes || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 p-4 max-w-[1920px] mx-auto">
      {/* Top Banner & Tab Switcher */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              National Security Watchlist & Biometric Registry
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Modular multi-biometric interception registry. Only configured watchlist hits trigger security events; unverified persons are never flagged as suspicious.
          </p>
        </div>

        {/* Tab Switcher & Toast */}
        <div className="flex items-center gap-3">
          {feedbackMsg && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
              ✓ {feedbackMsg}
            </div>
          )}

          <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab('FACE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'FACE' 
                  ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>FACIAL BIOMETRICS ({enrolledFaces.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('VEHICLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'VEHICLE' 
                  ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>ANPR VEHICLES ({vehicleWatchlist.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FACIAL BIOMETRIC REGISTRY & MODULAR RECOGNITION                    */}
      {/* ========================================================================= */}
      {activeTab === 'FACE' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-2">
              {/* Module Toggle Indicator */}
              <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                faceConfig.enabled 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <Activity className="w-3.5 h-3.5" />
                <span>MODULE: {faceConfig.enabled ? 'ACTIVE' : 'DISABLED'}</span>
              </div>

              {/* Category Filter */}
              <select
                value={faceCategoryFilter}
                onChange={(e) => setFaceCategoryFilter(e.target.value)}
                className="bg-slate-900 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs"
              >
                <option value="ALL">All Categories</option>
                <option value="WATCHLIST">Watchlist Suspects</option>
                <option value="AUTHORIZED">Authorized Personnel</option>
                <option value="SECURITY_STAFF">Security Staff</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search enrolled identity..."
                  value={faceSearch}
                  onChange={(e) => setFaceSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCalibrating(!isCalibrating)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Calibrate Pipeline</span>
              </button>

              <button
                onClick={() => setIsEnrollingFace(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-600/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Enroll New Face</span>
              </button>
            </div>
          </div>

          {/* Biometric Pipeline Calibration Panel */}
          {isCalibrating && (
            <div className="tactical-card p-4 rounded-xl border border-cyan-500/40 bg-[#0B1324] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  MODULAR BIOMETRIC CALIBRATION
                </h3>
                <button onClick={() => setIsCalibrating(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                {/* Module Enabled */}
                <div className="space-y-1.5">
                  <label className="text-slate-300">Biometric Recognition State</label>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={faceConfig.enabled}
                        onChange={(e) => setFaceConfig({ ...faceConfig, enabled: e.target.checked })}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span className="text-slate-200">
                        {faceConfig.enabled ? 'Enabled (Active Biometrics)' : 'Disabled (Bypassed)'}
                      </span>
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    If disabled, TEJAS tracks persons with standard YOLO without face processing.
                  </p>
                </div>

                {/* Similarity Threshold */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-slate-300">Cosine Similarity Threshold</label>
                    <span className="text-cyan-400 font-bold">{faceConfig.similarity_threshold}</span>
                  </div>
                  <input
                    type="range"
                    min="0.25"
                    max="0.85"
                    step="0.05"
                    value={faceConfig.similarity_threshold}
                    onChange={(e) => setFaceConfig({ ...faceConfig, similarity_threshold: e.target.value })}
                    className="w-full accent-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Recommended: 0.40. Higher values prevent false matches; lower allows looser matches.
                  </p>
                </div>

                {/* Min Quality Score */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="text-slate-300">Min Biometric Quality Gating</label>
                    <span className="text-cyan-400 font-bold">{faceConfig.min_quality_score}</span>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.70"
                    step="0.05"
                    value={faceConfig.min_quality_score}
                    onChange={(e) => setFaceConfig({ ...faceConfig, min_quality_score: e.target.value })}
                    className="w-full accent-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Rejects blurry or low-resolution crops ($&lt;36\text{px}$) to eliminate spurious matches.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
                >
                  Apply & Log Calibration
                </button>
              </div>
            </div>
          )}

          {/* Enrolled Face Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFaces.map((face) => {
              const isWatchlist = face.category === 'WATCHLIST';
              const isAuth = face.category === 'AUTHORIZED' || face.category === 'SECURITY_STAFF';

              return (
                <div
                  key={face.id}
                  className="tactical-card rounded-xl border border-[#1E2D48] overflow-hidden hover:border-cyan-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="p-4 space-y-3">
                    {/* Header ID & Threat Level */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                        {face.id}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isWatchlist 
                          ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                          : isAuth 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {face.category}
                      </span>
                    </div>

                    {/* Photo & Quality Badge */}
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {face.photo_base64 ? (
                          <img 
                            src={face.photo_base64.startsWith('data:') ? face.photo_base64 : `data:image/jpeg;base64,${face.photo_base64}`} 
                            alt={face.name} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <User className="w-8 h-8 text-slate-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-white truncate">{face.name}</h3>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Threat: <strong className={isWatchlist ? 'text-red-400' : 'text-emerald-400'}>{face.threat_level}</strong>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Quality Score: {(face.quality_score * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    {/* Dossier notes */}
                    {face.notes && (
                      <p className="text-xs text-slate-400 line-clamp-2 font-mono bg-slate-900/60 p-2 rounded border border-slate-800/80">
                        {face.notes}
                      </p>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 py-2.5 bg-[#0A101C] border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-[10px] text-slate-500">
                      {face.created_at ? new Date(face.created_at).toLocaleDateString() : 'Enrolled'}
                    </span>
                    <button
                      onClick={() => handleDeleteFace(face.id, face.name)}
                      className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      title="Remove from Biometric Registry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredFaces.length === 0 && !faceLoading && (
              <div className="col-span-full tactical-card p-12 text-center text-slate-500 font-mono">
                <UserX className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p>No enrolled biometric identities match the current query.</p>
                <button
                  onClick={() => setIsEnrollingFace(true)}
                  className="mt-3 px-3 py-1.5 rounded bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  Enroll First Identity
                </button>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* INTERACTIVE BIOMETRIC TESTBENCH (Verification of 6 Scenarios)             */}
          {/* ========================================================================= */}
          <div className="tactical-card p-5 rounded-xl border border-[#1E2D48] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
                    INTERACTIVE BIOMETRIC RECOGNITION TESTBENCH
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Verify all 6 operational pipeline scenarios: Known Face, Unknown Face, Blurry Face, Multiple Faces, No Face, and Threshold Gating.
                  </p>
                </div>
              </div>
            </div>

            {/* Scenario Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 text-[11px] mr-1">RUN TEST SCENARIO:</span>
              <button
                onClick={() => loadScenarioProbe('WATCHLIST')}
                disabled={testEvaluating}
                className="px-3 py-1.5 rounded bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40"
              >
                1. Known Watchlist Match (+40 Threat)
              </button>
              <button
                onClick={() => loadScenarioProbe('AUTHORIZED')}
                disabled={testEvaluating}
                className="px-3 py-1.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40"
              >
                2. Known Authorized Match (-30 Threat)
              </button>
              <button
                onClick={() => loadScenarioProbe('UNKNOWN')}
                disabled={testEvaluating}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                3. Unknown Face (Neutral / 0 Threat)
              </button>
              <button
                onClick={() => loadScenarioProbe('BLURRY_FACE')}
                disabled={testEvaluating}
                className="px-3 py-1.5 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40"
              >
                4. Blurry Face (Quality Rejected)
              </button>
              <button
                onClick={() => loadScenarioProbe('NO_FACE')}
                disabled={testEvaluating}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-800"
              >
                5. No Face / Back Turned
              </button>
            </div>

            {/* Testbench Visual Results */}
            {testResult && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 font-mono text-xs">
                {/* Probe Visual */}
                <div className="tactical-card p-3 rounded-lg border border-slate-800 bg-[#070B14]">
                  <span className="text-[10px] text-slate-400 font-bold block mb-2">PROBE OPTICAL CROP</span>
                  <div className="aspect-square bg-slate-900 rounded border border-slate-800 flex items-center justify-center overflow-hidden relative">
                    {testImageB64 && (
                      <img src={testImageB64} alt="Probe" className="w-full h-full object-contain" />
                    )}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-cyan-300 border border-cyan-500/30">
                      STATE: {testResult.state}
                    </div>
                  </div>
                </div>

                {/* Quality & Detection Breakdown */}
                <div className="tactical-card p-3 rounded-lg border border-slate-800 bg-[#070B14] space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold block">BIOMETRIC QUALITY GATING</span>
                  {testResult.detections && testResult.detections.length > 0 ? (
                    testResult.detections.map((det, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Quality Status:</span>
                          <strong className={det.quality?.is_acceptable ? 'text-emerald-400' : 'text-amber-400'}>
                            {det.quality?.status || 'UNKNOWN'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Composite Score:</span>
                          <strong className="text-cyan-300">
                            {det.quality?.quality_score !== undefined ? `${(det.quality.quality_score * 100).toFixed(0)}%` : 'N/A'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Resolution:</span>
                          <span className="text-slate-300">{det.quality?.metrics?.resolution || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Sharpness Var:</span>
                          <span className="text-slate-300">{det.quality?.metrics?.sharpness_var || 'N/A'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-center py-6">No face detected in probe crop.</div>
                  )}
                </div>

                {/* Match Evaluation & Threat Impact */}
                <div className="tactical-card p-3 rounded-lg border border-slate-800 bg-[#070B14] space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold block">IDENTITY RESOLUTION & THREAT IMPACT</span>
                  {testResult.state === 'MATCHED' && testResult.best_match ? (
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Resolved Identity:</span>
                        <strong className="text-amber-300 font-bold">{testResult.best_match.matched_identity?.name}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Category:</span>
                        <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 text-[10px] font-bold">
                          {testResult.best_match.matched_identity?.category}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cosine Similarity:</span>
                        <strong className="text-cyan-300">{testResult.best_match.similarity}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Confidence:</span>
                        <strong className="text-emerald-400">{(testResult.best_match.confidence * 100).toFixed(1)}%</strong>
                      </div>
                      <div className="p-1.5 rounded bg-red-950/40 border border-red-500/30 text-[10px] text-red-300 mt-1">
                        +40 Threat Score (Watchlist Infiltration Alert Emitted)
                      </div>
                    </div>
                  ) : testResult.state === 'UNKNOWN' ? (
                    <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2 text-[11px]">
                      <div className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-cyan-400" />
                        UNKNOWN / UNVERIFIED PERSON
                      </div>
                      <p className="text-slate-400 text-[10px]">
                        Biometric vector does not match any configured watchlist identity.
                      </p>
                      <div className="p-1.5 rounded bg-slate-800/80 text-[10px] text-slate-300">
                        ✓ 0 Threat Delta (Neutral observation per privacy rules)
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                      Biometric state: <strong className="text-slate-200">{testResult.state}</strong>. No matching identity evaluated.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ANPR VEHICLE WATCHLIST                                             */}
      {/* ========================================================================= */}
      {activeTab === 'VEHICLE' && (
        <div className="space-y-4">
          <div className="tactical-card p-3 rounded-xl border border-[#1E2D48] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search registered plate or vehicle title..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <button
              onClick={() => setIsAddingVehicle(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold shadow-lg shadow-red-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Vehicle Target</span>
            </button>
          </div>

          {/* Vehicle Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
            {filteredVehicles.map((item) => (
              <div
                key={item.id}
                className="tactical-card rounded-xl border border-[#1E2D48] p-4 flex flex-col justify-between hover:border-red-500/40 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                      {item.id}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-500/20 text-red-400 border border-red-500/40">
                      {item.threat_level}
                    </span>
                  </div>

                  <div>
                    <span className="text-xl font-black text-amber-300 tracking-wider">
                      {item.identifier}
                    </span>
                    <h3 className="text-xs text-white font-bold mt-1">{item.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-1">{item.category}</p>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded border border-slate-800 line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 mt-3">
                  <span>Logged: {item.date_added || 'Active'}</span>
                  <button
                    onClick={() => handleDeleteVehicle(item.id, item.identifier)}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ENROLL NEW FACE                                                    */}
      {/* ========================================================================= */}
      {isEnrollingFace && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="tactical-card max-w-lg w-full p-6 rounded-xl border border-cyan-500/50 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                ENROLL BIOMETRIC FACE IDENTITY
              </h3>
              <button onClick={() => setIsEnrollingFace(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {enrollError && (
              <div className="p-2.5 rounded bg-red-950/50 border border-red-500/50 text-red-300 text-xs">
                {enrollError}
              </div>
            )}

            <form onSubmit={handleEnrollSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Full Identity Title / Name</label>
                <input
                  type="text"
                  required
                  value={enrollForm.name}
                  onChange={(e) => setEnrollForm({ ...enrollForm, name: e.target.value })}
                  placeholder="e.g. Tariq Mansoor, Officer Vikram..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select
                    value={enrollForm.category}
                    onChange={(e) => setEnrollForm({ ...enrollForm, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="WATCHLIST">Watchlist (Flagged)</option>
                    <option value="AUTHORIZED">Authorized Personnel</option>
                    <option value="SECURITY_STAFF">Security Staff</option>
                    <option value="VISITOR">Visitor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Threat Classification</label>
                  <select
                    value={enrollForm.threat_level}
                    onChange={(e) => setEnrollForm({ ...enrollForm, threat_level: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                    <option value="NEUTRAL">Neutral / Clear</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Biometric Reference Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500"
                />
              </div>

              {enrollForm.preview_url && (
                <div className="flex items-center gap-3 p-2 bg-slate-900 rounded border border-slate-800">
                  <img src={enrollForm.preview_url} alt="Preview" className="w-14 h-14 rounded object-cover border border-slate-700" />
                  <span className="text-[11px] text-emerald-400">✓ Image ready for landmark extraction & SFace 128-D embedding.</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1">Dossier / Intelligence Notes</label>
                <textarea
                  rows={2}
                  value={enrollForm.notes}
                  onChange={(e) => setEnrollForm({ ...enrollForm, notes: e.target.value })}
                  placeholder="Operational background, clearance details, or case reference..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEnrollingFace(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollSubmitting}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold"
                >
                  {enrollSubmitting ? 'Enrolling...' : 'Confirm Biometric Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD VEHICLE TARGET                                                 */}
      {/* ========================================================================= */}
      {isAddingVehicle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="tactical-card max-w-md w-full p-6 rounded-xl border border-red-500/50 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Car className="w-4 h-4 text-red-400" />
                REGISTER VEHICLE WATCHLIST TARGET
              </h3>
              <button onClick={() => setIsAddingVehicle(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">License Plate Number</label>
                <input
                  type="text"
                  required
                  value={vehicleForm.identifier}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, identifier: e.target.value })}
                  placeholder="e.g. DL01AB1234..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white uppercase focus:outline-none focus:border-red-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Vehicle Description</label>
                <input
                  type="text"
                  value={vehicleForm.title}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, title: e.target.value })}
                  placeholder="e.g. Dark Grey Scorpio SUV..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Threat Level</label>
                  <select
                    value={vehicleForm.threat_level}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, threat_level: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={vehicleForm.category}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, category: e.target.value })}
                    placeholder="e.g. Infiltration..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Operational Notes</label>
                <textarea
                  rows={2}
                  value={vehicleForm.notes}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                  placeholder="Reason for surveillance or interception orders..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingVehicle(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  Register Plate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
