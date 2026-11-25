# Baygon — Plataforma de Gestão Esportiva & SaaS Multi-Tenant

Bem-vindo ao repositório do **Baygon**, um sistema completo e moderno para gestão de ligas, associações esportivas e campeonatos (futebol, society, futsal e outros esportes).

O ecossistema é composto por uma **API REST assíncrona de alta performance em FastAPI** e uma **aplicação web moderna em Next.js (App Router)** com suporte nativo a arquitetura **Multi-Tenant SaaS B2B**, permitindo que múltiplas ligas e associações utilizem a plataforma de forma isolada com seus próprios subdomínios, módulos e personalização.

---

## 🚀 Tecnologias Utilizadas

### Backend
- **FastAPI**: Framework web moderno, assíncrono e de alta performance em Python.
- **SQLAlchemy 2.0 (Async)**: ORM robusto com interceptores de sessão para isolamento multi-tenant seguro.
- **Alembic**: Gerenciamento e versionamento automatizado de migrações de banco de dados.
- **Pydantic v2**: Validação estrita de tipos, serialização e Data Transfer Objects (DTOs).
- **Uvicorn**: Servidor ASGI ultrarrápido.
- **JWT & BCrypt / Fernet**: Autenticação segura com tenant binding e criptografia de dados sensíveis.
- **OCR / Vision Service**: Extração de dados de fotos de súmulas físicas via IA (suporte a Ollama local, Gemini, OpenAI e RapidOCR).

### Frontend
- **Next.js (App Router)**: Framework React fullstack com Server Components e Edge Middleware.
- **TypeScript**: Tipagem estática em toda a interface e regras de negócio do cliente.
- **Tailwind CSS**: Estilização responsiva e utilitária com Design System esportivo moderno.
- **TanStack React Query**: Cache inteligente, revalidação e gerenciamento assíncrono de estado.
- **Lucide React**: Biblioteca de ícones moderna e consistente.

---

## ✨ Funcionalidades & Novas Features

A plataforma conta com um conjunto completo de ferramentas para organizar desde o rachão/pelada semanal até grandes campeonatos federados:

### 🏢 1. Arquitetura Multi-Tenant SaaS B2B
- **Isolamento Completo de Dados**: Cada associação possui seus dados (times, jogadores, financeiro, regras) estritamente isolados através de `TenantMixin` e interceptores de ORM.
- **Roteamento por Subdomínios**: Resolução automática através da URL (ex: `baygon.localhost`, `copa.localhost` ou `liga.dominio.com`) ou cabeçalho HTTP `x-tenant-slug`.
- **Motor de Planos & Módulos**: Sistema granular de permissões com decorator `@require_module` no backend e guardas no frontend, habilitando apenas os módulos contratados pela liga.
- **Checkout & Gestão de Assinatura**: Painel de planos e faturamento integrado (`/subscription`).
- **Segurança Reforçada**: Rate limiting individual por associação e tokens JWT vinculados obrigatoriamente ao tenant.

### 🏆 2. Formatos Avançados de Torneios & Campeonatos (`/tournaments`)
- **Modo Pelada / Associação Tradicional**: Temporada com rodadas periódicas, sorteio dinâmico de times a cada semana e pontuação acumulada para o Ranking Geral de Atletas.
- **Pontos Corridos (Liga de Times Fixos)**: Tabela de classificação automatizada com critérios de desempate configuráveis (pontos, vitórias, saldo de gols, gols pró, etc.).
- **Mata-Mata (Playoffs / Copas)**: Chaveamento visual (oitavas, quartas, semifinal e final) com controle de ida/volta e prorrogação/pênaltis.
- **Fase de Grupos + Mata-Mata**: Fase classificatória em grupos com chaveamento eliminatório gerado automaticamente para os classificados.

### 🎮 3. Fantasy Game Integrado (`/fantasy`)
- **Mercado de Atletas**: Preços dinâmicos calculados a partir das médias e atuações dos atletas reais da associação.
- **Escalação por Rodada**: Cada associado monta seu time respeitando o patrimônio em cartoletas, escolhendo formação tática e definindo o capitão.
- **Pontuação Automática**: Cálculo instantâneo das pontuações do fantasy a partir dos eventos oficiais registrados na súmula da rodada.
- **Ranking do Fantasy**: Tabelas de classificação da rodada e do campeonato geral de cartoleiros.

