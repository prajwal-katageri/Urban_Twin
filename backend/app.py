import os
import math
import secrets
from functools import wraps
from flask import Flask, jsonify, request
from flask_cors import CORS
from config import Config
from models import db, User, Zone, RainfallRecord, SimulationResult
from storage import storage_is_configured

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

db.init_app(app)
auth_tokens = {}

def require_auth(handler):
    @wraps(handler)
    def protected(*args, **kwargs):
        token = request.headers.get('Authorization', '').removeprefix('Bearer ').strip()
        if not token or token not in auth_tokens:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        request.current_user = auth_tokens[token]
        return handler(*args, **kwargs)
    return protected

def seed_database():
    """Seed initial Bengaluru pilot zones and IMD rainfall records."""
    if Zone.query.first():
        return

    zones = [
        Zone(id='indiranagar', name='Indiranagar', city='Bengaluru', center_lat=12.9784, center_lng=77.6408, area_km2=0.42, base_elevation=885.0),
        Zone(id='hsr', name='HSR Layout', city='Bengaluru', center_lat=12.9116, center_lng=77.6389, area_km2=0.65, base_elevation=875.0),
        Zone(id='koramangala', name='Koramangala', city='Bengaluru', center_lat=12.9348, center_lng=77.6253, area_km2=0.58, base_elevation=870.0),
        Zone(id='whitefield', name='Whitefield', city='Bengaluru', center_lat=12.9698, center_lng=77.7499, area_km2=0.72, base_elevation=890.0),
        Zone(id='electronic_city', name='Electronic City', city='Bengaluru', center_lat=12.8452, center_lng=77.6602, area_km2=0.80, base_elevation=895.0),
        Zone(id='custom_draw', name='Custom Area (Draw)', city='Bengaluru', center_lat=12.9784, center_lng=77.6408, area_km2=0.42, base_elevation=885.0),
    ]
    db.session.bulk_save_objects(zones)
    db.session.commit()

    # Seed IMD historical rainfall data (2015 - 2024)
    imd_years = [
        (2015, 890), (2016, 920), (2017, 1680), (2018, 1340), (2019, 1980),
        (2020, 1490), (2021, 1120), (2022, 1620), (2023, 1080), (2024, 1310)
    ]
    for zone in zones:
        for year, mm in imd_years:
            record = RainfallRecord(zone_id=zone.id, year=year, rainfall_mm=mm)
            db.session.add(record)
    db.session.commit()

