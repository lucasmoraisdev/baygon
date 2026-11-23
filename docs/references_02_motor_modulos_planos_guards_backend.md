# Referência 02: Motor de Módulos, Planos & Guards no Backend

## 📌 Status: CONCLUÍDA ✅ (20/11/2026)

---

## 1. Objetivo & Escopo da Fase
Implementar o motor de licenciamento e autorização modular da plataforma no backend (FastAPI), permitindo que:
- O sistema identifique dinamicamente o inquilino (*tenant*) a partir da requisição HTTP (subdomínio ou header `x-tenant-slug`);
- Cada rota de negócio especializada (ex: Fantasy Game, Financeiro de Sócios, Roletas) seja protegida por **Guards de Módulos** declarativos;
- Associações que não contrataram um módulo específico recebam resposta imediata `403 Feature Not Subscribed`;
- O endpoint `/api/v1/tenant/me` forneça metadados da associação, plano atual, cotas contratuais e lista de módulos ativos para o frontend;
- O lookup de tenant e verificação de módulos ocorra com cache em memória (<1ms de latência), evitando gargalos no banco.

---

## 2. Arquitetura Técnica Implementada

### 2.1. Middleware de Resolução de Tenant (`TenantResolutionMiddleware`)
- Intercepta requisições HTTP antes de atingirem os controladores em `app/core/middlewares/tenant_middleware.py`.
- Extrai o slug do tenant de:
  1. Header explícito `x-tenant-slug` (injetado pelo Edge/Next.js Middleware);
  2. Subdomínio do Host: `slug.dominio.com` -> `slug`;
  3. Fallback de desenvolvimento e transição para `baygon`.
- Busca a instância do Tenant via `TenantService` com cache TTL em memória (300 segundos).
- Configura `set_current_tenant(tenant)` e `set_current_tenant_id(tenant.id_tenant)` via `tenant_context.py`.
- Bloqueia com `404 tenant_not_found` se o slug for desconhecido e `403 tenant_suspended` se o tenant estiver suspenso.
- Limpa todo o contexto no bloco `finally:` da requisição.

### 2.2. Injeção de Dependência de Módulo: `@require_module`
Localizado em `app/core/dependencies/modules.py`:
```python
def require_module(module_code: str):
    async def dependency(tenant: Tenant = Depends(get_current_tenant)):
        if not tenant.has_module(module_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "feature_not_subscribed",
                    "module": module_code,
                    "message": f"O módulo '{module_code}' não está ativo no plano da sua associação."
                }
            )
        return True
    return dependency
```

### 2.3. Rotas Protegidas por Módulo
- **Módulo Fantasy Game (`fantasy`)**:
  - `app/api/v1/fantasy.py` protegido a nível de router com `dependencies=[Depends(require_module("fantasy"))]`.
- **Módulo Financeiro (`financial`)**:
  - `app/api/v1/financial.py` protegido com `dependencies=[Depends(require_module("financial"))]`.
- **Módulo Gamificação (`gamification`)**:
  - `app/api/v1/roulette_prizes.py` protegido com `dependencies=[Depends(require_module("gamification"))]`.
- **Módulo Competições (`competitions`)**:
  - Ativo em todos os planos esportivos padrão.

### 2.4. Endpoints de Tenant: `/api/v1/tenant/me` e `/api/v1/tenants/check-slug`
- Registrados em `app/api/v1/tenants.py`.
- `/api/v1/tenant/me` retorna dados de branding (cores, nome, logo), plano atual e lista de módulos ativos.
- `/api/v1/tenants/check-slug` valida instantaneamente se um subdomínio está disponível para novas contratações.

### 2.5. Validação de Tenant Mismatch no JWT
- Em `app/api/v1/auth.py`, o token JWT passa a incluir a claim `tenant_id`.
- Em `app/core/dependencies/auth_dependencies.py`, se um usuário tentar usar um token de uma associação em outra associação (ex: subdomínio diferente), a requisição é rejeitada com `403 Forbidden` (`tenant_mismatch`).

