import contextvars
from typing import Optional, Dict, Any

# Variáveis de contexto para corrotinas assíncronas
_current_tenant_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_tenant_id", default=None
)
_current_tenant_slug: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_tenant_slug", default=None
)
_current_tenant_obj: contextvars.ContextVar[Optional[Any]] = contextvars.ContextVar(
    "current_tenant_obj", default=None
)
_bypass_tenant_isolation: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "bypass_tenant_isolation", default=False
)


def get_current_tenant_id() -> Optional[str]:
    """Retorna o ID do tenant da requisição atual."""
    return _current_tenant_id.get()


def set_current_tenant_id(tenant_id: Optional[str]) -> None:
    """Define o ID do tenant para a requisição atual."""
    _current_tenant_id.set(tenant_id)


def get_current_tenant_slug() -> Optional[str]:
    """Retorna o slug do tenant da requisição atual."""
    return _current_tenant_slug.get()


def set_current_tenant_slug(slug: Optional[str]) -> None:
    """Define o slug do tenant para a requisição atual."""
    _current_tenant_slug.set(slug)


def get_current_tenant() -> Optional[Any]:
    """Retorna a instância ou metadados do tenant atual."""
    return _current_tenant_obj.get()


def set_current_tenant(tenant: Optional[Any]) -> None:
    """Define a instância do tenant para a requisição atual."""
    _current_tenant_obj.set(tenant)
    if tenant and hasattr(tenant, "id_tenant"):
        set_current_tenant_id(str(tenant.id_tenant))
    if tenant and hasattr(tenant, "slug"):
        set_current_tenant_slug(str(tenant.slug))


def is_tenant_bypass() -> bool:
    """Verifica se o isolamento multi-tenant está desativado (ex: migrations, scripts globais de admin)."""
    return _bypass_tenant_isolation.get()


def set_tenant_bypass(bypass: bool = True) -> None:
    """Ativa ou desativa o bypass de isolamento (uso restrito a scripts de manutenção)."""
    _bypass_tenant_isolation.set(bypass)


def clear_tenant_context() -> None:
    """Limpa todo o contexto do tenant na requisição atual."""
    _current_tenant_id.set(None)
    _current_tenant_slug.set(None)
    _current_tenant_obj.set(None)
    _bypass_tenant_isolation.set(False)
