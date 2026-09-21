import React from "react";
export default function Legend() {
  return <div className="legend-card"><strong>Water Depth (m)</strong><div className="legend-row"><i className="l5" /> &gt; 2.0</div><div className="legend-row"><i className="l4" /> 1.0 – 2.0</div><div className="legend-row"><i className="l3" /> 0.5 – 1.0</div><div className="legend-row"><i className="l2" /> 0.1 – 0.5</div><div className="legend-row"><i className="l1" /> &lt; 0.1</div></div>;
}
