from fastapi import APIRouter
from app.api.v1 import users, auth, rounds, teams, players, matches, events, awards, rules, rankings

router = APIRouter()
router.include_router(users.router)
router.include_router(auth.router)
router.include_router(rounds.router)
router.include_router(teams.router)
router.include_router(players.router)
router.include_router(matches.router)
router.include_router(events.router)
router.include_router(awards.router)
router.include_router(rules.router)
router.include_router(rankings.router)
