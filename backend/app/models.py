from sqlalchemy import Boolean, Column, Float, Integer, String, BigInteger
from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    match_id = Column(String, primary_key=True)
    ap_event_id = Column(String, nullable=False)
    queue_id = Column(String)
    map_id = Column(String)
    character_id = Column(String)
    started_at = Column(BigInteger)
    duration_seconds = Column(Integer)
    won_match = Column(Boolean)
    rounds_won = Column(Integer)
    total_rounds = Column(Integer)
    kills = Column(Integer)
    deaths = Column(Integer)
    assists = Column(Integer)
    acs = Column(Float)
    is_mvp = Column(Boolean)
    is_svp = Column(Boolean)
    first_kills = Column(Integer)
    rr_change = Column(Integer, nullable=True)
    tier_before = Column(Integer, nullable=True)
    tier_after = Column(Integer, nullable=True)


class MatchDetail(Base):
    """Stores raw JSON from GetBattleDetail for the full 10-player dataset."""
    __tablename__ = "match_details"

    match_id = Column(String, primary_key=True)
    raw_json = Column(String, nullable=False)


class Player(Base):
    """Per-player stats extracted from GetBattleDetail."""
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(String, nullable=False, index=True)
    puuid = Column(String)
    character_id = Column(String)
    team = Column(String)
    kills = Column(Integer)
    deaths = Column(Integer)
    assists = Column(Integer)
    acs = Column(Float)
    total_damage = Column(Integer)
    headshots = Column(Integer)
    bodyshots = Column(Integer)
    legshots = Column(Integer)
    kast = Column(Float)
    economy_score = Column(Integer)
    is_match_mvp = Column(Boolean)
    is_team_mvp = Column(Boolean)
    first_kill_count = Column(Integer)
    triple_kill = Column(Integer)
    quad_kill = Column(Integer)
    penta_kill = Column(Integer)
    clutch_count = Column(Integer)
    bomb_planter = Column(Integer)
    bomb_defuser = Column(Integer)
