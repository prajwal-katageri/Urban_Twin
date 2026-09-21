from .flood_model import propagate_flood
from .drainage_model import calculate_drainage_load
from .traffic_model import calculate_traffic_impact
from .risk import calculate_risk
from .routing import find_safe_route
from .geometry import point_in_polygon, feature_intersects_polygon


def _point_features(zone, cells, label):
    features = []
    minx, miny = zone["bounds"][0]
    maxx, maxy = zone["bounds"][1]
    rows = len(zone["elevationGrid"])
    cols = len(zone["elevationGrid"][0])
    dx = (maxx - minx) / cols
    dy = (maxy - miny) / rows
    for r, c in cells:
        features.append({
            "type": "Feature",
            "properties": {"type": label, "row": r, "col": c},
            "geometry": {"type": "Point", "coordinates": [minx + (c + 0.5) * dx, miny + (r + 0.5) * dy]},
        })
    return {"type": "FeatureCollection", "features": features}


def _affected_road_geojson(roads, flood_result, zone):
    features = []
    flooded = set(flood_result["waterloggingCells"])
    depths = flood_result["depths"]
    minx, miny = zone["bounds"][0]
    maxx, maxy = zone["bounds"][1]
    rows = len(depths)
    cols = len(depths[0])
    dx = (maxx - minx) / cols
    dy = (maxy - miny) / rows

    def road_is_affected(coords):
        samples = []
        for i in range(21):
            t = i / 20
            if len(coords) == 1:
                samples.append(coords[0])
            else:
                x = coords[0][0] + (coords[-1][0] - coords[0][0]) * t
                y = coords[0][1] + (coords[-1][1] - coords[0][1]) * t
                samples.append((x, y))
        wet = 0
        for x, y in samples:
            c = min(cols - 1, max(0, int((x - minx) / dx)))
            r = min(rows - 1, max(0, int((y - miny) / dy)))
            if depths[r][c] >= 0.30:
                wet += 1
        return wet / max(1, len(samples)) >= 0.20


    for road in roads:
        coords = road["geometry"]["coordinates"]
        if road_is_affected(coords):
            props = road.get("properties", {})
            features.append({"type": "Feature", "properties": {"id": props.get("id"), "name": props.get("name"), "blocked": True}, "geometry": road["geometry"]})
    return {"type": "FeatureCollection", "features": features}


def _build_routing_summary(roads, blocked):
    if not roads:
        return {"status": "NO_ROADS", "graph": {"nodes": [], "edges": []}}
    start = roads[0]["geometry"]["coordinates"][0]
    end = roads[-1]["geometry"]["coordinates"][-1]
    base = find_safe_route(roads, start, end, [], "dijkstra")
    blocked_graph = find_safe_route(roads, start, end, blocked, "astar")
    graph = blocked_graph.get("graph", base.get("graph", {"nodes": [], "edges": []}))
    nodes = graph.get("nodes", [])
    suggested_origin = blocked_graph.get("originNode") or (nodes[0]["id"] if nodes else None)
    suggested_destination = blocked_graph.get("destinationNode") or (nodes[-1]["id"] if nodes else None)
    if blocked_graph.get("status") != "ROUTE_FOUND" and len(nodes) > 1:
        best = None
        for i, a in enumerate(nodes):
            for b in nodes[i + 1:]:
                candidate = find_safe_route(roads, a["coordinates"], b["coordinates"], blocked, "astar")
                if candidate.get("status") == "ROUTE_FOUND":
                    score = candidate.get("distanceKm", 0)
                    if best is None or score > best[0]:
                        best = (score, a["id"], b["id"], a["coordinates"], b["coordinates"])
        if best:
            suggested_origin, suggested_destination = best[1], best[2]
            blocked_graph = find_safe_route(roads, best[3], best[4], blocked, "astar")
    return {
        "status": blocked_graph.get("status"),
        "algorithm": "A*",
        "graph": graph,
        "suggestedOrigin": suggested_origin,
        "suggestedDestination": suggested_destination,
        "baselineDistanceKm": base.get("distanceKm", 0),
        "blockedRoads": blocked,
    }


