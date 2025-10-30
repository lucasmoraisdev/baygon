import importlib
import pathlib
import pkgutil
from sqlalchemy.orm import declarative_base
from sqlalchemy import DateTime, Column
from sqlalchemy.sql import func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config.settings import DATABASE_URL
from sqlalchemy import event

class Timestamp:
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

Base = declarative_base()

models_dir = pathlib.Path(__file__).parent / "models"

# Importando dinamicamente todos os modulos dentro de app/db/models
for module_info in pkgutil.iter_modules([str(models_dir)]):
    module_name = f"app.db.models.{module_info.name}"
    importlib.import_module(module_name)

if not DATABASE_URL:
    raise ValueError("DATABASE_URL não foi configurada corretamente.")

if not DATABASE_URL.startswith("mysql+aiomysql://"):
    raise ValueError("DATABASE_URL precisa usar um driver assíncrono, ex: mysql+aiomysql://")
print(f"📦 Conectando ao banco de dados... {DATABASE_URL}")
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True
)

@event.listens_for(engine.sync_engine, "connect")
def set_sql_mode(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("SET time_zone = '+00:00'")
    cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
        
    await engine.dispose()