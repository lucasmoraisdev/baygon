from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import DateTime, create_engine, Column
from sqlalchemy.sql import func
from app.config.settings import DATABASE_URL

class Timestamp:
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

Base = declarative_base()

if not DATABASE_URL:
    raise ValueError("DATABASE_URL não foi configurada corretamente.")

engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    echo=False,
    connect_args={"timezone": "+00:00"}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
