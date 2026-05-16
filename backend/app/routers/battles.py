import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match, MatchDetail

router = APIRouter()

MAP_NAMES = {
    "/Game/Maps/Duality/Duality": "Bind",
    "/Game/Maps/Triad/Triad": "Haven",
    "/Game/Maps/Bonsai/Bonsai": "Split",
    "/Game/Maps/Port/Port": "Icebox",
    "/Game/Maps/Foxtrot/Foxtrot": "Breeze",
    "/Game/Maps/Canyon/Canyon": "Fracture",
    "/Game/Maps/Pitt/Pitt": "Pearl",
    "/Game/Maps/Jam/Jam": "Lotus",
    "/Game/Maps/Juliett/Juliett": "Sunset",
    "/Game/Maps/Abyss/Abyss": "Abyss",
}


def map_name(map_id: str | None) -> str:
    if not map_id:
        return "Unknown"
    return MAP_NAMES.get(map_id, map_id.split("/")[-1])


def _match_summary(m: Match) -> dict:
    return {
        "match_id": m.match_id,
        "queue_id": m.queue_id,
        "map_id": m.map_id,
        "map_name": map_name(m.map_id),
        "character_id": m.character_id,
        "started_at": m.started_at,
        "duration_seconds": m.duration_seconds,
        "won_match": m.won_match,
        "rounds_won": m.rounds_won,
        "total_rounds": m.total_rounds,
        "kills": m.kills,
        "deaths": m.deaths,
        "assists": m.assists,
        "acs": m.acs,
        "is_mvp": m.is_mvp,
        "is_svp": m.is_svp,
        "first_kills": m.first_kills,
        "rr_change": m.rr_change,
        "tier_before": m.tier_before,
        "tier_after": m.tier_after,
    }


@router.get("/battles/filters")
def get_battle_filters(db: Session = Depends(get_db)):
    queues = [r[0] for r in db.query(distinct(Match.queue_id)).filter(Match.queue_id.isnot(None)).all()]
    raw_map_ids = [r[0] for r in db.query(distinct(Match.map_id)).filter(Match.map_id.isnot(None)).all()]
    maps = [{"id": mid, "name": map_name(mid)} for mid in raw_map_ids]
    char_ids = [r[0] for r in db.query(distinct(Match.character_id)).filter(Match.character_id.isnot(None)).all()]
    return {"queues": queues, "maps": maps, "character_ids": char_ids}


@router.get("/battles")
def list_battles(
    queue: str | None = None,
    map_id: str | None = None,
    character_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Match).order_by(Match.started_at.desc())
    if queue:
        q = q.filter(Match.queue_id == queue)
    if map_id:
        q = q.filter(Match.map_id == map_id)
    if character_id:
        q = q.filter(Match.character_id == character_id)
    total = q.count()
    matches = q.offset(skip).limit(limit).all()

    return {
        "total": total,
        "matches": [_match_summary(m) for m in matches],
    }


@router.get("/battles/{match_id}")
def get_battle(match_id: str, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    detail = db.get(MatchDetail, match_id)
    players = []
    rounds_played = match.total_rounds or 1

    if detail:
        raw = json.loads(detail.raw_json)
        pgv = raw.get("battle_detail", {}).get("playerGameView", {})
        rounds_played = pgv.get("roundsPlayed") or rounds_played
        for p in raw.get("battle_detail", {}).get("players", []):
            score = p.get("statsScore")
            acs = round(int(score) / rounds_played, 1) if score else None
            total_shots = (
                (p.get("totalHeadshots") or 0)
                + (p.get("totalBodyshots") or 0)
                + (p.get("totalLegshots") or 0)
            )
            hs_pct = (
                round(p["totalHeadshots"] / total_shots * 100, 1)
                if total_shots > 0
                else None
            )
            players.append({
                "subject": p.get("subject"),
                "name": p.get("name"),
                "team_id": p.get("teamId"),
                "character_id": p.get("characterId"),
                "kills": p.get("statsKills"),
                "deaths": p.get("statsDeaths"),
                "assists": p.get("statsAssists"),
                "acs": acs,
                "is_match_mvp": bool(p.get("isMatchMvp")),
                "is_team_mvp": bool(p.get("isTeamMvp")),
                "headshots": p.get("totalHeadshots"),
                "bodyshots": p.get("totalBodyshots"),
                "legshots": p.get("totalLegshots"),
                "hs_pct": hs_pct,
                "total_damage": p.get("totalDamage"),
                "kast": p.get("kast"),
                "economy_score": p.get("economyScore"),
                "first_kills": p.get("firstKillCount"),
                "triple_kills": p.get("tripleKillCount"),
                "quadra_kills": p.get("quadraKillCount"),
                "penta_kills": p.get("pentaKillCount"),
                "clutch_count": p.get("clutchCount"),
                "bomb_plants": p.get("bombPlanterCount"),
                "bomb_defuses": p.get("bombDefuserCount"),
                "is_friend": bool(p.get("isFriend")),
            })

    return {
        "match_id": match.match_id,
        "ap_event_id": match.ap_event_id,
        "queue_id": match.queue_id,
        "map_id": match.map_id,
        "map_name": map_name(match.map_id),
        "character_id": match.character_id,
        "started_at": match.started_at,
        "duration_seconds": match.duration_seconds,
        "won_match": match.won_match,
        "rounds_won": match.rounds_won,
        "total_rounds": match.total_rounds,
        "kills": match.kills,
        "deaths": match.deaths,
        "assists": match.assists,
        "acs": match.acs,
        "is_mvp": match.is_mvp,
        "is_svp": match.is_svp,
        "rr_change": match.rr_change,
        "tier_before": match.tier_before,
        "tier_after": match.tier_after,
        "players": players,
    }
