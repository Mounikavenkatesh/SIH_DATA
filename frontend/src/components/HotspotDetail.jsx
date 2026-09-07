import React from 'react';
import { X, ShieldAlert, Activity, Factory, Clock, Radio, Info, Layers } from 'lucide-react';

function getRiskExplanation(hotspot, factors, riskScore, riskLevel) {
  const drivers = [];
  if ((factors.thermalIntensity || 0) >= 12) {
    drivers.push(`elevated thermal intensity (${hotspot.thermalIntensity || 25} MW, contributing ${factors.thermalIntensity} pts)`);
  }
  if ((factors.industrialProximity || 0) >= 10) {
    drivers.push(`proximity to industrial facility (${hotspot.distanceToIndustrialFacility ?? 0} km, contributing ${factors.industrialProximity} pts)`);
  }
  if ((factors.persistence || 0) >= 10) {
    drivers.push(`spatiotemporal persistence history (${factors.persistence} pts)`);
  }
  if ((factors.abnormalActivity || 0) >= 6) {
    drivers.push(`acute combustion anomaly factor (${factors.abnormalActivity} pts)`);
  }
  if ((factors.confidence || 0) >= 10) {
    drivers.push(`high sensor detection confidence (${factors.confidence} pts)`);
  }

  if (drivers.length === 0) {
    return 'Score reflects nominal baseline thermal intensity with isolated, non-critical observation telemetry.';
  }

  if (riskLevel === 'HIGH') {
    return `High risk driven primarily by ${drivers.slice(0, 2).join(' combined with ')}. Requires priority monitoring buffer review.`;
  } else if (riskLevel === 'MEDIUM') {
    return `Moderate risk profile characterized by ${drivers.slice(0, 2).join(' alongside ')}. Standard surveillance buffer recommended.`;
  } else {
    return `Low risk profile driven by ${drivers[0] || 'low thermal intensity'}. Nominal operational heat signature.`;
  }
}

