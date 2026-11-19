from decimal import Decimal
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.fantasy import (
    FantasySetting,
    FantasyRoundConfig,
    FantasyPlayer,
    FantasyTeam,
    FantasyLineup,
)
from app.db.models.player import Player
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.repositories.fantasy_repository import FantasyRepository
from app.schemas.fantasy_schema import (
    FantasyCalculationSummary,
    FantasyLineupPlayerRead,
    FantasyLineupRead,
    FantasyLineupSavePayload,
    FantasyPlayerRead,
    FantasyRoundConfigRead,
    FantasyRoundConfigUpdate,
    FantasyRoundRankingResponse,
    FantasySeasonRankingResponse,
    FantasySettingRead,
    FantasySettingUpdate,
    FantasyTeamRead,
    FantasyTeamUpdate,
)


class FantasyService:
    def __init__(self, repo: FantasyRepository, db: AsyncSession):
        self.repo = repo
        self.db = db

    async def check_feature_active(self, season_id: int):
        setting = await self.repo.get_or_create_setting(season_id)
        if not setting.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="O módulo Fantasy Game está desativado para esta temporada/associação.",
            )
        return setting

    async def get_active_season_id(self) -> int:
        q = select(Seasons).where(Seasons.is_active.is_(True)).order_by(Seasons.id_season.desc())
        res = await self.db.execute(q)
        season = res.scalars().first()
        if not season:
            # Pega a última cadastrada
            q_any = select(Seasons).order_by(Seasons.id_season.desc())
            res_any = await self.db.execute(q_any)
            season = res_any.scalars().first()
            if not season:
                raise HTTPException(status_code=404, detail="Nenhuma temporada encontrada.")
        return season.id_season

    # ---------------- SETTINGS ----------------

    async def get_settings(self, season_id: Optional[int] = None) -> FantasySettingRead:
        if not season_id:
            season_id = await self.get_active_season_id()
        setting = await self.repo.get_or_create_setting(season_id)
        return FantasySettingRead.model_validate(setting)

    async def update_settings(self, payload: FantasySettingUpdate, season_id: Optional[int] = None) -> FantasySettingRead:
        if not season_id:
            season_id = await self.get_active_season_id()
        setting = await self.repo.get_or_create_setting(season_id)
        updated = await self.repo.update_setting(setting, payload.model_dump(exclude_unset=True))
        return FantasySettingRead.model_validate(updated)

    # ---------------- ROUND CONFIG ----------------

    async def get_round_config(self, round_id: int) -> FantasyRoundConfigRead:
        config = await self.repo.get_or_create_round_config(round_id)
        return FantasyRoundConfigRead.model_validate(config)

    async def update_round_config(self, round_id: int, payload: FantasyRoundConfigUpdate) -> FantasyRoundConfigRead:
        config = await self.repo.get_or_create_round_config(round_id)
        slot_rules = [r.model_dump() for r in payload.slot_rules] if payload.slot_rules is not None else None
        data = payload.model_dump(exclude={"slot_rules"}, exclude_unset=True)
        updated = await self.repo.update_round_config(config, data, slot_rules)
        return FantasyRoundConfigRead.model_validate(updated)

    # ---------------- MARKET ----------------

    async def get_market(self, season_id: Optional[int] = None, round_id: Optional[int] = None) -> List[FantasyPlayerRead]:
        if not season_id:
            season_id = await self.get_active_season_id()
        await self.check_feature_active(season_id)

        items = await self.repo.get_market_players(season_id, round_id)
        return [FantasyPlayerRead(**item) for item in items]

    # ---------------- TEAM & LINEUP ----------------

    async def get_my_team(self, user_id: int, season_id: Optional[int] = None) -> FantasyTeamRead:
        if not season_id:
            season_id = await self.get_active_season_id()
        await self.check_feature_active(season_id)

        team = await self.repo.get_or_create_team(user_id, season_id)
        return FantasyTeamRead.model_validate(team)

    async def update_my_team(self, user_id: int, payload: FantasyTeamUpdate, season_id: Optional[int] = None) -> FantasyTeamRead:
        if not season_id:
            season_id = await self.get_active_season_id()
        await self.check_feature_active(season_id)

        team = await self.repo.get_or_create_team(user_id, season_id)
        updated = await self.repo.update_team_name(team, payload.name)
        return FantasyTeamRead.model_validate(updated)

    async def get_lineup(self, user_id: int, round_id: int) -> Optional[FantasyLineupRead]:
        # Busca season da round
        round_q = select(Round).where(Round.id_round == round_id)
        round_res = await self.db.execute(round_q)
        round_obj = round_res.scalars().first()
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")

        await self.check_feature_active(round_obj.season_id)
        team = await self.repo.get_or_create_team(user_id, round_obj.season_id)
        lineup = await self.repo.get_lineup(team.id_fantasy_team, round_id)
        if not lineup:
            return None

        return self._format_lineup(lineup)

    async def save_lineup(self, user_id: int, round_id: int, payload: FantasyLineupSavePayload) -> FantasyLineupRead:
        round_q = select(Round).where(Round.id_round == round_id)
        round_res = await self.db.execute(round_q)
        round_obj = round_res.scalars().first()
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")

        season_id = round_obj.season_id
        await self.check_feature_active(season_id)

        team = await self.repo.get_or_create_team(user_id, season_id)
        round_config = await self.repo.get_or_create_round_config(round_id)

        # Mapeia jogadores para verificação
        p_ids = [p.player_id for p in payload.players]
        players_q = select(Player).where(Player.id_player.in_(p_ids))
        players_res = await self.db.execute(players_q)
        players_map = {p.id_player: p for p in players_res.scalars().all()}

        fp_q = select(FantasyPlayer).where(
            FantasyPlayer.player_id.in_(p_ids),
            FantasyPlayer.season_id == season_id
        )
        fp_res = await self.db.execute(fp_q)
        fp_map = {fp.player_id: fp for fp in fp_res.scalars().all()}

        # Cria FantasyPlayer para os que não tinham ainda
        for pid in p_ids:
            if pid not in fp_map:
                new_fp = FantasyPlayer(
                    player_id=pid,
                    season_id=season_id,
                    current_price=Decimal("10.00"),
                    last_variation=Decimal("0.00"),
                    status="PROBABLE",
                )
                self.db.add(new_fp)
                await self.db.flush()
                fp_map[pid] = new_fp

        try:
            lineup = await self.repo.save_lineup(
                team=team,
                round_config=round_config,
                players_items=[p.model_dump() for p in payload.players],
                fantasy_players_map=fp_map,
                players_map=players_map,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        return self._format_lineup(lineup)

    def _format_lineup(self, lineup: FantasyLineup) -> FantasyLineupRead:
        players_list = []
        for lp in lineup.players:
            p = lp.player
            pos_str = p.posicao.value if p and hasattr(p.posicao, "value") else str(p.posicao if p else "")
            players_list.append(
                FantasyLineupPlayerRead(
                    id_lineup_player=lp.id_lineup_player,
                    player_id=lp.player_id,
                    player_name=p.nome if p else "Atleta",
                    player_nickname=p.apelido if p else None,
                    position=pos_str,
                    slot_label=lp.slot_label,
                    purchase_price=lp.purchase_price,
                    points_earned=lp.points_earned,
                    price_variation=lp.price_variation,
                )
            )

        return FantasyLineupRead(
            id_fantasy_lineup=lineup.id_fantasy_lineup,
            fantasy_team_id=lineup.fantasy_team_id,
            round_id=lineup.round_id,
            total_spent=lineup.total_spent,
            cash_remaining=lineup.cash_remaining,
            points_scored=lineup.points_scored,
            wealth_variation=lineup.wealth_variation,
            is_finalized=lineup.is_finalized,
            players=players_list,
        )

    # ---------------- APURAÇÃO ----------------

    async def calculate_round(self, round_id: int) -> FantasyCalculationSummary:
        try:
            lineups_count, players_count = await self.repo.finalize_round_calculation(round_id)
            return FantasyCalculationSummary(
                message=f"Apuração do Fantasy concluída com sucesso para a rodada {round_id}.",
                round_id=round_id,
                lineups_processed=lineups_count,
                players_updated=players_count,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ---------------- RANKINGS ----------------

    async def get_round_ranking(self, round_id: int) -> FantasyRoundRankingResponse:
        round_q = select(Round).where(Round.id_round == round_id)
        round_res = await self.db.execute(round_q)
        round_obj = round_res.scalars().first()
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")

        await self.check_feature_active(round_obj.season_id)
        rankings = await self.repo.get_round_ranking(round_id)
        return FantasyRoundRankingResponse(
            round_id=round_id,
            round_number=round_obj.round_number,
            rankings=rankings,
        )

    async def get_season_ranking(self, season_id: Optional[int] = None) -> FantasySeasonRankingResponse:
        if not season_id:
            season_id = await self.get_active_season_id()
        await self.check_feature_active(season_id)

        rankings = await self.repo.get_season_ranking(season_id)
        return FantasySeasonRankingResponse(
            season_id=season_id,
            rankings=rankings,
        )
