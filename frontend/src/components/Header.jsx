import React from 'react';
import { Flame, RefreshCw, AlertTriangle, Activity, ShieldAlert, PlusCircle } from 'lucide-react';

export default function Header({ summary, provider, onRefresh, onOpenAnalyze, loading }) {
  const isLive = provider?.mode === 'LIVE';

  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="brand-icon-box">
          <Flame size={22} color="#ffffff" />
        </div>
        <div>
          <div className="brand-title">Satellite Thermal Source Monitoring</div>
          <div className="brand-tag">Satellite Thermal Anomaly Analysis & Persistence Pipeline</div>
        </div>

        <div className={`mode-badge ${isLive ? 'live' : 'demo'}`} title={provider?.disclaimer}>
          <span className="dot-indicator" style={{ background: isLive ? '#10b981' : '#f59e0b', margin: 0 }}></span>
          <span>{isLive ? '🟢 Near-real-time FIRMS' : '🟡 FIRMS Demo Data'}</span>
        </div>
      </div>

      {/* Aggregate Telemetry Metric Cards */}
      <div className="nav-metrics">
        <div className="metric-pill">
          <span className="metric-pill-label">Total Hotspots</span>
          <span className="metric-pill-value">{summary?.totalHotspots ?? 0}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill-label">High Risk</span>
          <span className="metric-pill-value" style={{ color: 'var(--risk-high)' }}>
            {summary?.highRisk ?? 0}
          </span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill-label">Medium Risk</span>
          <span className="metric-pill-value" style={{ color: 'var(--risk-medium)' }}>
            {summary?.mediumRisk ?? 0}
          </span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill-label">Low Risk</span>
          <span className="metric-pill-value" style={{ color: 'var(--risk-low)' }}>
            {summary?.lowRisk ?? 0}
          </span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill-label">Persistent</span>
          <span className="metric-pill-value" style={{ color: '#a78bfa' }}>
            {summary?.persistentCount ?? 0}
          </span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill-label">Predicted Industrial Sources</span>
          <span className="metric-pill-value" style={{ color: '#f87171' }}>
            {summary?.predictedIndustrialSources ?? summary?.potentialIndustrialFires ?? 0}
          </span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="nav-actions">
        <button className="btn btn-warning" onClick={onOpenAnalyze} title="Run end-to-end classification on custom coordinates">
          <PlusCircle size={15} />
          <span>Analyze Hotspot</span>
        </button>
        <button className="btn btn-secondary" onClick={onRefresh} disabled={loading} title="Refresh telemetry from backend">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
}
