def calculate_drainage_load(drainage_segments, runoff_total_m3, capacity_multiplier=1.0):
    if not drainage_segments:
        return [], 0
    total_base_capacity = sum(float(s.get("properties", {}).get("capacity", s.get("capacity", 50))) for s in drainage_segments)
    multiplier = max(0.1, capacity_multiplier)
    results = []
    overloads = 0
    for segment in drainage_segments:
        share = float(segment.get("properties", {}).get("capacity", segment.get("capacity", 50))) / total_base_capacity if total_base_capacity else 1 / len(drainage_segments)
        incoming = runoff_total_m3 * share * 0.004
        capacity = float(segment.get("properties", {}).get("capacity", segment.get("capacity", 50))) * multiplier
        utilization = incoming / capacity if capacity else 999
        overloaded = utilization >= 1.0
        overloads += int(overloaded)
        results.append({
            **segment,
            "incomingRunoff": round(incoming, 2),
            "effectiveCapacity": round(capacity, 2),
            "utilization": round(utilization, 2),
            "overloaded": overloaded,
        })
    return results, overloads
