import json
import os
import time
import hashlib
from pathlib import Path
from typing import Tuple

import requests
from shapely.geometry import shape

from .geometry import bbox


# ============================================================
# DIRECTORIES
# ============================================================

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

CACHE_DIR = DATA_DIR / "real_cache"

CACHE_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# API CONFIGURATION
# ============================================================

OVERPASS_URL = os.getenv(
    "OVERPASS_URL",
    "https://overpass.private.coffee/api/interpreter"
)

OPEN_METEO_BASE = (
    "https://api.open-meteo.com/v1"
)

OPEN_METEO_ARCHIVE = (
    "https://archive-api.open-meteo.com/v1/archive"
)

REQUEST_TIMEOUT = int(
    os.getenv(
        "REAL_DATA_TIMEOUT_SECONDS",
        "60"
    )
)


# ============================================================
# ROAD DEFAULT SPEEDS
# ============================================================

ROAD_DEFAULT_SPEED = {
    "motorway": 80,
    "trunk": 60,
    "primary": 50,
    "secondary": 40,
    "tertiary": 35,
    "unclassified": 30,
    "residential": 25,
    "living_street": 15,
    "service": 15,
    "road": 25,
}


# ============================================================
# MODE
# ============================================================

def _mode():
    return os.getenv(
        "URBANTWIN_DATA_MODE",
        "REAL"
    ).upper()


# ============================================================
# CACHE
# ============================================================

def _cache_key(
    prefix: str,
    polygon: dict,
    extra: str = ""
) -> str:

    raw = json.dumps(
        polygon,
        sort_keys=True,
        separators=(",", ":")
    )

    digest = hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()[:16]

    if extra:
        return f"{prefix}_{digest}_{extra}"

    return f"{prefix}_{digest}"


def _read_cache(name: str):

    path = CACHE_DIR / f"{name}.json"

    if not path.exists():
        return None

    try:

        return json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )

    except Exception:

        return None


def _write_cache(
    name: str,
    data
):

    path = CACHE_DIR / f"{name}.json"

    path.write_text(
        json.dumps(
            data
        ),
        encoding="utf-8"
    )

    return data


# ============================================================
# HTTP REQUEST
# ============================================================

def _request_json(
    url,
    params=None,
    data=None,
    timeout=None
):

    headers = {
        "User-Agent":
            "UrbanTwin/1.0 "
            "(Smart India Hackathon 2026 prototype)",

        "Accept":
            "application/json",

        "Referer":
            "http://localhost:5173/"
    }

    if timeout is None:
        timeout = REQUEST_TIMEOUT

    last_error = None

    for attempt in range(3):

        try:

            # ------------------------------------------------
            # GET is used for Open-Meteo APIs.
            # POST is used for Overpass.
            # ------------------------------------------------

            if data is not None:

                response = requests.post(
                    url,
                    data=data,
                    headers=headers,
                    timeout=timeout
                )

            else:

                response = requests.get(
                    url,
                    params=params,
                    headers=headers,
                    timeout=timeout
                )

            response.raise_for_status()

            return response.json()

        except Exception as exc:

            last_error = exc

            print(
                f"Request failed "
                f"(attempt {attempt + 1}/3): {exc}"
            )

            if attempt < 2:

                time.sleep(
                    1.5 * (attempt + 1)
                )

    raise last_error


# ============================================================
# GEOMETRY
# ============================================================

def _bbox(
    polygon: dict
) -> Tuple[
    float,
    float,
    float,
    float
]:

    geom = shape(
        polygon
    )

    return geom.bounds


# ============================================================
# OSM PARSER
# ============================================================

