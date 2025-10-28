import random
from re import S
import uuid
from app.db.models.user import User
from app.db.repositories.user_repository import UserRepository
from app.config.settings import PHRASE_DECODE, PHRASE_ENCODE, APP_URL, EMAIL_CONFIG
from app.core.utils import load_options, get_random_password, send_invite_email

class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo
        self.default_passwords = load_options(PHRASE_DECODE, PHRASE_ENCODE) if PHRASE_DECODE and PHRASE_ENCODE else []

    async def create_user_with_invite(self, user_data: dict):
        setup_token = str(uuid.uuid4())
        default_password = get_random_password(self.default_passwords)

        user_data.update({
            "setup_token": setup_token,
            "password": default_password
        })

        user = User(**user_data)

        new_user = await self.repo.create(user=user)
        # enviar email 
        invite_link = f"{APP_URL}/complete-registration?setup_token={setup_token}"

        try:
            send_invite_email(
                from_email=EMAIL_CONFIG["from_email"],
                to_email=user_data["email"],
                invite_link=invite_link,
                smtp_server=EMAIL_CONFIG["smtp_server"],
                smtp_port=EMAIL_CONFIG["smtp_port"],
                smtp_user=EMAIL_CONFIG["smtp_user"],
                smtp_password=EMAIL_CONFIG["smtp_password"]
            )
            print(f"Convite enviado para {user_data['email']}")
        except Exception as e:
            print(f"Erro ao enviar o e-mail: {str(e)}")

        return new_user

    async def list_all_users(self, active: bool = True):
        if active:
            return await self.repo.list_all_active_users()
        return await self.repo.list_all_users()

    async def get_user_by_id(self, user_id: int):
        return await self.repo.get_by_id(user_id)

    async def update_user(self, user_id: int, user_data: dict):
        return await self.repo.update(user_id, user_data)

    async def delete_user(self, user_id: int):
        return await self.repo.delete_user(user_id)

        return new_user
    