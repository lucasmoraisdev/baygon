from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import ForeignKey, Integer, String, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp
import enum

if TYPE_CHECKING:
    from app.db.models.player import Player
    from app.db.models.user import User


class AdminActionTypeEnum(str, enum.Enum):
    SUSPEND = "suspend"
    FINE = "fine"
    BLOCK = "block"
    UNBLOCK = "unblock"
    OBSERVE = "observe"


class PlayerAdminAction(Base, Timestamp):
    """Modelo para rastrear ações administrativas em jogadores"""
    __tablename__ = "player_admin_actions"

    id_action: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Relacionamentos
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id_player"), nullable=False)
    admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id_user"), nullable=False)
    
    # Dados da ação
    action_type: Mapped[AdminActionTypeEnum] = mapped_column(SQLEnum(AdminActionTypeEnum), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Dados específicos por tipo de ação
    suspension_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    suspension_matches: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    suspension_until: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True)
    is_indefinite: Mapped[bool] = mapped_column(default=False)
    fine_amount: Mapped[Optional[float]] = mapped_column(nullable=True)
    observations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(default=True)
    
    # Relacionamentos ORM
    player: Mapped["Player"] = relationship("Player", foreign_keys=[player_id])
    admin: Mapped["User"] = relationship("User", foreign_keys=[admin_id])

    def __repr__(self):
        return f"<PlayerAdminAction(player_id={self.player_id}, action_type={self.action_type}, admin_id={self.admin_id})>"
