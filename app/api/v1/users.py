from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.db.models.user import User

router = APIRouter()

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()
