import asyncio
import sys
from datetime import datetime, timezone

from app.db.base import AsyncSessionLocal, engine
from app.db.models.user import User
from app.core.utils import encrypt_data
from app.config.settings import PHRASE_ENCODE


async def seed():
    if not PHRASE_ENCODE:
        raise ValueError("PHRASE_ENCODE não configurado em secrets.toml")

    encrypted_password = encrypt_data("Admin@123", PHRASE_ENCODE)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            admin = User(
                name="Admin",
                email="admin@baygon.com",
                username="admin",
                password=encrypted_password,
                is_admin=True,
                is_active=True,
                phone_number="00000000000",
            )
            session.add(admin)

    print("✅ Admin criado!")
    print("   username: admin")
    print("   senha:    Admin@123")


if __name__ == "__main__":
    asyncio.run(seed())
