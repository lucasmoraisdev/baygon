import os
from dotenv import load_dotenv
import toml

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

secrets_path = os.path.join(os.path.dirname(__file__), "..", "..", ".streamlit", "secrets.toml")
secrets_path = os.path.abspath(secrets_path)
if os.path.exists(secrets_path):
    secrets = toml.load(secrets_path)
else:
    secrets = {}

DATABASE_CONNECTION_NAME = (
    "local_database"
    if ENVIRONMENT == "development"
    else "production_database"
)

db_config = secrets.get("connections", {}).get(DATABASE_CONNECTION_NAME, {})
if db_config:
    DATABASE_URL = (
        f"{db_config.get('dialect', 'mysql')}+aiomysql://"
        f"{db_config.get('username')}:{db_config.get('password')}"
        f"@{db_config.get('host')}:{db_config.get('port')}/{db_config.get('database')}"
    )
else:
    DATABASE_URL = os.getenv("DATABASE_URL")
DEFAULT_USER_PERMISSION = {
    "logged_in": True,
    "is_admin": True,
    "username": None
}

APP_URL = (
    "http://localhost:8501"
    if ENVIRONMENT == "development"
    else "https://baygon-fantasy.streamlit.app"
)

API_URL = (
    "http://localhost:8000"
    if ENVIRONMENT == "development"
    else "https://api-baygon-fantasy.streamlit.app"
)

ROLES = ["ADMIN", "BOLEIRO", "RANDOM"]

ENCODING=secrets.get("encryption", {}).get("default_password", {})

if ENCODING:
    PHRASE_DECODE=ENCODING.get("decode")
    PHRASE_ENCODE=ENCODING.get("encode")
else:
    PHRASE_DECODE=None
    PHRASE_ENCODE=None

EMAIL_DATA = secrets.get("email", {})

EMAIL_CONFIG = {
    "from_email": EMAIL_DATA.get("from_email", ""),
    "smtp_server": EMAIL_DATA.get("smtp_server", ""),
    "smtp_port": EMAIL_DATA.get("smtp_port", ""),
    "smtp_user": EMAIL_DATA.get("smtp_user", ""),
    "smtp_password": EMAIL_DATA.get("smtp_password", "")
}