# UrbanTwin — Simulate Before You Build

UrbanTwin is a Smart India Hackathon prototype for predictive urban infrastructure planning. It provides a GIS-style digital twin where a planner can select an existing zone **or draw any polygon**, propose an intervention, simulate flood/drainage/accessibility effects, calculate a flood-response route, compare scenarios, and export a screening report.

## Key flow

**SELECT / DRAW ZONE → PROPOSE → SIMULATE → SEE IMPACT → ROUTE AROUND FLOODING → COMPARE**

## Important upgrade in this version

### Zone-agnostic
The simulation is no longer hard-coded to a single Bengaluru pilot area. The same Python engine accepts:

- predefined demo zones
- a user-drawn GeoJSON polygon of any shape
- different polygon sizes and locations

For a custom polygon, the engine dynamically creates a representative elevation grid, land-use grid, buildings, roads and drainage network inside the selected extent. These are explicitly **synthetic/representative demo data**, not official municipal or IMD data.

### Flood-response routing
The road network is converted into a graph:

```text
Intersections = nodes
Road segments = edges
Flooded/inaccessible roads = blocked edges
```

The routing module supports **Dijkstra and A***. A blocked road is removed from the routing graph for safe-route calculation.

Example:

```text
HOME
  │
Road A  ❌ flooded
  │
Road B  ✓ accessible
  │
Road C  ❌ flooded
  │
SAFE ZONE ✓
```

The dashboard displays the graph, blocked roads and the calculated route.

## Architecture

```text
React + Leaflet
      │
      │ REST JSON
      ▼
Flask API :5000
      │
      ▼
Python simulation engine
  ├── runoff_model.py
  ├── flood_model.py
  ├── drainage_model.py
  ├── traffic_model.py
  ├── routing.py
  ├── scenario_engine.py
  ├── geometry.py
  └── risk.py
      │
      ▼
GeoJSON + metrics + routing graph
      │
      ▼
React map + charts + route graph + comparison
```

There is **no Spring Boot, Java, Maven, PostgreSQL or port 8080 dependency** in this version.

## Folder structure

```text
UrbanTwin/
├── README.md
├── run-simulation.bat
├── run-frontend.bat
├── frontend/
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── styles.css
│       ├── services/api.js
│       └── components/
│           ├── MapView.jsx
│           ├── RoutingGraph.jsx
│           ├── MetricsChart.jsx
│           ├── WeatherChart.jsx
│           ├── Legend.jsx
│           └── StatCard.jsx
└── simulation-service/
    ├── app.py
    ├── requirements.txt
    ├── simulation/
    │   ├── config.py
    │   ├── data_loader.py
    │   ├── geometry.py
    │   ├── runoff_model.py
    │   ├── flood_model.py
    │   ├── drainage_model.py
    │   ├── traffic_model.py
    │   ├── routing.py
    │   ├── risk.py
    │   └── scenario_engine.py
    ├── data/
    │   ├── zones/bengaluru-pilot.json
    │   └── weather/bengaluru-pilot.json
    └── tests/
```

## Run locally

### Terminal 1 — Python simulation

```powershell
cd C:\Users\POOJA\Downloads\UrbanTwin\UrbanTwin\simulation-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Flask runs at:

```text
http://localhost:5000
```

### Terminal 2 — React dashboard

```powershell
cd C:\Users\POOJA\Downloads\UrbanTwin\UrbanTwin\frontend
npm install
npm run dev
```

Vite normally runs at:

```text
http://localhost:5173
```

No Java/Spring Boot terminal is required.

## Custom area workflow

1. Select **Custom Area (Draw)** or click **Draw Any Area**.
2. Click at least three points on the Leaflet map.
3. Click **Finish Polygon**.
4. UrbanTwin sends the polygon as GeoJSON to Flask.
5. Flask creates a simulation zone from that polygon.
6. The selected area is displayed in km².
7. Buildings, roads, drainage and elevation are generated inside that zone.
8. Run the simulation.
9. The flood model only calculates active cells belonging to the selected polygon.
10. The routing graph is built from the active zone's road network.

## Flood model

This is intentionally a lightweight screening model, not CFD.

```text
runoff = rainfall × runoff coefficient
```

Prototype coefficients:

- vegetation = 0.20
- soil = 0.40
- road = 0.80
- concrete = 0.85

Water is moved toward lower neighboring cells, then simplified drainage removal is applied. Depth is converted to LOW / MODERATE / HIGH / SEVERE risk classes.

## Flood-response routing

After simulation, affected roads are detected from predicted waterlogging.

The graph contains:

```text
Node:
  N1, N2, N3 ...

