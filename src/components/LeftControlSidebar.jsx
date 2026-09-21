import React from 'react';
import { Search, ChevronDown, MapPin, Layers, Clock, Box } from 'lucide-react';
import { PILOT_ZONES } from '../data/mockData';

export default function LeftControlSidebar({
  activeZone,
  setActiveZone,
  customAreaMode,
  setCustomAreaMode,
  layers,
  setLayers,
  viewMode,
  setViewMode
}) {
  const handleLayerToggle = (key) => {
    setLayers({ ...layers, [key]: !layers[key] });
  };

  return (
    <aside className="w-64 bg-[#111827] border-r border-slate-800 flex flex-col h-full overflow-y-auto shrink-0 p-4 space-y-6">
      {/* 1. Select Zone */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-slate-300 font-semibold text-xs uppercase tracking-wider">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>Select Zone</span>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search location..."
            className="w-full bg-[#1e293b]/60 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* City Select Dropdown */}
        <div className="space-y-1">
          <div className="relative">
            <select
              className="w-full bg-[#1e293b]/80 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none appearance-none cursor-pointer"
              defaultValue="Bengaluru"
            >
              <option value="Bengaluru">Bengaluru</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>

          {/* Zones List */}
          <div className="space-y-1 pt-1">
            {PILOT_ZONES.map((zone) => {
              const isSelected = activeZone.id === zone.id;
              return (
                <button
                  key={zone.id}
                  onClick={() => setActiveZone(zone)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  {zone.name.split(' (')[0]}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setCustomAreaMode(!customAreaMode)}
            className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition border ${
              customAreaMode
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-slate-900 border-slate-700 text-emerald-400 hover:bg-slate-800'
            }`}
          >
            Custom Area Tool
          </button>
          <p className={`text-[10px] leading-4 ${customAreaMode ? 'text-emerald-400' : 'text-slate-500'}`}>
            {customAreaMode
              ? 'Active: choose the polygon or lasso tool on the map.'
              : 'Always available for drawing a simulation area.'}
          </p>
        </div>
      </div>

      {/* 2. Map Layers Checkboxes */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex items-center space-x-2 text-slate-300 font-semibold text-xs uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Map Layers</span>
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={layers.satellite}
              onChange={() => handleLayerToggle('satellite')}
              className="w-3.5 h-3.5 rounded accent-blue-600 bg-slate-900 border-slate-700"
            />
            <span>Satellite</span>
          </label>

          <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={layers.buildings3D}
              onChange={() => handleLayerToggle('buildings3D')}
              className="w-3.5 h-3.5 rounded accent-blue-600 bg-slate-900 border-slate-700"
            />
            <span>Buildings (3D)</span>
          </label>

          <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={layers.roads}
              onChange={() => handleLayerToggle('roads')}
              className="w-3.5 h-3.5 rounded accent-blue-600 bg-slate-900 border-slate-700"
            />
            <span>Roads</span>
          </label>

          <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={layers.terrainElevation}
              onChange={() => handleLayerToggle('terrainElevation')}
              className="w-3.5 h-3.5 rounded accent-blue-600 bg-slate-900 border-slate-700"
            />
            <span>Terrain / Elevation</span>
          </label>

          <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={layers.drainageNetwork}
              onChange={() => handleLayerToggle('drainageNetwork')}
              className="w-3.5 h-3.5 rounded accent-blue-600 bg-slate-900 border-slate-700"
            />
            <span>Drainage Network</span>
          </label>

          <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={layers.floodRisk}
              onChange={() => handleLayerToggle('floodRisk')}
              className="w-3.5 h-3.5 rounded accent-blue-600 bg-slate-900 border-slate-700"
            />
            <span>Flood Risk (Simulated)</span>
          </label>

          <label className="flex items-center space-x-2.5 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={layers.trafficFlow}
              onChange={() => handleLayerToggle('trafficFlow')}
              className="w-3.5 h-3.5 rounded accent-blue-600 bg-slate-900 border-slate-700"
            />
            <span>Traffic Flow</span>
          </label>
        </div>
      </div>

      {/* 3. View Mode Switcher */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <span className="text-slate-300 font-semibold text-xs uppercase tracking-wider block">
          View Mode
        </span>

        <div className="grid grid-cols-2 gap-2 bg-[#1e293b]/60 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('2D')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-md text-xs font-semibold transition ${
              viewMode === '2D'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>2D Map</span>
          </button>

          <button
            onClick={() => setViewMode('3D')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-md text-xs font-semibold transition ${
              viewMode === '3D'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D View</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
