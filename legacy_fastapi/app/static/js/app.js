/**
 * SAT-THERM GIS Intelligence Platform
 * AI Industrial Fire Detection, Classification, Risk Zone Visualization & Persistent Monitoring
 * Smart India Hackathon (SIH) Pipeline
 */

// Application State
const state = {
  events: [],
  clusters: [],
  clusterMarkers: {},
  eventMarkers: {},
  stats: null,
  activeSeverity: "",
  activeStatus: "",
  minFrp: 0,
  selectedEventId: null,
};

// DOM Element References
const elements = {
  map: null,
  markersLayer: null,
  riskZonesLayer: null,
  clustersLayer: null,

  // Navigation Metrics
  metricTotalEvents: document.getElementById("metricTotalEvents"),
  metricActiveFires: document.getElementById("metricActiveFires"),
  metricCriticalFires: document.getElementById("metricCriticalFires"),
  metricResolvedFires: document.getElementById("metricResolvedFires"),
  metricHighRisk: document.getElementById("metricHighRisk"),

  // Classification & Severity Filters
  activeSeverityLabel: document.getElementById("activeSeverityLabel"),
  severityChips: document.querySelectorAll("#severityFilters .category-chip"),
  countAll: document.getElementById("countAll"),
  countCritical: document.getElementById("countCritical"),
  countMedium: document.getElementById("countMedium"),
  countLow: document.getElementById("countLow"),
  countResolved: document.getElementById("countResolved"),

  // Status Tabs
  statusTabs: document.querySelectorAll("#statusBar .status-tab"),

  // FRP Slider
  frpSlider: document.getElementById("frpSlider"),
  frpValDisplay: document.getElementById("frpValDisplay"),

  // Map Controls & Toggles
  basemapSelect: document.getElementById("basemapSelect"),
  toggleHotspots: document.getElementById("toggleHotspots"),
  toggleRiskZones: document.getElementById("toggleRiskZones"),
  toggleClusters: document.getElementById("toggleClusters"),

  // Feeds and Lists
  recentIncidentsFeed: document.getElementById("recentIncidentsFeed"),
  clusterList: document.getElementById("clusterList"),
  clusterTotalLabel: document.getElementById("clusterTotalLabel"),

  // Context Flyout Drawer
  contextDrawer: document.getElementById("contextDrawer"),
  btnCloseDrawer: document.getElementById("btnCloseDrawer"),
  drawerSubtitle: document.getElementById("drawerSubtitle"),
  drawerTitle: document.getElementById("drawerTitle"),
  incidentStatusBanner: document.getElementById("incidentStatusBanner"),
  detStatusBadge: document.getElementById("detStatusBadge"),
  detSeverityBadge: document.getElementById("detSeverityBadge"),
  btnResolveIncident: document.getElementById("btnResolveIncident"),

  // Drawer Detail Fields
  detFireId: document.getElementById("detFireId"),
  detCoords: document.getElementById("detCoords"),
  detSatellite: document.getElementById("detSatellite"),
  detDateTime: document.getElementById("detDateTime"),
  detDuration: document.getElementById("detDuration"),
  detFrp: document.getElementById("detFrp"),
  detBrightTemp: document.getElementById("detBrightTemp"),
  detConfidence: document.getElementById("detConfidence"),
  detRiskZoneRadius: document.getElementById("detRiskZoneRadius"),
  detFacilityName: document.getElementById("detFacilityName"),
  detFacilityDistance: document.getElementById("detFacilityDistance"),
  detFacilityType: document.getElementById("detFacilityType"),
  detLandBiome: document.getElementById("detLandBiome"),
  detCanopyCover: document.getElementById("detCanopyCover"),

  // AI Classification Score Bars
  scoreFlareVal: document.getElementById("scoreFlareVal"),
  scoreIndVal: document.getElementById("scoreIndVal"),
  scoreAgriVal: document.getElementById("scoreAgriVal"),
  scoreWildfireVal: document.getElementById("scoreWildfireVal"),
  barFlare: document.getElementById("barFlare"),
  barIndustrial: document.getElementById("barIndustrial"),
  barAgri: document.getElementById("barAgri"),
  barWildfire: document.getElementById("barWildfire"),
  btnToggleVector: document.getElementById("btnToggleVector"),
  jsonVector: document.getElementById("jsonVector"),

  // Top Actions
  btnSimulateFire: document.getElementById("btnSimulateFire"),
  btnExportGeoJson: document.getElementById("btnExportGeoJson"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnSeedMock: document.getElementById("btnSeedMock"),
  btnClearDb: document.getElementById("btnClearDb"),
  toastContainer: document.getElementById("toastContainer"),
};

// Toast Notification Utility
function showToast(message, type = "info") {
  if (!elements.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Basemaps Definition
let basemaps = {};
let currentBasemap = null;

// Initialize Leaflet Map
function initMap() {
  elements.map = L.map("map", {
    center: [22.5, 80.0], // Centered over India
    zoom: 5,
    zoomControl: true,
  });

  basemaps = {
    dark: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ | NASA FIRMS & OSM',
      maxZoom: 16,
    }),
    satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: '&copy; Esri &mdash; Earthstar Geographics | NASA FIRMS & OSM',
      maxZoom: 19,
    }),
    streets: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> & OpenStreetMap',
      subdomains: "abcd",
      maxZoom: 19,
    }),
  };

  currentBasemap = basemaps.dark;
  currentBasemap.addTo(elements.map);

  // Layers order: Clusters -> Risk Zones -> Hotspot Markers
  elements.clustersLayer = L.layerGroup().addTo(elements.map);
  elements.riskZonesLayer = L.layerGroup().addTo(elements.map);
  elements.markersLayer = L.layerGroup().addTo(elements.map);
}

