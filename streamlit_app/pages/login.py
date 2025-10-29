import logging
import streamlit as st
from utils.auth import authenticate_user
from utils.session_state import get_user_status, logout_user
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

user_status = get_user_status()

# Main page content
st.title("# Acesso ao Baygon Fantasy 🪳")
st.markdown("---")

if user_status['logged_in']:
    st.success(f"Bem-vindo, **{user_status['username']}**!")

    if user_status['is_admin']:
        st.info("Bem vindo xandao!")
    if st.button("Sair (deslogar)", key="logout_btn", on_click=logout_user):
        pass
else:
    with st.form("login_form", clear_on_submit=False):
        st.header("Entrar (la ele) na sua conta")

        username = st.text_input(
            "Seu nome de boleiro inventado pelo xandao",
            placeholder="Seu nome de usuario, conforme ordenado pelo xandao",
            max_chars=50
        )

        password = st.text_input(
            "Senha mirabolante",
            type="password",
            placeholder="Senha mais segura que Tuta na zaga",
            max_chars=50
        )

        submitted = st.form_submit_button("Adentrar", type="primary")

        if submitted:
            logging.info(f"Tentativa de login: username {username}, password {password}")
            print(f"Tentativa de login: username {username}, password {password}")
            if not username or not password:
                st.error("Golpe? Aqui não, Xandão ordenou, me dê seu usuario e senha vá")
            elif authenticate_user(username, password):
                st.success("Xandão permitiu... Redirecionando na velocidade de Vini jr...")
                st.rerun()
            else:
                st.error("Credenciais erradas... Chame o chaveiro e tente novamente...")