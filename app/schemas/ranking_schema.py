from typing import Optional
from pydantic import BaseModel


class AssociationRankingRow(BaseModel):
    player_id: int
    boleiro: str
    ranking_geral: int = 0
    artilharia: int = 0
    assistencias: int = 0
    babas_conquistados: int = 0
    babas_perdidos: int = 0
    empates: int = 0
    pontos_colaboracao: int = 0
    premio_defesa: int = 0
    premio_drible: int = 0
    premio_gol: int = 0
    premio_inacreditavel: int = 0
    presenca_baba: int = 0
    total_gols_contra: int = 0
    bola_cheia: int = 0
    bola_murcha: int = 0
    clean_sheets: int = 0
    pizza: int = 0
    ouros: int = 0
    pontos_copas: int = 0
    selecao_mes: int = 0
    roleta: int = 0
    ultimo_baba: str = "-"
    ultima_vitoria: str = "NÃO"
    posicao: str = "-"


class AssociationRankingResponse(BaseModel):
    season_id: Optional[int] = None
    season_number: Optional[int] = None
    rows: list[AssociationRankingRow] = []
