import streamlit as st
import bcrypt
import logging
from app.config.settings import DATABASE_CONNECTION_NAME
from app.core.state_manager import set_logged_in_user
from sqlalchemy import text


conn = st.connection(DATABASE_CONNECTION_NAME, type='sql')

logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')

def authenticate_user(username: str, password: str) -> bool:
    """Busca o usuario no DB, verifica a senha e define o estado da sessao em caso de sucesso"""
    if not username or not password:
        return False
    
    try:
        """
        1. Consulta ao banco de dados: Busca a senha hash e o status do admin
        """
        result = conn.query(
            "SELECT password, is_admin FROM users WHERE username = :username AND deleted_at IS NULL",
            params={"username": username},
        )

        logging.info(f"RESULTADO DA QUERY: {result}", exc_info=True)
        print(f"RESULTADO DA QUERY: {result}")

        if not result.empty:
            stored_hashed_password = result.iloc[0]['password']
            is_admin_user = result.iloc[0]['is_admin']

            # Garantindo que a senha armazenada esteja como bytes
            if isinstance(stored_hashed_password, str):
                stored_hashed_password = stored_hashed_password.encode('utf-8')

            # Validando senha
            if bcrypt.checkpw(password.encode('utf-8'), stored_hashed_password):
                set_logged_in_user(username, is_admin_user)
                return True
            return False
        return False
    except Exception as e:
        logging.error(f"Erro ao tentar conectar ao banco de dados: {e}", exc_info=True)
        print(f"Erro ao tentar conectar ao banco de dados: {e}")
        return False