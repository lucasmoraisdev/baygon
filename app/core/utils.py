from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
import smtplib
import uuid
from cryptography.fernet import Fernet
import random
import json

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
    
    cipher = Fernet(key)
    decrypted_data = cipher.decrypt(encoded.encode())
    options = json.loads(decrypted_data.decode())
    return options

def send_invite_email(from_email: str, to_email: str, invite_link: str, smtp_server: str, smtp_port: int, smtp_user: str, smtp_password: str, default_password: str):
    subject = "Bem vindo a Associação Baygon! Complete seu cadastro."

    html_body = f"""
    <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif;}}
                .content {{ max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px;}}
                .button {{
                    display: inline-block;
                    padding: 10px 20px;
                    background-color: #007BFF;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    margin-top: 20px;
               }}
                .footer {{
                    font-size: 12px;
                    color: #888888;
                    margin-top: 30px;
                    text-align: center;
               }}
                .warning-box {{
                    background-color: #ffcc00;
                    color: #333;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-weight: bold;
                    border: 1px solid #e0c500;
               }}
            </style>
        </head>
        <body>
            <div class="content">
                <h2>Bem-vindo!</h2>
                <p>Obrigado por se inscrever conosco! Para finalizar o seu cadastro, clique no botão abaixo para verificar o seu e-mail e definir sua senha:</p>
                <a href="{invite_link}" class="button">Completar o Cadastro</a>
                
                <!-- Caixa de Aviso -->
                <div class="warning-box">
                    <p><strong>Atenção:</strong> Você já possui uma senha inicial. Para ativar sua conta e garantir a segurança do seu perfil, por favor, cadastre uma nova senha ao completar seu cadastro.</p>
                    <p><strong>Sua senha inicial é:</strong></p>
                    <div class="password-box">{default_password}</div>
                
                </div>

                <p>Se você não se inscreveu para esta conta, por favor, ignore este e-mail.</p>
                <div class="footer">
                    <p>Atenciosamente, <br>A Equipe Baygon</p>
                </div>
            </div>
        </body>
    </html>

    """
    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((str(Header("Support", "utf-8")), from_email))
    msg["To"] = to_email
    msg["Subject"] = subject
    
    html_part = MIMEText(html_body, "html")
    msg.attach(html_part)

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls() 
        server.login(smtp_user, smtp_password)

        # Send the email
        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()

        print(f"Email successfully sent to {to_email}")
    except Exception as e:
        print(f"Failed to send email: {str(e)}")

    
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