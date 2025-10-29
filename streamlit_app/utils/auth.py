import streamlit as st
from utils.api_client import post, get
from utils.session_state import set_logged_in_user

def authenticate_user(username: str, password: str) -> bool:
    try:
        data = post('/login', {
            'username': username,
            'password': password
        })
        set_logged_in_user(username=data['username'], is_admin=data['is_admin'])
        return True
    except Exception as e:
        st.error(str(e))
        print(f"Error: {e}")
        return False

