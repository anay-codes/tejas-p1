import React, { useState, useEffect } from 'react';
import { Camera, Plus, CheckCircle2, AlertCircle, RefreshCw, Trash2, Search, X, Smartphone, Video, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { authService } from '../services/auth';

export default function Cameras() {
  const [camerasList, setCamerasList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  const [isProbing, setIsProbing] = useState(false);
  const isOperatorOrAdmin = authService.hasRole('ADMIN', 'OPERATOR');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    location: '',
    stream_type: 'RTSP',
    stream_url: 'rtsp://192.168.1.104:554/live/ch0',
    fps: 15,
    resolution: '1280x720',
    lat: 32.7300,
    lng: 74.8600
  });

  const loadCameras = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getCameras();
      if (data) setCamerasList(data);
    } catch (e) {
      console.warn("Failed to load cameras:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const handleProbeStream = async () => {
    if (!formData.stream_url) return;
    setIsProbing(true);
    setProbeResult(null);
    try {
      const res = await apiClient.probeCamera(formData.stream_url, formData.stream_type);
      setProbeResult(res);
      if (res.reachable && res.fps && res.resolution) {
        setFormData(prev => ({
          ...prev,
          fps: Math.round(res.fps) || prev.fps,
          resolution: res.resolution || prev.resolution
        }));
      }
    } catch (err) {
      setProbeResult({ reachable: false, error: err.message || "Probe failed" });
    } finally {
      setIsProbing(false);
    }
  };

  const handleTestExisting = async (cam) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const probe = await apiClient.probeCamera(cam.stream_url || cam.streamUrl, cam.stream_type || cam.streamType);
      setTestResult({
        cameraCode: cam.code,
        reachable: probe.reachable,
        fps: probe.fps,
        resolution: probe.resolution,
        error: probe.error
      });
    } catch (err) {
      setTestResult({
        cameraCode: cam.code,
        reachable: false,
        error: err.message || "Connection refused"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRestart = async (camId) => {
    try {
      await apiClient.restartCamera(camId);
      await loadCameras();
    } catch (err) {
      alert("Restart failed: " + (err.message || "Error"));
    }
  };

  const handleDelete = async (camId) => {
    if (!confirm("Are you sure you want to delete this camera node?")) return;
    try {
      await apiClient.deleteCamera(camId);
      await loadCameras();
    } catch (err) {
      alert("Delete failed: " + (err.message || "Error"));
    }
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();
    try {
      await apiClient.createCamera({
        code: formData.code.toUpperCase(),
        name: formData.name,
        location: formData.location,
        stream_type: formData.stream_type === 'PHONE_STREAM' ? 'RTSP' : formData.stream_type,
        stream_url: formData.stream_url,
        fps: Number(formData.fps) || 15,
        resolution: formData.resolution,
        lat: Number(formData.lat) || 32.7300,
        lng: Number(formData.lng) || 74.8600,
        ai_enabled: true
      });
      await loadCameras();
      setIsAdding(false);
      setProbeResult(null);
      setFormData({
        code: '',
        name: '',
        location: '',
        stream_type: 'RTSP',
        stream_url: 'rtsp://192.168.1.104:554/live/ch0',
        fps: 15,
        resolution: '1280x720',
        lat: 32.7300,
        lng: 74.8600
      });
    } catch (err) {
      alert("Failed to add camera: " + (err.message || "Error"));
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            Camera Nodes & Surveillance Ingestion
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage physical CCTV nodes, mobile phone camera streams, and RTSP video endpoints. Multiple phones can be registered as independent camera sources.
          </p>
        </div>

        {isOperatorOrAdmin && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ingestion Node</span>
          </button>
        )}
      </div>

      {/* Existing camera probe result banner */}
      {testResult && (
        <div className={`p-3 rounded-lg flex items-center justify-between text-xs border ${
          testResult.reachable 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {testResult.reachable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>
              <strong>{testResult.cameraCode}:</strong>{' '}
              {testResult.reachable 
                ? `Node reachable (${testResult.resolution} @ ${testResult.fps} FPS)` 
                : `Offline or unreachable (${testResult.error || 'Connection timed out'})`}
            </span>
          </div>
          <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Camera Form Card */}
      {isAdding && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Register New Camera Node
              </h2>
              <p className="text-xs text-slate-500">
                Add an RTSP network camera, smartphone stream, or local hardware capture.
              </p>
            </div>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddCamera} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Camera Code / Identifier</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. CAM-02, PHONE-01"
                className="input-clean w-full font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Camera Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. North Gate Entryway"
                className="input-clean w-full"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Location Sector</label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Sector B Perimeter"
                className="input-clean w-full"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Source Type</label>
              <select
                value={formData.stream_type}
                onChange={(e) => setFormData({ ...formData, stream_type: e.target.value })}
                className="input-clean w-full bg-white"
              >
                <option value="RTSP">RTSP / Network IP Camera</option>
                <option value="PHONE_STREAM">Mobile Phone Stream (IP Webcam / RTSP App)</option>
                <option value="HARDWARE">Local Hardware Webcam (Device Index 0, 1)</option>
                <option value="DEMO_MP4">Local Video File (MP4)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-700 font-medium mb-1">Stream Endpoint URL / Index</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={formData.stream_url}
                  onChange={(e) => setFormData({ ...formData, stream_url: e.target.value })}
                  placeholder={
                    formData.stream_type === 'HARDWARE' 
                      ? '0 (Device Index)' 
                      : formData.stream_type === 'PHONE_STREAM'
                      ? 'rtsp://192.168.1.x:8554/live or http://192.168.1.x:8080/video'
                      : 'rtsp://192.168.1.100:554/live'
                  }
                  className="input-clean w-full font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleProbeStream}
                  disabled={isProbing}
                  className="px-3.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-300 whitespace-nowrap flex items-center gap-1 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isProbing ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>

            {formData.stream_type === 'PHONE_STREAM' && (
              <div className="md:col-span-3 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Smartphone Camera Source:</strong>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    To use a mobile phone as a live surveillance camera node, run an RTSP/IP camera app on the phone connected to the same Wi-Fi network and enter the stream URL above. Multiple phones can be registered as independent surveillance nodes.
                  </p>
                </div>
              </div>
            )}

            {probeResult && (
              <div className={`md:col-span-3 p-3 rounded-md text-xs border ${
                probeResult.reachable 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {probeResult.reachable ? (
                  <div className="flex items-center justify-between">
                    <span>Source verified reachable: {probeResult.resolution} @ {probeResult.fps} FPS</span>
                    <span className="font-semibold text-emerald-700">Connection Verified</span>
                  </div>
                ) : (
                  <span>Stream unreachable: {probeResult.error || 'Connection timed out'}</span>
                )}
              </div>
            )}

            <div className="md:col-span-3 p-3 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-between">
              <span>Perimeter Boundary Configuration:</span>
              <span className="text-[11px] text-slate-500">
                After saving, virtual polygon boundaries can be calibrated under <strong className="text-slate-800">Virtual Zones</strong>.
              </span>
            </div>

            <div className="md:col-span-3 flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                Save Camera Node
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cameras Table Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Node / Identifier</th>
                <th className="py-3 px-4">Location Sector</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Protocol</th>
                <th className="py-3 px-4">Resolution & Rate</th>
                <th className="py-3 px-4">AI Pipeline</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {camerasList.length > 0 ? (
                camerasList.map((cam) => (
                  <tr key={cam.id || cam.code} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 font-mono">{cam.code}</div>
                      <div className="text-[11px] text-slate-500">{cam.name}</div>
                    </td>
                    <td className="py-3 px-4">{cam.location}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        cam.status === 'ONLINE' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cam.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {cam.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{cam.streamType || cam.stream_type}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{cam.resolution} @ {cam.fps} FPS</td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-emerald-700">Active</span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleTestExisting(cam)}
                        disabled={isTesting}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                      >
                        Probe
                      </button>
                      <Link
                        to="/zones"
                        className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors inline-block"
                      >
                        Zones
                      </Link>
                      {isOperatorOrAdmin && (
                        <>
                          <button
                            onClick={() => handleRestart(cam.id || cam.code)}
                            title="Restart Camera Pipeline"
                            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5 inline" />
                          </button>
                          {cam.code !== 'CAM-00' && (
                            <button
                              onClick={() => handleDelete(cam.id || cam.code)}
                              title="Delete Camera Node"
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-600">No camera nodes configured in database</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "+ Add Ingestion Node" to register a stream</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
