import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from app import app


def test_health():
    client = app.test_client()
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.get_json()['status'] == 'ok'


def test_preview_custom_area():
    client = app.test_client()
    polygon = {
        "type": "Polygon",
        "coordinates": [[[77.60, 12.90], [77.63, 12.90], [77.63, 12.93], [77.60, 12.93], [77.60, 12.90]]]
    }
    response = client.post('/api/preview-area', json={"polygon": polygon})
    assert response.status_code == 200
    assert response.get_json()['id'] == 'custom'
