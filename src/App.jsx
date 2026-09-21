import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LeftControlSidebar from './components/LeftControlSidebar';
import MapContainer from './components/MapContainer';
import BottomDashboard from './components/BottomDashboard';
import SimulationSetupSidebar from './components/SimulationSetupSidebar';
import ScenarioComparison from './components/ScenarioComparison';
import AnalyticsPanel from './components/AnalyticsPanel';
import BackendConfigModal from './components/BackendConfigModal';
import AuthScreen from './components/AuthScreen';

import { PILOT_ZONES } from './data/mockData';
import { runLocalSimulation } from './services/simulationEngine';
import { getBackendConfig, checkBackendHealth, runRemoteSimulation, getCurrentUser, logout } from './services/apiClient';

export default function App() {
  const [user, setUser] = useState(undefined);
  const [activeZone, setActiveZone] = useState(PILOT_ZONES[0]);
  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'simulate' | 'compare' | 'data' | 'reports'
  const [theme, setTheme] = useState('dark');
  const [viewMode, setViewMode] = useState('2D');

  const [layers, setLayers] = useState({
    satellite: false,
    buildings3D: true,
    roads: true,
    terrainElevation: true,
    drainageNetwork: false,
    floodRisk: false,
    trafficFlow: false,
  });

  const [intervention, setIntervention] = useState({
    type: 'building',
    materialId: 'concrete',
    floors: 10,
    footprintArea: 1200,
    rainfallRateMmHr: 85,
  });

  const [simResults, setSimResults] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [customAreaMode, setCustomAreaMode] = useState(false);

  // Backend Device REST Config
  const [backendConfig, setBackendConfig] = useState(getBackendConfig());
  const [backendOnline, setBackendOnline] = useState(false);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="min-h-screen bg-[#0b132b]" />;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;

  // Periodically check Flask backend health if enabled
  useEffect(() => {
    if (!backendConfig.isEnabled) {
      setBackendOnline(false);
      return;
    }

    let isMounted = true;
    const verifyHealth = async () => {
      const status = await checkBackendHealth(backendConfig.baseUrl);
      if (isMounted) setBackendOnline(status.online);
    };

    verifyHealth();
    const interval = setInterval(verifyHealth, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [backendConfig]);

  // Execute simulation (Spring Boot → Flask → Neon, or local fallback)
  const handleRunSimulation = async () => {
    setIsSimulating(true);

    // Try Spring Boot remote backend first
    if (backendConfig.isEnabled && backendOnline) {
      const remoteRes = await runRemoteSimulation({
        zoneId: activeZone.id,
        changeType: intervention.type === 'building'
          ? 'NEW_CONSTRUCTION'
          : intervention.type === 'road'
          ? 'ROAD_WIDENING'
          : 'DRAINAGE_IMPROVEMENT',
        rainfallMmHr: intervention.rainfallRateMmHr || 85,
        centerLat: activeZone.center[0],
        centerLng: activeZone.center[1],
        studyAreaKm2: activeZone.areaKm2,
        intervention: {
          footprintArea: intervention.footprintArea || 1200,
          floors: intervention.floors || 10,
          materialId: intervention.materialId || 'concrete',
        },
      });

      if (remoteRes.success && remoteRes.data) {
        const d = remoteRes.data;
        const fr = d.floodRisk || {};
        const tr = d.trafficRisk || {};
        const er = d.evacuationRoute || {};

        const mappedResults = {
          timestamp: new Date().toISOString(),
          zoneId: activeZone.id,
          zoneName: activeZone.name,
          simulationCode: d.simulationCode,
          dbSimulationId: d.dbSimulationId,
          isRemote: true,
          intervention,
          metrics: {
            estMaxWaterDepthM: fr.estMaxWaterDepthM || 0,
            affectedAreaKm2: fr.affectedAreaKm2 || 0,
            buildingsAtRiskCount: fr.buildingsAtRiskCount || 0,
            majorWaterloggingPointsCount: fr.majorWaterloggingPointsCount || 0,
            cutOffRoadCount: tr.cutoffRoadsCount || 0,
            totalEvacuationTimeMin: er.estimatedTimeMin || 0,
            riskScore: fr.riskScore || 0,
            riskLevel: fr.riskLevel || 'UNKNOWN',
            congestionMultiplier: tr.congestionMultiplier || 1.0,
            trafficImpactScore: tr.trafficImpactScore || 0,
          },
          floodRisk: fr,
          trafficRisk: tr,
          evacuationRoute: er,
          floodRiskPoints: generateFloodPoints(
            activeZone.center[0], activeZone.center[1], fr.riskScore || 50, fr.estMaxWaterDepthM || 1.0
          ),
          evacuationPath: er.routeGeometry || [],
          evacuationHub: { lat: activeZone.center[0] + 0.005, lng: activeZone.center[1] + 0.005, name: er.endPoint || 'Evacuation Hub' },
          roadStatus: (tr.affectedRoads || []).map(r => ({
            ...r,
            isCutOff: r.status === 'SUBMERGED',
            simulatedDepth: r.status === 'SUBMERGED' ? (fr.estMaxWaterDepthM || 1.0) : 0.2,
          })),
          disclaimer: d.disclaimer,
        };

        setSimResults(mappedResults);
        setIsSimulating(false);
        return;
      }
    }

    // Fallback: local simulation engine
    setTimeout(() => {
      const localResults = runLocalSimulation(activeZone, intervention);
      setSimResults(localResults);
      setIsSimulating(false);
    }, 500);
  };

  const handleCustomAreaChange = ({ areaKm2, center }) => {
    setActiveZone((previousZone) => ({
      ...previousZone,
      id: 'custom_draw',
      name: 'Custom Selected Area',
      areaKm2,
      center,
    }));
  };

  const generateFloodPoints = (centerLat, centerLng, riskScore, maxDepth) => {
    const points = [];
    const step = 0.002;
    for (let r = -4; r <= 4; r++) {
      for (let c = -4; c <= 4; c++) {
        const dist = Math.sqrt(r * r + c * c);
        const noise = Math.sin(r * 1.5) * Math.cos(c * 1.5);
        const scaledDepth = maxDepth * Math.max(0.05, (1 - (dist / 6)) + (noise * 0.3) + (riskScore / 200));
        const depth = Math.max(0.02, Number(scaledDepth.toFixed(2)));
        let riskCategory = 'safe', color = '#3b82f6';
        if (depth >= 2.0) { riskCategory = 'critical'; color = '#ef4444'; }
        else if (depth >= 1.0) { riskCategory = 'high'; color = '#f97316'; }
        else if (depth >= 0.5) { riskCategory = 'moderate'; color = '#eab308'; }
        else if (depth >= 0.1) { riskCategory = 'low'; color = '#06b6d4'; }
        points.push({ id: `fp_${r}_${c}`, lat: centerLat + r * step, lng: centerLng + c * step, depth, riskCategory, color, radius: Math.max(15, depth * 25) });
      }
    }
    return points;
  };


  useEffect(() => {
    const results = runLocalSimulation(activeZone, intervention);
    setSimResults(results);
  }, [activeZone]);

  return (
    <div className={`h-screen w-screen flex flex-col font-sans overflow-hidden ${theme === 'dark' ? 'bg-[#0b132b] text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Top Header Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        setTheme={setTheme}
        onOpenBackendModal={() => setIsBackendModalOpen(true)}
        backendConfig={backendConfig}
        backendOnline={backendOnline}
        user={user}
        onLogout={() => { logout(); setUser(null); }}
      />

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control Sidebar */}
        <LeftControlSidebar
          activeZone={activeZone}
          setActiveZone={setActiveZone}
          customAreaMode={customAreaMode}
          setCustomAreaMode={setCustomAreaMode}
          layers={layers}
          setLayers={setLayers}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        {/* Center Main View */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeTab === 'map' || activeTab === 'simulate' ? (
            <>
              {/* Map Canvas View (Top) */}
              <MapContainer
                activeZone={activeZone}
                simResults={simResults}
                layers={layers}
                customAreaMode={customAreaMode}
                onDrawnAreaChange={handleCustomAreaChange}
              />

              {/* Bottom Dashboard Grid (3 Cards) */}
              <BottomDashboard
                activeZone={activeZone}
                simResults={simResults}
              />
            </>
          ) : activeTab === 'compare' ? (
            <ScenarioComparison
              activeZone={activeZone}
              intervention={intervention}
            />
          ) : (
            <AnalyticsPanel
              activeZone={activeZone}
              simResults={simResults}
            />
          )}
        </main>

        {/* Right Simulation Setup Sidebar */}
        <SimulationSetupSidebar
          intervention={intervention}
          setIntervention={setIntervention}
          onRunSimulation={handleRunSimulation}
          isSimulating={isSimulating}
        />
      </div>

      {/* Backend Device Config Modal */}
      <BackendConfigModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        backendConfig={backendConfig}
        onUpdateConfig={(newCfg) => setBackendConfig(newCfg)}
      />
    </div>
  );
}