// Severity Marker Class Helper
function getSeverityClass(severity) {
  if (!severity) return "marker-critical";
  const s = severity.toLowerCase();
  if (s.includes("critical") || s.includes("high")) return "marker-critical";
  if (s.includes("medium")) return "marker-medium";
  if (s.includes("low")) return "marker-low";
  if (s.includes("no fire") || s.includes("resolved") || s.includes("safe")) return "marker-resolved";
  return "marker-critical";
}

// Severity Label Formatter Helper
function formatSeverity(severity) {
  if (!severity) return "Critical Fire";
  const trimmed = severity.trim();
  return trimmed.toLowerCase().endsWith("fire") ? trimmed : `${trimmed} Fire`;
}

// Risk Zone Styling Helper
function getRiskZoneColor(severity) {
  const s = (severity || "").toLowerCase();
  if (s.includes("critical") || s.includes("high")) {
    return { stroke: "#ef4444", fill: "#ef4444", opacity: 0.16 };
  }
  if (s.includes("medium")) {
    return { stroke: "#f59e0b", fill: "#f59e0b", opacity: 0.14 };
  }
  if (s.includes("low")) {
    return { stroke: "#06b6d4", fill: "#06b6d4", opacity: 0.12 };
  }
  return { stroke: "#10b981", fill: "#10b981", opacity: 0.08 };
}

// Render Indicative Risk / Monitoring Buffer Zones onto Map
function renderRiskZones(events) {
  elements.riskZonesLayer.clearLayers();

  if (elements.toggleRiskZones && !elements.toggleRiskZones.checked) {
    return;
  }

  events.forEach((evt) => {
    const radius = evt.risk_zone_radius_m || (
      (evt.severity && evt.severity.includes("Critical")) ? 2500 :
      (evt.severity && evt.severity.includes("Medium")) ? 800 :
      (evt.severity && evt.severity.includes("Low")) ? 350 : 100
    );

    const style = getRiskZoneColor(evt.severity);
    const circle = L.circle([evt.latitude, evt.longitude], {
      radius: radius,
      color: style.stroke,
      fillColor: style.fill,
      fillOpacity: style.opacity,
      weight: 1.5,
      dashArray: evt.status === "Persistent" ? "5, 5" : null,
      interactive: false, // ensures direct clicks pass through to marker
    });

    elements.riskZonesLayer.addLayer(circle);
  });
}

