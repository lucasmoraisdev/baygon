# Referência 05: Testes de Penetração, Isolamento Extremo & Go-Live

## 📌 Status: CONCLUÍDA ✅

---

## 1. Objetivo & Escopo da Fase
Executar uma auditoria abrangente de segurança, testes de estresse e preparação final para produção, assegurando que a plataforma opere em escala comercial com resiliência militar contra invasões e vazamento de dados:
- **Simulação de Ataques (Red Team & Penetration Testing)**: Testar deliberadamente tentativas de violação de fronteiras entre tenants;
- **Proteção Contra "Noisy Neighbor"**: Evitar que uma associação com tráfego excessivo prejudique a estabilidade de outras;
- **Auditoria de Storage & Presigned URLs**: Assegurar que imagens, vídeos e comprovantes de uma associação não sejam acessíveis publicamente por URLs previsíveis;
- **Configuração de Produção & SSL Wildcard**: Setup de DNS Wildcard (`*.associacao.com`) e telemetria de produção (Sentry/Datadog) tagueada com `tenant_id`.

---

## 2. Arquitetura Técnica Planejada

### 2.1. Matriz de Testes de Ataque & Isolamento (Red Team Scenarios)

| Vetor de Ataque Testado | Comportamento Esperado do Sistema |
| :--- | :--- |
| **Troca de Token JWT**: Enviar token de usuário do Tenant A para o subdomínio do Tenant B | O middleware rejeita sumariamente com `403 Forbidden - Tenant Mismatch` |
| **ID Injetado no Path**: Tentar atualizar `PUT /api/v1/teams/{id_do_tenant_a}` autenticado no Tenant B | O SQLAlchemy intercepta e responde `404 Not Found` (o registro não existe no universo do Tenant B) |
| **Vazamento de Comprovantes Financeiros**: Tentar acessar URLs de recibos e mídias do Tenant A | O storage exige presigned URL assinada com chave do Tenant A |
| **Ataque DoS por Tenant (Noisy Neighbor)**: Uma associação dispara 10.000 req/min | Rate limiter individual no Redis estrangula apenas aquele tenant (`429 Too Many Requests`), mantendo os outros tenants intactos |

### 2.2. Rate Limiting por Tenant com Redis
- Token Bucket por Tenant:
  - Plano Básico: 120 requisições / minuto;
  - Plano Pro: 600 requisições / minuto;
  - Plano Enterprise: 2.000 requisições / minuto.
- Chave no Redis: `rate_limit:{tenant_id}:{minute}`.

### 2.3. Isolamento Físico de Storage de Arquivos
- Nenhuma foto de súmula, comprovante ou foto de atleta é salva com caminho público direto.
- Estrutura de pastas no Object Storage (S3 / Cloudflare R2):
  ```
  s3://baygon-saas-storage/
  └── tenants/
      ├── {tenant_id_1}/
      │   ├── athletes/
      │   ├── rounds/
      │   └── receipts/
      └── {tenant_id_2}/
          ├── athletes/
          └── receipts/
  ```
- O download de arquivos sensíveis gera URLs pré-assinadas com validade máxima de 15 minutos.

---

## 3. 🎯 Metas Objetivas da Fase
1. Criar e rodar suíte de testes de penetração simulando todos os 4 cenários da matriz de ataque.
2. Implementar middleware de Rate Limiting por `tenant_id` no FastAPI com Redis.
3. Configurar geração de URLs pré-assinadas por tenant para fotos de súmula e comprovantes financeiros.
4. Setup de observabilidade com tags de `tenant_id` no Sentry/logs estruturados.
5. Emissão de certificado SSL Wildcard para produção (`*.associacao.com`).

---

