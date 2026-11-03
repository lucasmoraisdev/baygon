# Guia de Desenvolvimento & Padrões de Arquitetura — Baygon API

Este documento estabelece as diretrizes oficiais de desenvolvimento, padrões arquiteturais, convenções de código, fluxo de banco de dados e estratégia de testes para a API backend do **Baygon** construída com **FastAPI**, **SQLAlchemy (Async)**, **Alembic** e **Pydantic**.

---

## 1. Visão Geral da Arquitetura

A API adota uma arquitetura em camadas limpas com separação estrita de responsabilidades (**Separation of Concerns - SoC**):

```
app/
├── api/v1/             # 1. CONTROLLERS / ROUTERS (Rotas HTTP, validação de payload e códigos de status)
├── core/
│   ├── dependencies/   # 2. INJEÇÕES DE DEPENDÊNCIA (Validação de JWT, permissões RBAC)
│   ├── services/       # 3. REGRAS DE NEGÓCIO (Casos de Uso, validações de domínio, cálculos)
│   ├── enum/           # 4. ENUMS DE DOMÍNIO (Tipos de eventos, posições, status)
│   └── utils.py        # 5. UTILITÁRIOS (Criptografia Fernet, hashes, envio de e-mail)
├── db/
│   ├── models/         # 6. ENTIDADES DO BANCO (Mapeamento ORM declarativo SQLAlchemy)
│   ├── repositories/   # 7. REPOSITÓRIOS (Acesso e consultas diretas ao banco via AsyncSession)
│   └── base.py         # 8. CONEXÃO / ENGINE (Async engine, sessão assíncrona, Base)
├── schemas/            # 9. SCHEMAS PYDANTIC (DTOs de entrada, saída e atualização)
├── migrations/         # 10. MIGRATIONS ALEMBIC (Controle de versão do schema SQL)
└── main.py             # 11. ENTRADA DA APLICAÇÃO (Setup de rotas, middlewares, CORS)
```

---

## 2. Fluxo Desejado de Requisição (Life of a Request)

Toda requisição deve percorrer estritamente a seguinte esteira:

```
[ Cliente HTTP ]
       │
       ▼
[ Router (app/api/v1/*.py) ]
       │  Valida Schema Pydantic de entrada
       │  Injeta Depends(get_db) e Depends(user_has_permission)
       ▼
[ Service (app/core/services/*.py) ]
       │  Aplica regras de negócio, validações de unicidade e cálculos
       │  Não executa SQL cru nem comanda commits manuais desnecessários
       ▼
[ Repository (app/db/repositories/*.py) ]
       │  Executa queries (select, add, commit, refresh) usando AsyncSession
       │  Aplica filtros de soft-delete (deleted_at.is_(None))
       ▼
[ Banco de Dados (MySQL / MariaDB via aiomysql) ]
```

---

## 3. Padrão de Implementação por Camada

### 3.1 Schemas (Pydantic DTOs) — `app/schemas/`
Sempre criar 4 classes para cada entidade:
- `EntityBase`: Campos comuns obrigatórios.
- `EntityCreate(EntityBase)`: Campos necessários na criação (ex: senhas ou campos com default).
- `EntityUpdate(BaseModel)`: Todos os campos opcionais (`Optional[...] = None`) para updates parciais.
- `EntityRead(EntityBase)`: Dados retornados ao cliente (com IDs, timestamps e `from_attributes = True`).

```python
# app/schemas/season_schema.py
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class SeasonBase(BaseModel):
    initial_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool = True

class SeasonCreate(SeasonBase):
    number: Optional[int] = None

class SeasonUpdate(BaseModel):
    initial_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class SeasonRead(SeasonBase):
    id_season: int
    number: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
```

---

### 3.2 Repositórios (Data Access) — `app/db/repositories/`
- Recebem `AsyncSession` no construtor.
- Toda busca deve respeitar o **Soft Delete**: `where(Model.deleted_at.is_(None))`.
- Operações de mutação devem fazer `await self.db.commit()` e `await self.db.refresh(model)`.

```python
# app/db/repositories/season_repository.py
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.season import Seasons

class SeasonRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id_season: int) -> Optional[Seasons]:
        stmt = select(Seasons).where(
            Seasons.id_season == id_season,
            Seasons.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, season: Seasons) -> Seasons:
        self.db.add(season)
        await self.db.commit()
        await self.db.refresh(season)
        return season
```

---

### 3.3 Serviços (Regras de Negócio) — `app/core/services/`
- Recebem a instância do `Repository` via injeção.
- Centralizam decisões de negócio (ex: número sequencial automático, ativação de temporadas, cálculo de pontuação).
- Levantam `HTTPException` com status semântico em caso de inconsistência de negócio.

