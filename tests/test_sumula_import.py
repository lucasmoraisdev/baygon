import os
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

os.environ.setdefault("PYTHONUTF8", "1")

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.enum.events_enum import EventTypeEnum
from app.core.services.sumula_ocr_service import (
    SumulaOCRService,
    _parse_date_str,
    _parse_ouro_count,
    _parse_total_points,
    fuzzy_match_name,
)
from app.core.services.sumula_tabular_service import SumulaTabularService
from app.db.base import engine, get_db
from app.db.models.match_event import MatchEvent
from app.db.models.player import Player
from app.db.models.player_score import PlayerScore
from app.db.models.player_season_score import PlayerSeasonScore
from app.db.models.season import Seasons
from app.db.models.team import Teams
from app.db.models.user import User
from app.main import app


class TestSumulaParsingHelpers(unittest.TestCase):
    def test_parse_total_points_with_extra(self):
        raw, base, extra, total = _parse_total_points("38+3", goals=8, assists=8, wins=7)
        self.assertEqual(raw, "38+3")
        self.assertEqual(base, 38)
        self.assertEqual(extra, 3)
        self.assertEqual(total, 41)

    def test_parse_total_points_ocr_four_instead_of_plus(self):
        raw, base, extra, total = _parse_total_points("3843", goals=8, assists=8, wins=7)
        self.assertEqual(raw, "38+3")
        self.assertEqual(base, 38)
        self.assertEqual(extra, 3)
        self.assertEqual(total, 41)

    def test_parse_total_points_simple_number(self):
        raw, base, extra, total = _parse_total_points("27")
        self.assertEqual(raw, "27")
        self.assertEqual(base, 27)
        self.assertEqual(extra, 0)
        self.assertEqual(total, 27)

    def test_parse_date_str_with_ocr_confusions(self):
        self.assertEqual(_parse_date_str("07/11/26"), "2026-11-07")
        self.assertEqual(_parse_date_str("O7/11/26"), "2026-11-07")
        self.assertEqual(_parse_date_str("07/11/2026"), "2026-11-07")

    def test_parse_ouro_count(self):
        self.assertEqual(_parse_ouro_count("I"), 1)
        self.assertEqual(_parse_ouro_count("II"), 2)
        self.assertEqual(_parse_ouro_count("III"), 3)
        self.assertEqual(_parse_ouro_count("2"), 2)

    def test_fuzzy_match_name(self):
        candidates = [
            (1, "ADILSON"),
            (2, "L. BIEBER"),
            (3, "BOLA 7"),
            (4, "SALSICHA"),
        ]
        pid, name, score = fuzzy_match_name("AOILSON", candidates)
        self.assertEqual(pid, 1)
        self.assertEqual(name, "ADILSON")
        self.assertGreater(score, 0.7)

        pid2, name2, _ = fuzzy_match_name("L.RIERER", candidates)
        self.assertEqual(pid2, 2)
        self.assertEqual(name2, "L. BIEBER")

        pid3, name3, _ = fuzzy_match_name("BOLA3", candidates)
        self.assertEqual(pid3, 3)
        self.assertEqual(name3, "BOLA 7")


class TestSumulaTabularParser(unittest.TestCase):
    def test_csv_and_xlsx_roundtrip_baba1(self):
        svc = SumulaTabularService()
        for fmt, builder, filename in [
            ("csv", lambda: svc.build_template_csv(include_example=True, delimiter=","), "modelo.csv"),
            ("csv", lambda: svc.build_template_csv(include_example=True, delimiter=";"), "modelo_ptbr.csv"),
            ("xlsx", lambda: svc.build_template_xlsx(include_example=True), "modelo.xlsx"),
        ]:
            raw = builder()
            parsed = svc.parse_file(raw, filename, known_players=[])
            self.assertEqual(parsed.provider_used, fmt)
            self.assertEqual(parsed.header.date, "2026-11-07")
            self.assertEqual(parsed.header.baba_number, 1)
            self.assertEqual(parsed.header.total_goals, 51)
            self.assertEqual(parsed.header.total_assists, 37)
            self.assertEqual(parsed.header.location, "ARENA BAYGON")
            self.assertEqual(parsed.header.referee, "CRUZ")
            self.assertEqual(parsed.warnings, [])
            self.assertEqual(len(parsed.matches), 16)
            self.assertEqual(len(parsed.ouros), 8)

            # Time 2 campeao, Adilson 38+3 = 41
            t2 = next(t for t in parsed.teams if t.slot_index == 2)
            self.assertTrue(t2.is_valid_team)
            self.assertTrue(t2.is_champion)
            adilson = next(p for p in t2.players if p.raw_name == "ADILSON")
            self.assertEqual(adilson.pote, 1)
            self.assertEqual(adilson.base_points, 38)
            self.assertEqual(adilson.extra_points, 3)
            self.assertEqual(adilson.total_points, 41)

            # Time 4 row 6 Salsicha -> extra, pote=None
            t4 = next(t for t in parsed.teams if t.slot_index == 4)
            salsicha = next(p for p in t4.players if p.raw_name == "SALSICHA")
            self.assertTrue(salsicha.is_extra)
            self.assertIsNone(salsicha.pote)

            # Time 5 X-BACON -> single player, NOT a team
            t5 = next(t for t in parsed.teams if t.slot_index == 5)
            self.assertFalse(t5.is_valid_team)
            self.assertTrue(t5.is_extra_only)
            self.assertIsNone(t5.players[0].pote)


