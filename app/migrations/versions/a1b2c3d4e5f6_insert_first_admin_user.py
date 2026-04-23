"""insert first admin user

Revision ID: a1b2c3d4e5f6
Revises: 94350a4c7d03
Create Date: 2026-03-24 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
import datetime

from app.core.utils import encrypt_data
from app.config.settings import PHRASE_ENCODE

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '94350a4c7d03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # We define a temporary table representation for the `users` table
    users = table(
        'users',
        column('name', sa.String),
        column('email', sa.String),
        column('username', sa.String),
        column('password', sa.String),
        column('is_admin', sa.Boolean),
        column('phone_number', sa.String),
        column('is_active', sa.Boolean),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime)
    )

    # Note: PHRASE_ENCODE is required for encryption
    key = str(PHRASE_ENCODE) if PHRASE_ENCODE else ""
    if not key or len(key) < 32:
        raise ValueError("Invalid or missing PHRASE_ENCODE. You must have a valid Fernet key in your secrets.")
        
    default_password = 'Admin@123'
    encrypted_password = encrypt_data(default_password, key)

    op.bulk_insert(
        users,
        [
            {
                'name': 'Admin User',
                'email': 'admin@baygon.com',
                'username': 'admin',
                'password': encrypted_password,
                'is_admin': True,
                'is_active': True,
                'phone_number': '00000000000',
                'created_at': datetime.datetime.utcnow(),
                'updated_at': datetime.datetime.utcnow()
            }
        ]
    )


def downgrade() -> None:
    op.execute("DELETE FROM users WHERE username = 'admin' AND email = 'admin@baygon.com'")
