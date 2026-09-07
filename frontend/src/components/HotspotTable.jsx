import React, { useState } from 'react';

export default function HotspotTable({ hotspots = [], onSelectHotspot, selectedHotspot }) {
  const [sortField, setSortField] = useState('timestamp');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedHotspots = [...hotspots].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'riskScore') {
      valA = a.riskScore ?? 0;
      valB = b.riskScore ?? 0;
    } else if (sortField === 'confidence') {
      valA = a.confidence ?? 0;
      valB = b.confidence ?? 0;
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div style={{ overflowX: 'auto', maxHeight: '100%' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('hotspotId')} style={{ cursor: 'pointer' }}>
              Hotspot ID {sortField === 'hotspotId' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th>Acquisition Time</th>
            <th>Hotspot Detection Coordinates</th>
            <th onClick={() => handleSort('classification')} style={{ cursor: 'pointer' }}>
              Thermal Source Classification {sortField === 'classification' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th onClick={() => handleSort('confidence')} style={{ cursor: 'pointer' }}>
              Conf % {sortField === 'confidence' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th>Detection History / Persistence</th>
            <th onClick={() => handleSort('riskScore')} style={{ cursor: 'pointer' }}>
              Risk Score {sortField === 'riskScore' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th>Risk Level</th>
            <th>Nearby Industrial Asset</th>
            <th>Data Source</th>
          </tr>
        </thead>
        <tbody>
          {sortedHotspots.map((h) => {
            const isSelected = selectedHotspot?.hotspotId === h.hotspotId;
            const rLevel = h.riskLevel || 'LOW';
            const isP = h.persistence?.status === 'Persistent';

            return (
              <tr
                key={h.hotspotId}
                onClick={() => onSelectHotspot(h)}
                style={{
                  background: isSelected ? 'rgba(59, 130, 246, 0.18)' : undefined,
                  borderLeft: isSelected ? '3px solid #3b82f6' : undefined,
                }}
              >
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#60a5fa' }}>
                  {h.hotspotId}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {h.date} {h.time}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                  {Number(h.latitude).toFixed(3)}°N, {Number(h.longitude).toFixed(3)}°E
                </td>
                <td style={{ fontWeight: 600 }}>
                  {h.classification || h.targetClassification || 'Other Thermal Source'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>
                  {h.confidence}%
                </td>
                <td>
                  <span style={{ color: isP ? '#a78bfa' : 'var(--text-muted)', fontWeight: isP ? 700 : 400 }}>
                    {isP ? '● Persistent' : 'Isolated'}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  <span
                    style={{
                      color: rLevel === 'HIGH' ? '#ef4444' : rLevel === 'MEDIUM' ? '#f59e0b' : '#06b6d4',
                    }}
                  >
                    {h.riskScore ?? 35} / 100
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${rLevel.toLowerCase()}`}>
                    {rLevel}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.nearbyIndustrialFacility || 'None nearby'}
                </td>
                <td>
                  <span className="provenance-tag tag-demo">
                    {h.source || 'DEMO'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
