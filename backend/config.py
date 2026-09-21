import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'urbantwin-sih2026-secret-key')
    # PostgreSQL connection string: postgresql://username:password@localhost:5432/urbantwin
    # Fallback to local SQLite database if PostgreSQL URI is not set
    POSTGRES_URI = os.getenv('POSTGRES_URI') or os.getenv('DATABASE_URL')
    
    if POSTGRES_URI:
        parsed_uri = urlsplit(POSTGRES_URI)
        query = [(key, value) for key, value in parse_qsl(parsed_uri.query, keep_blank_values=True) if key != 'channel_binding']
        SQLALCHEMY_DATABASE_URI = urlunsplit(parsed_uri._replace(query=urlencode(query)))
    else:
        BASE_DIR = os.path.abspath(os.path.dirname(__file__))
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'urbantwin.db')}"
        
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_timeout': 30,
    }
