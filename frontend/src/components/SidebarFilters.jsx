import React from 'react';
import { Filter, Search, Zap, Layers } from 'lucide-react';

const CLASSIFICATION_OPTIONS = [
  'All Classifications',
  'Potential Industrial Fire',
  'Gas Flare',
  'Normal/Persistent Industrial Heat Source',
  'Agricultural Burning',
  'Other Thermal Source',
];

const DEMO_SCENARIOS = [
  {
    title: 'Scenario 1: Potential Industrial Fire',
    desc: 'High thermal intensity (78 MW) + acute chemical warehouse anomaly',
    expected: 'Potential Industrial Fire (HIGH Risk)',
    filter: { classification: 'Potential Industrial Fire', riskLevel: 'HIGH' },
    coords: [13.168, 80.264], // Manali Petrochem
  },
  {
    title: 'Scenario 2: Persistent Heat',
    desc: 'Visakhapatnam Steel blast furnace with 4+ consecutive active days',
    expected: 'Normal/Persistent Heat Source (MEDIUM/LOW Risk)',
    filter: { classification: 'Normal/Persistent Industrial Heat Source', persistent: 'true' },
    coords: [17.634, 83.181],
  },
  {
    title: 'Scenario 3: Gas Flare',
    desc: 'Jamnagar Reliance refinery flare pad at 0.12km proximity',
    expected: 'Gas Flare (Persistent, High BT)',
    filter: { classification: 'Gas Flare' },
    coords: [22.352, 69.854],
  },
  {
    title: 'Scenario 4: Crop Burning',
    desc: 'Sangrur Punjab paddy residue burning in daytime farmland',
    expected: 'Agricultural Burning (Farmland, Low Dist)',
    filter: { classification: 'Agricultural Burning' },
    coords: [30.245, 75.842],
  },
  {
    title: 'Scenario 5: Remote Anomaly',
    desc: 'Similipal forest reserve canopy with zero industrial proximity',
    expected: 'Other Thermal Source (Isolated)',
    filter: { classification: 'Other Thermal Source' },
    coords: [21.854, 86.342],
  },
];

export default function SidebarFilters({
  filters,
  onFilterChange,
  onSelectScenario,
  summary,
}) {
  return (
    <aside className="sidebar">
      {/* 1. Risk Level Filter Chips */}
      <div className="sidebar-section">
        <div className="sidebar-title">
          <span>Risk Level</span>
          <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
            {filters.riskLevel || 'ALL'}
          </span>
        </div>
        <div className="risk-filter-grid">
          <div
            className={`risk-chip ${!filters.riskLevel ? 'active' : ''}`}
            onClick={() => onFilterChange('riskLevel', '')}
          >
            <span>
              <span className="dot-indicator dot-all"></span>All
            </span>
            <span>{summary?.totalHotspots ?? 0}</span>
          </div>
          <div
            className={`risk-chip ${filters.riskLevel === 'HIGH' ? 'active' : ''}`}
            onClick={() => onFilterChange('riskLevel', 'HIGH')}
          >
            <span>
              <span className="dot-indicator dot-high"></span>High
            </span>
            <span style={{ color: 'var(--risk-high)' }}>{summary?.highRisk ?? 0}</span>
          </div>
          <div
            className={`risk-chip ${filters.riskLevel === 'MEDIUM' ? 'active' : ''}`}
            onClick={() => onFilterChange('riskLevel', 'MEDIUM')}
          >
            <span>
              <span className="dot-indicator dot-med"></span>Medium
            </span>
            <span style={{ color: 'var(--risk-medium)' }}>{summary?.mediumRisk ?? 0}</span>
          </div>
          <div
            className={`risk-chip ${filters.riskLevel === 'LOW' ? 'active' : ''}`}
            onClick={() => onFilterChange('riskLevel', 'LOW')}
          >
            <span>
              <span className="dot-indicator dot-low"></span>Low
            </span>
            <span style={{ color: 'var(--risk-low)' }}>{summary?.lowRisk ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 2. Classification & Persistence Selectors */}
      <div className="sidebar-section">
        <div className="sidebar-title">
          <span>Filter Parameters</span>
          <Filter size={13} color="var(--text-muted)" />
        </div>

        <div className="form-group">
          <label className="form-label">Thermal Source Classification</label>
          <select
            className="form-select"
            value={filters.classification || ''}
            onChange={(e) => onFilterChange('classification', e.target.value)}
          >
            {CLASSIFICATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt === 'All Classifications' ? '' : opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Persistence Recurrence</label>
          <select
            className="form-select"
            value={filters.persistent || ''}
            onChange={(e) => onFilterChange('persistent', e.target.value)}
          >
            <option value="">All Hotspots</option>
            <option value="true">Persistent Sources (Multi-day)</option>
            <option value="false">Non-persistent / Isolated</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Search Facility / ID</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search e.g. Refinery, Steel..."
              value={filters.search || ''}
              onChange={(e) => onFilterChange('search', e.target.value)}
              style={{ paddingLeft: '1.9rem' }}
            />
            <Search
              size={13}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '0.65rem', top: '0.65rem' }}
            />
          </div>
        </div>
      </div>

      {/* 3. Demo Quick Scenarios */}
      <div className="sidebar-section" style={{ flex: 1 }}>
        <div className="sidebar-title">
          <span>Demo Showcase Scenarios</span>
          <Zap size={13} color="#fbbf24" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {DEMO_SCENARIOS.map((sc, idx) => (
            <button
              key={idx}
              className="scenario-button"
              onClick={() => onSelectScenario(sc)}
              title={`Focus on ${sc.title}`}
            >
              <div className="scenario-name">
                <span>{sc.title}</span>
                <span style={{ color: '#60a5fa', fontSize: '0.65rem' }}>View →</span>
              </div>
              <div className="scenario-desc">{sc.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
