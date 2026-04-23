from typing import Optional, Sequence
from app.db.models.season import Seasons
from app.db.repositories.season_repository import SeasonRepository


class SeasonService:
    def __init__(self, repo: SeasonRepository):
        self.repo = repo

    async def create_new_season(self, season_data: dict):
        try:
            if not season_data.get("number"):
                last_season = await self.repo.get_last_season_number()
                season_data["number"] = last_season + 1

            season = Seasons(**season_data)
            new_season = await self.repo.create(season=season)

            print(f"Temporada cadastrada: {new_season}")
            return new_season
        except Exception as e:
            raise e

    async def create_new_seasons(self, seasons_data: list[dict]):
        created = []
        next_number = await self.repo.get_last_season_number()

        for season_data in seasons_data:
            if not season_data.get("number"):
                next_number += 1
                season_data["number"] = next_number
            else:
                next_number = max(next_number, season_data["number"])

            season = Seasons(**season_data)
            created.append(await self.repo.create(season=season))

        return created
    
    async def get_current_season(self) -> Optional[Seasons]:
        return await self.repo.get_current_season()

    async def list_all_seasons(self) -> Sequence[Seasons]:
        return await self.repo.list_all_seasons()
    
    async def get_season_by_id(self, season_id: int) -> Optional[Seasons]:
        return await self.repo.get_by_id(season_id)
    
    async def edit_season(self, season_id: int, season_data: dict):
        return await self.repo.edit(id_season=season_id, updates=season_data)
        
    async def delete_season(self, season_id: int):
        await self.repo.delete(season_id)

        return {
            "message": "Temporada deletada com sucesso!",
            "season": {}
        }