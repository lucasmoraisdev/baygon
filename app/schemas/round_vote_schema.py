from typing import List, Optional
from pydantic import BaseModel, ConfigDict


AWARD_CATEGORY_LABELS = {
    "bola_cheia": "Bola Cheia (MVP)",
    "bola_murcha": "Bola Murcha",
    "gol_rodada": "Gol da Rodada",
    "defesa_rodada": "Defesa da Rodada",
    "drible_rodada": "Drible da Rodada",
    "inacreditavel": "Inacreditável",
}


class RoundVoterRead(BaseModel):
    id_voter: int
    round_id: int
    user_id: int
    user_name: str
    user_email: str
    has_voted: bool = False
    is_referee: bool = False
    votes: List[RoundVoteItem] = []

    model_config = ConfigDict(from_attributes=True)


class RoundVotersAssignRequest(BaseModel):
    user_ids: List[int]


class RoundVoteItem(BaseModel):
    award_type: str
    player_id: int


class RoundVoteSubmitRequest(BaseModel):
    votes: List[RoundVoteItem]
    voter_user_id: Optional[int] = None


class RoundVoteCandidateCount(BaseModel):
    player_id: int
    player_name: str
    player_apelido: Optional[str] = None
    votes_count: int = 0
    percentage: float = 0.0


class RoundCategoryTally(BaseModel):
    award_type: str
    category_label: str
    total_votes: int = 0
    candidates: List[RoundVoteCandidateCount] = []
    leading_player_id: Optional[int] = None
    leading_player_name: Optional[str] = None


class RoundVotingStatusRead(BaseModel):
    round_id: int
    is_voting_open: bool
    is_user_voter: bool
    total_voters_count: int
    voted_voters_count: int
    referee_user_id: Optional[int] = None
    referee_name: Optional[str] = None
    voters: List[RoundVoterRead] = []
    user_votes: List[RoundVoteItem] = []
    tallies: List[RoundCategoryTally] = []
