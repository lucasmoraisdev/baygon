from typing import TYPE_CHECKING
from sqlalchemy import Mapped, mapped_column, Integer, String, Boolean, func
from app.db.base import Base, Timestamp
from sqlalchemy.orm import relationship

if TYPE_CHECKING:
    from app.db.models.player import Player


class User(Base, Timestamp):
    __tablename__ = "users"

    id_user = Mapped[int] = mapped_column(Integer, primary_key=True)
    name = Mapped[str] = mapped_column(String, nullable=False)
    email = Mapped[str] = mapped_column(String, nullable=False)
    username = Mapped[str] = mapped_column(String, nullable=False)
    password = Mapped[str] = mapped_column(String, nullable=False)
    is_admin = Mapped[bool] = mapped_column(Boolean,default=False)
    phone_number = Mapped[str] = mapped_column(String, nullable=False)
    setup_token = Mapped[str] = mapped_column(String, nullable=False)


    players: Mapped[list["Player"]] = relationship("Player", back_populates="user")