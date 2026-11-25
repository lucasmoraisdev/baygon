import asyncio
import json
import os
import sys
from datetime import date, datetime, time
from decimal import Decimal

# Garante saída UTF-8 no Windows
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.base import engine
from sqlalchemy import text


def format_sql_value(val):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "1" if val else "0"
    if isinstance(val, (int, float, Decimal)):
        return str(val)
    if isinstance(val, (datetime, date, time)):
        return f"'{val.strftime('%Y-%m-%d %H:%M:%S')}'"
    if isinstance(val, bytes):
        return f"X'{val.hex()}'"

    # String escaping
    escaped = (
        str(val)
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r", "\\r")
        .replace("\n", "\\n")
        .replace("\0", "\\0")
    )
    return f"'{escaped}'"


def serialize_json(obj):
    if isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.hex()
    return obj


async def run_export():
    print("[1/3] Conectando ao banco local e listando tabelas...")
    json_dump = {}
    sql_lines = [
        "-- ====================================================================",
        "-- BAYGON - DUMP INICIAL DE DADOS PARA PRODUÇÃO",
        f"-- Gerado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "-- ====================================================================",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "",
    ]

    async with engine.connect() as conn:
        res = await conn.execute(text("SHOW TABLES;"))
        tables = [row[0] for row in res.fetchall() if row[0] != "alembic_version"]

        total_rows_all = 0

        for table in tables:
            rows_res = await conn.execute(text(f"SELECT * FROM `{table}`;"))
            cols = list(rows_res.keys())
            rows = rows_res.fetchall()

            if not rows:
                continue

            total_rows_all += len(rows)
            print(f" -> Tabela `{table}`: {len(rows)} registros")

            # Salva no JSON
            json_dump[table] = [
                {k: serialize_json(v) for k, v in zip(cols, row)} for row in rows
            ]

            # Gera comandos SQL
            col_names = ", ".join(f"`{c}`" for c in cols)
            sql_lines.append(f"-- Dados da tabela `{table}` ({len(rows)} registros)")

            # Agrupa inserts em lotes de 50
            batch_size = 50
            for i in range(0, len(rows), batch_size):
                batch = rows[i : i + batch_size]
                values_clauses = []
                for r in batch:
                    formatted_vals = ", ".join(format_sql_value(v) for v in r)
                    values_clauses.append(f"({formatted_vals})")

                values_str = ",\n  ".join(values_clauses)
                sql_lines.append(
                    f"INSERT IGNORE INTO `{table}` ({col_names}) VALUES\n  {values_str};"
                )

            sql_lines.append("")

        sql_lines.append("SET FOREIGN_KEY_CHECKS = 1;")
        sql_lines.append("-- Fim do Dump")

    # Salva arquivos
    os.makedirs("scripts", exist_ok=True)
    sql_path = os.path.join("scripts", "dump_initial_data.sql")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))
    print(f"[2/3] SQL Dump salvo com sucesso em: {sql_path}")

    json_path = os.path.join("scripts", "initial_data_dump.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_dump, f, ensure_ascii=False, indent=2)
    print(f"[3/3] JSON Dump salvo com sucesso em: {json_path}")

    print(
        f"\nConcluído! Total de {total_rows_all} registros exportados de {len(json_dump)} tabelas."
    )


if __name__ == "__main__":
    asyncio.run(run_export())
