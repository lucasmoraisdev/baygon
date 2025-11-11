from datetime import datetime
import jwt
import streamlit as st
from utils.api_client import post, get
from utils.session_state import set_logged_in_user

def authenticate_user(username: str, password: str) -> bool:
    try:
        success, data = post('login', {
            'username': username,
            'password': password
        })
        if success and isinstance(data, dict) and 'access_token' in data:
            set_logged_in_user(access_token=data['access_token'])
            return True
        else:
            print(data) 
            return False
    except Exception as e:
        st.error(str(e))
        print(f"Error: {e}")
        return False

def validate_expired_token(token):
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        
        exp_timestamp = payload.get("exp")
        
        if exp_timestamp:
            exp_datetime = datetime.utcfromtimestamp(exp_timestamp)
            
            if exp_datetime < datetime.utcnow():
                return False
        return True
    except jwt.ExpiredSignatureError:
        return False
    except jwt.DecodeError:
        return False