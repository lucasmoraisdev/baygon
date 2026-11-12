import os
from dotenv import load_dotenv
import toml

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("environment", "development"))

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

API_URL = os.getenv(
    "API_URL",
    "http://localhost:8001"
    if ENVIRONMENT == "development"
    else "https://api-baygon-fantasy.streamlit.app"
)

ROLES = ["ADMIN", "BOLEIRO", "RANDOM"]

ENCODING = secrets.get("encryption", {}).get("default_password", {})

if ENCODING:
    # In secrets.toml:
    # decode = Fernet key (32 url-safe base64 bytes)
    # encode = encrypted default-password-list payload
    PHRASE_ENCODE = ENCODING.get("decode")
    PHRASE_DECODE = ENCODING.get("encode")
else:
    PHRASE_DECODE = os.getenv("PHRASE_DECODE")
    PHRASE_ENCODE = os.getenv("PHRASE_ENCODE")

print(f"Configurações de criptografia: PHRASE_DECODE={PHRASE_DECODE}, PHRASE_ENCODE={PHRASE_ENCODE}")
EMAIL_DATA = secrets.get("email", {})

EMAIL_CONFIG = {
    "from_email": EMAIL_DATA.get("from_email", os.getenv("SMTP_FROM_EMAIL", "")),
    "smtp_server": EMAIL_DATA.get("smtp_server", os.getenv("SMTP_SERVER", "")),
    "smtp_port": EMAIL_DATA.get("smtp_port", os.getenv("SMTP_PORT", "")),
    "smtp_user": EMAIL_DATA.get("smtp_user", os.getenv("SMTP_USER", "")),
    "smtp_password": EMAIL_DATA.get("smtp_password", os.getenv("SMTP_PASSWORD", ""))
}

SECRET_KEY = secrets.get("secret_key", {}).get("key") or os.getenv("SECRET_KEY", "dev-secret-key")

ACCESS_TOKEN_EXPIRE_HOURS = int(secrets.get("access_token_expire_hours", os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", 24)))
REFRESH_TOKEN_EXPIRE_DAYS = int(secrets.get("refresh_token_expire_days", os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30)))

# Sumula OCR / Vision Extraction settings (local open-source RapidOCR by default)
SUMULA_VISION_PROVIDER = os.getenv("SUMULA_VISION_PROVIDER", "auto")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5vl")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o")