class TestSumulaLocalOCRExtraction(unittest.IsolatedAsyncioTestCase):
    async def test_extract_exemplo_sumula_image(self):
        with open("exemplo_sumula.jpeg", "rb") as f:
            img_bytes = f.read()

        roster = [
            (101, "DIEGO"), (102, "CABREIRO"), (103, "BOLA 7"), (104, "N. CAGE"), (105, "DUDO"),
            (201, "ADILSON"), (202, "JANDERSON"), (203, "ED REX"), (204, "BARATA"), (205, "TUTA"),
            (301, "L. BIEBER"), (302, "MASSA"), (303, "MESSI"), (304, "FABINHO"), (305, "ARI"),
            (401, "RICK"), (402, "MILSON"), (403, "PIROCA"), (404, "TARTA"), (405, "GB"), (406, "SALSICHA"),
            (501, "X-BACON"),
        ]
        svc = SumulaOCRService()
        parsed = await svc.extract_from_image(img_bytes, known_players=roster, provider="rapidocr")

        self.assertEqual(parsed.provider_used, "rapidocr")
        self.assertEqual(parsed.header.total_goals, 51)
        self.assertEqual(parsed.header.total_assists, 37)
        self.assertEqual(parsed.header.referee, "CRUZ")
        self.assertEqual(len(parsed.teams), 6)

        slot2 = next(t for t in parsed.teams if t.slot_index == 2)
        self.assertTrue(slot2.is_valid_team)
        self.assertTrue(slot2.is_champion)
        adilson = next(p for p in slot2.players if p.row_index == 1)
        self.assertEqual(adilson.matched_player_id, 201)
        self.assertEqual(adilson.pote, 1)
        self.assertEqual(adilson.base_points, 38)
        self.assertEqual(adilson.extra_points, 3)
        self.assertEqual(adilson.total_points, 41)

        slot4 = next(t for t in parsed.teams if t.slot_index == 4)
        self.assertTrue(slot4.is_valid_team)
        salsicha = next(p for p in slot4.players if p.row_index == 6)
        self.assertIsNone(salsicha.pote)
        self.assertTrue(salsicha.is_extra)

        slot5 = next(t for t in parsed.teams if t.slot_index == 5)
        self.assertFalse(slot5.is_valid_team)
        self.assertTrue(slot5.is_extra_only)
        self.assertEqual(len(slot5.players), 1)
        self.assertIsNone(slot5.players[0].pote)
        self.assertTrue(slot5.players[0].is_extra)

        slot6 = next(t for t in parsed.teams if t.slot_index == 6)
        self.assertFalse(slot6.is_valid_team)
        self.assertEqual(len(slot6.players), 0)