Edge:
  road ID
  road name
  length
  speed
  blocked status
```

The routing panel allows:

- HOME node selection
- SAFE ZONE node selection
- A* or Dijkstra
- safe-route calculation
- distance and travel time
- number of flooded roads avoided

The graph visualization shows:

- blue node = HOME
- green node = SAFE ZONE
- red dashed edge = flooded/inaccessible road
- green edge = calculated route

## Graphs in the dashboard

The dashboard now provides three graph-oriented outputs:

1. **Response Graph** — rainfall, runoff, maximum water depth and affected area.
2. **Road Network Graph** — nodes, edges, blocked roads and safe route.
3. **Scenario Comparison Graph** — maximum depth comparison across baseline/building/drainage/road scenarios.

## API

- `GET /api/health`
- `GET /api/zones`
- `GET /api/zones/{id}`
- `GET /api/weather/{zoneId}`
- `POST /api/preview-area`
- `POST /api/simulate`
- `POST /api/route`
- `POST /api/compare`

### Custom-area simulation example

```json
{
  "zoneId": "custom",
  "selectedArea": {
    "type": "Polygon",
    "coordinates": [[
      [77.56, 12.95],
      [77.60, 12.95],
      [77.60, 12.98],
      [77.56, 12.98],
      [77.56, 12.95]
    ]]
  },
  "weather": {
    "rainfallMm": 160,
    "durationHours": 6
  },
  "intervention": {
    "type": "BUILDING",
    "footprintArea": 1200,
    "floors": 10,
    "material": "CONCRETE"
  }
}
```

## Data disclaimer

The included datasets are representative/synthetic prototype data. The project does **not** claim that the included rainfall, elevation, buildings, roads, drainage or traffic values are official IMD, BBMP, municipal or other authoritative datasets.

The architecture is designed so authoritative DEM, rainfall, OSM, building and drainage layers can replace the demo generator later.

## Scope and limitations

- prototype screening model
- not CFD
- not engineering certified
- no live sensor stream
- no official emergency routing
- representative demo data
- no full IFC/3D structural simulation
- no city-wide calibration

For the SIH demonstration, describe results as **relative scenario impacts** rather than certified predictions.

## Tests

After installing requirements:

```powershell
cd simulation-service
pytest -q
```

The tests cover runoff, flood propagation, drainage overload, risk thresholds, routing and scenario comparison.

## Real-data mode

This build defaults to real-data retrieval. See `REAL_DATA.md`. The application uses OpenStreetMap for roads/buildings, Open-Meteo's elevation service backed by Copernicus DEM GLO-90, and Open-Meteo historical ERA5-Land reanalysis for rainfall events. Custom drawn polygons drive the spatial data retrieval. OSM waterways are used only as a mapped hydrology/drainage proxy unless authoritative municipal storm-drain data are supplied.

### Authoritative-source references

- Greater Bengaluru Authority GIS viewer: https://bbmp.gov.in/gisviewer/
- Greater Bengaluru Authority corporation map downloads: https://www.bbmp.gov.in/maps/
- KSNDMC weather/rainfall: https://ksndmc.org/en/Activities/Weather
- ISRO/NRSC Bhuvan: https://bhuvan.nrsc.gov.in/
