# app/__init__.py
"""
Pacote principal da aplicação Streamlit Baygon.
Contém a configuração inicial e os submódulos principais.
"""
from . import core, config, schemas, db, api

__version__ = "0.1.0"
__all__ = ["core", "config", "db", "api", "schemas"]