### 📱 4. Mídia da Rodada & Redes Sociais (`/rounds/[id]`)
- **Central de Mídias**: Cadastro e organização de links de redes sociais da rodada (Instagram Reels, vídeos do YouTube, TikTok e links de transmissões ao vivo).
- **Galeria & Melhores Momentos**: Integração de gravações de câmeras de campo e destaques de cada partida.

### 🗳️ 5. Enquetes & Votações da Galera (`/polls`)
- **Votações Interativas**: Criação de enquetes como "Craque da Rodada", "Gol Mais Bonito", "Melhor Goleiro" ou votações personalizadas.
- **Voto Seguro**: Votação restrita a associados com prevenção de votos duplicados e apuração em tempo real.

### 💰 6. Gestão Financeira para Associações (`/admin/financeiro`)
- **Fluxo de Caixa**: Registro de receitas e despesas com categorização e demonstrativos.
- **Controle de Mensalidades**: Acompanhamento de mensalidades de sócios, valores pagos/pendentes e status de adimplência.

### 📋 7. Lista de Presença & Sorteio em Massa (`attendance` / `/rounds/[id]/mass`)
- **Confirmação de Presença**: Atletas confirmam presença na rodada antecipadamente pelo aplicativo.
- **Geração e Sorteio em Massa**: Criação automática de partidas e divisão equilibrada de times com base no quórum confirmado.

### ⏱️ 8. Súmula Digital ao Vivo & OCR de Súmula Física (`/matches/[id]`, `/admin/sumulas`)
- **Súmula Digital em Tempo Real**: Interface rápida para mesários e árbitros registrarem gols, assistências, cartões (amarelos/vermelhos), faltas e substituições com cronômetro de partida integrado.
- **Leitura Inteligente por Foto (OCR/Vision)**: Upload de foto da súmula em papel com reconhecimento automatizado de jogadores e gols via IA.

### 🎡 9. Roleta de Prêmios Gamificada (`roulette_prizes`)
- **Sorteio Interativo**: Roleta gamificada para sorteio de brindes, consumações e premiações para os atletas participantes da rodada.

### 🌐 10. Portal Público White-Label (`/public`)
- **Acesso Aberto (Sem Login)**: Torcedores, familiares e atletas podem acompanhar de qualquer dispositivo:
  - Classificação geral e ranking de atletas;
  - Tabela de jogos, resultados e súmulas das partidas;
  - Histórico de records (maiores goleadores, mais jogos, records da liga);
  - Histórico de temporadas anteriores.

### 🏅 11. Premiações, Rankings & Regras Dinâmicas (`/awards`, `/rankings`, `/admin/rules`)
- **Rankings**: Artilharia, assistências, melhor defesa, cartões e pontuações consolidadas.
- **Prêmios**: Premiações personalizadas por jogador e por equipe.
- **Central Paramétrica de Regras**: Ajuste dinâmico de pesos de pontuação para qualquer tipo de evento de jogo.

---

## 🛠️ Como Executar o Projeto Localmente

### Pré-requisitos
- **Python**: 3.10 ou superior
- **Node.js**: 18.x ou superior (com `npm`, `yarn` ou `pnpm`)
- **Banco de Dados**: MySQL, MariaDB ou PostgreSQL (ou SQLite para testes rápidos)

---

### 1. Configuração do Backend (FastAPI)

1. **Acesse a raiz do projeto e crie o ambiente virtual:**
   ```bash
   python -m venv venv
   ```

2. **Ative o ambiente virtual:**
   - **Windows:**
     ```powershell
     venv\Scripts\activate
     ```
   - **Linux / macOS:**
     ```bash
     source venv/bin/activate
     ```

3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configuração de Variáveis de Ambiente:**
   Crie ou edite o arquivo `.env` na raiz do projeto:
   ```env
   ENVIRONMENT=development
   DATABASE_URL=mysql+aiomysql://usuario:senha@localhost:3306/baygon_db
   ```
   > **Nota:** As configurações de segredos e chaves JWT também podem ser configuradas em `.streamlit/secrets.toml` ou `.env`.

