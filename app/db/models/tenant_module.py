from typing import TYPE_CHECKING, Optional
from datetime import datetime
from sqlalchemy import ForeignKey, Integer, String, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp

if TYPE_CHECKING:
    from app.db.models.tenant import Tenant


class TenantModule(Base, Timestamp):
    __tablename__ = "tenant_modules"
    __table_args__ = (
        UniqueConstraint("tenant_id", "module_code", name="uq_tenant_module"),
    )

    id_tenant_module: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id_tenant", ondelete="CASCADE"), nullable=False, index=True)
    module_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # 'competitions', 'financial', 'fantasy', 'gamification'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="modules",
    )

    def __repr__(self):
        return f"<TenantModule(tenant_id='{self.tenant_id}', module='{self.module_code}', active={self.is_active})>"