---

## 3. 🎯 Metas Atingidas
1. ✅ Middleware de resolução de subdomínio e header com cache LRU/TTL (< 1ms).
2. ✅ Dependência declarativa `@require_module` em FastAPI.
3. ✅ Proteção ativa em 100% dos routers de módulos extras (Fantasy, Financeiro, Roletas).
4. ✅ Endpoint `/api/v1/tenant/me` e `/api/v1/tenants/check-slug` operacionais.
5. ✅ Proteção contra Tenant Mismatch em tokens JWT.
6. ✅ Suíte de testes automatizados com cobertura total e 100% de aprovação.

---

## 4. 🧪 Métodos de Validação Executados & Resultados
- **Teste de Bloqueio de Módulo Não Contratado**:
  - Executado em `tests/test_tenant_modules.py`.
  - Criada associação `liga-basica-xxxx` apenas com módulo `competitions`.
  - Requisição para `/api/v1/fantasy/status` -> Retornou **403 Forbidden** com `error: "feature_not_subscribed"`.
- **Teste de Módulo Contratado**:
  - Requisição para `/api/v1/fantasy/status` com o tenant da Baygon -> Retornou **200 OK**.
- **Teste de Subdomínio Inexistente**:
  - Requisição com `x-tenant-slug: subdominio-inexistente-12345` -> Retornou **404 Not Found** com `error: "tenant_not_found"`.
- **Validação de Regressão Completa**:
  - `tests/test_tenant_isolation.py` -> **OK**
  - `tests/test_financial.py` -> **OK**
  - `tests/test_fantasy.py` -> **OK**
  - `tests/test_users_and_invites.py` -> **OK**
  - `tests/test_tenant_modules.py` -> **OK**
  - Compilador TypeScript do frontend (`tsc --noEmit`) -> **0 erros**.

---

## 5. 📚 Aprendizados Registrados
1. **Isolamento de Transações do MySQL vs Pool do SQLAlchemy em Testes**:
   - Savepoints em conexões isoladas (`join_transaction_mode="create_savepoint"`) não são visíveis para outras conexões do pool usadas pelo middleware do FastAPI. Para dados de teste consultados pelo middleware, é necessário commit real e cleanup no `finally:`.
2. **Ciclo de Vida do Event Loop Assíncrono no Python 3.14**:
   - O `unittest.IsolatedAsyncioTestCase` cria um event loop por TestCase. Conexões de pooling presas sem `engine.dispose()` no `asyncTearDown` disparam `AttributeError: 'NoneType' object has no attribute 'send'`. O descarte explícito no teardown tornou a suíte resiliente e estável.
3. **Seed de Testes x Interceptores de Tenant**:
   - Ao criar entidades diretamente em scripts ou testes fora do ciclo HTTP, deve-se explicitar `set_current_tenant_id(...)` para que o interceptor `before_flush` do ORM atribua o `tenant_id` correto e satisfaça as chaves estrangeiras (`CONSTRAINT foreign key (tenant_id) REFERENCES tenants(id_tenant)`).

---

## 6. 💡 Sugestões de Melhorias Não Previstas
1. **Invalidação Distribuída de Cache de Tenants**:
   - O cache atual é em memória do processo (`dict` com TTL). Quando escalarmos para múltiplos pods/workers backend na nuvem, migrar o cache de tenants para o Redis com pub/sub de invalidação quando houver upgrade de plano ou suspensão de conta.
2. **Quota Limiter por Plano**:
   - Além do bloqueio de módulos (`has_module`), adicionar guards declarativos de cota: `@require_quota("max_players")` para impedir cadastro de novos jogadores quando o tenant atingir o limite contratual do seu plano.
3. **Mecanismo de Webhooks de Tenant**:
   - Adicionar uma fila de notificações para disparar alertas para a diretoria da associação quando 90% das cotas forem atingidas, estimulando upsell do plano.
