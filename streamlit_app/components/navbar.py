import streamlit as st
from streamlit_app.utils.session_state import logout, is_authenticated

def sidebar():
    st.sidebar.title("🏆 Baygon League")
    if is_authenticated():
        st.sidebar.write(f"Olá, {st.session_state['user']['name']}")
        if st.sidebar.button("Sair"):
            logout()
    else:
        st.sidebar.info("Por favor, faça login.")
