from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'email': self.email}

class Zone(db.Model):
    __tablename__ = 'zones'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    city = db.Column(db.String(100), default='Bengaluru')
    center_lat = db.Column(db.Float, nullable=False)
    center_lng = db.Column(db.Float, nullable=False)
    area_km2 = db.Column(db.Float, nullable=False)
    base_elevation = db.Column(db.Float, default=880.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'city': self.city,
            'center': [self.center_lat, self.center_lng],
            'areaKm2': self.area_km2,
            'baseElevation': self.base_elevation,
        }

class RainfallRecord(db.Model):
    __tablename__ = 'rainfall_records'
    
    id = db.Column(db.Integer, primary_key=True)
    zone_id = db.Column(db.String(50), db.ForeignKey('zones.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    rainfall_mm = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'year': self.year,
            'rainfallMm': self.rainfall_mm
        }

class SimulationResult(db.Model):
    __tablename__ = 'simulation_results'
    
    id = db.Column(db.Integer, primary_key=True)
    zone_id = db.Column(db.String(50), nullable=False)
    intervention_type = db.Column(db.String(50), nullable=False)
    material_id = db.Column(db.String(50), nullable=False)
    floors = db.Column(db.Integer, default=10)
    footprint_area = db.Column(db.Float, default=1200.0)
    rainfall_rate = db.Column(db.Float, default=85.0)
    max_water_depth = db.Column(db.Float, nullable=False)
    affected_area_km2 = db.Column(db.Float, nullable=False)
    buildings_at_risk = db.Column(db.Integer, nullable=False)
    waterlogging_points = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'zoneId': self.zone_id,
            'interventionType': self.intervention_type,
            'metrics': {
                'estMaxWaterDepthM': self.max_water_depth,
                'affectedAreaKm2': self.affected_area_km2,
                'buildingsAtRiskCount': self.buildings_at_risk,
                'majorWaterloggingPointsCount': self.waterlogging_points,
            },
            'createdAt': self.created_at.isoformat()
        }
