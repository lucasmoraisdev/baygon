import time
import os
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Tuple

logger = logging.getLogger(__name__)


@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_seconds: int
    retry_after: int


PLAN_LIMITS: Dict[str, int] = {
    "basic": 120,        # 120 req/min
    "pro": 600,          # 600 req/min
    "enterprise": 2000,  # 2000 req/min
    "default": 120,
}


class RateLimitService:
    """
    Serviço de Rate Limiting por Tenant com backend primário em Redis
    e fallback resiliente em memória para proteção contra 'Noisy Neighbor'.
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis_client = None
        self._redis_available: Optional[bool] = None
        # Fallback em memória: {f"{tenant_id}:{minute}": (count, timestamp)}
        self._memory_store: Dict[str, Tuple[int, float]] = {}

    def _get_redis(self):
        if self._redis_available is False:
            return None
        if self._redis_client is None:
            try:
                import redis
                client = redis.Redis.from_url(
                    self.redis_url,
                    socket_connect_timeout=0.2,
                    socket_timeout=0.2,
                    decode_responses=True,
                )
                client.ping()
                self._redis_client = client
                self._redis_available = True
                logger.info(f"[RateLimit] Conectado ao Redis em {self.redis_url}")
            except Exception as e:
                logger.warning(f"[RateLimit] Redis não disponível ({e}). Utilizando fallback in-memory.")
                self._redis_available = False
                self._redis_client = None
        return self._redis_client

    def check_rate_limit(
        self,
        tenant_id: str,
        plan_code: str = "default",
        cost: int = 1,
        custom_limit: Optional[int] = None,
    ) -> RateLimitResult:
        limit = custom_limit or PLAN_LIMITS.get(plan_code.lower(), PLAN_LIMITS["default"])
        now = int(time.time())
        current_minute = now // 60
        reset_seconds = 60 - (now % 60)
        cache_key = f"rate_limit:{tenant_id}:{current_minute}"

        redis_client = self._get_redis()
        current_count = 0

        if redis_client:
            try:
                pipe = redis_client.pipeline()
                pipe.incrby(cache_key, cost)
                pipe.expire(cache_key, 65)
                results = pipe.execute()
                current_count = results[0]
            except Exception as e:
                logger.warning(f"[RateLimit] Falha no Redis ({e}). Ativando fallback em memória.")
                self._redis_available = False
                redis_client = None

        if not redis_client:
            # Fallback in-memory
            threshold = now - 120
            self._memory_store = {k: v for k, v in self._memory_store.items() if v[1] > threshold}
            existing = self._memory_store.get(cache_key)
            if existing:
                current_count = existing[0] + cost
            else:
                current_count = cost
            self._memory_store[cache_key] = (current_count, float(now))

        remaining = max(0, limit - current_count)
        allowed = current_count <= limit
        retry_after = reset_seconds if not allowed else 0

        return RateLimitResult(
            allowed=allowed,
            limit=limit,
            remaining=remaining,
            reset_seconds=reset_seconds,
            retry_after=retry_after,
        )

    def reset_for_tenant(self, tenant_id: str) -> None:
        """Limpa registros de contagem do tenant (usado em testes)."""
        keys_to_del = [k for k in self._memory_store.keys() if k.startswith(f"rate_limit:{tenant_id}:")]
        for k in keys_to_del:
            self._memory_store.pop(k, None)

        client = self._get_redis()
        if client:
            try:
                for key in client.scan_iter(f"rate_limit:{tenant_id}:*"):
                    client.delete(key)
            except Exception:
                pass


_rate_limit_instance: Optional[RateLimitService] = None


def get_rate_limit_service() -> RateLimitService:
    global _rate_limit_instance
    if _rate_limit_instance is None:
        _rate_limit_instance = RateLimitService()
    return _rate_limit_instance
