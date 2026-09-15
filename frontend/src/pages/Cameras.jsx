import React, { useState, useEffect } from 'react';
import { Camera, Plus, CheckCircle2, AlertTriangle, Play, RefreshCw, Trash2, Edit } from 'lucide-react';
import { apiClient } from '../services/api';

export default function Cameras() {
  const [camerasList, setCamerasList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    location: '',
    stream_type: 'RTSP',
    stream_url: 'rtsp://192.168.1.104:554/live/ch0',
    fps: 30,
    resolution: '1920x1080',
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

  const handleTestConnection = async (cam) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/cameras/${cam.id}/test`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setTestResult({
          cameraCode: result.camera_code,
          status: result.status,
          ping: `${result.latency_ms}ms`,
          codec: result.codec
        });
      } else {
        setTestResult({
          cameraCode: cam.code,
          status: 'PROBE_FAILED',
          ping: '--',
          codec: 'OFFLINE'
        });
      }
    } catch (err) {
      setTestResult({
        cameraCode: cam.code,
        status: 'CONNECTION_REFUSED',
        ping: '--',
        codec: 'OFFLINE'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code.toUpperCase(),
          name: formData.name,
          location: formData.location,
          stream_type: formData.stream_type,
          stream_url: formData.stream_url,
          fps: Number(formData.fps),
          resolution: formData.resolution,
          lat: Number(formData.lat) || 32.7300,
          lng: Number(formData.lng) || 74.8600,
          ai_enabled: true
        })
      });
      if (res.ok) {
        await loadCameras();
        setIsAdding(false);
        setFormData({
          code: '',
          name: '',
          location: '',
          stream_type: 'RTSP',
          stream_url: 'rtsp://192.168.1.104:554/live/ch0',
          fps: 30,
          resolution: '1920x1080',
          lat: 32.7300,
          lng: 74.8600
        });
      }
    } catch (err) {
      console.error("Failed to add camera:", err);
    }
  };

  return (
    <div className="space-y-4 p-4 max-w-[1920px] mx-auto">
      {/* Top Banner */}
      <div className="tactical-card p-4 rounded-xl border border-[#1E2D48] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
              Camera Nodes & Ingestion Management
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure existing IP-based CCTV hardware, RTSP streaming pipelines, and demo MP4 ingest feeds.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold shadow-lg shadow-cyan-600/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Ingestion Node</span>
        </button>
      </div>

      {/* Test Connection Banner if active */}
      {testResult && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Connection verified for {testResult.cameraCode}: Ping: {testResult.ping} | Codec: {testResult.codec}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Add Camera Form Modal */}
      {isAdding && (
        <div className="tactical-card rounded-xl p-5 border border-cyan-500/40">
          <h3 className="text-xs font-bold uppercase text-cyan-400 font-mono mb-4">
            Register New Video Stream Node
          </h3>
          <form onSubmit={handleAddCamera} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Camera Code (e.g. BOP-07)</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Perimeter Sector Location</label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Ingest Protocol</label>
              <select
                value={formData.stream_type}
                onChange={(e) => setFormData({ ...formData, stream_type: e.target.value })}
                className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
              >
                <option value="RTSP">RTSP (Real-Time Streaming Protocol)</option>
                <option value="DEMO_MP4">Demo Video (Prerecorded MP4)</option>
                <option value="HTTP_HLS">HLS / WebRTC Stream</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-400 mb-1">Stream Endpoint URI</label>
              <input
                type="text"
                required
                value={formData.stream_url}
                onChange={(e) => setFormData({ ...formData, stream_url: e.target.value })}
                className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-400"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
              >
                Register & Initialize Camera
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cameras Matrix Table */}
      <div className="tactical-card rounded-xl border border-[#1E2D48] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0E1524] border-b border-[#1E2D48] text-[11px] font-mono uppercase text-slate-400">
                <th className="py-3 px-4">CAMERA NODE</th>
                <th className="py-3 px-4">SECTOR LOCATION</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">INGEST TYPE</th>
                <th className="py-3 px-4">RESOLUTION / FPS</th>
                <th className="py-3 px-4">AI INFERENCE</th>
                <th className="py-3 px-4 text-right">CONTROLS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D48] text-xs font-mono">
              {camerasList.map((cam) => (
                <tr key={cam.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-200">{cam.code}</div>
                    <div className="text-[11px] text-slate-400">{cam.name}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{cam.location}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                      ● {cam.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-cyan-400 font-semibold">{cam.streamType}</td>
                  <td className="py-3 px-4 text-slate-400">{cam.resolution} @ {cam.fps} FPS</td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-400 font-bold">ACTIVE</span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleTestConnection(cam)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                    >
                      Test Ping
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
