import React from "react";
export default function WeatherChart({ weather, selectedYear, onSelect }) {
  const max = Math.max(...(weather?.events || []).map(e => e.rainfallMm), 1);
  return <div className="weather-chart">
    {(weather?.events || []).map(e => (
      <button key={e.year} className={`bar-col ${selectedYear === e.year ? 'selected' : ''}`} onClick={() => onSelect(e)} title={`${e.year}: ${e.rainfallMm} mm`}>
        <span className="bar-value">{e.rainfallMm}</span>
        <span className="bar" style={{ height: `${Math.max(10, e.rainfallMm / max * 130)}px` }} />
        <span className="bar-label">{e.year}</span>
      </button>
    ))}
  </div>;
}
