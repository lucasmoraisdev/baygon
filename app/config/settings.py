import os
from dotenv import load_dotenv

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT")

DATABASE_CONNECTION_NAME = "local_database" if ENVIRONMENT == "development" else "production_database" 

DEFAULT_USER_PERMISSION = {
    "logged_in": False,
    "is_admin": True,
    "username": None
}