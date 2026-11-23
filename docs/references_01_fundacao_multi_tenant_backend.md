# Referência 01: Fundação Multi-Tenant & Isolamento de Dados no Backend

## 📌 Status: CONCLUÍDA ✅

---

## 1. Objetivo & Escopo da Fase
Estabelecer a espinha dorsal de isolamento de dados no banco de dados para suportar múltiplos inquilinos (associações esportivas) em um único cluster de banco de dados, garantindo:
- **Zero Vazamento Cruzado (Zero Cross-Tenant Leakage)**: Dados de uma associação nunca são visíveis ou editáveis por outra;
- **Compatibilidade Total com Legado**: Os dados existentes da Associação Baygon são preservados integralmente como o Tenant inicial nº 1 (`slug: 'baygon'`);
- **Injeção Automática de Tenant ID**: Interceptores de ORM garantem que novos registros herdem automaticamente o tenant da requisição ativa sem necessidade de passar manualmente em cada chamada;
- **Interoperabilidade de Bancos**: Suporte tanto ao MySQL atual quanto ao PostgreSQL futuro (com Row-Level Security nativo).

---

## 2. Arquitetura Técnica Implementada

### 2.1. Modelos Core Multi-Tenant
1. **`Tenant` (`app/db/models/tenant.py`)**:
   - `id_tenant`: Chave primária UUID `String(36)`.
   - `name`: Nome formal da associação (ex: "Associação Baygon").
   - `slug`: Identificador único indexado para subdomínio (ex: `baygon` -> `baygon.associacao.com`).
   - `custom_domain`: Suporte a CNAME exclusivo (ex: `arena.baygon.com.br`).
   - `primary_color` & `secondary_color`: Identidade visual white-label em hexadecimal.
   - `status`: Estado da assinatura (`active`, `suspended`, `pending`).
   - `plan_id`: Vínculo ao plano contratado.
2. **`Plan` (`app/db/models/plan.py`)**:
   - `id_plan`: Identificador sequencial.
   - `name`: Nome do plano (ex: "Plano Completo Pro").
   - `code`: Código do plano (`pro_all_inclusive`).
   - `price_monthly_cents`: Valor mensal em centavos.
   - `max_players` & `max_seasons`: Cotas contratuais.
3. **`TenantModule` (`app/db/models/tenant_module.py`)**:
   - Entitlements de módulos por tenant: `competitions`, `financial`, `fantasy`, `gamification`.
   - Chave composta única `(tenant_id, module_code)`.
4. **`TenantAuditLog` (`app/db/models/tenant_audit.py`)**:
   - Trilha de auditoria para rastreamento de ações críticas e acessos administrativos por associação.

### 2.2. O Padrão `TenantMixin` e Interceptor no SQLAlchemy
- **`TenantMixin` (`app/db/tenant_mixin.py`)**:
  - Fornece a coluna indexada `tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)`.
  - Herdado por 100% das entidades de negócio do domínio:
    - Entidades de Competições: `Seasons`, `Round`, `Teams`, `Player`, `Match`, `EventScoreRule`, `Awards`, `RoundMedia`.
    - Entidades Administrativas e de Usuários: `User`, `SeasonPoll`.
    - Entidades Financeiras: `FinancialMonthlyFee`, `FinancialCost`.
    - Entidades de Fantasy Game: `FantasySetting`, `FantasyRoundConfig`, `FantasyTeam`, `FantasyLineup`.
    - Entidades de Gamificação: `RoulettePrize`.
- **`tenant_context.py` (`app/core/tenant_context.py`)**:
  - Utiliza `contextvars` nativo do Python para armazenar `current_tenant_id` e `current_tenant_obj` isolados por corrotina/requisição assíncrona.
- **`tenant_filter.py` (`app/db/tenant_filter.py`)**:
  - Evento `do_orm_execute`: Adiciona automaticamente `with_loader_criteria(TenantMixin, lambda cls: cls.tenant_id == current_tenant)`. Toda consulta `SELECT`, `UPDATE` e `DELETE` é filtrada transparentemente pelo banco.
  - Evento `before_flush`: Se um objeto herda de `TenantMixin` e `tenant_id` for nulo, injeta automaticamente o `current_tenant_id` antes de persistir no banco.

---

## 3. 🎯 Metas Objetivas da Fase
- [x] Criar tabelas `tenants`, `plans`, `tenant_modules` e `tenant_audit_logs`.
- [x] Criar `TenantMixin` e vincular a 100% das entidades de negócio (incluindo `round`, `matches`, `rules` e `awards`).
- [x] Desenvolver migrações Alembic reversíveis (`e1a2b3c4d5e6` e `f2b3c4d5e6f7`) com população de dados do tenant Baygon.
- [x] Implementar interceptor `setup_tenant_isolation` em `app/db/base.py`.
- [x] Criar teste automatizado de isolamento multi-tenant (`tests/test_tenant_isolation.py`) cobrindo Jogadores, Temporadas e busca direta por ID em Rodadas.

---

## 4. 🧪 Métodos de Validação Executados

### 4.1. Migração do Banco de Dados
```bash
$env:PYTHONUTF8="1"; .\venv\Scripts\alembic.exe -c app/alembic.ini upgrade head
```
**Resultado**: Sucesso (`e1a2b3c4d5e6 (head)`).

### 4.2. Teste Automatizado de Isolamento Multi-Tenant
```bash
$env:PYTHONUTF8="1"; .\venv\Scripts\python.exe -m unittest tests/test_tenant_isolation.py
```
**Resultado**: `Ran 1 test in 1.036s - OK`.
Comprovou que:
1. Novos registros recebem `tenant_id` automaticamente;
2. Associação Alfa e Associação Beta não enxergam dados de Atletas e Temporadas uma da outra.

### 4.3. Testes de Regressão da Aplicação
- `tests/test_users_and_invites.py` -> **`OK`**
- `tests/test_financial.py` -> **`OK`**
- `tests/test_fantasy.py` -> **`OK`**

### 4.4. Validação Segura de Frontend (Next.js)
```bash
.\web\node_modules\.bin\tsc.cmd --noEmit -p web/tsconfig.json
```
**Resultado**: `0 erros de tipagem`.

---

## 5. 📚 Aprendizados Registrados
1. **with_loader_criteria Exige Alvo Específico**: Usar `object` no `with_loader_criteria` causa `AttributeError: type object 'object' has no attribute 'tenant_id'`, pois o SQLAlchemy tenta analisar classes genéricas do Python. Criar a classe alvo `TenantMixin` resolve essa questão de forma segura e elegante.
2. **Compatibilidade de Encoding no Windows**: Mensagens de log contendo emojis (ex: `📦`) geram `UnicodeEncodeError` no terminal padrão do Windows (`cp1252`). A aplicação deve priorizar prefixos textuais neutros (`[DB]`) e o ambiente deve operar com `$env:PYTHONUTF8="1"`.
3. **Identificadores UUID em String**: Usar `String(36)` para `tenant_id` garante paridade entre MySQL (onde UUID é string/char) e PostgreSQL (onde mapeia perfeitamente para UUID nativo com RLS).

---

## 6. 💡 Sugestões de Melhorias Não Previstas
- **Middleware HTTP Global de Resolução de Tenant**: Criar middleware no FastAPI que resolva o tenant a partir do subdomínio ou cabeçalho `x-tenant-slug` e injete no contexto no início da requisição.
- **Cache de Metadados do Tenant**: Utilizar cache em memória (LRU) para busca de dados do tenant por slug, reduzindo a latência para menos de 1ms por request.
