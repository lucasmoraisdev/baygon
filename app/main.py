from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, users, matches, rankings, rounds, teams, players, events, awards, rules, seasons

app = FastAPI(title="Baygon API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
async def root():
    return {"message": "Baygon API running 🚀"}
