import os
import unittest
from datetime import datetime, timezone

os.environ.setdefault("PYTHONUTF8", "1")

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import engine, get_db
from app.db.models.award import Awards
from app.db.models.match import Match
from app.db.models.match_event import MatchEvent
from app.db.models.player import Player
from app.db.models.player_score import PlayerScore
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.models.team import Teams
from app.main import app


class TestAssociationRanking(unittest.IsolatedAsyncioTestCase):
    async def test_association_ranking_and_csv_export(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            season = Seasons(
                number=995,
                initial_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
                end_date=None,
                is_active=True,
            )
            session.add(season)
            await session.flush()

            rnd = Round(
                date=datetime(2026, 11, 12, tzinfo=timezone.utc),
                location="Arena Baygon",
                referee="Cruz",
                round_number=1,
                season_id=int(season.id_season),
            )
            session.add(rnd)
            await session.flush()

            gk = Player(nome="BARATA TESTE", apelido="Barata", posicao="goleiro", potes=1, is_associate=True, is_guest=False)
            ala = Player(nome="ADILSON TESTE", apelido="Adilson", posicao="ala", potes=1, is_associate=True, is_guest=False)
            loser = Player(nome="DIEGO TESTE", apelido="Diego", posicao="ala", potes=2, is_associate=True, is_guest=False)
            session.add_all([gk, ala, loser])
            await session.flush()

            team_a = Teams(name="Time A", round_id=int(rnd.id_round), players=[gk, ala])
            team_b = Teams(name="Time B", round_id=int(rnd.id_round), players=[loser])
            session.add_all([team_a, team_b])
            await session.flush()

            from sqlalchemy import select
            from app.db.models.user import User

            cameraman = (await session.execute(select(User))).scalars().first()
            if not cameraman:
                cameraman = User(
                    name="Cam Ranking",
                    email="cam_ranking@baygon.com",
                    username="cam_ranking",
                    password="x",
                    is_admin=True,
                    phone_number="11900001111",
                    is_active=True,
                )
                session.add(cameraman)
                await session.flush()

            match = Match(
                round_id=int(rnd.id_round),
                home_team_id=int(team_a.id_team),
                away_team_id=int(team_b.id_team),
                filmed_by=int(cameraman.id_user),
                event_type="vitoria_mandante",
                score_home=2,
                score_away=0,
            )
            session.add(match)
            await session.flush()

            session.add_all([
                MatchEvent(match_id=int(match.id_match), player_id=int(ala.id_player), event_type="gol"),
                MatchEvent(match_id=int(match.id_match), player_id=int(gk.id_player), event_type="assistencia"),
                MatchEvent(match_id=int(match.id_match), player_id=int(ala.id_player), event_type="gol"),
                Awards(round_id=int(rnd.id_round), teams=[team_a], event_type="time_vencedor_rodada"),
                Awards(round_id=int(rnd.id_round), player=[gk], event_type="roleta"),
                PlayerScore(player_id=int(ala.id_player), round_id=int(rnd.id_round), season_id=int(season.id_season), total_points=41),
                PlayerScore(player_id=int(gk.id_player), round_id=int(rnd.id_round), season_id=int(season.id_season), total_points=27),
            ])
            await session.flush()

            season_id = int(season.id_season)
            ala_id = int(ala.id_player)
            gk_id = int(gk.id_player)
            loser_id = int(loser.id_player)

            async def _override_get_db():
                yield session

            app.dependency_overrides[get_db] = _override_get_db

            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                resp = await client.get(f"/api/v1/rankings/season/{season_id}/association")
                self.assertEqual(resp.status_code, 200, resp.text)
                data = resp.json()
                self.assertEqual(data["season_number"], 995)
                rows_by_id = {r["player_id"]: r for r in data["rows"]}

                ala_row = rows_by_id[ala_id]
                self.assertEqual(ala_row["ranking_geral"], 41)
                self.assertEqual(ala_row["artilharia"], 2)
                self.assertEqual(ala_row["babas_conquistados"], 1)
                self.assertEqual(ala_row["pizza"], 1)
                self.assertEqual(ala_row["clean_sheets"], 0)
                self.assertEqual(ala_row["ultimo_baba"], "1°")
                self.assertEqual(ala_row["ultima_vitoria"], "1°")
                self.assertEqual(ala_row["posicao"], "ALA")

                gk_row = rows_by_id[gk_id]
                self.assertEqual(gk_row["clean_sheets"], 1)
                self.assertEqual(gk_row["assistencias"], 1)
                self.assertEqual(gk_row["roleta"], 1)
                self.assertEqual(gk_row["pizza"], 1)
                self.assertEqual(gk_row["posicao"], "GOLEIRO")

                loser_row = rows_by_id[loser_id]
                self.assertEqual(loser_row["babas_perdidos"], 1)
                self.assertEqual(loser_row["ultima_vitoria"], "NÃO")

                csv_resp = await client.get(f"/api/v1/rankings/season/{season_id}/export-csv")
                self.assertEqual(csv_resp.status_code, 200)
                csv_text = csv_resp.text
                self.assertIn("RANKING ASSOCIAÇÃO BAYGON - 995ª TEMPORADA", csv_text)
                self.assertIn("Boleiros,Ranking Geral,Artilharia,Assistências", csv_text)
                self.assertIn("Adilson,41,2,0,1,0,0", csv_text)
        finally:
            app.dependency_overrides.clear()
            await session.close()
            await trans.rollback()
            await conn.close()
