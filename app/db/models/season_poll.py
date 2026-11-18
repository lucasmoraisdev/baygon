from datetime import datetime
from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp

if TYPE_CHECKING:
    from app.db.models.season import Seasons
    from app.db.models.user import User


class SeasonPoll(Base, Timestamp):
    __tablename__ = "season_polls"

    id_poll: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id_season", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1", nullable=False)
    multiple_choices: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id_user", ondelete="SET NULL"), nullable=True)

    season: Mapped["Seasons"] = relationship("Seasons")
    created_by: Mapped[Optional["User"]] = relationship("User")
    options: Mapped[List["SeasonPollOption"]] = relationship(
        "SeasonPollOption",
        back_populates="poll",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="SeasonPollOption.id_option"
    )
    votes: Mapped[List["SeasonPollVote"]] = relationship(
        "SeasonPollVote",
        back_populates="poll",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class SeasonPollOption(Base, Timestamp):
    __tablename__ = "season_poll_options"

    id_option: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    poll_id: Mapped[int] = mapped_column(ForeignKey("season_polls.id_poll", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    poll: Mapped["SeasonPoll"] = relationship("SeasonPoll", back_populates="options")
    votes: Mapped[List["SeasonPollVote"]] = relationship(
        "SeasonPollVote",
        back_populates="option",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class SeasonPollVote(Base, Timestamp):
    __tablename__ = "season_poll_votes"

    id_vote: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    poll_id: Mapped[int] = mapped_column(ForeignKey("season_polls.id_poll", ondelete="CASCADE"), nullable=False)
    option_id: Mapped[int] = mapped_column(ForeignKey("season_poll_options.id_option", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id_user", ondelete="CASCADE"), nullable=False)

    poll: Mapped["SeasonPoll"] = relationship("SeasonPoll", back_populates="votes")
    option: Mapped["SeasonPollOption"] = relationship("SeasonPollOption", back_populates="votes")
    user: Mapped["User"] = relationship("User")

    __table_args__ = (
        UniqueConstraint("poll_id", "user_id", "option_id", name="uq_season_poll_user_option"),
    )
