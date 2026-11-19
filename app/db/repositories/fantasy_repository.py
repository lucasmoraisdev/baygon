import re
import unicodedata
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import func, select, and_, or_, update, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.fantasy import (
    FantasySetting,
    FantasyRoundConfig,
    FantasyRoundSlotRule,
    FantasyPlayer,
    FantasyTeam,
    FantasyLineup,
    FantasyLineupPlayer,
)
from app.db.models.player import Player
from app.db.models.player_score import PlayerScore
from app.db.models.round import Round
from app.db.models.user import User


def normalize_pos(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("utf-8")
    s = s.lower().strip()
    s = re.sub(r"(es|s)\b", "", s)
    return s


def matches_position(player_pos: str, target_val: str) -> bool:
    if not player_pos or not target_val:
        return False
    p_norm = normalize_pos(player_pos)
    target_tokens = [normalize_pos(t) for t in re.split(r"[/,]", target_val) if t.strip()]
    return any(p_norm in t or t in p_norm for t in target_tokens)


class FantasyRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------------- SETTINGS ----------------

    async def get_setting_by_season(self, season_id: int) -> Optional[FantasySetting]:
        query = select(FantasySetting).where(FantasySetting.season_id == season_id)
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_or_create_setting(self, season_id: int) -> FantasySetting:
        setting = await self.get_setting_by_season(season_id)
        if not setting:
            setting = FantasySetting(
                season_id=season_id,
                is_enabled=True,
                initial_budget=Decimal("100.00"),
                min_player_price=Decimal("1.00"),
                max_price_variation=Decimal("5.00"),
                appreciation_factor=Decimal("0.5000"),
            )
            self.db.add(setting)
            await self.db.commit()
            await self.db.refresh(setting)
        return setting

    async def update_setting(self, setting: FantasySetting, data: dict) -> FantasySetting:
        for key, value in data.items():
            if value is not None and hasattr(setting, key):
                setattr(setting, key, value)
        await self.db.commit()
        await self.db.refresh(setting)
        return setting

    # ---------------- ROUND CONFIG & SLOTS ----------------

    async def get_round_config(self, round_id: int) -> Optional[FantasyRoundConfig]:
        query = (
            select(FantasyRoundConfig)
            .where(FantasyRoundConfig.round_id == round_id)
            .options(selectinload(FantasyRoundConfig.slot_rules))
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_or_create_round_config(self, round_id: int) -> FantasyRoundConfig:
        config = await self.get_round_config(round_id)
        if not config:
            # Verifica se a rodada já possui scores computados (já foi jogada/encerrada)
            score_count_q = select(func.count(PlayerScore.id_player_score)).where(PlayerScore.round_id == round_id)
            score_res = await self.db.execute(score_count_q)
            has_scores = (score_res.scalar() or 0) > 0

            config = FantasyRoundConfig(
                round_id=round_id,
                total_slots=5,
                is_market_open=False,  # Mercado nasce fechado por segurança
                status="FINALIZED" if has_scores else "CLOSED",
            )
            self.db.add(config)
            await self.db.flush()

            # Regras default de 5 vagas (Futebol Society: 1 Goleiro, 1 Defensor, 2 Meias/Alas, 1 Atacante/Pivô)
            default_rules = [
                FantasyRoundSlotRule(round_config_id=config.id_round_config, slot_type="POSITION", target_value="Goleiro", required_quantity=1),
                FantasyRoundSlotRule(round_config_id=config.id_round_config, slot_type="POSITION", target_value="Defensores", required_quantity=1),
                FantasyRoundSlotRule(round_config_id=config.id_round_config, slot_type="POSITION", target_value="Meia/Ala", required_quantity=2),
                FantasyRoundSlotRule(round_config_id=config.id_round_config, slot_type="POSITION", target_value="Atacante/Pivô", required_quantity=1),
            ]
            self.db.add_all(default_rules)
            await self.db.commit()
            await self.db.refresh(config)
        return config

    async def update_round_config(
        self,
        config: FantasyRoundConfig,
        data: dict,
        slot_rules_data: Optional[List[dict]] = None
    ) -> FantasyRoundConfig:
        # Regra de Exclusividade: Ao abrir o mercado desta rodada, fecha o mercado de qualquer outra rodada da temporada
        if data.get("is_market_open") is True:
            round_obj = (await self.db.execute(select(Round).where(Round.id_round == config.round_id))).scalars().first()
            if round_obj:
                season_rounds_subq = select(Round.id_round).where(
                    and_(Round.season_id == round_obj.season_id, Round.id_round != config.round_id)
                )
                await self.db.execute(
                    update(FantasyRoundConfig)
                    .where(FantasyRoundConfig.round_id.in_(season_rounds_subq))
                    .values(
                        is_market_open=False,
                        status=case(
                            (FantasyRoundConfig.status == "OPEN", "CLOSED"),
                            else_=FantasyRoundConfig.status
                        )
                    )
                )

        for key, value in data.items():
            if value is not None and hasattr(config, key):
                setattr(config, key, value)

        if slot_rules_data is not None:
            # Substitui regras existentes
            for rule in list(config.slot_rules):
                await self.db.delete(rule)
            await self.db.flush()

            new_rules = [
                FantasyRoundSlotRule(
                    round_config_id=config.id_round_config,
                    slot_type=r.get("slot_type", "POSITION"),
                    target_value=r["target_value"],
                    required_quantity=r.get("required_quantity", 1),
                )
                for r in slot_rules_data
            ]
            self.db.add_all(new_rules)

        await self.db.commit()
        return await self.get_or_create_round_config(config.round_id)

    # ---------------- MERCADO & PLAYERS ----------------

    async def get_market_players(self, season_id: int, round_id: Optional[int] = None) -> List[dict]:
        # Busca todos os jogadores associados/ativos
        players_query = (
            select(Player)
            .where(Player.is_guest.is_(False))
            .order_by(Player.nome.asc())
        )
        players_res = await self.db.execute(players_query)
        all_players = players_res.scalars().all()

        # Busca registros de fantasy_players para a temporada
        fp_query = select(FantasyPlayer).where(FantasyPlayer.season_id == season_id)
        fp_res = await self.db.execute(fp_query)
        fp_map = {fp.player_id: fp for fp in fp_res.scalars().all()}

        # Cria registros ausentes automaticamente com preço padrão C$ 10.00
        new_fps = []
        for p in all_players:
            if p.id_player not in fp_map:
                new_fp = FantasyPlayer(
                    player_id=p.id_player,
                    season_id=season_id,
                    current_price=Decimal("10.00"),
                    last_variation=Decimal("0.00"),
                    status="PROBABLE",
                )
                self.db.add(new_fp)
                new_fps.append(new_fp)

        if new_fps:
            await self.db.commit()
            for nfp in new_fps:
                await self.db.refresh(nfp)
                fp_map[nfp.player_id] = nfp

        # Se houver round_id anterior ou atual, busca última pontuação
        scores_map: Dict[int, Decimal] = {}
        matches_count_map: Dict[int, int] = {}
        if round_id:
            # Pontuação da rodada atual ou anterior
            score_q = select(PlayerScore).where(
                and_(PlayerScore.season_id == season_id, PlayerScore.round_id == round_id)
            )
            score_res = await self.db.execute(score_q)
            for sc in score_res.scalars().all():
                scores_map[sc.player_id] = Decimal(str(sc.total_points))

        # Monta resposta combinada
        market_list = []
        for p in all_players:
            fp = fp_map.get(p.id_player)
            if not fp:
                continue

            pos_str = p.posicao.value if hasattr(p.posicao, "value") else str(p.posicao or "")

            market_list.append({
                "id_fantasy_player": fp.id_fantasy_player,
                "player_id": p.id_player,
                "season_id": season_id,
                "player_name": p.nome,
                "player_nickname": p.apelido,
                "position": pos_str,
                "pot": p.potes,
                "current_price": fp.current_price,
                "last_variation": fp.last_variation,
                "status": fp.status,
                "last_round_points": scores_map.get(p.id_player, Decimal("0.00")),
                "matches_played": matches_count_map.get(p.id_player, 0),
            })

        return market_list

    # ---------------- TEAM & LINEUPS ----------------

    async def get_or_create_team(self, user_id: int, season_id: int) -> FantasyTeam:
        query = select(FantasyTeam).where(
            and_(FantasyTeam.user_id == user_id, FantasyTeam.season_id == season_id)
        )
        res = await self.db.execute(query)
        team = res.scalars().first()

        if not team:
            # Pega orçamento inicial configurado para a temporada
            setting = await self.get_or_create_setting(season_id)
            budget = setting.initial_budget

            # Pega nome de exibição do usuário
            user_q = select(User).where(User.id_user == user_id)
            user_res = await self.db.execute(user_q)
            user = user_res.scalars().first()
            user_display = (user.name if user and user.name else "Mito").split()[0]
            team_name = f"Time do {user_display}"

            team = FantasyTeam(
                user_id=user_id,
                season_id=season_id,
                name=team_name,
                budget=budget,
                total_wealth=budget,
                total_points=Decimal("0.00"),
            )
            self.db.add(team)
            await self.db.commit()
            await self.db.refresh(team)
        return team

    async def update_team_name(self, team: FantasyTeam, name: str) -> FantasyTeam:
        team.name = name
        await self.db.commit()
        await self.db.refresh(team)
        return team

    async def get_lineup(self, team_id: int, round_id: int) -> Optional[FantasyLineup]:
        query = (
            select(FantasyLineup)
            .where(and_(FantasyLineup.fantasy_team_id == team_id, FantasyLineup.round_id == round_id))
            .options(
                selectinload(FantasyLineup.players).selectinload(FantasyLineupPlayer.player),
                selectinload(FantasyLineup.fantasy_team).selectinload(FantasyTeam.user),
            )
        )
        res = await self.db.execute(query)
        return res.scalars().first()

    async def save_lineup(
        self,
        team: FantasyTeam,
        round_config: FantasyRoundConfig,
        players_items: List[dict],
        fantasy_players_map: Dict[int, FantasyPlayer],
        players_map: Dict[int, Player],
    ) -> FantasyLineup:
        # 1. Validação de Mercado Aberto
        if not round_config.is_market_open or round_config.status != "OPEN":
            raise ValueError("O mercado para esta rodada está fechado.")

        # 2. Validação da quantidade total de vagas
        if len(players_items) != round_config.total_slots:
            raise ValueError(
                f"A escalação exige exatamente {round_config.total_slots} jogadores. Enviados: {len(players_items)}."
            )

        # 3. Validação de duplicados
        p_ids = [p["player_id"] for p in players_items]
        if len(p_ids) != len(set(p_ids)):
            raise ValueError("Não é permitido escalar o mesmo jogador mais de uma vez.")

        # 4. Validação por regras de slots (posição / pote)
        for rule in round_config.slot_rules:
            if rule.slot_type == "POSITION":
                count = sum(
                    1 for p in players_items
                    if players_map.get(p["player_id"]) and matches_position(
                        players_map[p["player_id"]].posicao.value
                        if hasattr(players_map[p["player_id"]].posicao, "value")
                        else str(players_map[p["player_id"]].posicao or ""),
                        rule.target_value
                    )
                )
                if count < rule.required_quantity:
                    raise ValueError(
                        f"A formação exige ao menos {rule.required_quantity} jogador(es) na posição '{rule.target_value}'. Foram escalados {count}."
                    )
            elif rule.slot_type == "POT":
                target_pot_val = int(rule.target_value.replace("Pote", "").strip()) if "pote" in rule.target_value.lower() else int(rule.target_value)
                count = sum(
                    1 for p in players_items
                    if players_map.get(p["player_id"]) and players_map[p["player_id"]].potes == target_pot_val
                )
                if count < rule.required_quantity:
                    raise ValueError(
                        f"A formação exige ao menos {rule.required_quantity} jogador(es) do {rule.target_value}. Foram escalados {count}."
                    )

        # 5. Cálculo financeiro da escalação
        total_spent = sum(
            fantasy_players_map[p["player_id"]].current_price
            for p in players_items
        )

        if total_spent > team.total_wealth:
            raise ValueError(
                f"Patrimônio insuficiente. O time custa C$ {total_spent:.2f}, mas seu patrimônio é C$ {team.total_wealth:.2f}."
            )

        cash_remaining = team.total_wealth - total_spent

        # 6. Salva ou atualiza a lineup
        lineup = await self.get_lineup(team.id_fantasy_team, round_config.round_id)
        if not lineup:
            lineup = FantasyLineup(
                fantasy_team_id=team.id_fantasy_team,
                round_id=round_config.round_id,
                total_spent=total_spent,
                cash_remaining=cash_remaining,
                points_scored=Decimal("0.00"),
                wealth_variation=Decimal("0.00"),
                is_finalized=False,
            )
            self.db.add(lineup)
            await self.db.flush()
        else:
            lineup.total_spent = total_spent
            lineup.cash_remaining = cash_remaining
            # Remove escalações anteriores deste lineup
            for lp in list(lineup.players):
                await self.db.delete(lp)
            await self.db.flush()

        # Cria novos itens de escalação
        new_players = [
            FantasyLineupPlayer(
                lineup_id=lineup.id_fantasy_lineup,
                player_id=p["player_id"],
                slot_label=p.get("slot_label", "Titular"),
                purchase_price=fantasy_players_map[p["player_id"]].current_price,
                points_earned=Decimal("0.00"),
                price_variation=Decimal("0.00"),
            )
            for p in players_items
        ]
        self.db.add_all(new_players)

        # Atualiza caixa do time
        team.budget = cash_remaining
        await self.db.commit()

        return await self.get_lineup(team.id_fantasy_team, round_config.round_id)

    # ---------------- APURAÇÃO DA RODADA ----------------

    async def finalize_round_calculation(self, round_id: int) -> Tuple[int, int]:
        """
        Executa a apuração oficial do Fantasy para a rodada:
        1. Calcula pontuação dos atletas na rodada oficial (PlayerScore).
        2. Atualiza valorização/desvalorização dos atletas (com piso e teto).
        3. Para times escalados: pontuação obtida e novo patrimônio acumulado.
        4. Para times NÃO escalados: pontuação 0 e patrimônio inalterado.
        """
        config = await self.get_or_create_round_config(round_id)
        round_q = select(Round).where(Round.id_round == round_id)
        round_res = await self.db.execute(round_q)
        round_obj = round_res.scalars().first()
        if not round_obj:
            raise ValueError(f"Rodada {round_id} não encontrada.")

        season_id = round_obj.season_id
        setting = await self.get_or_create_setting(season_id)

        # 1. Mapeia pontuações dos atletas nesta rodada
        score_q = select(PlayerScore).where(
            and_(PlayerScore.round_id == round_id, PlayerScore.season_id == season_id)
        )
        score_res = await self.db.execute(score_q)
        player_scores = {s.player_id: Decimal(str(s.total_points)) for s in score_res.scalars().all()}

        # 2. Busca todos os FantasyPlayer da temporada
        fp_query = select(FantasyPlayer).where(FantasyPlayer.season_id == season_id)
        fp_res = await self.db.execute(fp_query)
        fantasy_players = {fp.player_id: fp for fp in fp_res.scalars().all()}

        # 3. Atualiza preço dos atletas que jogaram ou cadastrados
        # Fórmula de valorização simples e justa:
        # Esperado = Preço Anterior * 0.40
        # Variação = Clamp((Pontos - Esperado) * K, -max_var, +max_var)
        k = setting.appreciation_factor
        max_var = setting.max_price_variation
        min_price = setting.min_player_price

        for pid, fp in fantasy_players.items():
            pts = player_scores.get(pid, Decimal("0.00"))
            expected = fp.current_price * Decimal("0.40")
            raw_var = (pts - expected) * k

            # Clamp
            if raw_var > max_var:
                variation = max_var
            elif raw_var < -max_var:
                variation = -max_var
            else:
                variation = raw_var

            new_price = fp.current_price + variation
            if new_price < min_price:
                variation = min_price - fp.current_price
                new_price = min_price

            fp.last_variation = variation
            fp.current_price = new_price

        # 4. Processa escalações da rodada
        lineups_q = (
            select(FantasyLineup)
            .where(FantasyLineup.round_id == round_id)
            .options(
                selectinload(FantasyLineup.players),
                selectinload(FantasyLineup.fantasy_team),
            )
        )
        lineups_res = await self.db.execute(lineups_q)
        lineups = lineups_res.scalars().all()

        for lineup in lineups:
            team = lineup.fantasy_team
            total_pts = Decimal("0.00")
            scaled_players_new_value = Decimal("0.00")
            scaled_players_old_value = Decimal("0.00")

            for lp in lineup.players:
                pts = player_scores.get(lp.player_id, Decimal("0.00"))
                lp.points_earned = pts
                fp = fantasy_players.get(lp.player_id)
                if fp:
                    lp.price_variation = fp.last_variation
                    scaled_players_new_value += fp.current_price
                    scaled_players_old_value += lp.purchase_price
                total_pts += pts

            lineup.points_scored = total_pts
            wealth_delta = scaled_players_new_value - scaled_players_old_value
            lineup.wealth_variation = wealth_delta
            lineup.is_finalized = True

            # Atualiza time do usuário:
            # Novo patrimônio = caixa guardado (cash_remaining) + novo valor dos jogadores
            team.total_wealth = lineup.cash_remaining + scaled_players_new_value
            team.budget = lineup.cash_remaining
            team.total_points += total_pts

        # Fecha rodada
        config.is_market_open = False
        config.status = "FINALIZED"
        await self.db.commit()

        return len(lineups), len(fantasy_players)

    # ---------------- RANKINGS COM TRATAMENTO DE EMPATES ----------------

    async def get_round_ranking(self, round_id: int) -> List[dict]:
        """
        Ranking da Rodada:
        - Ordenado por pontos decrescentes na rodada.
        - Empates em pontos compartilham a mesma colocação (1º, 1º, 3º).
        - Times sem escalação aparecem no final com 0 pontos e has_lineup=False.
        """
        round_q = select(Round).where(Round.id_round == round_id)
        round_res = await self.db.execute(round_q)
        round_obj = round_res.scalars().first()
        if not round_obj:
            return []

        # Pega todos os times da temporada
        teams_q = (
            select(FantasyTeam)
            .where(FantasyTeam.season_id == round_obj.season_id)
            .options(selectinload(FantasyTeam.user))
        )
        teams_res = await self.db.execute(teams_q)
        teams = teams_res.scalars().all()

        # Pega lineups desta rodada
        lineups_q = select(FantasyLineup).where(FantasyLineup.round_id == round_id)
        lineups_res = await self.db.execute(lineups_q)
        lineups_map = {l.fantasy_team_id: l for l in lineups_res.scalars().all()}

        entries = []
        for t in teams:
            l = lineups_map.get(t.id_fantasy_team)
            pts = l.points_scored if l else Decimal("0.00")
            entries.append({
                "team_id": t.id_fantasy_team,
                "team_name": t.name,
                "user_name": t.user.name if t.user else "Jogador",
                "user_id": t.user_id,
                "points": pts,
                "total_wealth": t.total_wealth,
                "has_lineup": l is not None,
            })

        # Ordena: quem escalou primeiro por pontos desc, quem não escalou depois
        entries.sort(key=lambda x: (1 if x["has_lineup"] else 0, x["points"], x["total_wealth"]), reverse=True)

        # Atribui posições com tratamento de empate esportivo padrão (1, 1, 3...)
        ranked = []
        current_rank = 1
        for i, entry in enumerate(entries):
            if i > 0 and entry["points"] == entries[i - 1]["points"] and entry["has_lineup"] == entries[i - 1]["has_lineup"]:
                entry["position"] = entries[i - 1]["position"]
            else:
                entry["position"] = i + 1
            ranked.append(entry)

        return ranked

    async def get_season_ranking(self, season_id: int) -> List[dict]:
        """
        Ranking Geral da Temporada:
        - Ordenado por total de pontos decrescente.
        - Empates em pontos compartilham a mesma colocação (1º, 1º, 3º).
        """
        teams_q = (
            select(FantasyTeam)
            .where(FantasyTeam.season_id == season_id)
            .options(selectinload(FantasyTeam.user))
            .order_by(FantasyTeam.total_points.desc(), FantasyTeam.total_wealth.desc())
        )
        teams_res = await self.db.execute(teams_q)
        teams = teams_res.scalars().all()

        ranked = []
        for i, t in enumerate(teams):
            entry = {
                "team_id": t.id_fantasy_team,
                "team_name": t.name,
                "user_name": t.user.name if t.user else "Jogador",
                "user_id": t.user_id,
                "points": t.total_points,
                "total_wealth": t.total_wealth,
                "has_lineup": True,
            }
            if i > 0 and entry["points"] == ranked[i - 1]["points"]:
                entry["position"] = ranked[i - 1]["position"]
            else:
                entry["position"] = i + 1
            ranked.append(entry)

        return ranked
