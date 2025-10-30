import os
import time
import streamlit as st
from utils.session_state import init_session_state, get_user_status

init_session_state()

os.environ["TZ"] = "UTC"
time.tzset()

def get_navigation_pages(status):
    """
    Define a lista de paginas de navegacao, controlando a visibilidade de paginas restritas, como o convite de administrador.
    """

    # Paginas acessiveis para todos
    login_page = st.Page("./pages/login.py", title="Login/Sair", icon="🔑")
    matchday_page = st.Page("./pages/matchday.py", title="Baba", icon="⚽️")
    ranking_page = st.Page("./pages/ranking.py", title="Ranking", icon="🏆")
    season_page = st.Page("./pages/season.py", title="Temporada", icon="⏳")
    complete_registration = st.Page("./pages/complete_registration.py", title="Finalizar cadastro", icon="🔑")

    # Paginas acessiveis apenas por administradores
    invite_user_page = st.Page(
        "./pages/invite_user.py", 
        title="Convidar Usuário", 
        icon="✉️",
    )

    # Usuario nao logado pode ver a pagina de login, ranking, matchday e season
    if not status['logged_in']:
        navigation = [login_page, matchday_page, ranking_page, season_page, complete_registration]

    # Usuario logado pode ver as mesmas paginas (mais pagina de confirmacao de nome para lista do baba (TODO), alterar perfil e Login q vira sair)
    else:
        navigation = [
            matchday_page,
            ranking_page,
            season_page,
            login_page,
            complete_registration
        ]

        if status["is_admin"]:
            navigation.insert(0, invite_user_page)
    
    return navigation

st.title("Baygonverso :stadium:")
st.markdown('---')

# st.set_page_config(
#     page_title="Baygonverso",
#     page_icon="⚽️",
#     layout="centered",
#     initial_sidebar_state="expanded",
#     menu_items={
#         'About': '# Xandao inventando moda.'
#     }
# )

user_status = get_user_status()

pages_list = get_navigation_pages(user_status)
pg = st.navigation(pages_list)
pg.run()