```python
# app/core/services/season_service.py
class SeasonService:
    def __init__(self, repo: SeasonRepository):
        self.repo = repo

    async def create_new_season(self, season_data: dict) -> Seasons:
        if not season_data.get("number"):
            last_number = await self.repo.get_last_season_number()
            season_data["number"] = last_number + 1

        if "is_active" not in season_data or season_data["is_active"] is None:
            season_data["is_active"] = True

        season = Seasons(**season_data)
        return await self.repo.create(season=season)
```

---

### 3.4 Rotas / Controllers — `app/api/v1/`
- Não devem ter lógica de negócio ou queries de banco diretamente.
- Apenas orquestram repositório + serviço, recebem DTOs e retornam DTOs.
- Devem declarar explicitamente `response_model` e `status_code`.

```python
# app/api/v1/seasons.py
@router.post("/", response_model=SeasonRead, status_code=status.HTTP_201_CREATED)
async def create_season(
    season_create: SeasonCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(user_has_permission)
):
    repo = SeasonRepository(db)
    service = SeasonService(repo)
    return await service.create_new_season(season_create.model_dump())
```

---

## 4. Banco de Dados e Migrações (Alembic)

1. **Nunca altere o banco diretamente via DDL manual**: toda alteração de tabela deve ser feita através de uma migration do Alembic.
2. **Ciclo de Migration:**
   ```bash
   # 1. Altere o modelo em app/db/models/*.py
   
   # 2. Crie a migration com nome descritivo:
   alembic -c app/alembic.ini revision --autogenerate -m "add_column_x_to_table_y"
   
   # 3. Inspecione o arquivo gerado em app/migrations/versions/
   # (ATENÇÃO: no MySQL InnoDB, nunca tente dropar índices que suportem Foreign Keys)
   
   # 4. Aplique a migração:
   alembic -c app/alembic.ini upgrade head
   ```

---

## 5. Autenticação e Permissões (RBAC)

1. **Tokens JWT:**
   - O `access_token` tem duração padrão de **24 horas** e carrega `sub` (email), `role`, `user_id` e `username`.
   - O `refresh_token` tem duração de **30 dias** e serve exclusivamente para obter um novo par de tokens.
2. **Dependências de Rota:**
   - `Depends(get_current_user)`: Garante apenas que o token é válido e o usuário existe.
   - `Depends(user_has_permission)`: Garante que o usuário possui a role necessária (ex: `ADMIN`).

---

## 6. Estratégia e Padrão de Testes Automatizados

Os testes devem ser organizados na pasta raiz `tests/` utilizando **pytest** e **pytest-asyncio** com banco de testes isolado (SQLite em memória ou MySQL de teste):

```
tests/
├── conftest.py            # Fixtures globais (cliente HTTP assíncrono, engine de teste, tokens)
├── unit/                  # Testes unitários puros de Services e Utils (com mocks)
│   ├── test_auth_service.py
│   └── test_score_service.py
└── integration/           # Testes ponta a ponta dos endpoints HTTP
    ├── test_auth_api.py
    ├── test_seasons_api.py
    └── test_matches_api.py
```

### Exemplo de Teste de Integração (pytest + httpx.AsyncClient):

```python
# tests/integration/test_seasons_api.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_and_get_current_season(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "initial_date": "2026-05-01T00:00:00Z",
        "end_date": "2026-10-01T00:00:00Z"
    }

    # 1. Cria temporada
    response = await client.post("/api/v1/seasons/", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["is_active"] is True

    # 2. Busca temporada atual
    get_res = await client.get("/api/v1/seasons/current")
    assert get_res.status_code == 200
    assert get_res.json()["id_season"] == data["id_season"]
```

---

## 7. Checklist para Criação de Novos Recursos / Endpoints

Antes de submeter qualquer novo endpoint ou funcionalidade na API:
- [ ] O modelo SQLAlchemy está com herança de `Base, Timestamp` e soft delete?
- [ ] Foi gerada e executada a migration do Alembic?
- [ ] Os 4 schemas do Pydantic (`Base`, `Create`, `Update`, `Read`) foram criados?
- [ ] O `Repository` implementa os métodos de banco com tratamento de `deleted_at`?
- [ ] O `Service` concentra as validações de domínio e lança `HTTPException` apropriada?
- [ ] O `Router` possui tipagem estrita de retorno (`response_model=...`) e `status_code`?
- [ ] As rotas administrativas estão protegidas com `Depends(user_has_permission)`?
- [ ] O router foi registrado em `app/main.py` com o prefixo `/api/v1`?