class TestSumulaAPIEndpoints(unittest.IsolatedAsyncioTestCase):
    async def test_all_sumula_endpoints_transactional(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            admin = (await session.execute(select(User).where(User.is_admin.is_(True)))).scalars().first()
            if not admin:
                admin = User(
                    name="Test Admin",
                    email="test_admin@baygon.local",
                    username="test_admin",
                    password="x",
                    is_admin=True,
                    phone_number="00000000000",
                    is_active=True,
                )
                session.add(admin)
                await session.flush()

            season = Seasons(
                number=999,
                initial_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
                end_date=None,
                is_active=True,
            )
            session.add(season)
            await session.flush()
            season_id = int(season.id_season)
            admin_id = int(admin.id_user)
            admin_username = admin.username

            async def _override_get_db():
                yield session

            async def _override_admin():
                return SimpleNamespace(id_user=admin_id, is_admin=True, username=admin_username)

            app.dependency_overrides[get_db] = _override_get_db
            app.dependency_overrides[user_has_permission] = _override_admin

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. GET /template (csv and xlsx)
                r_tpl_csv = await client.get("/api/v1/sumulas/template?format=csv")
                self.assertEqual(r_tpl_csv.status_code, 200)
                self.assertIn("[CABECALHO]", r_tpl_csv.text)

                r_tpl_xlsx = await client.get("/api/v1/sumulas/template?format=xlsx")
                self.assertEqual(r_tpl_xlsx.status_code, 200)
                self.assertGreater(len(r_tpl_xlsx.content), 1000)

                # 2. POST /preview-file (xlsx)
                r_prev_file = await client.post(
                    "/api/v1/sumulas/preview-file",
                    files={"file": ("modelo_sumula_baba1.xlsx", r_tpl_xlsx.content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                    data={"season_id": str(season_id), "round_number": "1"},
                )
                self.assertEqual(r_prev_file.status_code, 200, r_prev_file.text)
                prev_file_json = r_prev_file.json()
                self.assertEqual(len(prev_file_json["matches"]), 16)
                self.assertEqual(prev_file_json["warnings"], [])

                # 3. POST /import-file (import full Baba 1 CSV into DB)
                r_imp_file = await client.post(
                    "/api/v1/sumulas/import-file",
                    files={"file": ("modelo_sumula_baba1.csv", r_tpl_csv.content, "text/csv")},
                    data={"season_id": str(season_id), "round_number": "1"},
                )
                self.assertEqual(r_imp_file.status_code, 201, r_imp_file.text)
                imp_json = r_imp_file.json()

                # 4 valid teams (DIEGO, ADILSON, L. BIEBER, RICK); X-BACON (slot 5) is NOT a team
                self.assertEqual(imp_json["teams_created"], 4)
                self.assertEqual(imp_json["matches_created"], 16)
                # 51 goals + 37 assists + 9 ouros (1+1+1+2+1+1+1+1) = 97 events
                self.assertEqual(imp_json["ouros_registered"], 9)
                self.assertEqual(imp_json["match_events_created"], 97)
                # 22 unique players in the 5 populated tables
                self.assertEqual(imp_json["player_scores_created"], 22)
                self.assertEqual(imp_json["player_season_scores_updated"], 22)
                self.assertIsNotNone(imp_json["round_winner_team_id"])

                round_id = imp_json["round_id"]
                teams_db = (await session.execute(
                    select(Teams).where(Teams.round_id == round_id, Teams.deleted_at.is_(None))
                )).scalars().all()
                self.assertEqual(len(teams_db), 4)

                adilson_pl = (await session.execute(select(Player).where(Player.nome == "ADILSON"))).scalar_one()
                salsicha_pl = (await session.execute(select(Player).where(Player.nome == "SALSICHA"))).scalar_one()
                xbacon_pl = (await session.execute(select(Player).where(Player.nome == "X-BACON"))).scalar_one()
                self.assertEqual(adilson_pl.potes, 1)
                self.assertIsNone(salsicha_pl.potes)
                self.assertIsNone(xbacon_pl.potes)

                adilson_score = (await session.execute(
                    select(PlayerScore).where(
                        PlayerScore.round_id == round_id,
                        PlayerScore.player_id == adilson_pl.id_player,
                        PlayerScore.deleted_at.is_(None),
                    )
                )).scalar_one()
                self.assertEqual(adilson_score.total_points, 41)

                adilson_ss = (await session.execute(
                    select(PlayerSeasonScore).where(
                        PlayerSeasonScore.season_id == season_id,
                        PlayerSeasonScore.player_id == adilson_pl.id_player,
                        PlayerSeasonScore.deleted_at.is_(None),
                    )
                )).scalar_one()
                self.assertEqual(adilson_ss.total_points, 41)

                # Duplicate round without overwrite returns 409
                r_dup = await client.post(
                    "/api/v1/sumulas/import-file",
                    files={"file": ("modelo_sumula_baba1.csv", r_tpl_csv.content, "text/csv")},
                    data={"season_id": str(season_id), "round_number": "1"},
                )
                self.assertEqual(r_dup.status_code, 409)

                # 4. POST /preview (image OCR) & POST /import-image (with overwrite=true)
                with open("exemplo_sumula.jpeg", "rb") as f:
                    img_bytes = f.read()

                r_prev_img = await client.post(
                    "/api/v1/sumulas/preview",
                    files={"file": ("sumula.jpg", img_bytes, "image/jpeg")},
                    data={"season_id": str(season_id), "round_number": "1", "provider": "rapidocr"},
                )
                self.assertEqual(r_prev_img.status_code, 200, r_prev_img.text)
                self.assertTrue(r_prev_img.json()["round_exists"])

                r_imp_img = await client.post(
                    "/api/v1/sumulas/import-image",
                    files={"file": ("sumula.jpg", img_bytes, "image/jpeg")},
                    data={
                        "season_id": str(season_id),
                        "round_number": "1",
                        "provider": "rapidocr",
                        "overwrite_existing_round": "true",
                    },
                )
                self.assertEqual(r_imp_img.status_code, 201, r_imp_img.text)
                self.assertEqual(r_imp_img.json()["round_id"], round_id)
        finally:
            app.dependency_overrides.clear()
            await session.close()
            await trans.rollback()
            await conn.close()
            await engine.dispose()


if __name__ == "__main__":
    unittest.main(verbosity=2)
