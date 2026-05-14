from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter()


@router.get("/stats/agents")
def agent_stats(db: Session = Depends(get_db)):
    pass


@router.get("/stats/maps")
def map_stats(db: Session = Depends(get_db)):
    pass


@router.get("/stats/trends")
def trend_stats(days: int = 30, db: Session = Depends(get_db)):
    pass
