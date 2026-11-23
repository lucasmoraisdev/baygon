from typing import Optional
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column


class TenantMixin:
    """
    Mixin base para todas as entidades que pertencem a um tenant específico.
    Fornece a coluna `tenant_id` e atua como discriminador para o interceptor
    automático de segurança multi-tenant no SQLAlchemy.
    """
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
