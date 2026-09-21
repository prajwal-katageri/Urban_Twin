import json
import math
import os
from pathlib import Path
from .geometry import bbox, point_in_polygon, feature_intersects_polygon
from .real_data import fetch_osm_features, fetch_elevation_grid, fetch_weather_events

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
GRID_SIZE = 12

ZONE_CATALOG = [
    {"id": "indiranagar", "name": "Indiranagar", "city": "Bengaluru", "center": [77.6408, 12.9784]},
    {"id": "hsr-layout", "name": "HSR Layout", "city": "Bengaluru", "center": [77.6382, 12.9116]},
    {"id": "koramangala", "name": "Koramangala", "city": "Bengaluru", "center": [77.6245, 12.9352]},
    {"id": "whitefield", "name": "Whitefield", "city": "Bengaluru", "center": [77.7500, 12.9698]},
    {"id": "electronic-city", "name": "Electronic City", "city": "Bengaluru", "center": [77.6630, 12.8450]},
]


def load_json(relative_path):
    with open(DATA_DIR / relative_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _rectangle(center, size=0.012):
    lon, lat = center
    half = size / 2
    return {"type": "Polygon", "coordinates": [[[lon-half, lat-half], [lon+half, lat-half], [lon+half, lat+half], [lon-half, lat+half], [lon-half, lat-half]]]}


def _grid_land_use(polygon, roads, buildings, rows=GRID_SIZE, cols=GRID_SIZE):
    minx, miny, maxx, maxy = bbox(polygon)
    road_shapes = []
    building_shapes = []
    from shapely.geometry import shape
    for f in roads.get("features", []):
        road_shapes.append(shape(f["geometry"]).buffer(0.00004))
    for f in buildings.get("features", []):
        building_shapes.append(shape(f["geometry"]))
    grid = []
    for r in range(rows):
        row = []
        for c in range(cols):
            x = minx + (c + 0.5) * (maxx - minx) / cols
            y = miny + (r + 0.5) * (maxy - miny) / rows
            point = __import__("shapely.geometry", fromlist=["Point"]).Point(x, y)
            if any(g.contains(point) for g in building_shapes):
                row.append("CONCRETE")
            elif any(g.contains(point) for g in road_shapes):
                row.append("ROAD")
            else:
                row.append("VEGETATION")
        grid.append(row)
    return grid


def _real_zone(zone_id, name, city, polygon):
    minx, miny, maxx, maxy = bbox(polygon)
    osm = fetch_osm_features(polygon)
    elevation = fetch_elevation_grid(polygon, GRID_SIZE, GRID_SIZE)
    roads = osm["roads"]
    buildings = osm["buildings"]
    waterways = osm["waterways"]
    land_use = _grid_land_use(polygon, roads, buildings, GRID_SIZE, GRID_SIZE)

    # OSM waterways are real mapped geometry but not necessarily storm drains. Their capacity is explicitly estimated.
    drainage = {"type": "FeatureCollection", "features": waterways.get("features", [])}
    weather = fetch_weather_events(polygon)

    return {
        "id": zone_id,
        "name": name,
        "city": city,
        "description": "Zone-agnostic urban digital twin using live-fetched real geospatial data where available.",
        "dataLabel": "REAL DATA MODE",
        "bounds": [[minx, miny], [maxx, maxy]],
        "polygon": polygon,
        "elevationGrid": elevation,
        "landUseGrid": land_use,
        "roads": roads,
        "buildings": buildings,
        "drainage": drainage,
        "weather": weather,
        "sources": {
            "mode": "REAL",
            "roads": "OpenStreetMap",
            "buildings": "OpenStreetMap",
            "waterways": "OpenStreetMap; used as drainage/hydrology proxy unless authoritative municipal storm-drain data is supplied",
            "elevation": "Open-Meteo Elevation API using Copernicus DEM GLO-90",
            "rainfall": "Open-Meteo Historical Weather API / ERA5-Land reanalysis",
            "traffic": "OSM highway-class proxy; not observed traffic counts",
        },
    }


def _demo_zone(zone_id, name, city, polygon, seed=1):
    minx, miny, maxx, maxy = bbox(polygon)
    width = max(maxx - minx, 0.002)
    height = max(maxy - miny, 0.002)
    cell_lon = width / GRID_SIZE
    cell_lat = height / GRID_SIZE
    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2
    elevation = []
    land_use = []
    for r in range(GRID_SIZE):
        erow, lrow = [], []
        for c in range(GRID_SIZE):
            x = minx + (c + 0.5) * cell_lon
            y = miny + (r + 0.5) * cell_lat
            radial = ((x-cx)/width)**2 + ((y-cy)/height)**2
            wave = 2.8*math.sin((c+seed)*0.8)+1.7*math.cos((r+seed)*0.55)
            erow.append(round(900-34*max(0,1-2.2*radial)+wave,2))
            lrow.append("ROAD" if c in (3,9) or r in (5,10) else ("CONCRETE" if 5<=c<=8 and 5<=r<=8 else ("SOIL" if (r+c+seed)%5==0 else "VEGETATION")))
        elevation.append(erow); land_use.append(lrow)
    roads=[]; rid=1
    for r in (2,5,8,11):
        y=miny+(r+.5)*cell_lat; roads.append(_line_feature(f"R{rid}",f"Road {rid}",[[minx,y],[maxx,y]],8 if r!=5 else 10,350+rid*70,28+(rid%3)*4)); rid+=1
    for c in (2,5,8,11):
        x=minx+(c+.5)*cell_lon; roads.append(_line_feature(f"R{rid}",f"Road {rid}",[[x,miny],[x,maxy]],8,320+rid*60,30+(rid%3)*4)); rid+=1
    buildings=[]; bid=1
    for r in range(2,12,3):
        for c in range(1,12,3):
            x0=minx+c*cell_lon+cell_lon*.15; y0=miny+r*cell_lat+cell_lat*.15; x1=x0+cell_lon*.65; y1=y0+cell_lat*.65
            f={"type":"Feature","properties":{"id":f"B{bid}","name":f"Building {bid}","floors":3+(bid%6),"use":"Mixed Use"},"geometry":{"type":"Polygon","coordinates":[[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]]}}
            if feature_intersects_polygon(f,polygon): buildings.append(f)
            bid+=1
    drainage=[]
    for i,r in enumerate((3,7,11),1):
        y=miny+(r+.5)*cell_lat; drainage.append(_line_feature(f"D{i}",f"Drain {i}",[[minx,y],[maxx,y]],0,0,0,capacity=55+i*5))
    return {"id":zone_id,"name":name,"city":city,"description":"Zone-agnostic representative fallback area.","dataLabel":"DEMO FALLBACK","bounds":[[minx,miny],[maxx,maxy]],"polygon":polygon,"elevationGrid":elevation,"landUseGrid":land_use,"roads":{"type":"FeatureCollection","features":roads},"buildings":{"type":"FeatureCollection","features":buildings},"drainage":{"type":"FeatureCollection","features":drainage},"weather":{"zoneId":zone_id,"events":[{"year":2015+i,"rainfallMm":v,"durationHours":6,"source":"DEMO FALLBACK","sourceType":"DEMO"} for i,v in enumerate([70,90,120,150,180,100,135,210,80,115])]},"sources":{"mode":"DEMO","note":"Fallback only. Set URBANTWIN_DATA_MODE=REAL for live real-data retrieval."}}


def _line_feature(fid,name,coords,width=8,traffic=400,speed=30,capacity=None):
    props={"id":fid,"name":name,"width":width,"trafficVolume":traffic,"speedKph":speed,"lengthKm":1.0}
    if capacity is not None: props["capacity"]=capacity
    return {"type":"Feature","properties":props,"geometry":{"type":"LineString","coordinates":coords}}


def load_zone(zone_id):
    if zone_id == "bengaluru-pilot":
        pilot = load_json("zones/bengaluru-pilot.json")

        polygon = pilot.get("polygon")

        if not polygon:
            bounds = pilot.get("bounds")

            if not bounds or len(bounds) != 2:
                raise ValueError(
                    "bengaluru-pilot.json must contain either polygon or valid bounds"
                )

            minx, miny = bounds[0]
            maxx, maxy = bounds[1]

            polygon = {
                "type": "Polygon",
                "coordinates": [[
                    [minx, miny],
                    [maxx, miny],
                    [maxx, maxy],
                    [minx, maxy],
                    [minx, miny]
                ]]
            }

        try:
            return _real_zone(
                "bengaluru-pilot",
                "Bengaluru Pilot Zone",
                "Bengaluru",
                polygon
            )

        except Exception:
            if os.getenv("URBANTWIN_DATA_MODE", "REAL").upper() == "DEMO":
                pilot["polygon"] = polygon
                return pilot

            raise

    for item in ZONE_CATALOG:
        if item["id"] == zone_id:
            polygon = _rectangle(item["center"])

            try:
                return _real_zone(
                    item["id"],
                    item["name"],
                    item["city"],
                    polygon
                )

            except Exception:
                if os.getenv("URBANTWIN_DATA_MODE", "REAL").upper() == "DEMO":
                    return _demo_zone(
                        item["id"],
                        item["name"],
                        item["city"],
                        polygon
                    )

                raise

    raise ValueError(f"Unknown zone: {zone_id}")

def load_custom_zone(polygon, name="Custom Area", city="User Selected Area"):
    if not polygon or polygon.get("type") != "Polygon": raise ValueError("selectedArea must be a GeoJSON Polygon")
    coords=polygon.get("coordinates",[])
    if not coords or len(coords[0])<4: raise ValueError("A polygon needs at least three points")
    try:
        return _real_zone("custom", name, city, polygon)
    except Exception as exc:
        if __import__("os").getenv("URBANTWIN_DATA_MODE", "REAL").upper() == "DEMO":
            return _demo_zone("custom", name, city, polygon, 7)
        raise RuntimeError(f"Real-data retrieval failed: {exc}. Check internet access or set URBANTWIN_DATA_MODE=DEMO for prototype fallback.")


def load_weather(zone_id):
    zone = load_zone(zone_id)
    return zone.get("weather", {"events": []})
