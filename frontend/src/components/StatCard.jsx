import React from "react";
export default function StatCard({ label, value, unit, accent }) {
  return <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value" data-accent={accent ? 'true' : 'false'}>{value} <small>{unit}</small></div>
  </div>;
}
