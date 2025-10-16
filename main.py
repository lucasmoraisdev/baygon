from dotenv import load_dotenv
import streamlit as st
import os
load_dotenv()
environment = os.getenv("ENVIRONMENT")

database_connection = "local_database" if environment == "development" else "production_database"

conn = st.connection(database_connection)

st.write("Baygon")


login_page = st.Page("app/pages/login.py", title="Login", icon="🔑")
matchday_page = st.Page("app/pages/matchday.py", title="Baba", icon="⚽️")
# ranking_page = st.Page("pages/ranking.py", title="Ranking", icon="🏆")
# season_page = st.Page("pages/season.py", title="Temporada", icon="⏳")

pg = st.navigation([login_page, matchday_page])

pg.run()