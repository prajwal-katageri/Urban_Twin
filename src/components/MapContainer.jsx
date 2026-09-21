import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MousePointer, Square, Circle, Pencil, Trash2, Plus, Minus } from 'lucide-react';

export default function MapContainer({ activeZone, simResults, layers, onDrawnAreaChange, customAreaMode }) {
  const mapRef = useRef(null);
  const leafletInstanceRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const userDrawMarkersRef = useRef([]);
  const lassoPreviewRef = useRef(null);
  const lassoPointsRef = useRef([]);
  const isLassoDrawingRef = useRef(false);

  const [activeTool, setActiveTool] = useState('polygon'); // 'pointer' | 'rect' | 'polygon'
  const [drawnPoints, setDrawnPoints] = useState([]);
  const [calculatedArea, setCalculatedArea] = useState(activeZone.areaKm2);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: activeZone.center,
        zoom: activeZone.zoom,
        zoomControl: false,
      });

      leafletInstanceRef.current = map;
    }

    const map = leafletInstanceRef.current;
    map.setView(activeZone.center, activeZone.zoom);

    // Remove existing tile layers
    map.eachLayer((l) => {
      if (l instanceof L.TileLayer) map.removeLayer(l);
    });

    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

    if (layers?.satellite) {
      tileUrl = `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}${googleApiKey ? `&key=${googleApiKey}` : ''}`;
      attribution = '&copy; Google Maps Satellite';
    }

    L.tileLayer(tileUrl, { maxZoom: 20, attribution }).addTo(map);

    // Reset default zone polygon if user hasn't drawn a custom polygon yet
    if (drawnPoints.length === 0) {
      const cLat = activeZone.center[0];
      const cLng = activeZone.center[1];
      const defaultPoly = [
        [cLat + 0.003, cLng - 0.003],
        [cLat + 0.004, cLng + 0.002],
        [cLat + 0.001, cLng + 0.005],
        [cLat - 0.003, cLng + 0.003],
        [cLat - 0.002, cLng - 0.004],
      ];
      renderPolygon(map, defaultPoly);
      setCalculatedArea(activeZone.areaKm2);
    }
  }, [activeZone, layers]);

  // Click handler to draw custom polygon points on map
  useEffect(() => {
    const map = leafletInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (activeTool !== 'polygon' && activeTool !== 'rect') return;

      const newPoint = [e.latlng.lat, e.latlng.lng];
      setDrawnPoints((prev) => {
        const next = [...prev, newPoint];
        if (next.length >= 3) {
          renderPolygon(map, next);
          const areaKm2 = calculatePolygonAreaKm2(next);
          const center = next.reduce(
            (sum, point) => [sum[0] + point[0] / next.length, sum[1] + point[1] / next.length],
            [0, 0]
          );
          const approxArea = Number(areaKm2.toFixed(2));
          setCalculatedArea(approxArea);
          if (onDrawnAreaChange) onDrawnAreaChange({ areaKm2: Math.max(0.01, approxArea), center });
        }
        return next;
      });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [activeTool, onDrawnAreaChange]);

  useEffect(() => {
    const map = leafletInstanceRef.current;
    if (!map) return;

    const stopDrawing = () => {
      isLassoDrawingRef.current = false;
      lassoPointsRef.current = [];
      if (lassoPreviewRef.current) {
        map.removeLayer(lassoPreviewRef.current);
        lassoPreviewRef.current = null;
      }
      map.dragging.enable();
    };

    const handleMouseDown = (event) => {
      if (activeTool !== 'lasso') return;
      isLassoDrawingRef.current = true;
      lassoPointsRef.current = [event.latlng];
      map.dragging.disable();
      lassoPreviewRef.current = L.polyline(lassoPointsRef.current, {
        color: '#10b981',
        weight: 3,
        dashArray: '6 4',
      }).addTo(map);
    };

    const handleMouseMove = (event) => {
      if (!isLassoDrawingRef.current) return;
      const points = lassoPointsRef.current;
      const previous = points[points.length - 1];
      if (previous && map.distance(previous, event.latlng) < 3) return;
      points.push(event.latlng);
      lassoPreviewRef.current?.setLatLngs(points);
    };

    const handleMouseUp = () => {
      if (!isLassoDrawingRef.current) return;
      const points = [...lassoPointsRef.current];
      isLassoDrawingRef.current = false;
      map.dragging.enable();

      if (lassoPreviewRef.current) {
        map.removeLayer(lassoPreviewRef.current);
        lassoPreviewRef.current = null;
      }

      if (points.length < 3) {
        lassoPointsRef.current = [];
        return;
      }

      renderPolygon(map, points);
      const areaKm2 = calculatePolygonAreaKm2(points);
      const center = points.reduce(
        (sum, point) => [sum[0] + point.lat / points.length, sum[1] + point.lng / points.length],
        [0, 0]
      );
      const selectedArea = Number(areaKm2.toFixed(2));
      setDrawnPoints(points.map((point) => [point.lat, point.lng]));
      setCalculatedArea(selectedArea);
      onDrawnAreaChange?.({ areaKm2: Math.max(0.01, selectedArea), center });
      lassoPointsRef.current = [];
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    map.on('mouseout', handleMouseUp);

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.off('mouseout', handleMouseUp);
      stopDrawing();
    };
  }, [activeTool, onDrawnAreaChange]);

  useEffect(() => {
    if (customAreaMode) setActiveTool('polygon');
  }, [customAreaMode]);

  const calculatePolygonAreaKm2 = (points) => {
    const earthRadiusKm = 6371;
    const degreeScale = Math.PI / 180;
    let area = 0;

    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const currentLat = Array.isArray(current) ? current[0] : current.lat;
      const currentLng = Array.isArray(current) ? current[1] : current.lng;
      const nextLat = Array.isArray(next) ? next[0] : next.lat;
      const nextLng = Array.isArray(next) ? next[1] : next.lng;
      const currentX = earthRadiusKm * currentLng * degreeScale * Math.cos(currentLat * degreeScale);
      const currentY = earthRadiusKm * currentLat * degreeScale;
      const nextX = earthRadiusKm * nextLng * degreeScale * Math.cos(nextLat * degreeScale);
      const nextY = earthRadiusKm * nextLat * degreeScale;
      area += currentX * nextY - nextX * currentY;
    }

    return Math.abs(area) / 2;
  };

  const renderPolygon = (map, points) => {
    if (polygonLayerRef.current) map.removeLayer(polygonLayerRef.current);
    userDrawMarkersRef.current.forEach((m) => map.removeLayer(m));
    userDrawMarkersRef.current = [];

    const poly = L.polygon(points, {
      color: '#2563eb',
      weight: 3,
      fillColor: '#3b82f6',
      fillOpacity: 0.35,
    }).addTo(map);

    points.forEach((coord) => {
      const marker = L.circleMarker(coord, {
        radius: 4,
        fillColor: '#ffffff',
        color: '#2563eb',
        weight: 2,
        fillOpacity: 1,
      }).addTo(map);
      userDrawMarkersRef.current.push(marker);
    });

    polygonLayerRef.current = poly;
  };

  const handleClearDrawings = () => {
    const map = leafletInstanceRef.current;
    if (!map) return;
    setDrawnPoints([]);
    setCalculatedArea(activeZone.areaKm2);
    if (polygonLayerRef.current) map.removeLayer(polygonLayerRef.current);
    userDrawMarkersRef.current.forEach((m) => map.removeLayer(m));
    userDrawMarkersRef.current = [];
  };

  const handleZoomIn = () => leafletInstanceRef.current?.zoomIn();
  const handleZoomOut = () => leafletInstanceRef.current?.zoomOut();

  return (
    <div className="relative flex-1 h-full w-full bg-slate-900 overflow-hidden">
      {/* Leaflet Mount Container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Top Left Drawing Toolbar */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-auto bg-white shadow-lg rounded-lg p-1 flex flex-col space-y-1 border border-slate-200">
        <button
          onClick={() => setActiveTool('pointer')}
          className={`p-2 rounded hover:bg-slate-100 ${activeTool === 'pointer' ? 'bg-slate-100 text-blue-600 font-bold' : 'text-slate-700'}`}
          title="Select / Inspect Tool"
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTool('rect')}
          className={`p-2 rounded hover:bg-slate-100 ${activeTool === 'rect' ? 'bg-slate-100 text-blue-600 font-bold' : 'text-slate-700'}`}
          title="Draw Box Area"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTool('polygon')}
          className={`p-2 rounded hover:bg-slate-100 ${activeTool === 'polygon' ? 'bg-slate-100 text-blue-600 font-bold' : 'text-slate-700'}`}
          title="Click Map to Draw Custom Area"
        >
          <Circle className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTool('lasso')}
          className={`p-2 rounded hover:bg-slate-100 ${activeTool === 'lasso' ? 'bg-slate-100 text-emerald-600 font-bold' : 'text-slate-700'}`}
          title="Freehand Lasso Selection"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-200 my-1" />
        <button
          onClick={handleClearDrawings}
          className="p-2 rounded hover:bg-slate-100 text-slate-700 hover:text-red-600"
          title="Clear Drawn Polygon"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Top Right Zoom Controls */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-auto bg-white shadow-lg rounded-lg p-1 flex flex-col space-y-1 border border-slate-200">
        <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-slate-100 text-slate-700">
          <Plus className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-200" />
        <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-slate-100 text-slate-700">
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Center Tooltip: Selected Area */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 text-white border border-slate-700 px-4 py-2 rounded-xl shadow-xl text-xs backdrop-blur text-center">
        <span className="font-semibold block text-slate-300 text-[11px]">Selected Area</span>
        <span className="font-bold text-sm text-slate-100">Area: {calculatedArea} km²</span>
      </div>

      {/* Bottom Right Elevation Gradient Box */}
      <div className="absolute bottom-6 right-4 z-20 bg-white/95 text-slate-800 border border-slate-200 p-2.5 rounded-lg shadow-lg text-xs space-y-1 backdrop-blur">
        <span className="font-bold text-[11px] block">Elevation (m)</span>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-12 bg-gradient-to-t from-emerald-600 via-yellow-400 to-rose-500 rounded-sm"></div>
          <div className="flex flex-col justify-between h-12 text-[10px] font-semibold text-slate-600">
            <span>920</span>
            <span>860</span>
          </div>
        </div>
      </div>

      {/* Bottom Left Scale Bar & Active Tool Indicator */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center space-x-2">
        <div className="bg-white/95 text-slate-800 border border-slate-300 px-3 py-1 rounded text-[10px] font-bold shadow-md">
          200 m
        </div>
        <div className="bg-slate-900/90 text-blue-400 border border-slate-700 px-2.5 py-1 rounded text-[10px] font-mono shadow-md">
          Tool: {activeTool === 'polygon' ? 'Click Map to Add Polygon Nodes' : activeTool}
        </div>
      </div>
    </div>
  );
}