export default function HotspotDetail({ hotspot, onClose }) {
  if (!hotspot) return null;

  const riskLevel = hotspot.riskLevel || 'LOW';
  const riskScore = hotspot.riskScore ?? 35;
  const factors = hotspot.riskFactors || {};
  const persistence = hotspot.persistence || {};
  const classification = hotspot.classification || hotspot.targetClassification || 'Other Thermal Source';

  return (
    <aside className={`detail-drawer ${hotspot ? 'open' : ''}`}>
      {/* Header */}
      <div className="drawer-header">
        <div>
          <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
            Thermal Hotspot Intelligence Trace
          </div>
          <h2 className="drawer-title">{hotspot.hotspotId}</h2>
        </div>
        <button className="btn-close" onClick={onClose} title="Close drawer">
          <X size={18} />
        </button>
      </div>

      <div className="drawer-body">
        {/* Classification & Risk Level Banner */}
        <div
          className="detail-card"
          style={{
            background:
              riskLevel === 'HIGH'
                ? 'rgba(239, 68, 68, 0.12)'
                : riskLevel === 'MEDIUM'
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(6, 182, 212, 0.12)',
            borderColor:
              riskLevel === 'HIGH' ? '#ef4444' : riskLevel === 'MEDIUM' ? '#f59e0b' : '#06b6d4',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span className={`badge badge-${riskLevel.toLowerCase()}`}>
              {riskLevel} RISK LEVEL
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
              {riskScore} / 100
            </span>
          </div>

          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f9fafb', marginBottom: '0.2rem' }}>
            {classification}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            AI Model Confidence: <b>{Math.round((hotspot.classificationConfidence || 0.85) * 100)}%</b>
            <span className="provenance-tag tag-derived">DERIVED DATA</span>
          </div>
        </div>

        {/* Classification Evidence & Feature Attribution */}
        <div className="detail-card">
          <div className="detail-card-title">
            <Layers size={14} color="#38bdf8" />
            <span>Classification Evidence & Decision Basis</span>
            <span className="provenance-tag tag-derived">ML FEATURES</span>
          </div>

          <div className="evidence-grid">
            <div className="evidence-item">
              <span className="evidence-label">1. Thermal Intensity (FRP)</span>
              <span className="evidence-val">{hotspot.thermalIntensity ?? 25} MW</span>
              <span className="evidence-note">
                {(hotspot.thermalIntensity || 25) >= 50
                  ? 'High combustion radiative power (>50 MW)'
                  : (hotspot.thermalIntensity || 25) >= 30
                  ? 'Moderate sustained industrial heat'
                  : 'Low radiative thermal output'}
              </span>
            </div>

            <div className="evidence-item">
              <span className="evidence-label">2. Industrial Proximity</span>
              <span className="evidence-val">
                {hotspot.distanceToIndustrialFacility != null ? `${hotspot.distanceToIndustrialFacility} km` : 'N/A'}
              </span>
              <span className="evidence-note">
                {hotspot.nearbyIndustrialFacility && hotspot.nearbyIndustrialFacility !== 'None'
                  ? `OSM Asset: ${hotspot.nearbyIndustrialFacility}`
                  : 'Zero industrial facilities within 5km radius'}
              </span>
            </div>

            <div className="evidence-item">
              <span className="evidence-label">3. Spatiotemporal Persistence</span>
              <span className="evidence-val">
                {persistence.status || 'Non-persistent'} ({persistence.detectionCount ?? 1} hits, {persistence.durationHours ?? 0}h)
              </span>
              <span className="evidence-note">
                {persistence.status === 'Persistent'
                  ? 'Stationary multi-day recurrence confirms permanent industrial infrastructure'
                  : 'Isolated observation indicates non-persistent/transient thermal signature'}
              </span>
            </div>

            <div className="evidence-item">
              <span className="evidence-label">4. Land-Use / Biome Context</span>
              <span className="evidence-val" style={{ textTransform: 'capitalize' }}>
                {hotspot.landUse || 'industrial'}
              </span>
              <span className="evidence-note">
                Surface land context separates industrial operations from agricultural burning or forest canopies
              </span>
            </div>
          </div>
        </div>

        {/* Transparent Risk Scoring Breakdown */}
        <div className="detail-card">
          <div className="detail-card-title">
            <ShieldAlert size={14} color="#f59e0b" />
            <span>Transparent Risk Factors (0–100 Breakdown)</span>
            <span className="provenance-tag tag-derived">DERIVED</span>
          </div>

          <div className="factor-row">
            <div className="factor-meta">
              <span>Thermal Intensity (FRP) &mdash; 25% Weight</span>
              <b>{factors.thermalIntensity ?? 0} pts</b>
            </div>
            <div className="factor-track">
              <div className="factor-fill" style={{ width: `${(factors.thermalIntensity ?? 0) * 4}%`, background: '#ef4444' }} />
            </div>
          </div>

          <div className="factor-row">
            <div className="factor-meta">
              <span>Industrial Proximity Factor &mdash; 20% Weight</span>
              <b>{factors.industrialProximity ?? 0} pts</b>
            </div>
            <div className="factor-track">
              <div className="factor-fill" style={{ width: `${(factors.industrialProximity ?? 0) * 5}%`, background: '#f59e0b' }} />
            </div>
          </div>

          <div className="factor-row">
            <div className="factor-meta">
              <span>Spatiotemporal Persistence &mdash; 20% Weight</span>
              <b>{factors.persistence ?? 0} pts</b>
            </div>
            <div className="factor-track">
              <div className="factor-fill" style={{ width: `${(factors.persistence ?? 0) * 5}%`, background: '#a78bfa' }} />
            </div>
          </div>

          <div className="factor-row">
            <div className="factor-meta">
              <span>Instrument Confidence &mdash; 15% Weight</span>
              <b>{factors.confidence ?? 0} pts</b>
            </div>
            <div className="factor-track">
              <div className="factor-fill" style={{ width: `${(factors.confidence ?? 0) * 6.6}%`, background: '#34d399' }} />
            </div>
          </div>

          <div className="factor-row">
            <div className="factor-meta">
              <span>Recent Detection Frequency &mdash; 10% Weight</span>
              <b>{factors.frequency ?? 0} pts</b>
            </div>
            <div className="factor-track">
              <div className="factor-fill" style={{ width: `${(factors.frequency ?? 0) * 10}%`, background: '#60a5fa' }} />
            </div>
          </div>

          <div className="factor-row">
            <div className="factor-meta">
              <span>Acute / Abnormal Activity &mdash; 10% Weight</span>
              <b>{factors.abnormalActivity ?? 0} pts</b>
            </div>
            <div className="factor-track">
              <div className="factor-fill" style={{ width: `${(factors.abnormalActivity ?? 0) * 10}%`, background: '#ec4899' }} />
            </div>
          </div>

          {/* Contributing Factors Narrative Explanation */}
          <div className="risk-explanation-box">
            <div className="risk-explanation-title">💡 Risk Score Contributing Factor Breakdown:</div>
            <div className="risk-explanation-text">
              {hotspot.riskExplanation || getRiskExplanation(hotspot, factors, riskScore, riskLevel)}
            </div>
          </div>
        </div>

        {/* Spatiotemporal Persistence Card */}
        <div className="detail-card">
          <div className="detail-card-title">
            <Clock size={14} color="#a78bfa" />
            <span>Detection History & Persistence</span>
            <span className="provenance-tag tag-derived">DERIVED</span>
          </div>

          <div className="grid-2col">
            <div className="prop-box">
              <span className="prop-name">Persistence Status</span>
              <span className="prop-val" style={{ color: persistence.status === 'Persistent' ? '#a78bfa' : '#67e8f9' }}>
                {persistence.status || 'Non-persistent'}
              </span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Detection History</span>
              <span className="prop-val">{persistence.detectionCount ?? 1} detections over {persistence.durationHours ?? 0} hrs</span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Observation Period</span>
              <span className="prop-val">{persistence.durationHours ?? 0} hours active tracking</span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Spatial Tolerance</span>
              <span className="prop-val">1.0 km buffer</span>
            </div>
          </div>
        </div>

        {/* Industrial Proximity Context Card */}
        <div className="detail-card">
          <div className="detail-card-title">
            <Factory size={14} color="#60a5fa" />
            <span>Industrial Asset Context (OSM)</span>
            <span className="provenance-tag tag-derived">DERIVED</span>
          </div>

          <div style={{ marginBottom: '0.6rem' }}>
            <span className="prop-name">Nearest Industrial Facility</span>
            <span className="prop-val" style={{ color: '#93c5fd', fontSize: '0.9rem' }}>
              {hotspot.nearbyIndustrialFacility || 'None nearby'}
            </span>
          </div>

          <div className="grid-2col">
            <div className="prop-box">
              <span className="prop-name">Distance to Facility</span>
              <span className="prop-val">{hotspot.distanceToIndustrialFacility ?? 'N/A'} km</span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Land Use Biome</span>
              <span className="prop-val">{hotspot.landUse || 'industrial'}</span>
            </div>
          </div>
        </div>

        {/* Source Telemetry Card */}
        <div className="detail-card">
          <div className="detail-card-title">
            <Radio size={14} color="#34d399" />
            <span>Satellite Telemetry</span>
            <span className="provenance-tag tag-source">SOURCE DATA</span>
          </div>

          <div className="grid-2col">
            <div className="prop-box">
              <span className="prop-name">Hotspot Detection Coordinates</span>
              <span className="prop-val mono">
                {Number(hotspot.latitude).toFixed(4)}° N, {Number(hotspot.longitude).toFixed(4)}° E
              </span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Satellite / Sensor</span>
              <span className="prop-val">{hotspot.satellite || 'VIIRS'}</span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Brightness Temp</span>
              <span className="prop-val">{hotspot.brightness} K</span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Confidence</span>
              <span className="prop-val">{hotspot.confidence}%</span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Acquisition Timestamp</span>
              <span className="prop-val mono" style={{ fontSize: '0.74rem' }}>
                {hotspot.timestamp ? new Date(hotspot.timestamp).toUTCString() : 'N/A'}
              </span>
            </div>
            <div className="prop-box">
              <span className="prop-name">Data Mode</span>
              <span className="prop-val">
                {hotspot.source === 'DEMO' ? 'SYNTHETIC DEMO' : hotspot.source}
                <span className="provenance-tag tag-demo">DEMO</span>
              </span>
            </div>
          </div>
        </div>

        {/* Scientific Disclaimer */}
        <div style={{ background: 'rgba(31, 41, 55, 0.4)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Info size={12} />
            <span>Scientific Disclaimer</span>
          </div>
          This prototype demonstrates an AI-assisted approach for classifying satellite thermal hotspots and estimating risk. Synthetic/demo data is used for development. Predictions and risk scores are not validated emergency-response determinations and should not be treated as operational fire certification.
        </div>
      </div>
    </aside>
  );
}
