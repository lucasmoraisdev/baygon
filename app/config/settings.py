import os
from dotenv import load_dotenv
import toml

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

secrets_path = os.path.join(os.path.dirname(__file__), "../../.streamlit/secrets.toml")
if os.path.exists(secrets_path):
    secrets = toml.load(secrets_path)
else:
    secrets = {}

DATABASE_CONNECTION_NAME = (
    "connections.local_database"
    if ENVIRONMENT == "development"
    else "connections.production_database"
)

db_config = secrets.get(DATABASE_CONNECTION_NAME, {})

if db_config:
    DATABASE_URL = (
        f"{db_config.get('dialect', 'mysql')}+pymysql://"
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

ROLES = ["ADMIN", "BOLEIRO", "RANDOM"]