// Render Thermal Fire Markers with Detailed Popups
function renderMarkers() {
  elements.markersLayer.clearLayers();
  state.eventMarkers = {};

  if (elements.toggleHotspots && !elements.toggleHotspots.checked) {
    elements.riskZonesLayer.clearLayers();
    return;
  }

  // Filter events by Severity, Status, and FRP
  const filteredEvents = state.events.filter((evt) => {
    // Severity Filter
    if (state.activeSeverity) {
      const sev = (evt.severity || "").toLowerCase();
      const sel = state.activeSeverity.toLowerCase();
      if (sel.includes("critical") && !sev.includes("critical") && !sev.includes("high")) return false;
      if (sel.includes("medium") && !sev.includes("medium")) return false;
      if (sel.includes("low") && !sev.includes("low")) return false;
      if ((sel.includes("no fire") || sel.includes("resolved")) && !sev.includes("resolved") && !sev.includes("no active source") && !sev.includes("safe") && !sev.includes("no fire")) return false;
    }

    // Status Filter
    if (state.activeStatus) {
      const stat = (evt.status || "Active").toLowerCase();
      const selStat = state.activeStatus.toLowerCase();
      if (stat !== selStat) return false;
    }

    // Min FRP Filter
    if (evt.frp < state.minFrp) {
      return false;
    }

    return true;
  });

  // Render Risk Zones for current filtered view
  renderRiskZones(filteredEvents);

  // Render Fire Incident Markers
  filteredEvents.forEach((evt) => {
    const severity = evt.severity || "Critical";
    const markerClass = getSeverityClass(severity);

    // Scale marker core with FRP
    const coreSize = Math.min(22, Math.max(10, Math.round(Math.sqrt(evt.frp) * 2.2)));
    const haloSize = coreSize * 2.4;

    const icon = L.divIcon({
      className: `marker-pulsing-icon ${markerClass}`,
      iconSize: [haloSize, haloSize],
      iconAnchor: [haloSize / 2, haloSize / 2],
      html: `
        <div class="marker-halo" style="width: ${haloSize}px; height: ${haloSize}px;"></div>
        <div class="marker-core" style="width: ${coreSize}px; height: ${coreSize}px;"></div>
      `,
    });

    const marker = L.marker([evt.latitude, evt.longitude], { icon: icon });
    state.eventMarkers[evt.id] = marker;

    // Attributes for Detection Information Popup
    const fireId = evt.fire_id || `FIRE-${evt.id.slice(0, 8).toUpperCase()}`;
    const locationName = evt.location_name || (evt.facility_context && evt.facility_context.nearest_facility_name) || "Industrial Perimeter Site";
    const coordsText = `${Number(evt.latitude).toFixed(4)}° N, ${Number(evt.longitude).toFixed(4)}° E`;
    const confPct = Math.round((evt.confidence_normalized || 0.8) * 100);
    const dateTime = `${evt.acq_date || ""} ${evt.acq_time || ""}`.trim() || "Real-Time Telemetry";
    const status = evt.status || "Active";
    const duration = evt.duration_text || "1h 45m";
    const riskRadius = evt.risk_zone_radius_m ? `${evt.risk_zone_radius_m.toLocaleString()} m` : "2,500 m";

    let badgeClass = "pill-critical";
    if (severity.includes("Medium")) badgeClass = "pill-medium";
    else if (severity.includes("Low")) badgeClass = "pill-low";
    else if (severity.includes("No Fire") || severity.includes("Resolved") || severity.includes("No active source")) badgeClass = "pill-resolved";

    // Structured Detection Information Popup Card
    const popupHtml = `
      <div class="fire-popup-card">
        <div class="fire-popup-header">
          <span class="fire-popup-id">${fireId}</span>
          <span class="fire-popup-badge ${badgeClass}">${formatSeverity(severity)}</span>
        </div>
        <div class="fire-popup-location">🏭 ${locationName}</div>
        <div class="fire-popup-grid">
          <div class="fire-popup-field">
            <span class="fire-popup-label">Hotspot Detection Coordinates</span>
            <span class="fire-popup-value mono">${coordsText}</span>
          </div>
          <div class="fire-popup-field">
            <span class="fire-popup-label">AI Confidence</span>
            <span class="fire-popup-value" style="color: #34d399;">${confPct}%</span>
          </div>
          <div class="fire-popup-field">
            <span class="fire-popup-label">Date & Time</span>
            <span class="fire-popup-value mono">${dateTime}</span>
          </div>
          <div class="fire-popup-field">
            <span class="fire-popup-label">Current Status</span>
            <span class="fire-popup-value" style="color: ${status === 'Resolved' ? '#10b981' : (status === 'Persistent' ? '#f59e0b' : '#f87171')}; font-weight: 700;">${status}</span>
          </div>
          <div class="fire-popup-field">
            <span class="fire-popup-label">Detection History / Persistence</span>
            <span class="fire-popup-value" style="color: #67e8f9;">${duration}</span>
          </div>
          <div class="fire-popup-field">
            <span class="fire-popup-label">Indicative Monitoring Buffer</span>
            <span class="fire-popup-value" style="color: #fbbf24;">${riskRadius}</span>
          </div>
        </div>
        <div class="fire-popup-actions">
          <button class="fire-popup-btn primary" onclick="openContextDrawer('${evt.id}')">
            🔍 Full Trace
          </button>
          ${status !== 'Resolved' ? `
            <button class="fire-popup-btn resolve" onclick="resolveIncident('${evt.id}')">
              ✅ Mark Resolved
            </button>
          ` : ''}
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);

    // Quick Tooltip on Hover
    marker.bindTooltip(`
      <div style="font-family: var(--font-sans); font-size: 0.72rem;">
        <strong>${fireId}</strong>: ${severity} Fire<br/>
        FRP: <b>${evt.frp} MW</b> | Conf: <b>${confPct}%</b><br/>
        <span style="color: #94a3b8;">${locationName}</span>
      </div>
    `, { direction: "top", offset: [0, -10] });

    elements.markersLayer.addLayer(marker);
  });
}

// Center and Focus on Persistent Cluster
window.focusCluster = function(lat, lon) {
  elements.map.flyTo([lat, lon], 14, { duration: 1.5 });
  if (state.events && state.events.length > 0) {
    let nearest = null;
    let minDist = Infinity;
    state.events.forEach((evt) => {
      const d = Math.hypot(evt.latitude - lat, evt.longitude - lon);
      if (d < minDist) {
        minDist = d;
        nearest = evt;
      }
    });
    if (nearest && minDist < 0.15) {
      setTimeout(() => openContextDrawer(nearest.id), 700);
    }
  }
};

// Render Persistent Hotspot Clusters onto Map
function renderClusters() {
  elements.clustersLayer.clearLayers();
  state.clusterMarkers = {};

  if (elements.toggleClusters && !elements.toggleClusters.checked) {
    return;
  }

  state.clusters.forEach((cluster) => {
    const lat = cluster.centroid_lat;
    const lon = cluster.centroid_lon;
    const radius = cluster.radius_meters || 1500;
    const displayName = cluster.site_name || `Cluster ${cluster.group_code.slice(0, 8)}`;
    const scorePct = Math.round(cluster.persistence_score * 100);

    // Boundary circle indicating cluster catchment radius
    const circle = L.circle([lat, lon], {
      radius: radius,
      color: "#f59e0b",
      fillColor: "#f59e0b",
      fillOpacity: 0.12,
      weight: 1.5,
      dashArray: "4, 4",
      interactive: false,
    });

    // Radar marker badge
    const radarIcon = L.divIcon({
      className: "cluster-marker-wrap",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: `
        <div class="cluster-radar-pulse"></div>
        <div class="cluster-radar-badge" title="${displayName}">
          🏭 ${cluster.detection_count}
        </div>
      `,
    });

    const marker = L.marker([lat, lon], { icon: radarIcon });
    state.clusterMarkers[cluster.group_code] = marker;

    const popupHtml = `
      <div class="cluster-popup">
        <div class="cluster-popup-title">${displayName}</div>
        <div class="cluster-popup-meta">
          <div>Persistence: <b style="color: #fbbf24;">${scorePct}%</b></div>
          <div>Detections: <b>${cluster.detection_count}</b> (${cluster.active_days} active days)</div>
          <div>Dominant: <b>${cluster.dominant_category || "Industrial"}</b></div>
          <div>Active Period: <b>${cluster.first_seen}</b> to <b>${cluster.last_seen}</b></div>
        </div>
        <button class="cluster-popup-btn" onclick="focusCluster(${lat}, ${lon})">
          🎯 Zoom In & Focus
        </button>
      </div>
    `;
    marker.bindPopup(popupHtml);

    elements.clustersLayer.addLayer(circle);
    elements.clustersLayer.addLayer(marker);
  });
}

// Fetch and Render Multi-Layer Context in Flyout Drawer
window.openContextDrawer = async function(eventId) {
  state.selectedEventId = eventId;
  elements.contextDrawer.classList.add("open");

  try {
    const res = await fetch(`/api/v1/events/${eventId}/context`);
    if (!res.ok) throw new Error("Failed to load event context");
    const data = await res.json();

    const severity = data.severity || "Critical";
    const status = data.status || "Active";
    const fireId = data.fire_id || `FIRE-${eventId.slice(0, 8).toUpperCase()}`;

    // Header & Titles
    elements.drawerSubtitle.textContent = `AI INDUSTRIAL FIRE INCIDENT`;
    elements.drawerTitle.textContent = `${fireId} — ${formatSeverity(severity)}`;

    // Status Banner in Drawer
    if (elements.detStatusBadge) {
      elements.detStatusBadge.textContent = status;
      elements.detStatusBadge.className = `status-badge status-${status.toLowerCase()}`;
    }
    if (elements.detSeverityBadge) {
      elements.detSeverityBadge.textContent = formatSeverity(severity);
      let sevClass = "severity-critical";
      if (severity.includes("Medium")) sevClass = "severity-medium";
      else if (severity.includes("Low")) sevClass = "severity-low";
      else if (severity.includes("No Fire") || severity.includes("Resolved") || severity.includes("No active source")) sevClass = "severity-resolved";
      elements.detSeverityBadge.className = `severity-badge ${sevClass}`;
    }

    // Resolve Button in Drawer
    if (elements.btnResolveIncident) {
      if (status === "Resolved") {
        elements.btnResolveIncident.textContent = "✅ Incident Resolved";
        elements.btnResolveIncident.disabled = true;
        elements.btnResolveIncident.style.opacity = "0.6";
        elements.btnResolveIncident.style.cursor = "default";
      } else {
        elements.btnResolveIncident.textContent = "✅ Mark Resolved / Safe";
        elements.btnResolveIncident.disabled = false;
        elements.btnResolveIncident.style.opacity = "1";
        elements.btnResolveIncident.style.cursor = "pointer";
        elements.btnResolveIncident.onclick = () => resolveIncident(eventId);
      }
    }

    // Telemetry Fields
    if (elements.detFireId) elements.detFireId.textContent = fireId;
    elements.detCoords.textContent = `${data.telemetry.latitude.toFixed(4)}° N, ${data.telemetry.longitude.toFixed(4)}° E`;
    elements.detSatellite.textContent = `${data.telemetry.satellite} (${data.telemetry.instrument})`;
    elements.detDateTime.textContent = `${data.telemetry.acq_date} ${data.telemetry.acq_time}`;
    if (elements.detDuration) elements.detDuration.textContent = data.duration_text || "1h 45m";
    elements.detFrp.textContent = `${data.telemetry.frp} MW`;
    elements.detBrightTemp.textContent = `${data.telemetry.brightness_temperature} K`;
    elements.detConfidence.textContent = `${Math.round(data.telemetry.confidence_normalized * 100)}%`;

    // Risk Zone Radius
    const rRadius = data.risk_zone_radius_m || (
      (severity && severity.includes("Critical")) ? 2500 :
      (severity && severity.includes("Medium")) ? 800 :
      (severity && severity.includes("Low")) ? 350 : 100
    );
    if (elements.detRiskZoneRadius) {
      elements.detRiskZoneRadius.textContent = `${rRadius.toLocaleString()} meters (${(rRadius / 1000).toFixed(1)} km Perimeter)`;
    }

    // OSM Facility Proximity
    const fac = data.facility_context || {};
    elements.detFacilityName.textContent = fac.nearest_facility_name || "No nearby facility within 3km";
    elements.detFacilityDistance.textContent = fac.distance_meters != null ? `${Math.round(fac.distance_meters)} m` : "N/A";
    elements.detFacilityType.textContent = (fac.nearest_facility_type || "None").toUpperCase();

    // Land Cover Biome
    const land = data.land_cover_context || {};
    elements.detLandBiome.textContent = (land.land_use_type || "Unknown").replace(/_/g, " ").toUpperCase();
    elements.detCanopyCover.textContent = (land.vegetation_context || "mixed").replace(/_/g, " ").toUpperCase();

    // Classification Score Bars
    const clsObj = data.classification || {};
    const scores = clsObj.scores || data.classification_scores || {};

    const flarePct = Math.round((scores.flare_score || 0) * 100);
    const indPct = Math.round((scores.industrial_score || 0) * 100);
    const agriPct = Math.round((scores.agriculture_score || 0) * 100);
    const wildPct = Math.round((scores.wildfire_score || 0) * 100);

    elements.scoreFlareVal.textContent = `${flarePct}%`;
    elements.barFlare.style.width = `${flarePct}%`;

    elements.scoreIndVal.textContent = `${indPct}%`;
    elements.barIndustrial.style.width = `${indPct}%`;

    elements.scoreAgriVal.textContent = `${agriPct}%`;
    elements.barAgri.style.width = `${agriPct}%`;

    elements.scoreWildfireVal.textContent = `${wildPct}%`;
    elements.barWildfire.style.width = `${wildPct}%`;

    // ML Feature Vector
    elements.jsonVector.textContent = JSON.stringify(data.ml_feature_vector || data.ml_features || {}, null, 2);
  } catch (err) {
    console.error("Error fetching context:", err);
    showToast("Error fetching event context", "error");
  }
};

// Resolve Incident / Mark Safe Function
window.resolveIncident = async function(eventId) {
  try {
    showToast(`Marking incident ${eventId.slice(0, 8)} as Resolved / No active source...`, "info");
    const res = await fetch(`/api/v1/events/${eventId}/resolve`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to mark incident resolved");
    const updated = await res.json();
    showToast(`Incident ${updated.fire_id || eventId.slice(0, 8)} marked Resolved / No active source!`);

    await refreshAll();

    if (state.selectedEventId === eventId) {
      await openContextDrawer(eventId);
    }
  } catch (err) {
    console.error("Resolve incident error:", err);
    showToast("Failed to resolve incident", "error");
  }
};

// Simulate Incoming Satellite Thermal Anomaly Detection in Real Time
async function simulateDetection() {
  try {
    showToast("Triggering satellite thermal anomaly detection simulation (NASA FIRMS VIIRS)...", "info");
    const res = await fetch("/api/v1/events/simulate-detection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Simulation endpoint failed");
    const newEvent = await res.json();
    const lat = newEvent.latitude ?? (newEvent.coordinates ? newEvent.coordinates[0] : null);
    const lon = newEvent.longitude ?? (newEvent.coordinates ? newEvent.coordinates[1] : null);
    const eventId = newEvent.id || newEvent.event_id;
    const locName = newEvent.location_name || newEvent.location || "Industrial Complex";
    showToast(`🛰️ NEW SATELLITE DETECTION: ${newEvent.fire_id} (${formatSeverity(newEvent.severity)}) at ${locName}!`);

    // Refresh telemetry and markers
    await refreshAll();

    // Fly to new incident and open drawer
    if (lat != null && lon != null) {
      elements.map.flyTo([lat, lon], 12, { duration: 1.5 });
    }
    if (eventId) {
      setTimeout(() => {
        openContextDrawer(eventId);
      }, 800);
    }
  } catch (err) {
    console.error("Simulate error:", err);
    showToast("Failed to simulate fire detection", "error");
  }
}

// Render Recent Fire Incidents Feed
function renderRecentIncidents(incidents) {
  if (!elements.recentIncidentsFeed) return;

  if (!incidents || incidents.length === 0) {
    incidents = (state.events || []).slice(0, 8);
  }

  if (!incidents || incidents.length === 0) {
    elements.recentIncidentsFeed.innerHTML = `
      <div style="font-size: 0.72rem; color: var(--text-muted); text-align: center; padding: 0.75rem;">
        No thermal anomaly detections found.
      </div>
    `;
    return;
  }

  elements.recentIncidentsFeed.innerHTML = "";
  incidents.forEach((inc) => {
    const card = document.createElement("div");
    const severity = inc.severity || "Critical";
    let sevClass = "incident-critical";
    let pillClass = "pill-critical";
    if (severity.includes("Medium")) { sevClass = "incident-medium"; pillClass = "pill-medium"; }
    else if (severity.includes("Low")) { sevClass = "incident-low"; pillClass = "pill-low"; }
    else if (severity.includes("No Fire") || severity.includes("Resolved") || severity.includes("No active source")) { sevClass = "incident-resolved"; pillClass = "pill-resolved"; }

    card.className = `incident-card ${sevClass}`;
    const fireId = inc.fire_id || `FIRE-${(inc.id || "").slice(0, 8)}`;
    const loc = inc.location_name || "Industrial Facility Site";
    const frp = inc.frp != null ? `${inc.frp} MW` : "";
    const timeStr = `${inc.acq_date || ""} ${inc.acq_time || ""}`.trim() || inc.status || "Active";

    card.innerHTML = `
      <div class="incident-card-top">
        <span class="incident-id-text">${fireId}</span>
        <span class="incident-pill ${pillClass}">${severity}</span>
      </div>
      <div class="incident-card-loc" title="${loc}">📍 ${loc}</div>
      <div class="incident-card-bottom">
        <span>🕒 ${timeStr}</span>
        <span style="color: #ef4444; font-weight: 600;">${frp}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      const lat = inc.latitude ?? (inc.coordinates ? inc.coordinates[0] : null);
      const lon = inc.longitude ?? (inc.coordinates ? inc.coordinates[1] : null);
      const incId = inc.id || inc.event_id;
      if (lat != null && lon != null) {
        elements.map.flyTo([lat, lon], 13, { duration: 1.2 });
      }
      setTimeout(() => {
        if (incId && state.eventMarkers && state.eventMarkers[incId]) {
          state.eventMarkers[incId].openPopup();
        } else if (incId) {
          openContextDrawer(incId);
        }
      }, 700);
    });

    elements.recentIncidentsFeed.appendChild(card);
  });
}

