import os
import sys
from typing import Optional
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

import requests
from app.config.settings import API_URL

API_URL = f"{API_URL}/api/v1"

def post(endpoint: str, data: dict, token: Optional[str] = None):
    headers = { "Authorization": f"Bearer {token}" } if token else {}
    try:
        response = requests.post(f"{API_URL}/{endpoint}", json=data, headers=headers)

        if response.status_code in (200, 201):
            return True, response.json()

        else:
            try:
                error_message = response.json().get("detail", "Erro desconhecido no servidor.")
            except Exception:
                error_message = f"Erro inesperado ({response.status_code})"
            return False, error_message
    except requests.exceptions.RequestException as e:
        return False, f"Erro de conexão com a API: {str(e)}"

def get(endpoint: str, token: Optional[str] = None):
    headers = { "Authorization": f"Bearer {token}" } if token else {}
    response = requests.get(f"{API_URL}/{endpoint}", headers=headers)
    response.raise_for_status()
    return response.json()