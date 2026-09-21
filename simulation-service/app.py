from flask import Flask, jsonify, request
from flask_cors import CORS

from simulation.data_loader import (
    load_zone,
    load_weather,
    load_custom_zone,
    ZONE_CATALOG
)

from simulation.scenario_engine import (
    simulate,
    compare_scenarios
)

from simulation.routing import find_safe_route

import os


app = Flask(__name__)

CORS(app)


# =========================================================
# HEALTH
# =========================================================

@app.get("/api/health")
def health():

    return jsonify({
        "status": "ok",
        "service": "UrbanTwin simulation engine",
        "mode": "zone-agnostic",
        "dataMode": os.getenv(
            "URBANTWIN_DATA_MODE",
            "REAL"
        ),
        "realSources": [
            "OpenStreetMap",
            "Open-Meteo ERA5-Land",
            "Copernicus DEM GLO-90"
        ]
    })


# =========================================================
# ZONES
# =========================================================

@app.get("/api/zones")
def zones():

    result = [
        {
            "id": "bengaluru-pilot",
            "name": "Bengaluru Pilot Zone",
            "city": "Bengaluru",
            "label": "REAL DATA MODE"
        }
    ]

    result.extend(
        {
            "id": z["id"],
            "name": z["name"],
            "city": z["city"],
            "label": "REAL DATA MODE"
        }
        for z in ZONE_CATALOG
    )

    result.append({
        "id": "custom",
        "name": "Custom Area",
        "city": "User Selected Area",
        "label": "Draw any polygon · real GIS data"
    })

    return jsonify(result)


# =========================================================
# ZONE DETAILS
# =========================================================

@app.get("/api/zones/<zone_id>")
def zone_detail(zone_id):

    try:

        return jsonify(
            load_zone(zone_id)
        )

    except ValueError as e:

        return jsonify({
            "error": str(e)
        }), 404

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# WEATHER
# =========================================================

@app.get("/api/weather/<zone_id>")
def weather(zone_id):

    try:

        return jsonify(
            load_weather(zone_id)
        )

    except ValueError as e:

        return jsonify({
            "error": str(e)
        }), 404

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


# =========================================================
# PREVIEW CUSTOM AREA
# =========================================================

@app.post("/api/preview-area")
def preview_area():

    payload = request.get_json(
        force=True
    )

    try:

        polygon = payload["polygon"]

        zone = load_custom_zone(
            polygon,
            payload.get(
                "name",
                "Custom Area"
            ),
            payload.get(
                "city",
                "User Selected Area"
            )
        )

        return jsonify(zone)

    except KeyError:

        return jsonify({
            "error": "polygon is required"
        }), 400

    except Exception as e:

        print(
            f"Preview area error: {e}"
        )

        return jsonify({
            "error": str(e)
        }), 400


# =========================================================
# FULL ZONE RESOLUTION
# =========================================================

def _resolve_zone(payload):

    selected = payload.get(
        "selectedArea"
    )

    if selected:

        return load_custom_zone(
            selected,
            payload.get(
                "zoneName",
                "Custom Area"
            ),
            payload.get(
                "city",
                "User Selected Area"
            )
        )

    return load_zone(
        payload["zoneId"]
    )


# =========================================================
# SIMULATION
# =========================================================

@app.post("/api/simulate")
def run_simulation():

    payload = request.get_json(
        force=True
    )

    try:

        zone = _resolve_zone(
            payload
        )

        result = simulate(
            zone,
            payload.get(
                "weather",
                {}
            ),
            payload.get(
                "intervention",
                {
                    "type": "NONE"
                }
            )
        )

        return jsonify(result)

    except Exception as e:

        print(
            f"Simulation error: {e}"
        )

        return jsonify({
            "error": str(e)
        }), 400


# =========================================================
# ROUTING
# =========================================================

@app.post("/api/route")
def route():

    payload = request.get_json(
        force=True
    )

    try:

        zone = _resolve_zone(
            payload
        )

        roads = zone[
            "roads"
        ][
            "features"
        ]

        result = find_safe_route(
            roads,
            payload["origin"],
            payload["destination"],
            payload.get(
                "blockedRoads",
                []
            ),
            payload.get(
                "algorithm",
                "astar"
            )
        )

        return jsonify(result)

    except KeyError as e:

        return jsonify({
            "error": f"Missing field: {e}"
        }), 400

    except Exception as e:

        print(
            f"Routing error: {e}"
        )

        return jsonify({
            "error": str(e)
        }), 400


# =========================================================
# SCENARIO COMPARISON
# =========================================================

@app.post("/api/compare")
def compare():

    payload = request.get_json(
        force=True
    )

    try:

        zone = _resolve_zone(
            payload
        )

        result = compare_scenarios(
            zone,
            payload.get(
                "weather",
                {}
            ),
            payload.get(
                "scenarios",
                []
            )
        )

        return jsonify({
            "scenarios": result
        })

    except Exception as e:

        print(
            f"Compare error: {e}"
        )

        return jsonify({
            "error": str(e)
        }), 400


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )