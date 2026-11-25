import argparse
import asyncio
import os
import sys

# Garante saída UTF-8 no Windows
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


def clean_database_url(url: str) -> str:
    """Padroniza URL para driver assíncrono mysql+aiomysql."""
    if not url:
        return url
    if url.startswith("mysql://"):
        url = url.replace("mysql://", "mysql+aiomysql://", 1)
    return url


async def run_seed(db_url: str = None, dump_file: str = None):
    target_url = db_url or os.getenv("DATABASE_URL")
    if not target_url:
        print("❌ Erro: DATABASE_URL não informada via argumento ou variável de ambiente.")
        sys.exit(1)

    target_url = clean_database_url(target_url)
    sql_path = dump_file or os.path.join("scripts", "dump_initial_data.sql")

    if not os.path.exists(sql_path):
        print(f"❌ Erro: Arquivo de dump não encontrado em: {sql_path}")
        sys.exit(1)

    print("=" * 70)
    print("🌱 BAYGON - SEEDER DE PRODUÇÃO / INICIAL")
    print("=" * 70)
    # Mascara a senha para exibição segura
    safe_display_url = target_url
    if "@" in target_url and ":" in target_url.split("@")[0]:
        prefix, rest = target_url.split("@", 1)
        scheme_user = prefix.rsplit(":", 1)[0]
        safe_display_url = f"{scheme_user}:****@{rest}"
    print(f"🔌 Destino: {safe_display_url}")
    print(f"📄 Arquivo: {sql_path}")
    print("-" * 70)

    # Configuração de conexão com SSL automático se necessário
    connect_args = {}
    if "tidbcloud.com" in target_url or "aivencloud.com" in target_url or "ssl" in target_url.lower():
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx

    engine = create_async_engine(
        target_url,
        echo=False,
        connect_args=connect_args,
        pool_pre_ping=True,
    )

    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    # Divide os comandos por ponto e vírgula
    raw_statements = sql_content.split(";")
    statements = []
    for s in raw_statements:
        clean = s.strip()
        if clean and not clean.startswith("--"):
            statements.append(clean)

    print(f"🚀 Executando {len(statements)} blocos de comandos SQL...")

    async with engine.connect() as conn:
        # Desativa chaves estrangeiras explicitamente na sessão
        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        
        executed = 0
        for stmt in statements:
            try:
                await conn.execute(text(stmt))
                executed += 1
            except Exception as e:
                # Mostra aviso mas continua para não travar em caso de inserts duplicados
                print(f"⚠️ Aviso na instrução: {e}")

        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        await conn.commit()

    await engine.dispose()

    print("-" * 70)
    print(f"✅ Seeder concluído com sucesso! {executed}/{len(statements)} comandos executados.")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Seeder de produção do Baygon a partir do dump.")
    parser.add_argument("--db-url", type=str, help="URL de conexão do banco de dados de produção")
    parser.add_argument("--file", type=str, help="Caminho do arquivo SQL de dump (padrão: scripts/dump_initial_data.sql)")
    args = parser.parse_args()

    asyncio.run(run_seed(db_url=args.db_url, dump_file=args.file))


if __name__ == "__main__":
    main()
