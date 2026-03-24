# Baygon API (performanceBaygon)

Bem-vindo ao repositório do **Baygon API**, um sistema de gerenciamento de campeonatos esportivos estruturado com as tecnologias mais modernas e eficientes.

## 🚀 Tecnologias Utilizadas

- **FastAPI**: Framework web moderno e de alta performance para construção de APIs com Python.
- **SQLAlchemy & Alembic**: ORM e controle de migrações para mapeamento e gestão do banco de dados (MySQL/PostgreSQL suportados).
- **Pydantic**: Para validação rigorosa de tipagens e schemas de entrada/saída (DTOs).
- **Uvicorn**: Servidor ASGI leve e ultrarrápido.

## 📁 Estrutura do Projeto

O projeto adota uma arquitetura em camadas limpas, garantindo separação de responsabilidades (SoC - Separation of Concerns), facilitando a testabilidade e evolução contínua da aplicação:

```
app/
├── api/v1/             # Controladores (Routers) - Responsáveis por expor os endpoints e tratar requisições HTTP (Auth, Seasons, Rounds, etc)
├── core/
│   ├── dependencies/   # Injeções de dependência, como validação de tokens JWT e permissões
│   └── services/       # Regras de Negócio - Classes que abstraem a lógica da aplicação, isolando os controllers do banco de dados (TeamService, MatchService...)
├── db/
│   ├── models/         # Entidades do SQLAlchemy mapeadas diretamente para tabelas do BD
│   └── repositories/   # Camada de abstração do SQLAlchemy (Design Pattern: Depository). Centraliza acesso direto a tabelas e consultas complexas via DB Async.
├── schemas/            # Schemas do Pydantic utilizados para validar o tráfego de dados nas rotas
└── main.py             # Entrada principal da aplicação FastAPI e setup de Rotas / Middlewares
```

## ⚙️ Entidades & Funcionalidades (Casos de Uso)

O sistema foi completamente mapeado a partir do `USE_CASES.md`, englobando endpoints RESTful organizados e separados:

- **🔐 Usuários (`/users`)**: Autenticação, gestão e busca de usuários por hierarquia.
- **📅 Temporadas (`/seasons`)**: Criação e gestão de competições/temporadas contendo múltiplas rodadas.
- **🔄 Rodadas (`/rounds`)**: Definição de eventos e datas vinculados a uma temporada para agrupamento de partidas.
- **🏆 Times (`/teams`)**: Gestão de equipes criadas e em atividade dentro de rodadas.
- **👥 Jogadores (`/players`)**: Perfis globais associados aos times, com tracking de atividades.
- **⚽ Partidas (`/matches`)**: Jogos organizados com base nos times registrados, resultados e logs de câmeras.
- **📊 Eventos (`/events`)**: Linha do tempo de uma partida com tracking do que ocorreu em jogo (gols, cartões, faltas, assists).
- **🎯 Pontuações / Rankings (`/rankings`)**: Sistema base de agregação de pontos individuais e por time que consolida a tabela principal do campeonato.
- **🏅 Prêmios (`/awards`)**: Distribuição de prêmios por time e por jogador conforme o evento catalogado na partida.
- **⚙️ Regras (`/rules`)**: Central paramétrica configurável de pontuação aplicável dinamicamente conforme cada tipo de evento registrado.

## 🛠️ Como Executar o Projeto Localmente

1. **Clone o repositório e acesse a pasta:**
   ```bash
   git clone <URL_DO_REPO>
   cd baygon
   ```

2. **Crie e ative um ambiente virtual (Recomendado):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/MacOS
   # venv\Scripts\activate   # Windows
   ```

3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configuração de Ambiente (`.env`):**
   - Certifique-se de configurar sua conexão de banco de dados e credenciais JWT.

5. **Inicie o servidor de desenvolvimento FastAPI:**
   ```bash
   uvicorn app.main:app --reload
   ```

6. **Acesse e teste a API:**
   - Acesse em seu navegador: [http://localhost:8000/docs](http://localhost:8000/docs)
   - O *Swagger UI* trará a documentação de todos os endpoints perfeitamente estruturados e interativos!

---
*Desenvolvido seguindo as melhores práticas do mercado, voltado à escalabilidade, controle de performance e componentização de software.*