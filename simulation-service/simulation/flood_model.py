from .runoff_model import calculate_runoff
from .risk import calculate_risk
from .geometry import point_in_polygon


def _neighbors(r, c, rows, cols):
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols:
            yield nr, nc


def _elevation_grid(zone):
    return zone["elevationGrid"]


def propagate_flood(zone, rainfall_mm, duration_hours, intervention):
    grid = _elevation_grid(zone)
    rows = len(grid)
    cols = len(grid[0])
    depths = [[0.0 for _ in range(cols)] for _ in range(rows)]
    runoff_m3_total = 0.0
    land_use = zone.get("landUseGrid")
    intervention_type = intervention.get("type", "NONE")
    polygon = zone.get("polygon")
    minx, miny = zone["bounds"][0]
    maxx, maxy = zone["bounds"][1]
    cell_lon = (maxx - minx) / cols
    cell_lat = (maxy - miny) / rows
    active = set()

    for r in range(rows):
        for c in range(cols):
            cx = minx + (c + 0.5) * cell_lon
            cy = miny + (r + 0.5) * cell_lat
            if polygon and not point_in_polygon((cx, cy), polygon):
                continue
            active.add((r, c))
            lu = land_use[r][c]
            extra = 0.0
            if intervention_type == "BUILDING":
                footprint = intervention.get("drawnFootprint")
                if footprint:
                    extra = 0.18 if point_in_polygon((cx, cy), footprint) else 0.0
                elif 0.30 * rows <= r <= 0.65 * rows and 0.30 * cols <= c <= 0.65 * cols:
                    extra = 0.18
            elif intervention_type == "ROAD":
                if r in (int(rows * 0.45), int(rows * 0.5)):
                    extra = 0.04
            result = calculate_runoff(rainfall_mm, lu, extra, cell_area_m2=10000)
            runoff_m3_total += result["runoffM3"]
            base_depth = result["runoffM3"] / 10000
            depths[r][c] = base_depth * 2.8 * min(1.0, max(0.25, duration_hours / 6.0))

    for _ in range(6):
        transfer = [[0.0 for _ in range(cols)] for _ in range(rows)]
        for r, c in active:
            candidates = [p for p in _neighbors(r, c, rows, cols) if p in active]
            lower = [p for p in candidates if grid[p[0]][p[1]] < grid[r][c]]
            if lower:
                nr, nc = min(lower, key=lambda p: grid[p[0]][p[1]])
                amount = depths[r][c] * 0.16
                transfer[r][c] -= amount
                transfer[nr][nc] += amount
        for r, c in active:
            depths[r][c] = max(0.0, depths[r][c] + transfer[r][c])

    if intervention_type == "DRAINAGE":
        current = float(intervention.get("currentCapacity", 50))
        proposed = float(intervention.get("proposedCapacity", current))
        capacity_gain = max(0.0, proposed - current) / max(current, 1)
        for r, c in active:
            depths[r][c] *= max(0.30, 1.0 - 0.45 * capacity_gain)
    else:
        for r, c in active:
            drain_factor = 0.90 if grid[r][c] >= 905 else 0.96
            depths[r][c] *= drain_factor

    if intervention_type == "BUILDING":
        footprint = intervention.get("drawnFootprint")
        for r, c in active:
            cx = minx + (c + 0.5) * cell_lon
            cy = miny + (r + 0.5) * cell_lat
            if footprint:
                if point_in_polygon((cx, cy), footprint):
                    depths[r][c] *= 1.18
            elif 0.30 * rows <= r <= 0.65 * rows and 0.30 * cols <= c <= 0.65 * cols:
                depths[r][c] *= 1.18

    if intervention_type == "ROAD":
        for r, c in active:
            if r in (int(rows * 0.45), int(rows * 0.5)):
                depths[r][c] *= 1.04

    features = []
    flooded_cells = []
    max_depth = 0.0
    cell_area_m2 = ((maxx - minx) * 111320 / cols) * ((maxy - miny) * 110540 / rows)

    for r in range(rows):
        for c in range(cols):
            depth = depths[r][c]
            max_depth = max(max_depth, depth)
            if depth >= 0.1 and (r, c) in active:
                flooded_cells.append((r, c))
            lon0 = minx + c * cell_lon
            lat0 = miny + r * cell_lat
            lon1 = lon0 + cell_lon
            lat1 = lat0 + cell_lat
            features.append({
                "type": "Feature",
                "properties": {"row": r, "col": c, "waterDepth": round(depth, 3), "risk": calculate_risk(depth), "active": (r, c) in active},
                "geometry": {"type": "Polygon", "coordinates": [[[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]]}
            })

    affected_area_km2 = len(flooded_cells) * cell_area_m2 / 1_000_000
    return {
        "depths": depths,
        "activeCells": list(active),
        "maxDepth": round(max_depth, 3),
        "affectedAreaKm2": round(affected_area_km2, 3),
        "runoffM3": round(runoff_m3_total, 1),
        "floodGeoJson": {"type": "FeatureCollection", "features": features},
        "waterloggingCells": flooded_cells,
    }
