from sqlalchemy.orm import declarative_base
from sqlalchemy import DateTime, Column
from sqlalchemy.sql import func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config.settings import DATABASE_URL

class Timestamp:
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

Base = declarative_base()

if not DATABASE_URL:
    raise ValueError("DATABASE_URL não foi configurada corretamente.")

if not DATABASE_URL.startswith("mysql+aiomysql://"):
    raise ValueError("DATABASE_URL precisa usar um driver assíncrono, ex: mysql+aiomysql://")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args={"timezone": "+00:00"}
)

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