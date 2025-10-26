import streamlit as st
import uuid
from datetime import datetime
from app.config.settings import DATABASE_CONNECTION_NAME, APP_URL
from app.core.state_manager import get_user_status

conn = st.connection(DATABASE_CONNECTION_NAME)

def invite_new_user(user_data):
    """Insere o novo usuario no banco de dados com um token de configuracao
    e retorna o link de invite"""
    # 1. Gerar token unico  e dados de cadastro
    # O token de configuracao sera usada para o usuario completar o cadastro (definir a senha)
    setup_token = str(uuid.uuid4())
    current_time = datetime.now()

    # Senha inicial tera uma senha aleatoria uuid v4. 
    initial_password = str(uuid.uuid4())
    
    try:
        conn.query(
            """
            INSERT INTO users
            (name, is_admin, email, username, phone_number, created_at, password, setup_token)
            VALUES
            (:name, :is_admin, :email, :username, :phone_number, :created_at, :password, :setup_token)
            """,
            params={
                "name": user_data["name"],
                "is_admin": user_data["is_admin"],
                "email": user_data["email"],
                "username": user_data["username"],
                "phone_number": user_data["phone_number"],
                "created_at": current_time,
                "password": initial_password,
                "setup_token": setup_token
            },
            ttl=0
        )
        print()

        invite_link = f"{APP_URL}/complete_register?setup_token={setup_token}&user={user_data['username']}"

        return True, invite_link
    except Exception as e:
        st.error(f"Error ao tentar enviar email")
        print(f"Error ao tentar enviar email: {e}")
        return False, None

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

            success, invite_link = invite_new_user(new_user_data)

            if success:
                st.success(f"Usuário **{username}** cadastrado com sucesso e convite gerado!")
                st.info(f"O usuário deve usar o link abaixo para completar o cadastro:")
                st.code(invite_link)

                # Adicionar provedor de email
            else:
                st.error("Falha ao registrar o convite.")