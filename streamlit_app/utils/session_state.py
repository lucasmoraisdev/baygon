import streamlit as st

def init_session_state():
    for key in ["logged_in", "is_admin", "username"]:
        if key not in st.session_state:
            st.session_state[key] = False if key != "username" else None

def get_user_status():
    init_session_state()
    return {
        "logged_in": st.session_state.logged_in,
        "is_admin": st.session_state.is_admin,
        "username": st.session_state.username,
    }

def set_logged_in_user(username: str, is_admin: bool):
    st.session_state.logged_in = True
    st.session_state.is_admin = is_admin
    st.session_state.username = username

def logout_user():
    st.session_state.logged_in = False
    st.session_state.is_admin = False
    st.session_state.username = None
    st.rerun()
