# Referência 03: Roteamento de Subdomínios & Frontend Modular (Next.js)

## 📌 Status: CONCLUÍDA ✅ (20/11/2026)

---

## 1. Objetivo & Escopo da Fase
Prover suporte completo a subdomínios dinâmicos no Next.js (App Router) e estruturar a interface modular baseada em planos, garantindo:
- **Resolução de Subdomínio no Edge**: `subdominio.associacao.com` direciona para a visualização da associação específica, enquanto `associacao.com` ou `localhost` gerenciam o inquilino ativo;
- **Modularidade Real**: Módulos protegidos a nível de rota e layout;
- **Diferenciação Estrita de Personas (Sócio vs Administrador)**:
  - Sócios nunca são expostos a CTAs de vendas ou telas de upgrade (o módulo fica invisível na navegação ou exibe aviso institucional neutro);
  - Administradores têm acesso a telas ricas de experimentação e upsell com simulação de impacto na mensalidade (`ModuleUpgradeHero`);
- **White-Label Dinâmico**: Cores primárias/secundárias, logotipo e nome da associação injetados em tempo de execução via `TenantContext` e CSS Variables.

---

## 2. Arquitetura Técnica Implementada

### 2.1. Next.js Edge Middleware (`web/src/middleware.ts`)
- Implementado e ativo interceptando todas as rotas do Next.js.
- Suporta desenvolvimento local (`subdominio.localhost:3000` ou `localhost:3000` com fallback para `baygon`) e produção (`subdominio.associacao.com`).
- Injeta o cabeçalho `x-tenant-slug` na requisição e grava o cookie `baygon_tenant_slug` para consulta instantânea no client-side.

### 2.2. Injeção Automática no Cliente HTTP (`web/src/lib/api.ts`)
- Função `getActiveTenantSlug()` recupera o slug ativo do cookie ou do hostname.
- Todas as chamadas `fetchAPI` e renovações de refresh token enviam automaticamente o cabeçalho `x-tenant-slug` para o backend FastAPI.

### 2.3. Contexto Global do Inquilino (`web/src/context/TenantContext.tsx`)
- Consulta `/api/v1/tenant/me` na inicialização da aplicação.
- Fornece metadados (`name`, `slug`, `primary_color`, `secondary_color`, `logo_url`, `plan`, `modules`).
- Fornece a função `hasModule(code: string): boolean`.
- Injeta dinamicamente as variáveis CSS `--tenant-primary` e `--tenant-secondary` no `:root`.
- Integrado no provedor raiz `web/src/components/Providers.tsx`.

### 2.4. Proteção por Layouts e Componente Guard
- `web/src/components/guards/ModuleGuard.tsx`:
  - Se a associação tem o módulo: renderiza a página normalmente.
  - Se NÃO tem e o usuário é **Admin**: renderiza `ModuleUpgradeHero` com recursos do módulo, estimativa de investimento e botão para contratação.
  - Se NÃO tem e o usuário é **Sócio/Atleta**: renderiza tela neutra institucional sem botões de compra.
- Layouts isolados criados sem alterar o código interno das páginas:
  - `web/src/app/(dashboard)/fantasy/layout.tsx` -> protegido com `<ModuleGuard module="fantasy">`.
  - `web/src/app/(dashboard)/admin/financeiro/layout.tsx` -> protegido com `<ModuleGuard module="financial">`.

### 2.5. Navegação Dinâmica na Sidebar (`web/src/components/Sidebar.tsx`)
- Branding dinâmico no topo: logotipo ou avatar com as cores da associação (`tenant.primary_color` e `tenant.secondary_color`) e nome da liga.
- Itens de menu com verificação de módulo:
  - `Fantasy Game` (`module: 'fantasy'`)
  - `Financeiro` (`module: 'financial'`)
- Itens de módulos não contratados são **100% omitidos para atletas/sócios**, e exibidos com badge **`UPGRADE`** em amarelo/âmbar para administradores.

---

## 3. 🎯 Metas Atingidas
1. ✅ Edge Middleware do Next.js criado com suporte local e produção.
2. ✅ `TenantContext` e hook `useTenant()` com fallback resiliente.
3. ✅ Componentes `ModuleGuard` e `ModuleUpgradeHero` com diferenciação estrita de persona.
4. ✅ Layouts App Router de proteção dedicados para Fantasy e Financeiro.
5. ✅ `Sidebar` adaptada com branding dinâmico e menu condicional por plano.
6. ✅ Injeção automática de `x-tenant-slug` em todas as chamadas `fetchAPI`.
7. ✅ Compilação TypeScript com 0 erros.

---

## 4. 🧪 Métodos de Validação Executados & Resultados
- **Validação de Tipos e Sintaxe Next.js**:
  ```bash
  .\web\node_modules\.bin\tsc.cmd --noEmit -p web/tsconfig.json
  # Código de saída: 0 (Zero erros) ✅
  ```
- **Validação dos Testes de Módulos e Backend**:
  ```bash
  $env:PYTHONUTF8='1'; .\venv\Scripts\python.exe -m unittest tests/test_tenant_modules.py
  # Código de saída: 0 (OK) ✅
  ```

---

## 5. 📚 Aprendizados Registrados
1. **Composição via Layouts no Next.js App Router**:
   - Criar `layout.tsx` específicos dentro das pastas de rotas (`fantasy/layout.tsx`, `financeiro/layout.tsx`) é incomparavelmente mais limpo e seguro do que alterar páginas existentes de mais de 1.500 linhas. Permite envolver qualquer página com `ModuleGuard` sem tocar na lógica de estado interno da página.
2. **Sincronização entre Edge Middleware e Client Side**:
   - Como os Headers de requisição modificados no Next.js Middleware não são diretamente legíveis pelo `window.fetch` no browser, a gravação de um cookie `baygon_tenant_slug` no middleware permite que tanto componentes de servidor quanto o cliente HTTP leiam o slug instantaneamente de forma síncrona.
3. **Resiliência com Fallback Padrão no TenantProvider**:
   - Em caso de indisponibilidade transitória da API ou primeiro carregamento, o `TenantProvider` adota um estado fallback seguro da Baygon com todos os módulos essenciais, impedindo tela branca (FOUC) durante a renderização.

---

## 6. 💡 Sugestões de Melhorias Não Previstas
1. **Pré-carregamento Server-Side de Metadados de Tenant (SSR)**:
   - Em fases futuras, podemos ler o cookie `baygon_tenant_slug` no `RootLayout` do servidor para já enviar o HTML pré-renderizado com as cores do tenant embutidas no CSS inline, eliminando qualquer micro-flicker de carregamento inicial.
2. **Página Dedicada de Marketplace de Módulos (`/admin/planos`)**:
   - Criar um painel central onde a diretoria pode visualizar todos os módulos disponíveis da plataforma (Fantasy, Financeiro, Roleta, Gestão de Sócios), com toggle "Ativar Módulo" acoplado ao checkout da Fase 4.
