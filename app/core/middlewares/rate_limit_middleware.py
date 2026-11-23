from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.tenant_context import get_current_tenant_id, get_current_tenant
from app.core.services.rate_limit_service import get_rate_limit_service

EXEMPT_PATHS = {
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/tenants/check-slug",
    "/api/v1/checkout/plans",
    "/api/v1/checkout/session",
    "/api/v1/webhooks/payment",
}


class TenantRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware que impõe rate limits por associação (tenant),
    impedindo que um tenant com tráfego abusivo comprometa a performance
    dos demais (Proteção Noisy Neighbor).
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if (
            path in EXEMPT_PATHS
            or path.startswith("/static")
            or path.startswith("/api/v1/checkout")
            or path.startswith("/api/v1/webhooks")
        ):
            return await call_next(request)

        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return await call_next(request)

        tenant = get_current_tenant()
        plan_code = "default"
        if tenant and hasattr(tenant, "plan") and tenant.plan:
            plan_code = getattr(tenant.plan, "code", "default")

        rate_limiter = get_rate_limit_service()
        res = rate_limiter.check_rate_limit(tenant_id=tenant_id, plan_code=plan_code)

        if not res.allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limit_exceeded",
                    "message": "Limite de requisições excedido para esta associação (Noisy Neighbor Protection).",
                    "tenant_id": tenant_id,
                    "limit": res.limit,
                    "retry_after": res.retry_after,
                },
                headers={
                    "Retry-After": str(res.retry_after),
                    "X-RateLimit-Limit": str(res.limit),
                    "X-RateLimit-Remaining": str(res.remaining),
                    "X-RateLimit-Reset": str(res.reset_seconds),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(res.limit)
        response.headers["X-RateLimit-Remaining"] = str(res.remaining)
        response.headers["X-RateLimit-Reset"] = str(res.reset_seconds)
        return response