// Load Persistent Hotspot Clusters
async function loadClusters() {
  try {
    const res = await fetch("/api/v1/clusters?limit=50");
    if (!res.ok) throw new Error("Failed to load clusters");
    state.clusters = await res.json();

    if (elements.clusterTotalLabel) {
      elements.clusterTotalLabel.textContent = `${state.clusters.length} sites`;
    }
    elements.clusterList.innerHTML = "";

    if (state.clusters.length === 0) {
      elements.clusterList.innerHTML = `
        <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 1rem;">
          No recurring persistent sites recorded.
        </div>
      `;
      renderClusters();
      return;
    }

    state.clusters.forEach((cluster) => {
      const item = document.createElement("div");
      item.className = "cluster-item";

      const scoreClass = cluster.persistence_score >= 0.6 ? "score-high" : "score-med";
      const displayName = cluster.site_name || `Cluster ${cluster.group_code.slice(0, 8)}`;

      item.innerHTML = `
        <div class="cluster-header">
          <span class="cluster-name" title="${displayName}">${displayName}</span>
          <span class="cluster-score ${scoreClass}">${Math.round(cluster.persistence_score * 100)}% Persist</span>
        </div>
        <div class="cluster-details">
          <span>${cluster.detection_count} detections</span>
          <span>${cluster.dominant_category || "Mixed"}</span>
        </div>
      `;

      item.addEventListener("click", () => {
        elements.map.flyTo([cluster.centroid_lat, cluster.centroid_lon], 13, {
          duration: 1.5,
        });
        showToast(`Centered on ${displayName}`);
        if (state.clusterMarkers && state.clusterMarkers[cluster.group_code]) {
          setTimeout(() => {
            state.clusterMarkers[cluster.group_code].openPopup();
          }, 600);
        }
      });

      elements.clusterList.appendChild(item);
    });

    renderClusters();
  } catch (err) {
    console.error("Error loading clusters:", err);
  }
}

