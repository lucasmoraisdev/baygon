from typing import TYPE_CHECKING, Optional
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp
from app.db.tenant_mixin import TenantMixin

if TYPE_CHECKING:
    from app.db.models.round import Round


class RoundMedia(Base, Timestamp, TenantMixin):
    __tablename__ = "round_media"

    id_round_media: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round", ondelete="CASCADE"), nullable=False)
    media_type: Mapped[str] = mapped_column(String(50), nullable=False)  # youtube, instagram, tiktok, other
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    round: Mapped["Round"] = relationship("Round", back_populates="media")

    def __repr__(self):
        return f"<RoundMedia(id={self.id_round_media}, round_id={self.round_id}, type='{self.media_type}')>"
