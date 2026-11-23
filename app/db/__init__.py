import asyncio
from app.db.base import Base, engine, get_db

print("[DB] Criando tabelas no banco...")
print(f"[DB] Conectando ao banco de dados... {engine.url}")
print(f"[DB] Tabelas... {Base.metadata}")
async def init_db():
    # async with engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.create_all)
    print("[DB] Banco de dados inicializado!")

print("[DB] Criando tabelas no banco...")
# asyncio.run(init_db())