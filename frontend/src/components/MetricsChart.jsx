import React from "react";
export default function MetricsChart({ result }) {
  if (!result?.chart) return <div className="graph-empty">Run a simulation to see the response graph.</div>;
  const items = [
    ['Rainfall', result.chart.rainfallMm, 'mm'],
    ['Runoff', result.chart.runoffM3, 'm³'],
    ['Max depth', result.chart.maxDepthM, 'm'],
    ['Affected area', result.chart.affectedAreaKm2, 'km²'],
  ];
  const max = Math.max(...items.map(x => Number(x[1]) || 0), 1);
  return <div className="metric-chart">
    {items.map(([label, value, unit]) => <div className="metric-bar" key={label}>
      <div className="metric-value">{value} <small>{unit}</small></div>
      <div className="metric-track"><i style={{height: `${Math.max(8, (Number(value) / max) * 100)}%`}}/></div>
      <div className="metric-label">{label}</div>
    </div>)}
  </div>;
}
