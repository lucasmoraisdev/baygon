import streamlit as st
from utils.api_client import post
from utils.auth import validate_expired_token
from utils.paswords import validate_password
from utils.session_state import set_logged_in_user

st.title("👋 Bem vindo ao Baygonverso!")
st.markdown("Finalize seu cadastro definindo uma nova senha segura.")

params = st.query_params
setup_token = params.get("setup_token")

if not setup_token:
    st.error("Token de configuração não encontrado. Verifique o link no seu email ou peça por um novo")
    st.stop()

if not validate_expired_token(setup_token):
    st.error("O seu convite expirou mané. Solicite um novo.")
    st.stop()

# Form
with st.form("complete_registration_form", clear_on_submit=False): 
    st.subheader("Complete seu cadastro")

    temp_password = st.text_input("Digite a senha enviada por email: ", type="password", max_chars=150)
    new_password = st.text_input("Digite a nova senha: ", type="password", max_chars=150)
    confirm_password = st.text_input("Confirme a nova senha: ", type="password", max_chars=150)

    st.caption("A senha deve conter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos.")

    submitted = st.form_submit_button("Salvar nova senha", type="primary")

    if submitted:
        if not temp_password or not new_password or not confirm_password:
            st.error("Todos os campos sao obrigatorios")
        elif new_password != confirm_password:
            st.error("As senhas nao sao iguais")
        elif not validate_password(new_password):
            st.error("A senha deve conter pelo menos 8 caracteres, incluindo 1 letra maiúscula, 1 letra minúscula, 1 número e 1 símbolo.")
        else:
            payload = {
                "setup_token": setup_token,
                "temporary_password": temp_password,
                "new_password": new_password
            }

            success, response = post("users/complete-registration", payload)

            if success:
                if isinstance(response, dict):
                    username = response.get("username")
                    is_admin = response.get("is_admin")
                    access_token = response.get("access_token")

                    if username and access_token:
                        set_logged_in_user(access_token)
                        st.success("Senha atualizada e login realizado com sucesso! Redirecionando...")
                        st.rerun()
                    else:
                        st.error("Resposta inesperada da API: dados ausentes.")
                else:
                    st.error(f"Resposta inesperada da API: {response}")
            else:
                st.error(response)