5. **Inicialização do Banco de Dados & Migrations:**
   - Crie o banco de dados vazio no seu SGBD (ex: `baygon_db`).
   - Execute o script de inicialização do schema:
     ```bash
     python scripts/init_db.py
     ```
   - Aplique as migrações mais recentes do Alembic:
     ```bash
     alembic -c app/alembic.ini upgrade head
     ```
   - *(Opcional)* Crie o usuário administrador inicial executando o seed:
     ```bash
     python scripts/seed_db.py
     ```
     > **Usuário padrão de seed:** `admin` | **Senha:** `Admin@123`

6. **Inicie o servidor backend:**
   ```bash
   uvicorn app.main:app --port 8001 --reload
   ```
   O backend estará ativo em: **`http://localhost:8001`** (ou `http://127.0.0.1:8001`).

---

### 2. Configuração do Frontend (Next.js)

1. **Acesse a pasta `web` e instale os pacotes:**
   ```bash
   cd web
   npm install
   ```

2. **Configuração de Variáveis do Frontend:**
   Verifique ou crie o arquivo `web/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8001/api/v1
   BACKEND_API_URL=http://127.0.0.1:8001/api/v1
   NEXT_PUBLIC_DEFAULT_TENANT=baygon
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   O frontend estará ativo em: **`http://localhost:3000`**.

---

## 🌐 Formas de Acessar em Localhost

A plataforma oferece suporte a diferentes modos de acesso local, tanto para o uso padrão quanto para simulação e teste de múltiplos tenants (associações).

### 1. Acesso ao Frontend Web

