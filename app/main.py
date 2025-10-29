from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import users, matches, rankings

app = FastAPI(title="Baygon API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/v1")
# app.include_router(matches.router, prefix="/api/v1")
# app.include_router(rankings.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Baygon API running 🚀"}
