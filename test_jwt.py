#!/usr/bin/env python3
"""
Script para testar a geração de JWT tokens
"""
from datetime import datetime, timedelta
from app.core.jwt_manager import JWTManager
from app.config.settings import ACCESS_TOKEN_EXPIRE_HOURS, REFRESH_TOKEN_EXPIRE_DAYS
import jwt
import json
import base64

print("=" * 80)
print("TESTE DE GERAÇÃO DE JWT TOKENS")
print("=" * 80)

# Teste de geração de tokens
test_data = {
    "sub": "test@example.com",
    "email": "test@example.com",
    "username": "testuser",
    "user_id": 1
}

print("\n1. Criando Access Token...")
access_token = JWTManager.create_access_token(test_data)
print(f"Access Token: {access_token[:50]}...")

# Decodificar e mostrar
try:
    access_payload = jwt.decode(access_token, JWTManager.JWT_SECRET, algorithms=[JWTManager.ALGORITHM])
    print(f"\nPayload do Access Token:")
    print(json.dumps(access_payload, indent=2, default=str))
    
    # Verificar se exp é um inteiro (timestamp Unix)
    print(f"\nExp type: {type(access_payload['exp'])}")
    print(f"Exp value: {access_payload['exp']}")
    
    # Converter para datetime para verificar
    exp_datetime = datetime.fromtimestamp(access_payload['exp'])
    iat_datetime = datetime.fromtimestamp(access_payload['iat']) if 'iat' in access_payload else "N/A"
    
    print(f"Exp datetime: {exp_datetime}")
    print(f"Iat datetime: {iat_datetime}")
    print(f"Tempo até expiração: {exp_datetime - datetime.now()}")
except Exception as e:
    print(f"Erro ao decodificar: {e}")

print("\n" + "=" * 80)
print("\n2. Criando Refresh Token...")
refresh_token = JWTManager.create_refresh_token(test_data)
print(f"Refresh Token: {refresh_token[:50]}...")

# Decodificar e mostrar
try:
    refresh_payload = jwt.decode(refresh_token, JWTManager.JWT_SECRET, algorithms=[JWTManager.ALGORITHM])
    print(f"\nPayload do Refresh Token:")
    print(json.dumps(refresh_payload, indent=2, default=str))
    
    # Verificar se exp é um inteiro (timestamp Unix)
    print(f"\nExp type: {type(refresh_payload['exp'])}")
    print(f"Exp value: {refresh_payload['exp']}")
    
    # Converter para datetime para verificar
    exp_datetime = datetime.fromtimestamp(refresh_payload['exp'])
    iat_datetime = datetime.fromtimestamp(refresh_payload['iat']) if 'iat' in refresh_payload else "N/A"
    
    print(f"Exp datetime: {exp_datetime}")
    print(f"Iat datetime: {iat_datetime}")
    print(f"Tempo até expiração: {exp_datetime - datetime.now()}")
except Exception as e:
    print(f"Erro ao decodificar: {e}")

print("\n" + "=" * 80)
print("\nCONFIGURAÇÕES:")
print(f"ACCESS_TOKEN_EXPIRE_HOURS: {ACCESS_TOKEN_EXPIRE_HOURS}")
print(f"REFRESH_TOKEN_EXPIRE_DAYS: {REFRESH_TOKEN_EXPIRE_DAYS}")
print("=" * 80)
