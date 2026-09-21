import math


def bbox(polygon):
    coords = polygon.get("coordinates", []) if isinstance(polygon, dict) else polygon
    if coords and isinstance(coords[0][0], (int, float)):
        ring = coords
    else:
        ring = coords[0] if coords else []
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    if not xs or not ys:
        raise ValueError("Polygon has no coordinates")
    return min(xs), min(ys), max(xs), max(ys)


def point_in_polygon(point, polygon):
    x, y = point
    coords = polygon.get("coordinates", []) if isinstance(polygon, dict) else polygon
    ring = coords[0] if coords else []
    inside = False
    if len(ring) < 3:
        return False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        intersects = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-15) + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


def point_to_segment_distance(point, a, b):
    px, py = point
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def line_intersects_polygon(coords, polygon):
    if not coords:
        return False
    if any(point_in_polygon(p, polygon) for p in coords):
        return True
    poly = polygon.get("coordinates", [])[0]
    if not poly:
        return False
    for p in coords:
        for i in range(len(poly) - 1):
            if point_to_segment_distance(p, poly[i], poly[i + 1]) < 0.00015:
                return True
    return False


def feature_intersects_polygon(feature, polygon):
    geometry = feature.get("geometry", {})
    coords = geometry.get("coordinates", [])
    kind = geometry.get("type")
    if kind == "Point":
        return point_in_polygon(coords, polygon)
    if kind == "LineString":
        return line_intersects_polygon(coords, polygon)
    if kind == "Polygon":
        ring = coords[0] if coords else []
        return any(point_in_polygon(p, polygon) for p in ring) or (ring and point_in_polygon(ring[0], polygon))
    return False
