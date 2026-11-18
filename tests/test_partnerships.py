import asyncio
import unittest
from app.db.base import AsyncSessionLocal
from app.db.repositories.player_repository import PlayerRepository
from app.db.models.player import Player
from sqlalchemy import select

class TestPartnerships(unittest.IsolatedAsyncioTestCase):
    async def test_partnerships(self):
        async with AsyncSessionLocal() as s:
            repo = PlayerRepository(s)
            p = (await s.execute(select(Player))).scalars().first()
            if not p:
                print("No player found")
                return
            res = await repo.get_player_partnerships(p.id_player)
            self.assertIn("pairs", res)
            self.assertIn("trios", res)
            print(f"Player {p.nome} (id {p.id_player}):")
            print(f"Pairs count: {len(res['pairs'])}, Trios count: {len(res['trios'])}")
            if res["pairs"]:
                print(f"Top duo: {res['pairs'][0]['partner_name']} with {res['pairs'][0]['matches_together']} matches, win rate {res['pairs'][0]['win_rate']}%")

if __name__ == '__main__':
    unittest.main()