// Load Aggregate Telemetry Statistics
async function loadStatistics() {
  try {
    const res = await fetch("/api/v1/statistics");
    if (!res.ok) throw new Error("Failed to fetch statistics");
    state.stats = await res.json();

    if (elements.metricTotalEvents) {
      elements.metricTotalEvents.textContent = state.stats.total_fires ?? state.stats.total_events ?? 0;
    }
    if (elements.metricActiveFires) {
      elements.metricActiveFires.textContent = state.stats.active_fires ?? 0;
    }
    if (elements.metricCriticalFires) {
      elements.metricCriticalFires.textContent = state.stats.critical_fires ?? 0;
    }
    if (elements.metricResolvedFires) {
      elements.metricResolvedFires.textContent = state.stats.resolved_incidents ?? 0;
    }
    if (elements.metricHighRisk) {
      elements.metricHighRisk.textContent = `${state.stats.high_risk_locations ?? state.stats.total_persistent_clusters ?? 0} sites`;
    }

    // Severity Breakdown Counters
    let countCritical = 0;
    let countMedium = 0;
    let countLow = 0;
    let countResolved = 0;

    state.events.forEach((e) => {
      const s = (e.severity || "").toLowerCase();
      if (s.includes("critical") || s.includes("high")) countCritical++;
      else if (s.includes("medium")) countMedium++;
      else if (s.includes("low")) countLow++;
      else if (s.includes("no fire") || s.includes("resolved") || s.includes("no active source") || s.includes("safe")) countResolved++;
    });

    if (elements.countAll) elements.countAll.textContent = state.events.length;
    if (elements.countCritical) elements.countCritical.textContent = countCritical;
    if (elements.countMedium) elements.countMedium.textContent = countMedium;
    if (elements.countLow) elements.countLow.textContent = countLow;
    if (elements.countResolved) elements.countResolved.textContent = countResolved;

    renderRecentIncidents(state.stats.recent_incidents || []);
  } catch (err) {
    console.error("Error loading statistics:", err);
  }
}