#### Modo Direto (Tenant Padrão)
Acesse diretamente a URL padrão. O sistema resolverá automaticamente para a associação configurada como padrão (`baygon`):
- 👉 **[http://localhost:3000](http://localhost:3000)**

#### Modo Subdomínios Multi-Tenant (`*.localhost`)
Navegadores modernos (Chrome, Firefox, Edge, Safari) suportam nativamente a resolução de qualquer subdomínio `.localhost` para `127.0.0.1` de acordo com a norma **RFC 6761**, sem necessidade de alterar o arquivo `hosts` do sistema:
- 👉 **Associação Baygon:** [http://baygon.localhost:3000](http://baygon.localhost:3000)
- 👉 **Associação Liga 1:** [http://liga1.localhost:3000](http://liga1.localhost:3000)
- 👉 **Torneio / Copa Exemplo:** [http://copa.localhost:3000](http://copa.localhost:3000)
*(Qualquer `<slug>.localhost:3000` direciona para a respectiva associação cadastrada no banco de dados).*

---

### 2. Acesso ao Backend & Documentação Interativa (Swagger / ReDoc)

- **Swagger UI (OpenAPI Interativo):**
  👉 **[http://localhost:8001/docs](http://localhost:8001/docs)**
  > **Dica Multi-Tenant no Swagger:** Para testar rotas autenticadas ou específicas de uma associação, informe o cabeçalho `x-tenant-slug: baygon` (ou o slug desejado) na requisição. Caso omitido em ambiente local, o backend adota o fallback automático `baygon`.

- **ReDoc (Documentação Alternativa):**
  👉 **[http://localhost:8001/redoc](http://localhost:8001/redoc)**

- **Healthcheck da API:**
  👉 **[http://localhost:8001/](http://localhost:8001/)** *(Retorna `{"message": "Baygon API running 🚀"}`)*

---

### 🗺️ Mapa de Rotas Principais no Localhost

Após subir o frontend (`http://localhost:3000`), você pode navegar diretamente para as seguintes telas:

| Funcionalidade / Módulo | URL em Localhost | Descrição |
| :--- | :--- | :--- |
| **Dashboard & Ranking Geral** | `http://localhost:3000/` | Visão geral da temporada atual, artilharia e tabela de classificação |
| **Torneios & Campeonatos** | `http://localhost:3000/tournaments` | Gestão de pontos corridos, copas mata-mata e grupos |
| **Fantasy Game** | `http://localhost:3000/fantasy` | Escalação de times, mercado de jogadores e pontuação da rodada |
| **Rodadas & Mídias** | `http://localhost:3000/rounds` | Gestão de rodadas, links de vídeos/redes sociais e confirmação de presença |
| **Sorteio em Massa** | `http://localhost:3000/rounds/[id]/mass` | Montagem automática de times e geração em massa de partidas |
| **Partidas & Súmula ao Vivo** | `http://localhost:3000/matches` | Lista de partidas e acesso à súmula digital em tempo real |
| **Jogadores & Atletas** | `http://localhost:3000/players` | Cadastro, perfis, scouts individuais e histórico |
| **Times da Rodada** | `http://localhost:3000/teams` | Composição de equipes e resultados |
| **Temporadas** | `http://localhost:3000/seasons` | Histórico e configuração de novas temporadas |
| **Enquetes & Votações** | `http://localhost:3000/polls` | Votação de craque da rodada e enquetes da associação |
| **Premiações & Troféus** | `http://localhost:3000/awards` | Gestão de prêmios por equipe e por atleta |
| **Financeiro (Admin)** | `http://localhost:3000/admin/financeiro` | Fluxo de caixa, controle de mensalidades e adimplência |
| **Gestão de Súmulas & OCR** | `http://localhost:3000/admin/sumulas` | Auditoria de súmulas e upload de foto para leitura por IA |
| **Regras de Pontuação** | `http://localhost:3000/admin/rules` | Configuração de pontos por gol, vitória, cartões e faltas |
| **Usuários & Permissões** | `http://localhost:3000/admin/users` | Gestão de usuários, papéis e permissões |
| **Planos & Assinatura** | `http://localhost:3000/subscription` | Gestão do plano SaaS da associação e contratação de módulos |
| **Portal Público (Sem Login)** | `http://localhost:3000/public` | Visão para torcedores (jogos, classificação, records e estatísticas) |
| **Login / Autenticação** | `http://localhost:3000/login` | Acesso com credenciais de usuário (`admin` / `Admin@123`) |

---

## 📁 Estrutura de Diretórios

```
baygon/
├── app/                        # Backend em FastAPI
│   ├── api/v1/                 # Endpoints REST (auth, tournaments, fantasy, rounds, matches, etc.)
│   ├── core/
│   │   ├── dependencies/       # Injeções de dependência (JWT, permissões RBAC, tenant context)
│   │   ├── middlewares/        # Middlewares (TenantResolutionMiddleware, RateLimitMiddleware)
│   │   ├── services/           # Regras de negócio da aplicação e cálculos de domínio
│   │   └── utils.py            # Utilitários de criptografia, formatação e e-mails
│   ├── db/
│   │   ├── models/             # Modelos declarativos SQLAlchemy com suporte a TenantMixin
│   │   ├── repositories/       # Abstração de acesso ao banco (Design Pattern Repository)
│   │   └── base.py             # Configuração de AsyncSession e engine assíncrona
│   ├── migrations/             # Migrações de schema geradas pelo Alembic
│   ├── schemas/                # Schemas de validação e serialização Pydantic (DTOs)
│   └── main.py                 # Ponto de entrada da API e registro de rotas
├── docs/                       # Documentações técnicas aprofundadas da evolução Multi-Tenant
├── scripts/                    # Scripts utilitários (init_db.py, seed_db.py)
├── tests/                      # Bateria de testes automatizados unitários e de integração
└── web/                        # Frontend em Next.js (App Router)
    ├── src/
    │   ├── app/                # Rotas do App Router (Dashboard, Admin, Public, Auth)
    │   ├── components/         # Componentes visuais reutilizáveis e Design System
    │   ├── hooks/              # Custom React Hooks
    │   ├── lib/                # Configuração da API (fetchAPI, active tenant, tokens)
    │   ├── middleware.ts       # Edge Middleware para resolução de subdomínios e cookies
    │   └── types/              # Definições de tipagem TypeScript
    └── package.json            # Dependências e scripts do frontend
```

---

## 🧪 Validação & Testes

### Validação Estática do Frontend (Next.js & TypeScript)
Conforme as diretrizes do projeto, sempre valide a integridade de rotas dinâmicas e tipagens com o compilador TypeScript:
```powershell
.\web\node_modules\.bin\tsc.cmd --noEmit -p web/tsconfig.json
```

### Testes Automatizados do Backend
Execute os testes unitários e de integração com o `pytest`:
```bash
pytest tests/ -v
```

---

*Desenvolvido com foco em alta disponibilidade, isolamento multi-tenant seguro e excelência em experiência de usuário para atletas e gestores esportivos.*
