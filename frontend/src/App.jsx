import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SidebarFilters from './components/SidebarFilters';
import MapView from './components/MapView';
import HotspotDetail from './components/HotspotDetail';
import AnalyzeModal from './components/AnalyzeModal';
import StatisticsPanel from './components/StatisticsPanel';
import HotspotTable from './components/HotspotTable';
import { fetchHotspots, fetchStatistics, fetchConfig } from './services/api';
import './styles/index.css';

export default function App() {
  const [hotspots, setHotspots] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [provider, setProvider] = useState({ mode: 'DEMO' });
  const [loading, setLoading] = useState(false);

  // Filters State
  const [filters, setFilters] = useState({
    riskLevel: '',
    classification: '',
    persistent: '',
    search: '',
  });

  // Active Hotspot Selection & Map Focus
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [focusCoords, setFocusCoords] = useState(null);
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('charts'); // 'charts' | 'table'

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hotspotsRes, statsRes, configRes] = await Promise.all([
        fetchHotspots(filters),
        fetchStatistics(),
        fetchConfig(),
      ]);

      setHotspots(hotspotsRes.data || []);
      setStatistics(statsRes);
      if (configRes.provider) {
        setProvider(configRes.provider);
      }
    } catch (err) {
      console.error('Error loading hotspot platform data:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Filter Change
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Handle Demo Scenario Click
  const handleSelectScenario = (scenario) => {
    if (scenario.coords) {
      setFocusCoords(scenario.coords);
    }
    // Find matching hotspot in list or apply filter
    if (scenario.filter) {
      setFilters((prev) => ({
        ...prev,
        ...scenario.filter,
      }));
    }
    const match = hotspots.find(
      (h) =>
        Math.abs(h.latitude - scenario.coords[0]) < 0.05 &&
        Math.abs(h.longitude - scenario.coords[1]) < 0.05
    );
    if (match) {
      setSelectedHotspot(match);
    }
  };

  // Handle Analysis Submit Success
  const handleAnalysisSuccess = (newHotspot) => {
    setHotspots((prev) => [newHotspot, ...prev]);
    setSelectedHotspot(newHotspot);
    setFocusCoords([newHotspot.latitude, newHotspot.longitude]);
    loadData();
  };

  return (
    <div className="app-container">
      {/* 1. Header Navigation */}
      <Header
        summary={statistics?.summary}
        provider={provider}
        onRefresh={loadData}
        onOpenAnalyze={() => setIsAnalyzeModalOpen(true)}
        loading={loading}
      />

      {/* 2. Main Workspace */}
      <div className="workspace">
        {/* Left Sidebar Filters */}
        <SidebarFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onSelectScenario={handleSelectScenario}
          summary={statistics?.summary}
        />

        {/* Center GIS Map */}
        <MapView
          hotspots={hotspots}
          selectedHotspot={selectedHotspot}
          onSelectHotspot={(h) => setSelectedHotspot(h)}
          focusCoords={focusCoords}
        />

        {/* Right Flyout Detail Drawer */}
        <HotspotDetail
          hotspot={selectedHotspot}
          onClose={() => setSelectedHotspot(null)}
        />
      </div>

      {/* 3. Bottom Panel (Charts & Data Table) */}
      <div className="bottom-panel">
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeBottomTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('charts')}
          >
            📊 Visual Intelligence Charts (Recharts)
          </button>
          <button
            className={`tab-btn ${activeBottomTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('table')}
          >
            📋 Observation Registry ({hotspots.length} Records)
          </button>
        </div>

        <div className="tab-content">
          {activeBottomTab === 'charts' ? (
            <StatisticsPanel statistics={statistics} />
          ) : (
            <HotspotTable
              hotspots={hotspots}
              onSelectHotspot={(h) => {
                setSelectedHotspot(h);
                setFocusCoords([h.latitude, h.longitude]);
              }}
              selectedHotspot={selectedHotspot}
            />
          )}
        </div>
      </div>

      {/* 4. Scientific Disclaimer Banner */}
      <footer className="disclaimer-banner">
        ⚠️ <b>Scientific & Prototype Disclaimer:</b> This prototype demonstrates an AI-assisted approach for classifying satellite thermal hotspots and estimating risk. Synthetic/demo data is used for development. Predictions and risk scores are not validated emergency-response determinations and should not be treated as operational fire certification.
      </footer>

      {/* 5. Real-Time Hotspot Analysis Studio Modal */}
      <AnalyzeModal
        isOpen={isAnalyzeModalOpen}
        onClose={() => setIsAnalyzeModalOpen(false)}
        onAnalysisSuccess={handleAnalysisSuccess}
      />
    </div>
  );
}