// Fetch Thermal Events from Backend
async function loadEvents() {
  try {
    const res = await fetch("/api/v1/events?limit=500");
    if (!res.ok) throw new Error("Failed to fetch events");
    const data = await res.json();
    state.events = Array.isArray(data) ? data : (data.events || []);
    renderMarkers();
  } catch (err) {
    console.error("Error fetching events:", err);
    showToast("Error fetching thermal events", "error");
  }
}

// Export GeoJSON FeatureCollection
async function exportGeoJSON() {
  try {
    showToast("Generating GeoJSON dataset...", "info");
    const res = await fetch("/api/v1/events?format=geojson&limit=1000");
    if (!res.ok) throw new Error("GeoJSON generation failed");
    const data = await res.json();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sat_therm_hotspots_${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${data.features ? data.features.length : 0} hotspot detection coordinates as GeoJSON!`);
  } catch (err) {
    console.error("Export GeoJSON error:", err);
    showToast("Failed to export GeoJSON", "error");
  }
}

// Export Filtered Events as CSV
function exportCSV() {
  try {
    if (!state.events || state.events.length === 0) {
      showToast("No events available to export", "error");
      return;
    }

    const headers = [
      "fire_id",
      "event_id",
      "latitude",
      "longitude",
      "severity",
      "status",
      "duration_text",
      "risk_zone_radius_m",
      "frp_mw",
      "confidence_normalized",
      "location_name",
      "acq_date",
      "acq_time",
      "satellite",
    ];

    const rows = state.events.map((e) => {
      return [
        `"${e.fire_id || ''}"`,
        `"${e.id}"`,
        e.latitude,
        e.longitude,
        `"${e.severity || ''}"`,
        `"${e.status || ''}"`,
        `"${e.duration_text || ''}"`,
        e.risk_zone_radius_m || 2500,
        e.frp,
        e.confidence_normalized,
        `"${(e.location_name || '').replace(/"/g, '""')}"`,
        `"${e.acq_date || ''}"`,
        `"${e.acq_time || ''}"`,
        `"${e.satellite || ''}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sat_therm_observations_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${state.events.length} thermal observations as CSV!`);
  } catch (err) {
    console.error("Export CSV error:", err);
    showToast("Failed to export CSV", "error");
  }
}

