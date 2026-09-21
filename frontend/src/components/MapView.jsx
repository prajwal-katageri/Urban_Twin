import React from "react";
import { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polygon, CircleMarker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MapClickHandler({ active, onPoint }) {
  useMapEvents({ click(e) { if (active) onPoint([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

function MapViewport({ zone }) {
  const map = useMap();
  useEffect(() => {
    if (zone?.bounds) {
      const [[minx, miny], [maxx, maxy]] = zone.bounds;
      map.fitBounds([[miny, minx], [maxy, maxx]], { padding: [18, 18] });
    }
  }, [map, zone]);
  return null;
}

const floodStyle = (feature) => {
  const d = feature.properties?.waterDepth || 0;
  let fill = '#9edff3';
  if (d >= 2) fill = '#173c9a';
  else if (d >= 1) fill = '#2d75e8';
  else if (d >= .5) fill = '#25a8df';
  else if (d >= .1) fill = '#68d3eb';
  return { color: fill, weight: 0.4, fillColor: fill, fillOpacity: d > 0 ? Math.min(.82, .18 + d * .3) : 0 };
};

const elevationStyle = (feature) => {
  const e = feature.properties?.elevation || 900;
  const t = Math.max(0, Math.min(1, (e - 860) / 55));
  return { color: 'transparent', weight: 0, fillColor: `rgb(${Math.round(70 + 130 * (1-t))},${Math.round(125 + 90*t)},${Math.round(125 + 45*t)})`, fillOpacity: .22 };
};

export default function MapView({ zone, layers, floodResult, route, drawing, drawingPoints, onPoint, selectionPolygon, buildingPolygon }) {
  const bounds = zone?.bounds || [[77.55, 12.96], [77.562, 12.972]];
  const center = [(bounds[0][1] + bounds[1][1]) / 2, (bounds[0][0] + bounds[1][0]) / 2];
  const roads = zone?.roads;
  const buildings = zone?.buildings;
  const drainage = zone?.drainage;
  const elevation = zone?.elevationGeoJson;

  useEffect(() => { setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }, [zone]);

  return (
    <div className="map-wrap">
      <MapContainer center={center} zoom={14} minZoom={3} maxZoom={20} scrollWheelZoom className="map">
        <MapViewport zone={zone} />
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler active={drawing} onPoint={onPoint} />
        {layers.terrain && elevation && <GeoJSON data={elevation} style={elevationStyle} />}
        {layers.roads && roads && <GeoJSON data={roads} style={{ color: '#657284', weight: 4, opacity: .85 }} />}
        {layers.buildings && buildings && <GeoJSON data={buildings} style={{ color: '#566273', weight: .6, fillColor: '#d5d9df', fillOpacity: .76 }} />}
        {layers.drainage && drainage && <GeoJSON data={drainage} style={{ color: '#13a5c8', weight: 3, dashArray: '6 5' }} />}
        {layers.flood && floodResult?.floodGeoJson && <GeoJSON data={floodResult.floodGeoJson} style={floodStyle} />}
        {layers.flood && floodResult?.waterloggingGeoJson && <GeoJSON data={floodResult.waterloggingGeoJson} pointToLayer={(_, latlng) => L.circleMarker(latlng, { radius: 6, color: '#d7193f', fillColor: '#d7193f', fillOpacity: .9 })} />}
        {layers.traffic && floodResult?.affectedRoadGeoJson && <GeoJSON data={floodResult.affectedRoadGeoJson} style={{ color: '#e23a4c', weight: 8, opacity: .9 }} />}
        {drawingPoints.length > 1 && <Polyline positions={drawingPoints} pathOptions={{ color: '#0969ff', weight: 3, dashArray: '8 6' }} />}
        {drawingPoints.map((p, i) => <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: '#fff', weight: 2, fillColor: '#0969ff', fillOpacity: 1 }} />)}
        {route?.route?.geometry?.coordinates && <Polyline positions={route.route.geometry.coordinates.map(([lng, lat]) => [lat, lng])} pathOptions={{ color: '#16a34a', weight: 8 }} />}
        {selectionPolygon && <Polygon positions={selectionPolygon} pathOptions={{ color: '#1264e8', weight: 3, fillColor: '#1264e8', fillOpacity: .14 }} />}
        {buildingPolygon && <Polygon positions={buildingPolygon} pathOptions={{ color: '#f59e0b', weight: 3, fillColor: '#f59e0b', fillOpacity: .25, dashArray: '6 4' }} />}
      </MapContainer>
      <div className="map-toolbar"><span>+</span><span>−</span></div>
      <div className="map-scale">Zone-aware GIS view</div>
      {drawing && <div className="draw-hint">Click the map to add polygon points</div>}
    </div>
  );
}
