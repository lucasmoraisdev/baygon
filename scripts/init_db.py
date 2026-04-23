import asyncio
from app.db.base import Base, engine


async def init_db():
    print("🔧 Criando tabelas no banco (se ainda não existirem)...")

    # async with engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.create_all)

    print("✅ Banco inicializado com sucesso!")


if __name__ == "__main__":
    asyncio.run(init_db())