// Refresh Full Dashboard Data
async function refreshAll() {
  await loadEvents();
  await Promise.all([loadStatistics(), loadClusters()]);
}

// Event Listeners Setup
function setupEventListeners() {
  // Severity Filter Chips
  elements.severityChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      elements.severityChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.activeSeverity = chip.dataset.severity;
      if (elements.activeSeverityLabel) {
        elements.activeSeverityLabel.textContent = state.activeSeverity || "All";
      }
      renderMarkers();
    });
  });

  // Status Tabs (All, Active, Persistent, Resolved)
  elements.statusTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      elements.statusTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.activeStatus = tab.dataset.status;
      renderMarkers();
    });
  });

  // FRP Range Slider
  elements.frpSlider.addEventListener("input", (e) => {
    state.minFrp = parseFloat(e.target.value);
    elements.frpValDisplay.textContent = `${state.minFrp} MW`;
    renderMarkers();
  });

  // Basemap Switcher
  if (elements.basemapSelect) {
    elements.basemapSelect.addEventListener("change", (e) => {
      const key = e.target.value;
      if (basemaps[key]) {
        elements.map.removeLayer(currentBasemap);
        currentBasemap = basemaps[key];
        currentBasemap.addTo(elements.map);
        currentBasemap.bringToBack();
        showToast(`Basemap: ${e.target.options[e.target.selectedIndex].text}`);
      }
    });
  }

  // Layer Toggles
  if (elements.toggleHotspots) {
    elements.toggleHotspots.addEventListener("change", () => {
      renderMarkers();
    });
  }
  if (elements.toggleRiskZones) {
    elements.toggleRiskZones.addEventListener("change", () => {
      renderMarkers();
    });
  }
  if (elements.toggleClusters) {
    elements.toggleClusters.addEventListener("change", () => {
      renderClusters();
    });
  }

  // Simulation Button
  if (elements.btnSimulateFire) {
    elements.btnSimulateFire.addEventListener("click", simulateDetection);
  }

  // Export Buttons
  if (elements.btnExportGeoJson) {
    elements.btnExportGeoJson.addEventListener("click", exportGeoJSON);
  }
  if (elements.btnExportCsv) {
    elements.btnExportCsv.addEventListener("click", exportCSV);
  }

  // Drawer Close Button
  elements.btnCloseDrawer.addEventListener("click", () => {
    elements.contextDrawer.classList.remove("open");
  });

  // Toggle Feature Vector JSON
  elements.btnToggleVector.addEventListener("click", () => {
    const isShowing = elements.jsonVector.classList.toggle("show");
    elements.btnToggleVector.querySelector("span").textContent = isShowing
      ? "▼ Hide ML Feature Vector"
      : "▶ View ML Feature Vector";
  });

  // Manual Refresh Button
  elements.btnRefresh.addEventListener("click", async () => {
    await refreshAll();
    showToast("GIS Fire intelligence refreshed");
  });

  // Seed Mock Data Button
  elements.btnSeedMock.addEventListener("click", async () => {
    showToast("Processing mock FIRMS pipeline ingestion...", "info");
    try {
      const res = await fetch("/api/v1/ingest/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shift_dates_to_today: true, clear_existing: true }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Ingested ${data.events_enriched} events, formed ${data.clusters_formed} clusters!`);
        await refreshAll();
      } else {
        showToast(data.detail || "Ingestion failed", "error");
      }
    } catch (err) {
      showToast("Ingestion request error", "error");
    }
  });

  // Clear Database Button
  elements.btnClearDb.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to purge all fire events and clusters?")) return;
    try {
      const res = await fetch("/api/v1/ingest/clear", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        elements.contextDrawer.classList.remove("open");
        await refreshAll();
      }
    } catch (err) {
      showToast("Failed to clear database", "error");
    }
  });
}

// Bootstrap Application
document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  setupEventListeners();
  await refreshAll();

  // Real-Time Background Polling (Every 8 seconds)
  setInterval(async () => {
    try {
      await loadEvents();
      await loadStatistics();
    } catch (err) {
      console.warn("Real-time poll update skipped:", err);
    }
  }, 8000);
});
