import streamlit as st

st.title("⚽️ Dia de Baba (Matchday)")
st.markdown("---")

st.header("Resultados da Rodada")

# mostrar as tabelas

# conteudo restrito, cadastro e edicao
if st.session_state.get("logged_in") and st.session_state.get("is_admin"):
    st.divider()
    st.header("🛠️ Painel de Administração de Rodadas")
    st.warning(f"Bem vindo Xandão! Aqui você pode registrar os resultados das partidas da rodada.")

    with st.expander("Registrar novo jogo"):
        col1, col2 = st.columns(2)
        with col1:
            st.selectbox("Time da casa", ["Time A", "Time B"])
        with col2:
            st.selectbox("Time visitante", ["Time C", "Time D"])
        st.number_input("Resultado do time da casa", min_value=0)
        st.number_input("Resultado do time visitante", min_value=0)
        st.button("Salvar resultados", type="secondary")
elif st.session_state.get("logged_in"):
    st.info("Usuario logado e nao eh o xandao")

else:
    st.info("Para editar faca login")
    st.page_link("app/pages/login.py", label="Ir para login")