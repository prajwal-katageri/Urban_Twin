"""Warm the real-data cache for a GeoJSON polygon file.
Usage:
  python scripts/download_real_data.py data/areas/bengaluru.geojson
The running app can also fetch these datasets automatically for every drawn polygon.
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "simulation-service"))
from simulation.real_data import fetch_osm_features, fetch_elevation_grid, fetch_weather_events

if len(sys.argv) != 2:
    raise SystemExit("Provide a GeoJSON Feature or Polygon file")
obj = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if obj.get("type") == "Feature": obj = obj["geometry"]
if obj.get("type") == "FeatureCollection": obj = obj["features"][0]["geometry"]
print("Fetching OpenStreetMap...")
fetch_osm_features(obj)
print("Fetching Copernicus GLO-90 elevation through Open-Meteo...")
fetch_elevation_grid(obj)
print("Fetching 2015-2024 ERA5-Land rainfall...")
fetch_weather_events(obj)
print("Real-data cache ready.")
