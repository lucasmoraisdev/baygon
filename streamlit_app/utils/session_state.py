import jwt
import streamlit as st

def init_session_state():
    for key in ["logged_in", "is_admin", "username", "access_token", "user_id"]:
        if key not in st.session_state:
            st.session_state[key] = False if key != "username" or key != "access_token" or key != "user_id" else None

def get_user_status():
    init_session_state()
    return {
        "logged_in": st.session_state.logged_in,
        "is_admin": st.session_state.is_admin,
        "username": st.session_state.username,
        "access_token": st.session_state.access_token,
        "user_id": st.session_state.access_token
    }

def set_logged_in_user(access_token: str):
    try:
        payload = jwt.decode(access_token, options={"verify_signature": False})
        st.session_state.username = payload.get("sub")
        st.session_state.is_admin = payload.get("is_admin", False)
        st.session_state.user_id = payload.get("user_id", None)
        st.session_state.logged_in = True
    except Exception:
        st.session_state.logged_in = False
        st.session_state.username = None
        st.session_state.is_admin = False
        st.session_state.access_token = None
        st.session_state.user_id = None

def logout_user():
    for key in ["logged_in", "is_admin", "username", "access_token", "user_id"]:
        if key in st.session_state:
            st.session_state[key] = False if key in ["logged_in", "is_admin"] else None
    st.rerun()
