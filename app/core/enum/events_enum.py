import enum


class EventTypeEnum(str, enum.Enum):
    # eventos de premiacao
    ROUND_WINNER = "time_vencedor_rodada"
    MVP = "bola_cheia"
    WORST_PLAYER = "bola_murcha"
    BEST_GOAL = "gol_rodada"
    BEST_DEFENSE = "defesa_rodada"
    TOAST = "drible_rodada"
    UNBELIVABLE = "inacreditavel"
    BEST_GOAL_KEEPER = "goleiro_menos_vazado"
    ROULETTE = "roleta"
    # eventos de partida (jogador)
    GOAL = "gol"
    ASSIST = "assistencia"
    BLUNDER = "ouro"
    YELLOW_CARD = "cartao_amarelo"
    RED_CARD = "cartao_vermelho"
    OWN_GOAL = "gol_contra"
    # evento de partida (time)
    HOME_WIN = "vitoria_mandante"
    AWAY_WIN = "vitoria_visitante"
    DRAW = "empate"

class EventContextEnum(str, enum.Enum):
    MATCH = "match",
    ROUND = "round",
    SEASON = "season"