with app.app_context():
    db.create_all()
    seed_database()

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'online',
        'service': 'UrbanTwin Flask REST Backend',
        'database': app.config['SQLALCHEMY_DATABASE_URI'].split('://')[0],
        'storage': 'configured' if storage_is_configured() else 'not_configured',
        'version': '1.0.0-SIH2026'
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    if not name or not email or len(password) < 6:
        return jsonify({'success': False, 'message': 'Name, email, and a password of at least 6 characters are required'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'An account with this email already exists'}), 409
    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    token = secrets.token_urlsafe(32)
    auth_tokens[token] = user.id
    return jsonify({'success': True, 'token': token, 'user': user.to_dict()}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
    token = secrets.token_urlsafe(32)
    auth_tokens[token] = user.id
    return jsonify({'success': True, 'token': token, 'user': user.to_dict()})

@app.route('/api/auth/me', methods=['GET'])
@require_auth
def current_user():
    user = User.query.get(request.current_user)
    return jsonify({'success': True, 'user': user.to_dict()})

@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    token = request.headers.get('Authorization', '').removeprefix('Bearer ').strip()
    auth_tokens.pop(token, None)
    return jsonify({'success': True})

@app.route('/api/zones', methods=['GET'])
def get_zones():
    zones = Zone.query.all()
    return jsonify({'success': True, 'data': [z.to_dict() for z in zones]})

@app.route('/api/zones/<zone_id>', methods=['GET'])
def get_zone(zone_id):
    zone = Zone.query.get(zone_id)
    if not zone:
        return jsonify({'success': False, 'message': 'Zone not found'}), 404
    return jsonify({'success': True, 'data': zone.to_dict()})

@app.route('/api/weather/<zone_id>', methods=['GET'])
def get_weather(zone_id):
    records = RainfallRecord.query.filter_by(zone_id=zone_id).order_by(RainfallRecord.year).all()
    if not records:
        records = RainfallRecord.query.filter_by(zone_id='indiranagar').order_by(RainfallRecord.year).all()
    return jsonify([r.to_dict() for r in records])

@app.route('/api/simulate', methods=['POST'])
@require_auth
def simulate():
    data = request.get_json() or {}
    zone_id = data.get('zoneId', 'indiranagar')
    intervention = data.get('intervention', {})
    
    material_id = intervention.get('materialId', 'concrete')
    floors = int(intervention.get('floors', 10))
    footprint_area = float(intervention.get('footprintArea', 1200))
    rainfall_rate = float(intervention.get('rainfallRateMmHr', data.get('rainfallMmHr', 85)))

    zone = Zone.query.get(zone_id)
    if not zone:
        fallback_zone = Zone.query.get('indiranagar')
        zone = Zone(
            id=zone_id,
            name='Custom Selected Area',
            city=fallback_zone.city,
            center_lat=float(data.get('centerLat', fallback_zone.center_lat)),
            center_lng=float(data.get('centerLng', fallback_zone.center_lng)),
            area_km2=max(0.01, float(data.get('studyAreaKm2', fallback_zone.area_km2))),
            base_elevation=fallback_zone.base_elevation,
        )
    
    # Run hydrologic accumulation heuristic physics
    runoff_factor = 0.92 if material_id == 'concrete' else (0.35 if material_id == 'permeable' else 0.95)
    area_m2 = zone.area_km2 * 1000000
    water_vol_m3 = area_m2 * (rainfall_rate / 1000) * runoff_factor
    structural_disp = footprint_area * (floors * 0.35) * runoff_factor
    
    total_water = water_vol_m3 + structural_disp
    est_max_water_depth = round((total_water / area_m2) * 14.5, 2)
    affected_area = round(zone.area_km2 * min(0.85, (est_max_water_depth / 2.8)), 2)
    buildings_at_risk = int(affected_area * 140)
    waterlogging_points = max(1, int(est_max_water_depth * 2.2))

    # Persist simulation run to database
    sim_run = SimulationResult(
        zone_id=zone.id,
        intervention_type=intervention.get('type', 'building'),
        material_id=material_id,
        floors=floors,
        footprint_area=footprint_area,
        rainfall_rate=rainfall_rate,
        max_water_depth=est_max_water_depth,
        affected_area_km2=affected_area,
        buildings_at_risk=buildings_at_risk,
        waterlogging_points=waterlogging_points
    )
    db.session.add(sim_run)
    db.session.commit()

    # Spatial heatmap grid generation
    center_lat, center_lng = zone.center_lat, zone.center_lng
    flood_points = []
    step = 0.002
    for r in range(-4, 5):
        for c in range(-4, 5):
            p_lat = center_lat + (r * step)
            p_lng = center_lng + (c * step)
            dist = math.sqrt(r*r + c*c)
            point_depth = round(max(0.02, est_max_water_depth * max(0.05, 1 - (dist / 6))), 2)
            
            color = '#3b82f6'
            risk = 'low'
            if point_depth >= 2.0:
                color, risk = '#ef4444', 'critical'
            elif point_depth >= 1.0:
                color, risk = '#f97316', 'high'
            elif point_depth >= 0.5:
                color, risk = '#eab308', 'moderate'

            flood_points.append({
                'id': f"fp_{r}_{c}",
                'lat': p_lat,
                'lng': p_lng,
                'depth': point_depth,
                'riskCategory': risk,
                'color': color,
                'radius': max(15, point_depth * 25)
            })

    flood_risk = {
        'riskScore': min(100, max(5, int(est_max_water_depth * 35))),
        'riskLevel': 'HIGH' if est_max_water_depth >= 1 else 'MEDIUM',
        'estMaxWaterDepthM': est_max_water_depth,
        'affectedAreaKm2': affected_area,
        'buildingsAtRiskCount': buildings_at_risk,
        'majorWaterloggingPointsCount': waterlogging_points,
    }

    return jsonify({
        'success': True,
        'isRemote': True,
        'data': {
            'simulationCode': f'SIM-{zone.id.upper()}-{sim_run.id}',
            'dbSimulationId': sim_run.id,
            'floodRisk': flood_risk,
            'trafficRisk': {'cutoffRoadsCount': max(1, int(est_max_water_depth * 1.5)), 'affectedRoads': []},
            'evacuationRoute': {
                'estimatedTimeMin': int(18 + (est_max_water_depth * 12)),
                'endPoint': 'Safe Hub',
                'routeGeometry': [[center_lat - 0.006, center_lng - 0.005], [center_lat + 0.005, center_lng + 0.005]],
            },
            'floodRiskPoints': flood_points,
            'metrics': {
                'estMaxWaterDepthM': est_max_water_depth,
                'affectedAreaKm2': affected_area,
                'buildingsAtRiskCount': buildings_at_risk,
                'majorWaterloggingPointsCount': waterlogging_points,
                'cutOffRoadCount': max(1, int(est_max_water_depth * 1.5)),
                'totalEvacuationTimeMin': int(18 + (est_max_water_depth * 12)),
            },
        },
        'zoneId': zone.id,
        'metrics': {
            'estMaxWaterDepthM': est_max_water_depth,
            'affectedAreaKm2': affected_area,
            'buildingsAtRiskCount': buildings_at_risk,
            'majorWaterloggingPointsCount': waterlogging_points,
            'cutOffRoadCount': max(1, int(est_max_water_depth * 1.5)),
            'totalEvacuationTimeMin': int(18 + (est_max_water_depth * 12))
        },
        'floodRiskPoints': flood_points,
        'evacuationPath': [
            [center_lat - 0.006, center_lng - 0.005],
            [center_lat - 0.003, center_lng - 0.002],
            [center_lat + 0.001, center_lng + 0.001],
            [center_lat + 0.005, center_lng + 0.005]
        ]
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
