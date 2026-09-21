
import React, { useEffect, useMemo, useState } from 'react';
import MapView from './components/MapView';
import WeatherChart from './components/WeatherChart';
import StatCard from './components/StatCard';
import Legend from './components/Legend';
import RoutingGraph from './components/RoutingGraph';
import MetricsChart from './components/MetricsChart';
import { api } from './services/api';
import './styles.css';

const defaultIntervention = { type: 'BUILDING', footprintArea: 1200, floors: 10, material: 'CONCRETE', name: 'Building Scenario' };

function polygonAreaKm2(points) {
  if (points.length < 3) return 0;
  const lat0 = points.reduce((s, p) => s + p[0], 0) / points.length;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110.57;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [y1, x1] = points[i];
    const [y2, x2] = points[(i + 1) % points.length];
    area += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky);
  }
  return Math.abs(area) / 2;
}

function App() {
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState('bengaluru-pilot');
  const [zone, setZone] = useState(null);
  const [weather, setWeather] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [intervention, setIntervention] = useState(defaultIntervention);
  const [layers, setLayers] = useState({ terrain: true, roads: true, buildings: true, drainage: true, flood: false, traffic: false });
  const [result, setResult] = useState(null);
  const [route, setRoute] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [selectionPolygon, setSelectionPolygon] = useState(null);
  const [buildingPolygon, setBuildingPolygon] = useState(null);
  const [drawMode, setDrawMode] = useState(null);
  const [selectedAreaKm2, setSelectedAreaKm2] = useState(0);
  const [tab, setTab] = useState('Map');
  const [compareResults, setCompareResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [originNode, setOriginNode] = useState('');
  const [destinationNode, setDestinationNode] = useState('');
  const [algorithm, setAlgorithm] = useState('astar');
  const [dataOpen, setDataOpen] = useState(false);

  const loadZone = async (id) => {
    if (id === 'custom') return;
    setLoading(true);
    try {
      const [z, w] = await Promise.all([api.zone(id), api.weather(id)]);
      const elevationFeatures = [];
      const [[minx, miny], [maxx, maxy]] = z.bounds;
      const rows = z.elevationGrid.length;
      const cols = z.elevationGrid[0].length;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = minx + c * (maxx - minx) / cols;
        const y = miny + r * (maxy - miny) / rows;
        elevationFeatures.push({ type: 'Feature', properties: { elevation: z.elevationGrid[r][c] }, geometry: { type: 'Polygon', coordinates: [[[x,y],[x+(maxx-minx)/cols,y],[x+(maxx-minx)/cols,y+(maxy-miny)/rows],[x,y+(maxy-miny)/rows],[x,y]]] } });
      }
      z.elevationGeoJson = { type: 'FeatureCollection', features: elevationFeatures };
      setZone(z); setWeather(w); setSelectedEvent(w.events[0]); setResult(null); setRoute(null); setSelectionPolygon(null); setBuildingPolygon(null); setDrawingPoints([]); setSelectedAreaKm2(0); setDrawMode(null); setOriginNode(''); setDestinationNode('');
      setMessage(`${z.name} loaded. Zone geometry drives the simulation.`);
    } catch (e) { setMessage(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { api.zones().then(setZones).catch(e => setMessage(e.message)); loadZone('bengaluru-pilot'); }, []);

  const selectedWeather = selectedEvent || { rainfallMm: 120, durationHours: 6, year: 2024 };
  const updateIntervention = (patch) => setIntervention(prev => ({ ...prev, ...patch }));
  const areaPointsGeoJson = selectionPolygon ? selectionPolygon.map(([lat,lng]) => [lng,lat]) : null;
  const selectedAreaGeoJson = areaPointsGeoJson ? { type:'Polygon', coordinates:[[...areaPointsGeoJson, areaPointsGeoJson[0]]] } : null;
  const buildingPointsGeoJson = buildingPolygon ? buildingPolygon.map(([lat,lng]) => [lng,lat]) : null;
  const buildingFootprintGeoJson = buildingPointsGeoJson ? { type:'Polygon', coordinates:[[...buildingPointsGeoJson, buildingPointsGeoJson[0]]] } : null;
  const graphNodes = result?.routing?.graph?.nodes || [];

  useEffect(() => {
    if (graphNodes.length) {
      setOriginNode(result.routing.suggestedOrigin || graphNodes[0].id);
      setDestinationNode(result.routing.suggestedDestination || graphNodes[graphNodes.length - 1].id);
    }
  }, [result]);

  const runSimulation = async (customIntervention = intervention, label = '') => {
    if (!zone) return;
    setLoading(true); setMessage('Running flood, drainage, traffic and routing models...');
    try {
      const r = await api.simulate({ zoneId: zone.id, zoneName: zone.name, selectedArea: selectedAreaGeoJson, intervention: customIntervention, weather: { rainfallMm: selectedWeather.rainfallMm, durationHours: selectedWeather.durationHours } });
      setResult(r); setLayers(l => ({ ...l, flood: true, traffic: true })); setRoute(null); setMessage(label ? `${label} completed.` : 'Simulation completed. Routing graph updated.'); return r;
    } catch (e) { setMessage(e.message); return null; } finally { setLoading(false); }
  };

  const runRoute = async () => {
    if (!result || !originNode || !destinationNode) return;
    setLoading(true); setMessage('Calculating safe route with ' + algorithm.toUpperCase() + '...');
    try {
      const r = await api.route({ zoneId: zone.id, selectedArea: selectedAreaGeoJson, origin: originNode, destination: destinationNode, blockedRoads: result.routing.blockedRoads, algorithm });
      setRoute(r); setTab('Routing'); setMessage(r.status === 'ROUTE_FOUND' ? `Safe route found. ${r.blockedRoads.length} flooded road(s) avoided.` : 'No safe route exists with current blocked roads.');
    } catch (e) { setMessage(e.message); } finally { setLoading(false); }
  };

  const runCompare = async () => {
    setLoading(true); setMessage('Comparing scenarios...');
    const scenarios = [
      { id:'baseline', name:'Baseline', intervention:{type:'NONE', name:'Baseline'} },
      { id:'building', name:'Scenario A · Building', intervention:{type:'BUILDING', footprintArea:1200, floors:10, material:'CONCRETE', name:'Scenario A · Building'} },
      { id:'drainage', name:'Scenario B · Drainage +', intervention:{type:'DRAINAGE', currentCapacity:50, proposedCapacity:80, name:'Scenario B · Drainage +'} },
      { id:'road', name:'Scenario C · Road Widening', intervention:{type:'ROAD', currentWidth:8, proposedWidth:12, name:'Scenario C · Road Widening'} },
    ];
    try { const r = await api.compare({ zoneId: zone.id, selectedArea: selectedAreaGeoJson, weather:{rainfallMm:selectedWeather.rainfallMm,durationHours:selectedWeather.durationHours}, scenarios }); setCompareResults(r.scenarios); setTab('Compare'); setMessage('Scenario comparison completed.'); }
    catch(e){ setMessage(e.message); } finally { setLoading(false); }
  };

  const startDrawing = (mode = 'zone') => { setDrawing(true); setDrawMode(mode); setDrawingPoints([]); setResult(null); setRoute(null); if (mode === 'zone') { setSelectionPolygon(null); setBuildingPolygon(null); setSelectedAreaKm2(0); setZone(null); setZoneId('custom'); setMessage('Draw any polygon on the map. The selected polygon becomes the simulation zone.'); } else { setBuildingPolygon(null); setMessage('Draw the proposed building footprint inside the active zone.'); } };
  const addPoint = p => setDrawingPoints(prev => [...prev, p]);
  const finishDrawing = async () => {
    if (drawingPoints.length < 3) { setMessage('Add at least three points to create a polygon.'); return; }
    setDrawing(false);
    const area = polygonAreaKm2(drawingPoints);
    const polygon = { type:'Polygon', coordinates:[[...drawingPoints.map(([lat,lng]) => [lng,lat]), [drawingPoints[0][1], drawingPoints[0][0]]]] };
    if (drawMode === 'building') {
      setBuildingPolygon(drawingPoints);
      setDrawingPoints([]);
      updateIntervention({ drawnFootprint: polygon, footprintArea: Math.round(area * 1000000), name: 'Building Scenario' });
      setMessage(`Building footprint captured: ${area.toFixed(3)} km². Run the simulation to apply the intervention.`);
      return;
    }
    setSelectionPolygon(drawingPoints); setSelectedAreaKm2(area); setLoading(true);
    try {
      const z = await api.previewArea({ polygon, name:'Custom Area', city:'User Selected Area' });
      const elevationFeatures = [];
      const [[minx,miny],[maxx,maxy]] = z.bounds;
      const rows = z.elevationGrid.length, cols = z.elevationGrid[0].length;
      for (let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
        const x=minx+c*(maxx-minx)/cols, y=miny+r*(maxy-miny)/rows, dx=(maxx-minx)/cols, dy=(maxy-miny)/rows;
        elevationFeatures.push({type:'Feature',properties:{elevation:z.elevationGrid[r][c]},geometry:{type:'Polygon',coordinates:[[[x,y],[x+dx,y],[x+dx,y+dy],[x,y+dy],[x,y]]]}});
      }
      z.elevationGeoJson={type:'FeatureCollection',features:elevationFeatures};
      setZone(z); setDrawMode(null); setWeather(z.weather || {events:[]}); setSelectedEvent((z.weather?.events || [])[0] || null); setMessage(`Custom zone created: ${area.toFixed(2)} km². Simulation is now polygon-scoped.`);
    } catch(e){ setMessage(e.message); } finally { setLoading(false); }
  };

  const reportHtml = () => {
    const r = result || {};
    return `<html><head><title>UrbanTwin Report</title><style>body{font-family:Arial;padding:36px;color:#162033}table{border-collapse:collapse;width:100%}td,th{padding:10px;border:1px solid #ddd;text-align:left}</style></head><body><h1>UrbanTwin — Zone Simulation Report</h1><p><b>Zone:</b> ${zone?.name || '—'}</p><p><b>Area:</b> ${selectedAreaKm2 ? selectedAreaKm2.toFixed(2)+' km²' : 'Zone extent'}</p><p><b>Rainfall:</b> ${selectedWeather.rainfallMm} mm / ${selectedWeather.durationHours} h</p><table><tr><th>Metric</th><th>Result</th></tr><tr><td>Flood risk</td><td>${r.floodRisk||'—'}</td></tr><tr><td>Maximum depth</td><td>${r.maxWaterDepth||'—'} m</td></tr><tr><td>Affected area</td><td>${r.affectedAreaKm2||'—'} km²</td></tr><tr><td>Runoff</td><td>${r.runoffM3||'—'} m³</td></tr><tr><td>Buildings at risk</td><td>${r.buildingsAtRisk||'—'}</td></tr><tr><td>Flooded roads</td><td>${r.affectedRoads||'—'}</td></tr></table><h2>Flood-response routing</h2><p>Road intersections are graph nodes and road segments are graph edges. Flooded roads are removed from the routing graph. ${r.routing?.algorithm || 'A*'} calculates an alternative route.</p><h2>Assumptions</h2><p>Prototype runoff coefficients: vegetation 0.2, soil 0.4, road 0.8, concrete 0.85. Elevation-based grid and drainage are screening-level approximations.</p><h2>Limitations</h2><p>Real mapped GIS data are combined with screening-level runoff, elevation propagation and estimated traffic/drainage parameters. This is not an engineering-certified flood, traffic, drainage, or evacuation assessment.</p></body></html>`;
  };
  const downloadReport = () => { const blob = new Blob([reportHtml()], {type:'text/html'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='urbantwin-zone-report.html'; a.click(); URL.revokeObjectURL(a.href); };

  const maxCompare = useMemo(() => Math.max(...compareResults.map(s => s.result.maxWaterDepth || 0), 0.1), [compareResults]);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><span/><span/><span/></div><div><div className="brand-name">UrbanTwin</div><div className="brand-sub">Simulate Before You Build · Zone Agnostic</div></div></div>
      <nav>{['Map','Simulate','Routing','Compare'].map(n => <button key={n} className={tab===n?'nav-active':''} onClick={()=>setTab(n)}>{n}</button>)}</nav>
      <div className="top-actions"><span className="prototype-pill">PROTOTYPE MODE</span><div className="profile"><div className="avatar">●</div><div><b>Guest</b><small>GIS Decision Support</small></div></div></div>
    </header>

    <main className="workspace">
      <aside className="sidebar">
        <section><h3>⌖ Select Zone</h3><select value={zoneId} onChange={e=>{const id=e.target.value; setZoneId(id); if(id==='custom') startDrawing(); else loadZone(id);}}><option value="">Choose zone...</option>{zones.filter(z=>z.id!=='custom').map(z=><option key={z.id} value={z.id}>{z.name}</option>)}<option value="custom">Custom Area (Draw)</option></select>
          <div className="zone-list">{zones.filter(z=>z.id!=='custom').map(z=><button key={z.id} className={zoneId===z.id?'zone-active':''} onClick={()=>{setZoneId(z.id);loadZone(z.id)}}>{z.name}</button>)}</div>
        </section>
        <section><h3>Map Layers</h3>{[['terrain','Terrain / Elevation'],['buildings','Buildings'],['roads','Roads / Graph Edges'],['drainage','Drainage Network'],['flood','Flood Risk (Simulated)'],['traffic','Flooded Roads / Accessibility']].map(([k,l])=><label className="check" key={k}><input type="checkbox" checked={layers[k]} onChange={e=>setLayers({...layers,[k]:e.target.checked})}/><span>{l}</span></label>)}</section>
        <section><h3>Selected Area</h3><div className="area-card"><b>{selectedAreaKm2 ? selectedAreaKm2.toFixed(2) : '—'} <small>km²</small></b><span>{selectionPolygon ? 'Custom polygon active' : 'Entire selected zone'}</span></div><button className="draw-main" onClick={()=>startDrawing('zone')}>＋ Draw Any Area</button>{drawing && <button className="finish-main" onClick={finishDrawing}>✓ Finish {drawMode === 'building' ? 'Footprint' : 'Zone'}</button>}</section>
        <div className="side-note">ZONE-AGNOSTIC ENGINE<br/><span>The simulation accepts predefined zones or any user-drawn polygon. Demo geometry is generated dynamically for the selected area.</span></div>
      </aside>

      <section className="center-panel">
        <div className="map-card"><MapView zone={zone} layers={layers} floodResult={result} route={route} drawing={drawing} drawingPoints={drawingPoints} onPoint={addPoint} selectionPolygon={selectionPolygon} buildingPolygon={buildingPolygon}/><div className="map-badge"><b>Active Zone</b><span>{zone?.name || 'Draw a zone'}</span><small>{selectedAreaKm2 ? `${selectedAreaKm2.toFixed(2)} km² selected` : 'Zone-aware simulation'}</small></div><Legend/></div>
        <div className="bottom-grid">
          <div className="panel weather-panel"><div className="panel-title"><span>☁</span><b>Historical Weather</b></div>{weather && <><div className="selectors"><select value={selectedEvent?.year || ''} onChange={e=>setSelectedEvent(weather.events.find(x=>x.year===Number(e.target.value)))}>{weather.events.map(e=><option key={e.year} value={e.year}>{e.year}</option>)}</select><span className="event-chip">{selectedWeather.rainfallMm} mm</span></div><div className="rainfall-big">{selectedWeather.rainfallMm}<small> mm · {selectedWeather.durationHours} h</small></div><WeatherChart weather={weather} selectedYear={selectedWeather.year} onSelect={setSelectedEvent}/><div className="source-line">{selectedWeather.source || weather?.source || 'Real historical rainfall / reanalysis'} · {zone?.dataLabel || 'REAL DATA MODE'}</div></>}</div>
          <div className="panel results-panel"><div className="panel-title"><span>≋</span><b>Simulation Results</b><span className="preview">{result ? 'Completed' : 'Waiting'}</span></div>{result ? <div className="result-preview"><div><span>Flood Risk</span><b className={`risk-${String(result.floodRisk).toLowerCase()}`}>{result.floodRisk}</b></div><div><span>Max Depth</span><b>{result.maxWaterDepth} m</b></div><div><span>Affected Area</span><b>{result.affectedAreaKm2} km²</b></div><div><span>Buildings at Risk</span><b>{result.buildingsAtRisk}</b></div><div><span>Flooded Roads</span><b>{result.affectedRoads}</b></div><div><span>Drainage Overloads</span><b>{result.drainageOverloads}</b></div></div>:<div className="empty-results">Run a scenario to generate flood depth, drainage, traffic and routing outputs.</div>}</div>
          <div className="panel chart-panel"><div className="panel-title"><span>▥</span><b>Response Graph</b></div><MetricsChart result={result}/></div>
        </div>
      </section>

      <aside className="setup-panel">
        <div className="setup-head"><span className="step">1</span><b>Simulation Setup</b><h2>{zone?.name || 'Choose or draw a zone'}</h2></div>
        <div className="intervention-tabs">{['BUILDING','ROAD','DRAINAGE'].map(t=><button key={t} className={intervention.type===t?'active':''} onClick={()=>updateIntervention({type:t,name:t==='BUILDING'?'Building Scenario':t==='ROAD'?'Road Scenario':'Drainage Scenario'})}>{t[0]+t.slice(1).toLowerCase()}</button>)}</div>
        <div className="step-block"><div className="step-row"><span className="step">2</span><b>Intervention</b></div>
          {intervention.type==='BUILDING' && <><div className="draw-box"><b>⌗</b><span>Building footprint</span><button onClick={()=>startDrawing('building')}>Draw footprint on map</button></div><div className="field"><span>Footprint area</span><input type="number" value={intervention.footprintArea} onChange={e=>updateIntervention({footprintArea:Number(e.target.value)})}/></div><div className="field"><span>Floors</span><input type="number" value={intervention.floors} onChange={e=>updateIntervention({floors:Number(e.target.value)})}/></div><div className="field"><span>Material</span><select value={intervention.material} onChange={e=>updateIntervention({material:e.target.value})}><option>CONCRETE</option><option>BRICK</option><option>STEEL</option></select></div></>}
          {intervention.type==='ROAD' && <><div className="field"><span>Current width</span><input type="number" value={intervention.currentWidth || 8} onChange={e=>updateIntervention({currentWidth:Number(e.target.value)})}/></div><div className="field"><span>Proposed width</span><input type="number" value={intervention.proposedWidth || 12} onChange={e=>updateIntervention({proposedWidth:Number(e.target.value)})}/></div></>}
          {intervention.type==='DRAINAGE' && <><div className="field"><span>Current capacity</span><input type="number" value={intervention.currentCapacity || 50} onChange={e=>updateIntervention({currentCapacity:Number(e.target.value)})}/></div><div className="field"><span>Proposed capacity</span><input type="number" value={intervention.proposedCapacity || 80} onChange={e=>updateIntervention({proposedCapacity:Number(e.target.value)})}/></div></>}
        </div>
        <div className="step-block"><div className="step-row"><span className="step">3</span><b>Rainfall Event</b></div>{weather && <div className="weather-selection"><b>{selectedWeather.year} historical event</b><span>{selectedWeather.rainfallMm} mm rainfall · {selectedWeather.durationHours} h duration</span><small>{selectedWeather.sourceType === 'REAL_REANALYSIS' ? 'ERA5-Land reanalysis · not a station observation' : 'Demo fallback'}</small></div>}</div>
        <div className="setup-actions"><button className="run-btn" disabled={loading || !zone || !weather} onClick={()=>runSimulation()}>▶ Run Simulation</button><button className="compare-btn" disabled={loading || !zone} onClick={runCompare}>Compare Scenarios</button></div>
        <div className="route-block"><div className="step-row"><span className="step">4</span><b>Flood-Response Routing</b></div>{graphNodes.length ? <><div className="route-note">Flooded roads are removed from the graph. Choose HOME and SAFE ZONE.</div><div className="route-grid"><select value={originNode} onChange={e=>setOriginNode(e.target.value)}>{graphNodes.map(n=><option key={n.id} value={n.id}>{n.id} · Home node</option>)}</select><select value={destinationNode} onChange={e=>setDestinationNode(e.target.value)}>{graphNodes.map(n=><option key={n.id} value={n.id}>{n.id} · Safe node</option>)}</select></div><select className="algorithm-select" value={algorithm} onChange={e=>setAlgorithm(e.target.value)}><option value="astar">A* shortest safe route</option><option value="dijkstra">Dijkstra shortest safe route</option></select><button className="route-btn" disabled={loading} onClick={runRoute}>Find Safe Route</button>{route && <div className="route-result"><b>{route.status}</b><span>{route.distanceKm} km · {route.travelTimeMin} min</span><small>{route.blockedRoads.length} flooded road(s) avoided · {route.algorithm}</small></div>}</> : <div className="empty-route">Run the simulation first. It will automatically build the road graph from the active zone.</div>}</div>
        <div className="data-link"><button onClick={()=>setDataOpen(!dataOpen)}>▣ Data & Methodology {dataOpen?'▲':'▼'}</button>{dataOpen && <div className="data-pop"><p><b>Zone:</b> {zone?.name || '—'}</p><p><b>Rainfall:</b> real historical reanalysis events from the active zone; official KSNDMC station data can be supplied through the authoritative-data adapter.</p><p><b>Flood:</b> runoff + elevation propagation + drainage screening.</p><p><b>Routing:</b> intersections = nodes, roads = edges, flooded edges removed, Dijkstra/A*.</p><p><b>Data:</b> {zone?.dataLabel || 'REAL DATA MODE'} · roads/buildings from OSM, terrain from Copernicus GLO-90 via Open-Meteo, rainfall from ERA5-Land reanalysis. Waterway capacity and traffic are marked as estimates/proxies where observed values are unavailable.</p></div>}</div>
        <button className="report-btn" disabled={!result} onClick={downloadReport}>▤ Export Report</button>
      </aside>
    </main>

    {message && <div className="bottom-status"><span>{loading ? '● ' : '✓ '}{message}</span><button onClick={()=>setMessage('')}>Dismiss</button></div>}

    {tab==='Routing' && result && <div className="routing-overlay"><div className="routing-card"><div className="compare-header"><div><span className="eyebrow">FLOOD-RESPONSE ROUTING</span><h2>Road Network Graph</h2><p>HOME → accessible road network → SAFE ZONE</p></div><button onClick={()=>setTab('Map')}>×</button></div><RoutingGraph routing={result.routing} route={route}/><div className="routing-explanation"><div><b>Graph model</b><span>Intersections are nodes; roads are edges.</span></div><div><b>Flood response</b><span>{result.routing.blockedRoads.length} road(s) predicted inaccessible and removed from routing.</span></div><div><b>Algorithm</b><span>{route?.algorithm || result.routing.algorithm} computes the alternative path.</span></div></div>{route && <div className="route-summary"><b>{route.status}</b><span>{route.distanceKm} km · {route.travelTimeMin} min · {route.blockedRoads.length} blocked road(s) avoided</span></div>}</div></div>}

    {tab==='Compare' && <div className="compare-overlay"><div className="compare-card"><div className="compare-header"><div><span className="eyebrow">SCENARIO COMPARISON</span><h2>Baseline vs Proposed Interventions</h2><p>{zone?.name} · {selectedWeather.rainfallMm} mm event</p></div><button onClick={()=>setTab('Map')}>×</button></div><div className="comparison-table"><table><thead><tr><th>Scenario</th><th>Risk</th><th>Max Depth</th><th>Affected Area</th><th>Roads</th><th>Buildings</th></tr></thead><tbody>{compareResults.map(s=><tr key={s.id}><td><b>{s.name}</b></td><td>{s.result.floodRisk}</td><td>{s.result.maxWaterDepth} m</td><td>{s.result.affectedAreaKm2} km²</td><td>{s.result.affectedRoads}</td><td>{s.result.buildingsAtRisk}</td></tr>)}</tbody></table></div><div className="comparison-bars">{compareResults.map(s=><div className="compare-col" key={s.id}><b>{s.name}</b><div className="bar-meter"><i style={{width:`${Math.min(100,(s.result.maxWaterDepth/maxCompare)*100)}%`}}/></div><small>{s.result.maxWaterDepth} m maximum depth</small></div>)}</div><div className="disclaimer">This is a prototype scenario comparison using representative data and simplified models. It supports screening and demonstration, not engineering certification.</div><button className="report-btn" onClick={downloadReport}>Export Current Scenario Report</button></div></div>}
  </div>;
}

export default App;
