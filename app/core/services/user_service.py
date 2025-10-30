import random
from re import S
import uuid

from fastapi import HTTPException, status
from app.db.models.user import User
from app.db.repositories.user_repository import UserRepository
from app.config.settings import PHRASE_DECODE, PHRASE_ENCODE, APP_URL, EMAIL_CONFIG
from app.core.utils import encrypt_data, load_options, get_random_password, send_invite_email

class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo
        self.default_passwords = load_options(PHRASE_ENCODE, PHRASE_DECODE) if PHRASE_DECODE and PHRASE_ENCODE else []

    async def create_user_with_invite(self, user_data: dict):
        required_data_is_used = await self.repo.validate_if_user_data_exists(
            username=user_data["username"],
            phone_number=user_data["phone_number"],
            email=user_data["email"]
        )

        if required_data_is_used:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um usuário cadastrado com esse email, username ou telefone."
            )

        setup_token = str(uuid.uuid4())
        default_password = get_random_password(self.default_passwords)

        key = PHRASE_ENCODE if PHRASE_ENCODE else ""
        user_data.update({
            "setup_token": setup_token,
            "password": encrypt_data(default_password, key )
        })
        print(f"Usuario cadastrado: {user_data}")

        user = User(**user_data)

        new_user = await self.repo.create(user=user)
        print(f"Usuario cadastrado: {new_user}")

        # enviar email 
        invite_link = f"{APP_URL}/complete-registration?setup_token={setup_token}"
        print(f"invite_link: {invite_link}")
        try:
            print(f"CONFIG EMAIL: {EMAIL_CONFIG}")
            send_invite_email(
                from_email=EMAIL_CONFIG["from_email"],
                to_email=user_data["email"],
                invite_link=invite_link,
                smtp_server=EMAIL_CONFIG["smtp_server"],
                smtp_port=EMAIL_CONFIG["smtp_port"],
                smtp_user=EMAIL_CONFIG["smtp_user"],
                smtp_password=EMAIL_CONFIG["smtp_password"],
                default_password=default_password
            )
            print(f"Convite enviado para {user_data['email']}")
        except Exception as e:
            print(f"Erro ao enviar o e-mail: {str(e)}")
        
        new_user.invite_link = invite_link
        return new_user

    async def list_all_users(self, active: bool = True):
        if active:
            return await self.repo.list_all_active_users()
        return await self.repo.list_all_users()

    async def get_user_by_id(self, user_id: int):
        return await self.repo.get_by_id(user_id)

    async def get_user_by_username(self, username: str):
        return await self.repo.get_by_username(username)
    
    async def get_user_by_phone_number(self, phone_number: str):
        return await self.repo.get_by_phone_number(phone_number)
    
    async def get_user_by_email(self, email: str):
        return await self.repo.get_by_email(email)

    async def update_user(self, user_id: int, user_data: dict):
        return await self.repo.update(user_id, user_data)

    async def delete_user(self, user_id: int):
        return await self.repo.delete_user(user_id)

        return new_user
    