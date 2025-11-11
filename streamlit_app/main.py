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
    register_teams_page = st.Page("./pages/invite_user.py", title="Registrar/Editar Times", icon="✍️")
    # manage_players_page = st.Page("./pages/invite_user.py", title="Confirmar/Remover Jogadores", icon="🛠️")
    # draw_teams_page = st.Page("./pages/invite_user.py", title="Sortear Times", icon="🎲")
    

    # Paginas acessiveis para nao-logados e limitado para logados nao admins
    # teams_page = st.Page("./pages/invite_user.py", title="Ver times", icon="📝")
    # players_page = st.Page("./pages/invite_user.py", title="Confirmar presença", icon="✅")

    # Usuario nao logado pode ver a pagina de login, ranking, matchday e season
    if not status['logged_in']:
        navigation = [
            login_page, 
            matchday_page, 
            ranking_page, 
            season_page, 
            complete_registration,
            # teams_page,
            # players_page,
        ]

    # Usuario logado pode ver as mesmas paginas (mais pagina de confirmacao de nome para lista do baba (TODO), alterar perfil e Login q vira sair)
    else:
        navigation = [
            matchday_page,
            ranking_page,
            season_page,
            login_page,
            # teams_page,
            # players_page,
            complete_registration
        ]

        if status["is_admin"]:
            # navigation.insert(-1, draw_teams_page)
            # navigation.insert(-1, manage_players_page)
            navigation.insert(-1, register_teams_page)
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


