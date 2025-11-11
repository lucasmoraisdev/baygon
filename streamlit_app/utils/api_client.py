import os
import sys
from typing import Optional, Tuple, Union, Dict, Any
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from .session_state import get_user_status

import requests
from app.config.settings import API_URL

API_URL = f"{API_URL}/api/v1"

def post(endpoint: str, data: dict) -> Tuple[bool, Union[Dict[str, Any], str]]:
    status = get_user_status()
    token = status.get("access_token")
    headers = { "Authorization": f"Bearer {token}" } if token else {}
    try:
        response = requests.post(f"{API_URL}/{endpoint}", json=data, headers=headers)

        if response.status_code in (200, 201):
            print(f"response: {response.json()}")
            return True, response.json()

        else:
            try:
                error_message = response.json().get("detail", "Erro desconhecido no servidor.")
            except Exception:
                error_message = f"Erro inesperado ({response.status_code})"
            return False, error_message
    except requests.exceptions.RequestException as e:
        return False, f"Erro de conexão com a API: {str(e)}"

def get(endpoint: str):
    status = get_user_status()
    token = status.get("access_token")
    headers = { "Authorization": f"Bearer {token}" } if token else {}
    response = requests.get(f"{API_URL}/{endpoint}", headers=headers)
    response.raise_for_status()
    return response.json()