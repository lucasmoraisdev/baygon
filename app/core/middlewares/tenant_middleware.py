from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.tenant_context import set_current_tenant, clear_tenant_context
from app.db.base import AsyncSessionLocal
from app.db.repositories.tenant_repository import TenantRepository
from app.core.services.tenant_service import TenantService

# Rotas globais isentas de resolução de tenant
EXEMPT_PATHS = {
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1",
    "/api/v1/",
    "/api/v1/tenants/check-slug",
    "/api/v1/checkout/plans",
    "/api/v1/checkout/session",
    "/api/v1/webhooks/payment",
}

DEFAULT_FALLBACK_TENANT_SLUG = "baygon"


class TenantResolutionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Permite rotas públicas/documentação/checkout sem tenant obrigatório
        if (
            path in EXEMPT_PATHS 
            or path.startswith("/static")
            or path.startswith("/api/v1/checkout")
            or path.startswith("/api/v1/webhooks")
        ):
            return await call_next(request)

        # 1. Extração do slug via header ou Host
        slug = request.headers.get("x-tenant-slug")

        if not slug:
            host = request.headers.get("host", "").split(":")[0].lower()
            if host and host not in {"localhost", "127.0.0.1", "testserver", "test"}:
                parts = host.split(".")
                if len(parts) > 1:
                    slug = parts[0]

        # 2. Fallback de transição e desenvolvimento
        if not slug:
            slug = DEFAULT_FALLBACK_TENANT_SLUG

        # 3. Resolução no banco de dados / cache
        try:
            async with AsyncSessionLocal() as session:
                repo = TenantRepository(session)
                service = TenantService(repo)
                tenant = await service.get_tenant_by_slug(slug)

                # Fallback para o tenant padrão se o slug extraído do host (ex: nome do app no Render) não for um tenant específico
                if not tenant and slug != DEFAULT_FALLBACK_TENANT_SLUG:
                    tenant = await service.get_tenant_by_slug(DEFAULT_FALLBACK_TENANT_SLUG)

                if not tenant:
                    return JSONResponse(
                        status_code=404,
                        content={
                            "error": "tenant_not_found",
                            "message": f"Associação com subdomínio '{slug}' não foi encontrada.",
                            "slug": slug,
                        },
                    )

                if tenant.status == "suspended":
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "tenant_suspended",
                            "message": "O acesso desta associação está temporariamente suspenso.",
                            "slug": slug,
                        },
                    )

                # Injeta tenant no contexto da corrotina
                set_current_tenant(tenant)

            # Executa a requisição dentro do contexto configurado
            response = await call_next(request)
            return response
        finally:
            clear_tenant_context()