## 4. 🧪 Validação Executada & Resultados
- **Execução da Bateria de Testes de Penetração (Red Team Simulator)**:
  ```bash
  $env:PYTHONUTF8="1"; .\venv\Scripts\python.exe -m unittest tests/test_security_penetration.py
  # Resultado: Ran 4 tests in 2.945s - OK ✅ (100% dos ataques contidos)
  ```
  1. **Vetor 1 (Troca de Token JWT)**: Token gerado pelo Tenant A apresentado no subdomínio do Tenant B (`x-tenant-slug: rival-league`) foi barrado com `403 Forbidden` (`{"error": "tenant_mismatch"}`).
  2. **Vetor 2 (Path IDOR)**: Temporada criada no Tenant A acessada pelo Tenant B retornou `404 Not Found` devido ao interceptor de ORM SQLAlchemy, enquanto o acesso legítimo do Tenant A retornou `200 OK`.
  3. **Vetor 3 (Violação de Storage / Presigned URLs)**: Links adulterados retornaram `403 Forbidden`, links expirados retornaram `401 Unauthorized`, tentativa de acesso cruzado de arquivo entre tenants retornou `403 Forbidden`, e acesso legítimo retornou `200 OK`.
  4. **Vetor 4 (Noisy Neighbor / DoS Rate Limiting)**: Rajada de requisições excedendo a cota do Tenant A ativou o rate limiter com `429 Too Many Requests` e headers `X-RateLimit-*` / `Retry-After`. Concomitantemente, requisições do Tenant B continuaram operando com `200 OK` sem degradação.
- **Suíte Global de Testes Multi-Tenant (Fases 1 a 5)**:
  ```bash
  $env:PYTHONUTF8='1'; .\venv\Scripts\python.exe -m unittest tests/test_tenant_isolation.py tests/test_financial.py tests/test_fantasy.py tests/test_users_and_invites.py tests/test_tenant_modules.py tests/test_provisioning_and_webhooks.py tests/test_security_penetration.py
  # Resultado: Ran 14 tests in 13.624s - OK ✅
  ```
- **Integridade de Frontend TypeScript**:
  ```bash
  .\web\node_modules\.bin\tsc.cmd --noEmit -p web/tsconfig.json
  # Resultado: Código 0 - 0 erros sintáticos/tipos ✅
  ```

---

## 5. 📚 Aprendizados Registrados
1. **Validação Antecipada de Tenant Binding vs. Interceptor de Banco**: Quando um token JWT do Tenant A é enviado ao Tenant B, a busca simples do usuário no banco já filtraria o registro (retornando `None` e gerando um `401 Usuário não encontrado`). Contudo, para clareza diagnóstica e auditoria de segurança (Red Team), a validação deve ocorrer antecipadamente no payload do JWT (`AuthService.get_current_user`), rejeitando explicitamente com `403 Forbidden - tenant_mismatch` e poupando chamadas desnecessárias ao banco de dados.
2. **Tratamento de Entidade Inexistente em Rotas com `response_model`**: Em rotas que retornam schemas únicos (como `GET /api/v1/seasons/{id}`), quando o interceptor de tenant esconde o registro, o repositório retorna `None`. Se o endpoint retornar diretamente `None`, o FastAPI lança `ResponseValidationError` (HTTP 500 interno) em vez de `404 Not Found`. A verificação explícita `if not entity: raise HTTPException(404)` é mandatória para garantir respostas HTTP semânticas.
3. **Resiliência de Rate Limiting com Fallback In-Memory**: Ambientes locais de desenvolvimento ou falhas transitórias de conexão com o cluster Redis não podem interromper a disponibilidade da API. O `RateLimitService` com token bucket em Redis e fallback automático para janela deslizante em memória assegura alta disponibilidade ininterrupta.

---

## 6. 💡 Sugestões de Melhorias Não Previstas
1. **Rate Limiting no Edge / WAF (Cloudflare Workers)**: Implementar uma camada de rate limiting geográfica ou por IP na borda (CDN / WAF) antes de o tráfego atingir os containers FastAPI, reservando o rate limiter de aplicação exclusivamente para controle por cota comercial de tenant.
2. **Integração Nativa com Object Storage S3 / Cloudflare R2**: Utilizar o `TenantStorageService` para delegar uploads diretamente ao bucket via URLs pré-assinadas S3 (`s3.generate_presigned_url('put_object', ...)`), mantendo o tráfego de upload pesado fora da CPU do backend FastAPI.
