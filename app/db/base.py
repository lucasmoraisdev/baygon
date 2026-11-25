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
    raise ValueError(
        "DATABASE_URL não foi configurada. Configure a variável de ambiente DATABASE_URL no seu provedor (ex: Render)."
    )

DATABASE_URL = DATABASE_URL.strip().strip("'\"")

if DATABASE_URL.startswith("mysql://"):
    DATABASE_URL = DATABASE_URL.replace("mysql://", "mysql+aiomysql://", 1)
elif DATABASE_URL.startswith("mysql+pymysql://"):
    DATABASE_URL = DATABASE_URL.replace("mysql+pymysql://", "mysql+aiomysql://", 1)

if not DATABASE_URL.startswith("mysql+aiomysql://"):
    scheme = DATABASE_URL.split("://")[0] if "://" in DATABASE_URL else DATABASE_URL
    raise ValueError(
        f"DATABASE_URL inválida (esquema recebido: '{scheme}://'). "
        f"O Baygon requer um banco de dados MySQL compatível com aiomysql (ex: mysql://usuario:senha@host:port/banco). "
        f"Certifique-se de usar um serviço MySQL (como TiDB Cloud Serverless gratuito) e não PostgreSQL."
    )

import os
import ssl

connect_args = {}
if (
    any(k in DATABASE_URL.lower() for k in ["ssl", "tidbcloud.com", "aivencloud.com"])
    or os.getenv("DB_SSL", "").lower() in ("true", "1")
):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = ctx

# Mascara senha nos logs
safe_log_url = DATABASE_URL
if "@" in DATABASE_URL and ":" in DATABASE_URL.split("@")[0]:
    prefix, rest = DATABASE_URL.split("@", 1)
    scheme_user = prefix.rsplit(":", 1)[0]
    safe_log_url = f"{scheme_user}:****@{rest}"

print(f"[DB] Conectando ao banco de dados... {safe_log_url}")
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args=connect_args,
)

from app.db.tenant_filter import setup_tenant_isolation
setup_tenant_isolation(engine)

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