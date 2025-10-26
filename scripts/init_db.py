from app.db.base import Base, engine
from app.db.models import round, user, ranking


def init_db():
    print("🔧 Criando tabelas no banco (se ainda não existirem)...")
    Base.metadata.create_all(bind=engine)
    print("✅ Banco inicializado com sucesso!")

if __name__ == "__main__":
    init_db()