def _parse_osm_data(
    data,
    polygon
):

    roads = []
    buildings = []
    waterways = []

    polygon_geom = shape(
        polygon
    )

    for element in data.get(
        "elements",
        []
    ):

        if element.get(
            "type"
        ) != "way":

            continue

        geometry = element.get(
            "geometry",
            []
        )

        tags = element.get(
            "tags",
            {}
        )

        if len(geometry) < 2:
            continue

        coordinates = []

        for point in geometry:

            if (
                "lon" not in point
                or "lat" not in point
            ):
                continue

            coordinates.append([
                point["lon"],
                point["lat"]
            ])

        if len(coordinates) < 2:
            continue

        highway = tags.get(
            "highway"
        )

        building = tags.get(
            "building"
        )

        waterway = tags.get(
            "waterway"
        )

        # ====================================================
        # ROADS
        # ====================================================

        if highway:

            road_geometry = {
                "type": "LineString",
                "coordinates": coordinates
            }

            try:

                if not shape(
                    road_geometry
                ).intersects(
                    polygon_geom
                ):
                    continue

            except Exception:

                continue

            roads.append({

                "type": "Feature",

                "properties": {

                    "id":
                        element.get("id"),

                    "highway":
                        highway,

                    "name":
                        tags.get("name"),

                    "maxspeed":
                        tags.get("maxspeed"),

                    "lanes":
                        tags.get("lanes"),

                    "surface":
                        tags.get("surface"),

                    "oneway":
                        tags.get("oneway"),

                    "speedKph":
                        ROAD_DEFAULT_SPEED.get(
                            highway,
                            25
                        ),

                    "source":
                        "OpenStreetMap"
                },

                "geometry":
                    road_geometry
            })

        # ====================================================
        # BUILDINGS
        # ====================================================

        elif building:

            if (
                coordinates[0]
                != coordinates[-1]
            ):

                coordinates.append(
                    coordinates[0]
                )

            if len(coordinates) < 4:
                continue

            building_geometry = {
                "type": "Polygon",
                "coordinates": [
                    coordinates
                ]
            }

            try:

                if not shape(
                    building_geometry
                ).intersects(
                    polygon_geom
                ):
                    continue

            except Exception:

                continue

            buildings.append({

                "type": "Feature",

                "properties": {

                    "id":
                        element.get("id"),

                    "building":
                        building,

                    "name":
                        tags.get("name"),

                    "levels":
                        tags.get("building:levels"),

                    "source":
                        "OpenStreetMap"
                },

                "geometry":
                    building_geometry
            })

        # ====================================================
        # WATERWAYS
        # ====================================================

        elif waterway:

            water_geometry = {
                "type": "LineString",
                "coordinates": coordinates
            }

            try:

                if not shape(
                    water_geometry
                ).intersects(
                    polygon_geom
                ):
                    continue

            except Exception:

                continue

            waterways.append({

                "type": "Feature",

                "properties": {

                    "id":
                        element.get("id"),

                    "waterway":
                        waterway,

                    "name":
                        tags.get("name"),

                    "source":
                        "OpenStreetMap"
                },

                "geometry":
                    water_geometry
            })

    return {

        "roads": {
            "type":
                "FeatureCollection",

            "features":
                roads
        },

        "buildings": {
            "type":
                "FeatureCollection",

            "features":
                buildings
        },

        "waterways": {
            "type":
                "FeatureCollection",

            "features":
                waterways
        }
    }


# ============================================================
# OSM FEATURES
# ============================================================

