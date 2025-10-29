import os
import sys
from typing import Optional
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

import requests
from app.config.settings import APP_URL


API_URL = f"{APP_URL}/api/v1"

def post(endpoint: str, data: dict, token: Optional[str] = None):
    headers = { "Authorization": f"Bearer {token}" } if token else {}
    response = requests.post(f"{API_URL}/{endpoint}", json=data, headers=headers)
    response.raise_for_status()
    return response.json()

def get(endpoint: str, token: Optional[str] = None):
    headers = { "Authorization": f"Bearer {token}" } if token else {}
    response = requests.get(f"{API_URL}/{endpoint}", headers=headers)
    response.raise_for_status()
    return response.json()