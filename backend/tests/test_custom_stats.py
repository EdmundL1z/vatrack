import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import Match, MatchDetail

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _match(match_id, queue_id="competitive", map_id="Ascent", character_id="agent-a",
           won_match=True, kills=15, deaths=10, assists=5, started_at=1_700_000_000):
    db = TestingSessionLocal()
    db.add(Match(
        match_id=match_id, ap_event_id=f"ap-{match_id}",
        queue_id=queue_id, map_id=map_id, character_id=character_id,
        started_at=started_at, duration_seconds=2000, won_match=won_match,
        kills=kills, deaths=deaths, assists=assists,
    ))
    db.commit()
    db.close()


def _detail(match_id, players):
    db = TestingSessionLocal()
    db.add(MatchDetail(
        match_id=match_id,
        raw_json=json.dumps({"battle_detail": {"players": players}}),
    ))
    db.commit()
    db.close()


def test_group_by_map_empty():
    resp = client.get("/api/stats/custom", params={"group_by": "map"})
    assert resp.status_code == 200
    assert resp.json() == []


def test_group_by_map_basic():
    _match("m1", map_id="Ascent", won_match=True)
    _match("m2", map_id="Ascent", won_match=False)
    _match("m3", map_id="Bind", won_match=True)

    data = client.get("/api/stats/custom", params={"group_by": "map"}).json()
    ascent = next(r for r in data if r["map_id"] == "Ascent")
    assert ascent["played"] == 2
    assert ascent["wins"] == 1
    assert ascent["win_rate"] == 50.0


def test_group_by_agent():
    _match("m1", character_id="agent-a", won_match=True)
    _match("m2", character_id="agent-a", won_match=True)
    _match("m3", character_id="agent-b", won_match=False)

    data = client.get("/api/stats/custom", params={"group_by": "agent"}).json()
    a = next(r for r in data if r["character_id"] == "agent-a")
    assert a["played"] == 2
    assert a["wins"] == 2
    assert a["win_rate"] == 100.0


def test_filter_by_map_ids():
    _match("m1", map_id="Ascent", won_match=True)
    _match("m2", map_id="Bind", won_match=False)

    data = client.get("/api/stats/custom", params={"group_by": "map", "map_ids": "Ascent"}).json()
    assert len(data) == 1
    assert data[0]["map_id"] == "Ascent"


def test_filter_by_character_ids():
    _match("m1", character_id="agent-a", won_match=True)
    _match("m2", character_id="agent-b", won_match=False)

    data = client.get("/api/stats/custom", params={"group_by": "agent", "character_ids": "agent-a"}).json()
    assert len(data) == 1
    assert data[0]["character_id"] == "agent-a"


def test_filter_queue_all():
    _match("m1", queue_id="competitive", won_match=True)
    _match("m2", queue_id="unranked", won_match=False)

    data = client.get("/api/stats/custom", params={"group_by": "map", "queue": "all"}).json()
    assert sum(r["played"] for r in data) == 2


def test_filter_queue_competitive_default():
    _match("m1", queue_id="competitive")
    _match("m2", queue_id="unranked")

    data = client.get("/api/stats/custom", params={"group_by": "map"}).json()
    assert sum(r["played"] for r in data) == 1


def test_group_by_none_summary():
    _match("m1", won_match=True,  kills=20, deaths=8,  assists=4)
    _match("m2", won_match=False, kills=10, deaths=12, assists=6)

    data = client.get("/api/stats/custom", params={"group_by": "none"}).json()
    assert data["played"] == 2
    assert data["wins"] == 1
    assert data["win_rate"] == 50.0
    assert data["avg_kills"] == 15.0


def test_group_by_none_empty():
    data = client.get("/api/stats/custom", params={"group_by": "none"}).json()
    assert data["played"] == 0


def test_friend_filter_restricts_matches():
    _match("m1", won_match=True,  character_id="agent-a", kills=15, deaths=10)
    _match("m2", won_match=False, character_id="agent-a", kills=10, deaths=15)

    _detail("m1", [
        {"characterId": "agent-a", "teamId": "Blue", "statsKills": 15, "statsDeaths": 10,
         "isFriend": False, "subject": "me"},
        {"characterId": "agent-x", "teamId": "Blue", "isFriend": True,
         "subject": "friend-1", "name": "FriendA"},
    ])
    _detail("m2", [
        {"characterId": "agent-a", "teamId": "Blue", "statsKills": 10, "statsDeaths": 15,
         "isFriend": False, "subject": "me"},
        {"characterId": "agent-y", "teamId": "Blue", "isFriend": False, "subject": "stranger"},
    ])

    data = client.get("/api/stats/custom",
                      params={"group_by": "map", "friend_subject": "friend-1"}).json()
    assert sum(r["played"] for r in data) == 1


def test_group_by_friend():
    _match("m1", won_match=True, character_id="agent-a", kills=15, deaths=10)
    _detail("m1", [
        {"characterId": "agent-a", "teamId": "Blue", "statsKills": 15, "statsDeaths": 10,
         "isFriend": False, "subject": "me"},
        {"characterId": "agent-x", "teamId": "Blue", "isFriend": True,
         "subject": "friend-1", "name": "FriendA"},
    ])

    data = client.get("/api/stats/custom", params={"group_by": "friend"}).json()
    assert len(data) == 1
    assert data[0]["subject"] == "friend-1"
    assert data[0]["wins"] == 1
    assert data[0]["win_rate"] == 100.0
