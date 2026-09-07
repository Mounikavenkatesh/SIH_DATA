import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

const BASEMAP_URLS = {
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Canvas Dark | NASA FIRMS & OSM Context',
    name: 'ESRI Dark Gray',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Earthstar Geographics | NASA FIRMS & OSM Context',
    name: 'ESRI Satellite Imagery',
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; Carto & OpenStreetMap',
    name: 'OpenStreetMap Streets',
  },
};

// Custom Marker Generator
function createHotspotIcon(riskLevel, thermalIntensity = 25) {
  const level = (riskLevel || 'LOW').toUpperCase();
  let markerClass = 'marker-low';
  if (level === 'HIGH') markerClass = 'marker-high';
  else if (level === 'MEDIUM') markerClass = 'marker-med';

  const coreSize = Math.min(22, Math.max(10, Math.round(Math.sqrt(thermalIntensity) * 2.2)));
  const haloSize = coreSize * 2.4;

  return L.divIcon({
    className: `marker-pulsing-wrap ${markerClass}`,
    iconSize: [haloSize, haloSize],
    iconAnchor: [haloSize / 2, haloSize / 2],
    popupAnchor: [0, -haloSize / 2],
    html: `
      <div class="marker-halo" style="width: ${haloSize}px; height: ${haloSize}px;"></div>
      <div class="marker-core" style="width: ${coreSize}px; height: ${coreSize}px;"></div>
    `,
  });
}

// Subcomponent to handle programmatic camera flyTo transitions
function MapController({ focusCoords, zoom = 12 }) {
  const map = useMap();

  useEffect(() => {
    if (focusCoords && focusCoords.length === 2 && !isNaN(focusCoords[0]) && !isNaN(focusCoords[1])) {
      map.flyTo(focusCoords, zoom, { duration: 1.5 });
    }
  }, [focusCoords, zoom, map]);

  return null;
}

export default function MapView({
  hotspots = [],
  selectedHotspot,
  onSelectHotspot,
  focusCoords,
}) {
  const [basemapKey, setBasemapKey] = useState('dark');
  const currentBasemap = BASEMAP_URLS[basemapKey];

  return (
    <div className="map-viewport">
      {/* Basemap Switcher Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 800,
          background: 'rgba(17, 24, 39, 0.88)',
          backdropFilter: 'blur(10px)',
          padding: '0.4rem 0.6rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          gap: '0.4rem',
        }}
      >
        {Object.entries(BASEMAP_URLS).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setBasemapKey(key)}
            style={{
              background: basemapKey === key ? 'var(--accent-blue)' : 'transparent',
              color: basemapKey === key ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.25rem 0.5rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {info.name}
          </button>
        ))}
      </div>

      <MapContainer
        center={[22.5, 80.0]} // Centered over India
        zoom={5}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <MapController focusCoords={focusCoords} />

        <TileLayer
          url={currentBasemap.url}
          attribution={currentBasemap.attribution}
          maxZoom={18}
        />

        {/* Indicative Risk / Monitoring Buffer Circles & Hotspot Markers */}
        {hotspots.map((h) => {
          const lat = h.latitude;
          const lon = h.longitude;
          const riskLevel = h.riskLevel || 'LOW';
          const isSelected = selectedHotspot?.hotspotId === h.hotspotId;

          // Indicative monitoring buffer radius: High = 2500m, Medium = 1000m, Low = 400m
          const bufferRadius = riskLevel === 'HIGH' ? 2500 : riskLevel === 'MEDIUM' ? 1000 : 400;
          const strokeColor = riskLevel === 'HIGH' ? '#ef4444' : riskLevel === 'MEDIUM' ? '#f59e0b' : '#06b6d4';

          return (
            <React.Fragment key={h.hotspotId || `${lat}-${lon}`}>
              {/* Perimeter buffer */}
              <Circle
                center={[lat, lon]}
                radius={bufferRadius}
                pathOptions={{
                  color: strokeColor,
                  fillColor: strokeColor,
                  fillOpacity: isSelected ? 0.22 : 0.1,
                  weight: isSelected ? 2 : 1.2,
                  dashArray: h.persistence?.status === 'Persistent' ? '5, 5' : null,
                }}
              />

              {/* Hotspot marker */}
              <Marker
                position={[lat, lon]}
                icon={createHotspotIcon(riskLevel, h.thermalIntensity || 25)}
                eventHandlers={{
                  click: () => onSelectHotspot(h),
                }}
              >
                <Popup className="dark-popup">
                  <div style={{ minWidth: '220px', fontFamily: 'var(--font-sans)', color: '#f9fafb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', color: '#60a5fa' }}>
                        {h.hotspotId}
                      </span>
                      <span className={`badge badge-${riskLevel.toLowerCase()}`}>
                        {riskLevel} RISK
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      {h.classification || h.targetClassification || 'Other Thermal Source'}
                    </div>

                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                      🏭 {h.nearbyIndustrialFacility || 'No facility nearby'} ({h.distanceToIndustrialFacility ?? 'N/A'} km)
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', fontSize: '0.72rem', marginBottom: '0.6rem' }}>
                      <div>
                        <span style={{ color: '#6b7280', display: 'block' }}>Risk Score</span>
                        <b style={{ color: strokeColor }}>{h.riskScore ?? 35} / 100</b>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280', display: 'block' }}>Confidence</span>
                        <b>{h.confidence ?? 80}%</b>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280', display: 'block' }}>Intensity (FRP)</span>
                        <b style={{ color: '#f87171' }}>{h.thermalIntensity ?? 25} MW</b>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280', display: 'block' }}>Persistence</span>
                        <b style={{ color: h.persistence?.status === 'Persistent' ? '#a78bfa' : '#67e8f9' }}>
                          {h.persistence?.status || 'Non-persistent'} ({h.persistence?.detectionCount ?? 1} hits, {h.persistence?.durationHours ?? 0}h)
                        </b>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectHotspot(h)}
                      style={{
                        width: '100%',
                        padding: '0.35rem 0.5rem',
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      🔍 View Intelligence Trace
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Map Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          zIndex: 800,
          background: 'rgba(17, 24, 39, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '0.6rem 0.85rem',
          fontSize: '0.72rem',
        }}
      >
        <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          Indicative Risk / Monitoring Buffer Legend
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="dot-indicator dot-high"></span>
            <span>HIGH Risk (70–100) &mdash; Buffer 2,500m</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="dot-indicator dot-med"></span>
            <span>MEDIUM Risk (40–69) &mdash; Buffer 1,000m</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="dot-indicator dot-low"></span>
            <span>LOW Risk (0–39) &mdash; Buffer 400m</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.3rem', color: 'var(--text-muted)' }}>
            <span>- - - Dashed Circle: Persistent Recurrence</span>
          </div>
        </div>
      </div>
    </div>
  );
}
