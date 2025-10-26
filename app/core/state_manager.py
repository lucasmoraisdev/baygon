import streamlit as st
from app.config.settings import DEFAULT_USER_PERMISSION


def init_session_state():
    """Garante que todas as chaves de usuario padrao existam no st.session_state"""
    for key, default_value in DEFAULT_USER_PERMISSION.items():
        if key not in st.session_state:
            st.session_state[key] = default_value

def get_user_status():
    """Retorna o dicionario de status de usuario (logado, admin, username)"""
    init_session_state()
    return {
        "logged_in": st.session_state.logged_in,
        "is_admin": st.session_state.is_admin,
        "username": st.session_state.username
    }

def set_logged_in_user(username: str, is_admin: bool):
    """Define o estado de um usuario logado"""
    st.session_state.logged_in = True
    st.session_state.is_admin = is_admin
    st.session_state.username = username

def logout_user():
    """Define o estado de um usuario deslogado"""
    st.session_state.logged_in = False
    st.session_state.is_admin = False
    st.session_state.username = None
    st.rerun()

init_session_state()