def simulate(zone, weather, intervention):
    rainfall = float(weather.get("rainfallMm", 120))
    duration = float(weather.get("durationHours", 6))
    flood = propagate_flood(zone, rainfall, duration, intervention)
    multiplier = 1.0
    if intervention.get("type") == "DRAINAGE":
        current = float(intervention.get("currentCapacity", 50))
        proposed = float(intervention.get("proposedCapacity", current))
        multiplier = max(0.1, proposed / max(current, 1))

    drainage, overloads = calculate_drainage_load(zone["drainage"]["features"], flood["runoffM3"], multiplier)
    buildings_at_risk = 0
    building_risk_features = []
    minx, miny = zone["bounds"][0]
    maxx, maxy = zone["bounds"][1]
    rows = len(flood["depths"])
    cols = len(flood["depths"][0])
    dx = (maxx - minx) / cols
    dy = (maxy - miny) / rows

    for b in zone["buildings"]["features"]:
        coords = b["geometry"]["coordinates"][0]
        cx = sum(p[0] for p in coords[:-1]) / max(1, len(coords) - 1)
        cy = sum(p[1] for p in coords[:-1]) / max(1, len(coords) - 1)
        c = min(cols - 1, max(0, int((cx - minx) / dx)))
        r = min(rows - 1, max(0, int((cy - miny) / dy)))
        depth = flood["depths"][r][c]
        if depth >= 0.3:
            buildings_at_risk += 1
            building_risk_features.append({"type": "Feature", "properties": {**b.get("properties", {}), "waterDepth": round(depth, 3), "risk": calculate_risk(depth)}, "geometry": b["geometry"]})

    affected_roads = _affected_road_geojson(zone["roads"]["features"], flood, zone)
    blocked_ids = [f["properties"]["id"] for f in affected_roads["features"]]
    traffic = calculate_traffic_impact(zone["roads"]["features"], intervention)
    high_cells = [(r, c) for r, c in flood["waterloggingCells"] if flood["depths"][r][c] >= 0.3]
    risk = calculate_risk(flood["maxDepth"])
    routing = _build_routing_summary(zone["roads"]["features"], blocked_ids)

    return {
        "zoneId": zone["id"],
        "zoneName": zone["name"],
        "scenarioName": intervention.get("name", intervention.get("type", "Baseline")),
        "floodRisk": risk,
        "maxWaterDepth": flood["maxDepth"],
        "affectedAreaKm2": flood["affectedAreaKm2"],
        "runoffM3": flood["runoffM3"],
        "buildingsAtRisk": buildings_at_risk,
        "waterloggingPoints": len(high_cells),
        "drainageOverloads": overloads,
        "affectedRoads": len(affected_roads["features"]),
        "floodGeoJson": flood["floodGeoJson"],
        "affectedRoadGeoJson": affected_roads,
        "waterloggingGeoJson": _point_features(zone, high_cells, "waterlogging"),
        "buildingRiskGeoJson": {"type": "FeatureCollection", "features": building_risk_features},
        "drainageGeoJson": {"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": d, "geometry": {"type": "Point", "coordinates": d["geometry"]["coordinates"][0]}} for d in drainage if d["overloaded"]
        ]},
        "traffic": traffic,
        "drainage": drainage,
        "routing": routing,
        "chart": {
            "rainfallMm": rainfall,
            "runoffM3": round(flood["runoffM3"], 1),
            "maxDepthM": flood["maxDepth"],
            "affectedAreaKm2": flood["affectedAreaKm2"],
            "buildingsAtRisk": buildings_at_risk,
            "blockedRoads": len(blocked_ids),
        },
        "assumptions": {
            "runoffCoefficients": {"vegetation": 0.2, "soil": 0.4, "road": 0.8, "concrete": 0.85},
            "routing": "Road intersections are graph nodes and road segments are graph edges. Blocked/flooded roads are removed from the routing graph. A* is used for safe-route calculation.",
            "model": "Zone-agnostic grid-based elevation flow approximation with simplified drainage removal.",
        },
    }


def compare_scenarios(zone, weather, scenarios):
    results = []
    for scenario in scenarios:
        intervention = scenario.get("intervention", {"type": "NONE"})
        result = simulate(zone, weather, intervention)
        result["scenarioName"] = scenario["name"]
        results.append({"id": scenario["id"], "name": scenario["name"], "intervention": intervention, "result": result})
    return results
