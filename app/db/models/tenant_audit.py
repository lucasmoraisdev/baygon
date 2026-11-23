from typing import Optional
from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class TenantAuditLog(Base):
    __tablename__ = "tenant_audit_logs"

    id_audit: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # ex: "login", "create_team", "update_score"
    entity: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<TenantAuditLog(tenant='{self.tenant_id}', action='{self.action}', entity='{self.entity}')>"
