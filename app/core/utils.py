from datetime import datetime, timedelta, timezone
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
import smtplib
import uuid
from cryptography.fernet import Fernet
import random
import json
from fastapi import HTTPException, status
import jwt
from app.core.jwt_manager import JWTManager

from app.config.settings import SECRET_KEY

def get_random_password(passwords: list[str]) -> str:
    """
    Retorna uma senha aleatoria a partir
    das opcoes salvas.
    :param passwords: Lista de senhas disponiveis.
    :return: Uma senha aleatoria.
    """

    if not passwords:
        return uuid.uuid4().hex
    
    return random.choice(passwords)

def load_options(key: str, encoded: str) -> list[str]:
    """
    Carrega e descriptografa as opcoes de senhas disponiveis.
    :param key: Chave de criptografia.
    :param encoded: Senhas criptografadas.
    :return: Lista de senhas descriptografadas.
    """
    if key is None:
        raise ValueError("A chave de criptografia não pode ser nula.")
    
    if encoded is None:
        raise ValueError("As senhas criptografadas não podem ser nulas.")
    
    try:
        cipher = Fernet(key)
        decrypted_data = cipher.decrypt(encoded.encode())
        options = json.loads(decrypted_data.decode())
        return options
    except Exception as e:
        import sys
        print(f"ERROR: Failed to decrypt options. Key length: {len(key)}, Encoded length: {len(encoded)}", file=sys.stderr)
        print(f"ERROR Details: {type(e).__name__}: {e}", file=sys.stderr)
        # Return empty list if decryption fails instead of crashing
        return []

from app.core.email_templates import render_invite_email, render_password_reset_email


def send_invite_email(
    from_email: str,
    to_email: str,
    invite_link: str,
    smtp_server: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    default_password: str,
):
    subject = "Convite para a Associação Baygon • Complete seu cadastro"
    html_body = render_invite_email(invite_link=invite_link, default_password=default_password)

    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((str(Header("Associação Baygon", "utf-8")), from_email))
    msg["To"] = to_email
    msg["Subject"] = subject

    html_part = MIMEText(html_body, "html", "utf-8")
    msg.attach(html_part)

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)

        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()

        print(f"Email de convite enviado com sucesso para {to_email}")
    except Exception as e:
        print(f"Falha ao enviar e-mail de convite: {str(e)}")


def send_password_reset_email(
    from_email: str,
    to_email: str,
    reset_link: str,
    smtp_server: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
):
    subject = "Redefinição de Senha • Associação Baygon"
    html_body = render_password_reset_email(reset_link=reset_link)

    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((str(Header("Associação Baygon", "utf-8")), from_email))
    msg["To"] = to_email
    msg["Subject"] = subject

    html_part = MIMEText(html_body, "html", "utf-8")
    msg.attach(html_part)

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)

        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()

        print(f"Email de redefinição de senha enviado com sucesso para {to_email}")
    except Exception as e:
        print(f"Falha ao enviar e-mail de redefinição de senha: {str(e)}")

def encrypt_data(data: str, key: str) -> str:
    """
    Encriptografa os dados.
    :param data: Dados a serem encriptografados.
    :param key: Chave de criptografia.
    :return: Dados encriptografados.
    """
    cipher = Fernet(key)
    encrypted_data = cipher.encrypt(data.encode())
    return encrypted_data.decode()

def decrypt_data(encrypted_data: str, key: str) -> str:
    """
    Descriptografa os dados.
    :param encrypted_data: Dados a serem descriptografados.
    :param key: Chave de criptografia.
    :return: Dados descriptografados.
    """
    cipher = Fernet(key)
    decrypted_data = cipher.decrypt(encrypted_data.encode())
    return decrypted_data.decode()

def generate_setup_token(user_id: int, setup_token: str, expires_delta: datetime) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=24),
        "setup_token": setup_token
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return token

def decode_jwt_token(token: str): 
    """
    Decodifica um token jwt e valida a expiração.
    Retorna o payload (dict) se for válido, ou levanta HTTPException se inválido.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido."
        )
    
def generate_jwt_token(user_id: int, is_admin: bool = False):
    """
    Gera um token JWT de autenticação para o usuário logado.
    
    Args:
        user_id (int): ID do usuário.

    Returns:
        str: Token JWT.
    """
    jwt_manager = JWTManager()

    payload = {
        "sub": str(user_id),
        "roleId": "1" if is_admin else "0"
    }

    token = jwt_manager.create_access_token(payload)
    return token