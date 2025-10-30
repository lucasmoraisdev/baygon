import streamlit as st
from utils.api_client import post
from utils.session_state import get_user_status

user_status = get_user_status()

st.title("Fazer nova contratação 🤝")
st.markdown("---")

if not user_status['logged_in'] or not user_status['is_admin']:
    st.error("Acesso negado. Jaedson vai te chamar para um papo a dois.")
    st.stop()

# st.write(f"Bem vindo, **{user_status['username']}**. Use o formulário abaixo para fazer uma nova contratação.")

# Formulário
with st.form("invite_user_form", clear_on_submit=True):
    st.header("Dados do novo boleiro:")

    col1, col2 = st.columns(2)

    with col1:
        name = st.text_input("Nome completo", max_chars= 150)
        email = st.text_input("E-mail", help="Email que será usado para enviar o convite.")

    with col2:
        username = st.text_input("Nome do boleiro", max_chars=50, help="Nome do boleiro, deve ser único, que ficara nas listas, recordes, registros de babas e login")
        phone_number = st.text_input("Numero de telefone", max_chars=20)

    is_admin = st.checkbox("Conceder permissão de administrador?", value=False, help="Isso permitirá que o usuário possa fazer edições de registros")

    submitted = st.form_submit_button("Enviar convite", type="primary")

    # Colocar uma dupla confirmacao de enviar convite caso is_admin tenha sido marcado como true

    if submitted:
        if not name or not email or not username or not phone_number:
            st.error("Campos nomes, email, username e telefone sao obrigatorios")
        else:
            new_user_data = {
                "name": name,
                "email": email,
                "username": username,
                "phone_number": phone_number,
                "is_admin": is_admin
            }

            success, response = post('users', new_user_data)

            if success:

                if isinstance(response, dict):
                    invite_link = response.get("invite_link", "Link não retornado.")
                else:
                    invite_link = "Link não retornado."
                st.success(f"Usuário **{username}** cadastrado com sucesso e convite gerado!")
                st.info("O usuário deve usar o link abaixo para completar o cadastro:")
                st.code(invite_link)
            else:
                st.error(response)