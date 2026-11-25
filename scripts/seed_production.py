import argparse
import asyncio
import os
import sys

# Garante saída UTF-8 no Windows
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

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
    if not target_url and os.getenv("DB_HOST"):
        import urllib.parse
        host = os.getenv("DB_HOST")
        port = os.getenv("DB_PORT", "4000")
        user = urllib.parse.quote_plus(os.getenv("DB_USERNAME", os.getenv("DB_USER", "")).strip("'\""))
        pwd = urllib.parse.quote_plus(os.getenv("DB_PASSWORD", "").strip("'\""))
        db = os.getenv("DB_DATABASE", os.getenv("DB_NAME", "test")).strip("'\"")
        target_url = f"mysql+aiomysql://{user}:{pwd}@{host}:{port}/{db}"

    if not target_url:
        print("❌ Erro: DATABASE_URL ou variáveis DB_HOST/DB_USERNAME/DB_PASSWORD não informadas.")
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

    # Divide os comandos por ponto e vírgula e remove linhas de comentário
    raw_statements = sql_content.split(";")
    statements = []
    for s in raw_statements:
        clean_lines = [line for line in s.splitlines() if not line.strip().startswith("--")]
        stmt = "\n".join(clean_lines).strip()
        if stmt:
            statements.append(stmt)

    print(f"🚀 Executando {len(statements)} comandos SQL no banco remoto...")

    import re
    async with engine.begin() as conn:
        # Desativa chaves estrangeiras explicitamente na sessão
        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))

        executed = 0
        for stmt in statements:
            try:
                # Log amigável para comandos INSERT
                if stmt.upper().startswith("INSERT"):
                    m = re.search(r"INTO\s+[`]?([a-zA-Z0-9_]+)[`]?", stmt, re.IGNORECASE)
                    tbl = m.group(1) if m else "tabela"
                    print(f"  -> Populando `{tbl}`...")
                await conn.execute(text(stmt))
                executed += 1
            except Exception as e:
                print(f"⚠️ Aviso na instrução: {e}")

        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

    print("-" * 70)
    print(f"✅ Execução de comandos finalizada: {executed}/{len(statements)} concluídos.")
    print("-" * 70)
    print("🔍 Verificando registros no banco remoto...")

    total_remote_rows = 0
    async with engine.connect() as conn:
        res = await conn.execute(text("SHOW TABLES;"))
        remote_tables = [row[0] for row in res.fetchall() if row[0] != "alembic_version"]
        for t in remote_tables:
            try:
                c = await conn.execute(text(f"SELECT COUNT(*) FROM `{t}`;"))
                count = c.scalar()
                total_remote_rows += count
                if count > 0:
                    print(f"  ✓ `{t}`: {count} registros")
            except Exception as e:
                pass

    await engine.dispose()

    print("=" * 70)
    print(f"🎉 Seeder concluído! Total de {total_remote_rows} registros presentes no banco remoto.")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Seeder de produção do Baygon a partir do dump.")
    parser.add_argument("--db-url", type=str, help="URL de conexão do banco de dados de produção")
    parser.add_argument("--file", type=str, help="Caminho do arquivo SQL de dump (padrão: scripts/dump_initial_data.sql)")
    args = parser.parse_args()

    asyncio.run(run_seed(db_url=args.db_url, dump_file=args.file))


if __name__ == "__main__":
    main()
