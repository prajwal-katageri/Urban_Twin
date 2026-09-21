from simulation.runoff_model import calculate_runoff
from simulation.flood_model import propagate_flood
from simulation.drainage_model import calculate_drainage_load
from simulation.risk import calculate_risk
from simulation.routing import find_safe_route
from simulation.scenario_engine import compare_scenarios
from simulation.data_loader import load_zone


def test_runoff_calculation():
    result = calculate_runoff(100, "ROAD")
    assert result["runoffMm"] == 80
    assert result["runoffM3"] == 800


def test_flood_propagation_produces_depth():
    zone = load_zone("bengaluru-pilot")
    result = propagate_flood(zone, 120, 6, {"type": "BUILDING", "footprintArea": 1200, "floors": 10, "material": "CONCRETE"})
    assert result["maxDepth"] > 0
    assert result["floodGeoJson"]["features"]


def test_drainage_overload():
    segments = [{"id": "d1", "capacity": 50, "geometry": {"type": "LineString", "coordinates": [[77.55,12.96],[77.551,12.961]]}}]
    results, overloads = calculate_drainage_load(segments, 15000, 1)
    assert overloads == 1
    assert results[0]["overloaded"] is True


def test_risk_thresholds():
    assert calculate_risk(0.05) == "LOW"
    assert calculate_risk(0.7) == "MODERATE"
    assert calculate_risk(1.2) == "HIGH"
    assert calculate_risk(2.2) == "SEVERE"


def test_routing():
    zone = load_zone("bengaluru-pilot")
    roads = zone["roads"]["features"]
    result = find_safe_route(roads, roads[0]["geometry"]["coordinates"][0], roads[-1]["geometry"]["coordinates"][-1], [])
    assert result["status"] == "ROUTE_FOUND"
    assert result["route"]["geometry"]["coordinates"]


def test_scenario_comparison_changes_results():
    zone = load_zone("bengaluru-pilot")
    scenarios = [
        {"id": "baseline", "name": "Baseline", "intervention": {"type": "NONE"}},
        {"id": "drainage", "name": "Drainage +", "intervention": {"type": "DRAINAGE", "currentCapacity": 50, "proposedCapacity": 80}},
    ]
    result = compare_scenarios(zone, {"rainfallMm": 140, "durationHours": 6}, scenarios)
    assert len(result) == 2
    assert result[0]["result"]["maxWaterDepth"] != result[1]["result"]["maxWaterDepth"]


def test_custom_zone_is_supported_and_generates_graph():
    from simulation.data_loader import load_custom_zone
    polygon = {
        "type": "Polygon",
        "coordinates": [[[77.60, 12.90], [77.63, 12.90], [77.63, 12.93], [77.60, 12.93], [77.60, 12.90]]]
    }
    zone = load_custom_zone(polygon)
    result = compare_scenarios(zone, {"rainfallMm": 140, "durationHours": 6}, [
        {"id": "baseline", "name": "Baseline", "intervention": {"type": "NONE"}}
    ])[0]["result"]
    assert result["zoneId"] == "custom"
    assert result["routing"]["graph"]["nodes"]
    assert result["routing"]["graph"]["edges"]
