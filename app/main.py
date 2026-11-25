from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import (
    auth,
    users,
    matches,
    rankings,
    rounds,
    teams,
    players,
    events,
    awards,
    rules,
    seasons,
    sumulas,
    attendance,
    roulette_prizes,
    polls,
    round_votes,
    financial,
    fantasy,
    round_media,
    tenants,
    checkout,
    storage,
    tournaments,
)
from app.core.middlewares.tenant_middleware import TenantResolutionMiddleware
from app.core.middlewares.rate_limit_middleware import TenantRateLimitMiddleware

app = FastAPI(title="Baygon API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantRateLimitMiddleware)
app.add_middleware(TenantResolutionMiddleware)

app.include_router(tournaments.router, prefix="/api/v1")
app.include_router(storage.router, prefix="/api/v1")
app.include_router(checkout.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(rounds.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(players.router, prefix="/api/v1")
app.include_router(matches.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(awards.router, prefix="/api/v1")
app.include_router(rules.router, prefix="/api/v1")
app.include_router(rankings.router, prefix="/api/v1")
app.include_router(seasons.router, prefix="/api/v1")
app.include_router(sumulas.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(roulette_prizes.router, prefix="/api/v1")
app.include_router(polls.router, prefix="/api/v1")
app.include_router(round_votes.router, prefix="/api/v1")
app.include_router(financial.router, prefix="/api/v1")
app.include_router(fantasy.router, prefix="/api/v1")
app.include_router(round_media.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Baygon API running 🚀"}


@app.get("/api/v1")
@app.get("/api/v1/")
async def api_v1_root():
    return {
        "message": "Baygon API v1 running 🚀",
        "docs": "/docs",
        "status": "online",
    }
