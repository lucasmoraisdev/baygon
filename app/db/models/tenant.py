import uuid
from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import Column, String, Boolean, DateTime, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp

if TYPE_CHECKING:
    from app.db.models.tenant_module import TenantModule
    from app.db.models.plan import Plan


class Tenant(Base, Timestamp):
    __tablename__ = "tenants"

    id_tenant: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(63), unique=True, index=True, nullable=False)
    custom_domain: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(10), default="#059669", nullable=False)
    secondary_color: Mapped[str] = mapped_column(String(10), default="#10b981", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active, suspended, pending
    plan_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    custom_max_tournaments: Mapped[Optional[int]] = mapped_column(nullable=True)

    plan: Mapped[Optional["Plan"]] = relationship(
        "Plan",
        primaryjoin="Tenant.plan_id == Plan.id_plan",
        foreign_keys="Tenant.plan_id",
        lazy="selectin",
    )

    modules: Mapped[List["TenantModule"]] = relationship(
        "TenantModule",
        back_populates="tenant",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def has_module(self, module_code: str) -> bool:
        """Verifica se o tenant possui determinado módulo ativo."""
        for mod in self.modules:
            if mod.module_code == module_code and mod.is_active:
                return True
        return False

    def __repr__(self):
        return f"<Tenant(slug='{self.slug}', name='{self.name}', status='{self.status}')>"