def fetch_osm_features(
    polygon
):

    cache_name = _cache_key(
        "osm",
        polygon
    )

    cached = _read_cache(
        cache_name
    )

    if cached:

        print(
            "OSM cache HIT"
        )

        return cached

    print(
        "OSM cache MISS - "
        "fetching real OpenStreetMap data..."
    )

    minx, miny, maxx, maxy = bbox(
        polygon
    )

    bbox_text = (
        f"{miny},{minx},{maxy},{maxx}"
    )

    query = f"""
[out:json][timeout:30];
(
  way["highway"]({bbox_text});
  way["building"]({bbox_text});
  way["waterway"]({bbox_text});
);
out tags geom;
"""

    endpoints = [

        OVERPASS_URL,

        "https://overpass.private.coffee/api/interpreter",

        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",

        "https://overpass-api.de/api/interpreter"
    ]

    # Remove duplicates while preserving order.

    endpoints = list(
        dict.fromkeys(
            endpoints
        )
    )

    last_error = None

    for endpoint in endpoints:

        try:

            print(
                f"Trying Overpass: "
                f"{endpoint}"
            )

            started = time.time()

            data = _request_json(
                endpoint,
                data=query,
                timeout=60
            )

            elapsed = (
                time.time()
                - started
            )

            print(
                f"Overpass success: "
                f"{endpoint} "
                f"({elapsed:.1f}s)"
            )

            result = _parse_osm_data(
                data,
                polygon
            )

            print(
                "OSM features:",
                len(
                    result[
                        "roads"
                    ][
                        "features"
                    ]
                ),
                "roads,",
                len(
                    result[
                        "buildings"
                    ][
                        "features"
                    ]
                ),
                "buildings,",
                len(
                    result[
                        "waterways"
                    ][
                        "features"
                    ]
                ),
                "waterways"
            )

            return _write_cache(
                cache_name,
                result
            )

        except Exception as exc:

            print(
                f"Overpass failed: "
                f"{endpoint}"
            )

            print(
                f"Reason: {exc}"
            )

            last_error = exc

    raise RuntimeError(
        "All Overpass servers failed. "
        f"Last error: {last_error}"
    )


# ============================================================
# ELEVATION GRID
# ============================================================

def fetch_elevation_grid(
    polygon,
    rows=12,
    cols=12
):

    cache_name = _cache_key(
        "elevation",
        polygon,
        f"{rows}x{cols}"
    )

    cached = _read_cache(
        cache_name
    )

    if cached:

        print(
            "Elevation cache HIT"
        )

        return cached

    print(
        "Elevation cache MISS - "
        "fetching Copernicus DEM data..."
    )

    minx, miny, maxx, maxy = bbox(
        polygon
    )

    points = []

    for r in range(rows):

        for c in range(cols):

            lon = (
                minx
                + (
                    c + 0.5
                )
                * (
                    maxx - minx
                )
                / cols
            )

            lat = (
                miny
                + (
                    r + 0.5
                )
                * (
                    maxy - miny
                )
                / rows
            )

            points.append(
                (
                    lat,
                    lon
                )
            )

    # Open-Meteo supports a maximum
    # of 100 coordinates per request.

    batch_size = 100

    elevations = []

    total = len(
        points
    )

    for start in range(
        0,
        total,
        batch_size
    ):

        batch = points[
            start:
            start + batch_size
        ]

        params = {

            "latitude":
                ",".join(
                    f"{lat:.6f}"
                    for lat, lon
                    in batch
                ),

            "longitude":
                ",".join(
                    f"{lon:.6f}"
                    for lat, lon
                    in batch
                )
        }

        print(
            f"Fetching elevation "
            f"points "
            f"{start + 1}-"
            f"{start + len(batch)} "
            f"of {total}"
        )

        data = _request_json(
            f"{OPEN_METEO_BASE}/elevation",
            params=params,
            timeout=45
        )

        batch_elevations = data.get(
            "elevation",
            []
        )

        if len(
            batch_elevations
        ) != len(batch):

            raise RuntimeError(
                "Elevation API returned "
                f"{len(batch_elevations)} "
                "values for "
                f"{len(batch)} coordinates."
            )

        elevations.extend(
            batch_elevations
        )

    grid = []

    index = 0

    for r in range(rows):

        row = []

        for c in range(cols):

            row.append(
                elevations[index]
            )

            index += 1

        grid.append(row)

    _write_cache(
        cache_name,
        grid
    )

    print(
        "Elevation data cached."
    )

    return grid


# ============================================================
# HISTORICAL WEATHER
# ============================================================

