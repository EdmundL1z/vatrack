from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter()


@router.get("/battles")
def list_battles(queue: str = None, db: Session = Depends(get_db)):
    pass


@router.get("/battles/{match_id}")
def get_battle(match_id: str, db: Session = Depends(get_db)):
    pass
