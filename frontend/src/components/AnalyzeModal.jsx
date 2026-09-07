import React, { useState } from 'react';
import { X, Send, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { analyzeHotspot } from '../services/api';

const PRESETS = [
  { name: 'Manali Petrochem (Thermal Anomaly Spike)', lat: 13.168, lon: 80.264, bt: 395.0, ti: 85.0, conf: 96 },
  { name: 'Jamnagar Refinery (Gas Flare)', lat: 22.352, lon: 69.854, bt: 375.0, ti: 68.0, conf: 95 },
  { name: 'Vizag Steel (Blast Furnace)', lat: 17.634, lon: 83.181, bt: 352.0, ti: 42.0, conf: 92 },
  { name: 'Punjab Farm (Stubble Burn)', lat: 30.245, lon: 75.842, bt: 322.0, ti: 16.0, conf: 78 },
  { name: 'Singrauli Thermal (Power Boiler)', lat: 24.101, lon: 82.685, bt: 348.0, ti: 38.0, conf: 89 },
];

export default function AnalyzeModal({ isOpen, onClose, onAnalysisSuccess }) {
  const [formData, setFormData] = useState({
    latitude: 13.168,
    longitude: 80.264,
    brightness: 395.0,
    confidence: 96,
    thermalIntensity: 85.0,
    timestamp: new Date().toISOString().slice(0, 16),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleApplyPreset = (p) => {
    setFormData({
      latitude: p.lat,
      longitude: p.lon,
      brightness: p.bt,
      confidence: p.conf,
      thermalIntensity: p.ti,
      timestamp: new Date().toISOString().slice(0, 16),
    });
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        brightness: parseFloat(formData.brightness),
        confidence: parseFloat(formData.confidence),
        thermalIntensity: parseFloat(formData.thermalIntensity),
        timestamp: new Date(formData.timestamp).toISOString(),
        source: 'MANUAL_INSPECTION',
      };

      const res = await analyzeHotspot(payload);
      setResult(res);
      if (onAnalysisSuccess) {
        onAnalysisSuccess(res.data || res);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.response?.data?.error || err.message || 'Analysis pipeline request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="#fbbf24" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Real-Time Hotspot Analysis Studio</h3>
          </div>
          <button className="btn-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Submit coordinate telemetry to execute the complete pipeline:
            <b> Input &rarr; OSM Context &rarr; Persistence &rarr; Random Forest ML &rarr; Risk Assessment &rarr; MongoDB</b>.
          </div>

          {/* Preset Buttons */}
          <div style={{ marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
              QUICK INDUSTRIAL PRESETS:
            </span>
            <div className="preset-buttons">
              {PRESETS.map((p, idx) => (
                <button key={idx} type="button" className="preset-btn" onClick={() => handleApplyPreset(p)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="grid-2col" style={{ marginBottom: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Latitude (-90 to 90)</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  className="form-control"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Longitude (-180 to 180)</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  className="form-control"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Brightness Temperature (K)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="form-control"
                  value={formData.brightness}
                  onChange={(e) => setFormData({ ...formData, brightness: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Thermal Intensity (FRP in MW)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  className="form-control"
                  value={formData.thermalIntensity}
                  onChange={(e) => setFormData({ ...formData, thermalIntensity: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confidence (0 - 100%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  className="form-control"
                  value={formData.confidence}
                  onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Observation Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  className="form-control"
                  value={formData.timestamp}
                  onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.8rem', color: '#fca5a5', fontSize: '0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.6rem' }}
            >
              {loading ? (
                <span>Running ML & Risk Pipeline...</span>
              ) : (
                <>
                  <Send size={15} />
                  <span>Execute Pipeline Analysis</span>
                </>
              )}
            </button>
          </form>

          {/* Live Analysis Result Card */}
          {result && (
            <div
              style={{
                marginTop: '1rem',
                background: 'rgba(31, 41, 55, 0.8)',
                border: '1px solid #3b82f6',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399', fontWeight: 700, fontSize: '0.78rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Pipeline Execution Success</span>
                </div>
                <span className={`badge badge-${result.risk?.level?.toLowerCase()}`}>
                  {result.risk?.level} RISK ({result.risk?.score}/100)
                </span>
              </div>

              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f9fafb' }}>
                {result.classification}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                AI Confidence: <b>{Math.round((result.confidence || 0.85) * 100)}%</b> | Persistence: <b>{result.persistence?.status}</b> ({result.persistence?.detectionCount ?? 1} detections over {result.persistence?.durationHours ?? 0} hrs)
              </div>

              <div style={{ fontSize: '0.7rem', color: '#93c5fd', background: 'rgba(17, 24, 39, 0.6)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.4rem' }}>
                🏭 Nearest Asset: <b>{result.industrialContext?.facility || 'None'}</b> ({result.industrialContext?.distanceKm ?? 'N/A'} km away)
              </div>

              {result.risk?.explanation && (
                <div style={{ fontSize: '0.7rem', color: '#fde047', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                  💡 <b>Risk Explanation:</b> {result.risk.explanation}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
