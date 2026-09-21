import React from "react";
export default function RoutingGraph({ routing, route }) {
  const graph = routing?.graph || route?.graph;
  if (!graph?.nodes?.length) return <div className="graph-empty">Run a simulation to build the road graph.</div>;

  const xs = graph.nodes.map(n => n.coordinates[0]);
  const ys = graph.nodes.map(n => n.coordinates[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = 620, height = 250, pad = 28;
  const point = (coords) => ({
    x: pad + ((coords[0] - minX) / Math.max(maxX - minX, 1e-9)) * (width - pad * 2),
    y: height - pad - ((coords[1] - minY) / Math.max(maxY - minY, 1e-9)) * (height - pad * 2),
  });
  const nodeById = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
  const origin = route?.originNode || routing?.suggestedOrigin;
  const destination = route?.destinationNode || routing?.suggestedDestination;
  const routeCoords = route?.route?.geometry?.coordinates || [];

  return (
    <div className="routing-graph-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="routing-graph">
        {graph.edges.map((e, i) => {
          const a = point(nodeById[e.from].coordinates);
          const b = point(nodeById[e.to].coordinates);
          const blocked = e.blocked;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={blocked ? 'edge-blocked' : 'edge-open'} />;
        })}
        {routeCoords.length > 1 && routeCoords.map((c, i) => {
          if (i === routeCoords.length - 1) return null;
          const a = point(c);
          const b = point(routeCoords[i + 1]);
          return <line key={`r${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="edge-route" />;
        })}
        {graph.nodes.map(n => {
          const p = point(n.coordinates);
          const cls = n.id === origin ? 'node-home' : n.id === destination ? 'node-safe' : 'node-default';
          return <circle key={n.id} cx={p.x} cy={p.y} r="5" className={cls} />;
        })}
      </svg>
      <div className="graph-legend"><span><i className="dot-home"/>HOME</span><span><i className="dot-safe"/>SAFE ZONE</span><span><i className="line-blocked"/>Flooded road</span><span><i className="line-route"/>A* route</span></div>
    </div>
  );
}
