# app/__init__.py
"""
Pacote principal da aplicação Streamlit Baygon.
Contém a configuração inicial e os submódulos principais.
"""
from .api import v1
from . import core, config, schemas, db, migrations, components

__version__ = "0.1.0"
__all__ = ["core", "config", "db", "v1", "schemas", "migrations", "components"]
