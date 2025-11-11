from typing import Optional, Sequence
from app.db.models.season import Seasons
from app.db.repositories.season_repository import SeasonRepository


class SeasonService:
    def __init__(self, repo: SeasonRepository):
        self.repo = repo

    async def create_new_season(self, season_data: dict):
        try:
            last_season = await self.repo.get_last_season_number()

            season_data.update({
                "number": last_season + 1
            })

            season = Seasons(**season_data)

            new_season = await self.repo.create(season=season)

            print(f"Temporada cadastrada: {new_season}")

            return {
                "message": "Nova temporada cadastrada!",
                "season": {
                    "id": season.id_season,
                    "initial_date": season.initial_date,
                    "end_date": season.end_date,
                    "number": season.number,
                    "rounds": []
                }
            }
        except Exception as e:
            raise e
    
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