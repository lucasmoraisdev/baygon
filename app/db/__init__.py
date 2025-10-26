from app.db.base import Base, engine
from app.db.models.user import User

print("📦 Criando tabelas no banco...")
Base.metadata.create_all(bind=engine)
print("✅ Banco de dados inicializado!")
