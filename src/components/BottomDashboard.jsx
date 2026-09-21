import React, { useState } from 'react';
import { CloudRain, Waves, CheckCircle2, ChevronDown, Route, ShieldCheck, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function BottomDashboard({ activeZone, simResults }) {
  const [resultSubTab, setResultSubTab] = useState('flood'); // 'flood' | 'traffic' | 'accessibility'

  const imdData = [
    { year: '2015', rainfall: 890 },
    { year: '2016', rainfall: 920 },
    { year: '2017', rainfall: 1680 },
    { year: '2018', rainfall: 1340 },
    { year: '2019', rainfall: 1980 },
    { year: '2020', rainfall: 1490 },
    { year: '2021', rainfall: 1120 },
    { year: '2022', rainfall: 1620 },
    { year: '2023', rainfall: 1080 },
    { year: '2024', rainfall: 1310 },
  ];

  const metrics = simResults?.metrics || {
    estMaxWaterDepthM: 0.8,
    affectedAreaKm2: 0.12,
    buildingsAtRiskCount: 8,
    majorWaterloggingPointsCount: 2,
    cutOffRoadCount: 2,
    totalEvacuationTimeMin: 28,
  };
  const riskScore = Number(metrics.riskScore || simResults?.floodRisk?.riskScore || 50);
  const affectedRoads = simResults?.roadStatus || activeZone.roads || [];
  const cutOffRoads = Number(metrics.cutOffRoadCount ?? Math.max(1, Math.round((riskScore / 100) * affectedRoads.length)));
  const congestionMultiplier = Number(metrics.congestionMultiplier || (1 + riskScore / 100)).toFixed(2);
  const primaryRoad = affectedRoads.find((road) => road.isCutOff)?.name
    || affectedRoads[0]?.name
    || 'Local access corridor';
  const evacuationHub = simResults?.evacuationHub?.name
    || activeZone.evacuationHubs?.[0]?.name
    || 'Nearest safe assembly area';
  const evacuationTime = Number(metrics.totalEvacuationTimeMin || simResults?.evacuationRoute?.estimatedTimeMin || 28);
  const safePath = cutOffRoads < Math.max(1, affectedRoads.length) ? 'Available with diversions' : 'Limited; review route';

  return (
    <div className="h-64 bg-[#0f172a] border-t border-slate-800 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
      {/* Card 1: Historical Weather Data (IMD) */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center space-x-1.5">
            <CloudRain className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-100">Historical Weather Data (IMD)</h3>
          </div>
          <div className="flex items-center space-x-1">
            <div className="relative">
              <select className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] rounded px-2 py-0.5 appearance-none pr-4">
                <option>{activeZone.name.split(' ')[0]}</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 top-1 pointer-events-none" />
            </div>
            <div className="relative">
              <select className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] rounded px-2 py-0.5 appearance-none pr-4">
                <option>Annual Rainfall</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 top-1 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Rainfall Bar Chart */}
        <div className="h-36 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={imdData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="year" stroke="#64748b" fontSize={9} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[0, 2500]} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '11px' }} />
              <Bar dataKey="rainfall" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Rainfall (mm)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Card 2: Simulation Results (Preview) */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center space-x-1.5">
            <Waves className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-100">Simulation Results (Preview)</h3>
          </div>

          {/* PDF Flowchart Sub-tabs */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-slate-800">
            <button
              onClick={() => setResultSubTab('flood')}
              className={`text-[10px] px-2 py-0.5 rounded font-semibold transition ${
                resultSubTab === 'flood' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Flood
            </button>
            <button
              onClick={() => setResultSubTab('traffic')}
              className={`text-[10px] px-2 py-0.5 rounded font-semibold transition ${
                resultSubTab === 'traffic' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Traffic
            </button>
            <button
              onClick={() => setResultSubTab('accessibility')}
              className={`text-[10px] px-2 py-0.5 rounded font-semibold transition ${
                resultSubTab === 'accessibility' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Accessibility
            </button>
          </div>
        </div>

        {/* Dynamic Content Based on Active PDF Flowchart Sub-tab */}
        {resultSubTab === 'flood' && (
          <div className="space-y-1.5 text-xs py-1">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Estimated Water Depth</span>
              <span className="font-bold text-slate-100">{metrics.estMaxWaterDepthM} m</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Affected Area</span>
              <span className="font-bold text-slate-100">{metrics.affectedAreaKm2} km²</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Buildings at Risk</span>
              <span className="font-bold text-slate-100">{metrics.buildingsAtRiskCount}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Major Waterlogging Points</span>
              <span className="font-bold text-slate-100">{metrics.majorWaterloggingPointsCount}</span>
            </div>
          </div>
        )}

        {resultSubTab === 'traffic' && (
          <div className="space-y-1.5 text-xs py-1">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Submerged Cut-Off Roads</span>
              <span className="font-bold text-rose-400">{cutOffRoads} Corridors</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Congestion Index Multiplier</span>
              <span className="font-bold text-amber-400">{congestionMultiplier}x Delay</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Primary Rerouted Corridor</span>
              <span className="font-bold text-slate-100">{primaryRoad}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Emergency Vehicle Access</span>
              <span className="font-bold text-emerald-400">Preserved (CMH Road)</span>
            </div>
          </div>
        )}

        {resultSubTab === 'accessibility' && (
          <div className="space-y-1.5 text-xs py-1">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Est. Evacuation Clearance Time</span>
              <span className="font-bold text-emerald-300">{evacuationTime} mins</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Nearest Evacuation Hub</span>
              <span className="font-bold text-slate-100">{evacuationHub}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Assembly Hub Capacity</span>
              <span className="font-bold text-blue-400">2,500 Citizens</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 text-[11px]">Safe Path Availability</span>
              <span className="font-bold text-emerald-400">{safePath}</span>
            </div>
          </div>
        )}

        {/* Completed Prototype Banner */}
        <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-lg p-2 flex items-start space-x-2 text-[10px] text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-emerald-200">Simulation completed</span>
            <span className="text-slate-300">This is a prototype simulation using open data and simplified models.</span>
          </div>
        </div>
      </div>

      {/* Card 3: Flood Visualization (Simulated) */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center space-x-1.5 border-b border-slate-800/80 pb-2">
          <Waves className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-slate-100">Flood Visualization (Simulated)</h3>
        </div>

        <div className="flex items-center space-x-3 flex-1 pt-1">
          {/* Simulated Polygon Thumbnail Canvas */}
          <div className="flex-1 h-32 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="blueHeat" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1e3a8a" />
                  <stop offset="50%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
              <polygon points="30,20 80,25 90,60 50,85 20,70" fill="url(#blueHeat)" fillOpacity="0.75" stroke="#3b82f6" strokeWidth="1.5" />
              <circle cx="30" cy="20" r="2.5" fill="white" stroke="#2563eb" strokeWidth="1" />
              <circle cx="80" cy="25" r="2.5" fill="white" stroke="#2563eb" strokeWidth="1" />
              <circle cx="90" cy="60" r="2.5" fill="white" stroke="#2563eb" strokeWidth="1" />
              <circle cx="50" cy="85" r="2.5" fill="white" stroke="#2563eb" strokeWidth="1" />
              <circle cx="20" cy="70" r="2.5" fill="white" stroke="#2563eb" strokeWidth="1" />
            </svg>
          </div>

          {/* Water Depth Legend Scale */}
          <div className="w-24 space-y-1 text-[10px] text-slate-300">
            <span className="font-semibold block text-slate-400 text-[9px]">Water Depth (m)</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-2.5 bg-[#1e3a8a] rounded-xs inline-block"></span>
              <span>&gt; 2.0</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-2.5 bg-[#2563eb] rounded-xs inline-block"></span>
              <span>1.0 - 2.0</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-2.5 bg-[#3b82f6] rounded-xs inline-block"></span>
              <span>0.5 - 1.0</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-2.5 bg-[#60a5fa] rounded-xs inline-block"></span>
              <span>0.1 - 0.5</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-2.5 bg-[#93c5fd] rounded-xs inline-block"></span>
              <span>&lt; 0.1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