def fetch_weather_events(
    polygon: dict,
    start_year: int = 2015,
    end_year: int = 2024
):

    cache_name = _cache_key(
        f"weather_{start_year}_{end_year}",
        polygon
    )

    cached = _read_cache(
        cache_name
    )

    if cached:

        print(
            "Weather cache HIT"
        )

        return cached

    print(
        "Weather cache MISS - "
        "fetching ERA5-Land historical rainfall..."
    )

    minx, miny, maxx, maxy = (
        _bbox(polygon)
    )

    lat = (
        miny + maxy
    ) / 2

    lon = (
        minx + maxx
    ) / 2

    params = {

        "latitude":
            lat,

        "longitude":
            lon,

        "start_date":
            f"{start_year}-01-01",

        "end_date":
            f"{end_year}-12-31",

        "daily":
            "precipitation_sum,precipitation_hours",

        "timezone":
            "Asia/Kolkata",

        "models":
            "era5_land"
    }

    data = _request_json(
        OPEN_METEO_ARCHIVE,
        params=params,
        timeout=60
    )

    daily_data = data.get(
        "daily",
        {}
    )

    times = daily_data.get(
        "time",
        []
    )

    precipitation = daily_data.get(
        "precipitation_sum",
        []
    )

    hours = daily_data.get(
        "precipitation_hours",
        []
    )

    daily = []

    for date, mm, ph in zip(
        times,
        precipitation,
        hours
    ):

        if mm is None:
            continue

        rainfall = float(
            mm
        )

        duration = max(
            1,
            round(
                float(
                    ph or 24
                )
            )
        )

        daily.append({

            "date":
                date,

            "year":
                int(
                    date[:4]
                ),

            "rainfallMm":
                round(
                    rainfall,
                    1
                ),

            "durationHours":
                duration,

            "source":
                "Open-Meteo ERA5-Land reanalysis",

            "sourceType":
                "REAL_REANALYSIS",

            "isExtremeEvent":
                rainfall >= 100
        })

    # Highest rainfall events first.

    daily.sort(
        key=lambda x:
        x["rainfallMm"],
        reverse=True
    )

    # Keep top 12 events.

    events = daily[:12]

    # Return selected events chronologically.

    events.sort(
        key=lambda x:
        x["date"]
    )

    result = {

        "zoneId":
            "dynamic",

        "events":
            events,

        "source":
            "Open-Meteo Historical "
            "Weather API using "
            "ERA5-Land reanalysis",

        "note":
            "Real historical reanalysis, "
            "not an official KSNDMC station "
            "observation. Use KSNDMC observations "
            "when available for an official "
            "station-based analysis."
    }

    _write_cache(
        cache_name,
        result
    )

    print(
        f"Weather data cached "
        f"({len(events)} events)."
    )

    return result


# ============================================================
# NUMBER PARSING
# ============================================================

def _parse_number(
    value,
    default
):

    if value is None:
        return default

    try:

        return float(
            str(value)
            .replace(
                "m",
                ""
            )
            .strip()
            .split(";")[0]
        )

    except Exception:

        return default


# ============================================================
# SPEED PARSING
# ============================================================

def _parse_speed(
    value,
    default
):

    number = _parse_number(
        value,
        default
    )

    if (
        number
        and number > 0
    ):

        return float(
            number
        )

    return float(
        default
    )


# ============================================================
# DEFAULT ROAD WIDTH
# ============================================================

def _default_width(
    highway
):

    return {

        "motorway": 12,

        "trunk": 10,

        "primary": 9,

        "secondary": 8,

        "tertiary": 7,

        "residential": 6,

        "service": 4

    }.get(
        highway,
        6
    )


# ============================================================
# TRAFFIC PROXY
# ============================================================

def _traffic_proxy(
    highway
):

    # This is NOT observed traffic.
    # It is only a routing/simulation proxy.

    return {

        "motorway": 2200,

        "trunk": 1800,

        "primary": 1400,

        "secondary": 1000,

        "tertiary": 700,

        "residential": 350,

        "service": 120

    }.get(
        highway,
        300
    )


# ============================================================
# WATERWAY CAPACITY
# ============================================================

def _waterway_capacity(
    kind
):

    # OSM geometry is real.
    # Hydraulic capacity is estimated.

    return {

        "river": 250,

        "stream": 90,

        "drain": 65,

        "ditch": 45,

        "canal": 180,

        "wadi": 55

    }.get(
        kind,
        50
    )