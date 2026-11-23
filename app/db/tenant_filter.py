from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria
from app.core.tenant_context import get_current_tenant_id, is_tenant_bypass
from app.db.tenant_mixin import TenantMixin


def setup_tenant_isolation(engine):
    """
    Configura interceptores de segurança multi-tenant no SQLAlchemy.
    Garante que toda consulta SELECT/UPDATE/DELETE e todo INSERT sejam
    estritamente limitados ao tenant ativo no contexto da requisição.
    """

    # Evento de execução de queries ORM
    @event.listens_for(Session, "do_orm_execute")
    def _apply_tenant_filter(execute_state):
        if is_tenant_bypass():
            return

        current_tenant = get_current_tenant_id()
        if not current_tenant:
            return

        # Aplica filtro automático em todas as entidades que herdam de TenantMixin
        if execute_state.is_select:
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    TenantMixin,
                    lambda cls: cls.tenant_id == current_tenant,
                    include_aliases=True,
                )
            )

    # Evento antes de salvar novos registros
    @event.listens_for(Session, "before_flush")
    def _apply_tenant_on_insert(session, flush_context, instances):
        if is_tenant_bypass():
            return

        current_tenant = get_current_tenant_id()
        if not current_tenant:
            return

        for obj in session.new:
            if isinstance(obj, TenantMixin) and getattr(obj, "tenant_id", None) is None:
                setattr(obj, "tenant_id", current_tenant)
