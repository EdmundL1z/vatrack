import json
import time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match, MatchDetail
from app.routers.battles import map_name

router = APIRouter()


@router.get("/stats/agents")
def agent_stats(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Match.character_id,
            func.count().label("played"),
            func.sum(cast(Match.won_match, Integer)).label("wins"),
            func.avg(Match.kills).label("avg_kills"),
            func.avg(Match.deaths).label("avg_deaths"),
            func.avg(Match.assists).label("avg_assists"),
        )
        .filter(Match.character_id.isnot(None))
        .filter(Match.queue_id == "competitive")
        .group_by(Match.character_id)
        .order_by(func.count().desc())
        .all()
    )
    return [
        {
            "character_id": r.character_id,
            "played": r.played,
            "wins": int(r.wins or 0),
            "win_rate": round((r.wins or 0) / r.played * 100, 1),
            "avg_kills": round(r.avg_kills or 0, 1),
            "avg_deaths": round(r.avg_deaths or 0, 1),
            "avg_assists": round(r.avg_assists or 0, 1),
            "kd_ratio": round((r.avg_kills or 0) / max(r.avg_deaths or 1, 0.1), 2),
        }
        for r in rows
    ]


@router.get("/stats/maps")
def map_stats(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Match.map_id,
            func.count().label("played"),
            func.sum(cast(Match.won_match, Integer)).label("wins"),
            func.avg(Match.kills).label("avg_kills"),
            func.avg(Match.deaths).label("avg_deaths"),
            func.avg(Match.assists).label("avg_assists"),
        )
        .filter(Match.map_id.isnot(None))
        .filter(Match.queue_id == "competitive")
        .group_by(Match.map_id)
        .order_by(func.count().desc())
        .all()
    )
    return [
        {
            "map_id": r.map_id,
            "map_name": map_name(r.map_id),
            "played": r.played,
            "wins": int(r.wins or 0),
            "win_rate": round((r.wins or 0) / r.played * 100, 1),
            "avg_kills": round(r.avg_kills or 0, 1),
            "avg_deaths": round(r.avg_deaths or 0, 1),
            "avg_assists": round(r.avg_assists or 0, 1),
        }
        for r in rows
    ]


@router.get("/stats/trends")
def trend_stats(days: int = Query(30, ge=1, le=36500), db: Session = Depends(get_db)):
    cutoff = int(time.time()) - days * 86400
    rows = (
        db.query(Match)
        .filter(Match.queue_id == "competitive", Match.started_at >= cutoff)
        .order_by(Match.started_at.asc())
        .all()
    )
    return [
        {
            "match_id": m.match_id,
            "started_at": m.started_at,
            "map_name": map_name(m.map_id),
            "character_id": m.character_id,
            "won_match": m.won_match,
            "kills": m.kills,
            "deaths": m.deaths,
            "assists": m.assists,
            "rr_change": m.rr_change,
            "tier_after": m.tier_after,
        }
        for m in rows
    ]


@router.get("/stats/friends")
def friend_stats(subject: str | None = Query(None), db: Session = Depends(get_db)):
    rows = (
        db.query(Match, MatchDetail)
        .join(MatchDetail, Match.match_id == MatchDetail.match_id)
        .filter(Match.queue_id == "competitive")
        .all()
    )

    stats_map: dict[str, dict] = {}

    for match, detail in rows:
        raw = json.loads(detail.raw_json)
        players = raw.get("battle_detail", {}).get("players", [])
        if not players or not match.character_id:
            continue

        # Find user's player entry (same logic as frontend: character_id + K/D tiebreaker)
        candidates = [p for p in players if p.get("characterId") == match.character_id]
        if not candidates:
            continue
        my_player = (
            candidates[0] if len(candidates) == 1
            else next(
                (p for p in candidates
                 if p.get("statsKills") == match.kills and p.get("statsDeaths") == match.deaths),
                candidates[0],
            )
        )
        my_team = my_player.get("teamId")

        for p in players:
            if not p.get("isFriend"):
                continue
            if p.get("teamId") != my_team:
                continue
            subj = p.get("subject") or ""
            if not subj:
                continue
            if subject and subj != subject:
                continue
            name = p.get("name") or subj[:8]
            if subj not in stats_map:
                stats_map[subj] = {"subject": subj, "name": name, "played": 0, "wins": 0}
            stats_map[subj]["played"] += 1
            if match.won_match:
                stats_map[subj]["wins"] += 1
            if p.get("name"):
                stats_map[subj]["name"] = p["name"]

    result = []
    for s in stats_map.values():
        played = s["played"]
        wins = s["wins"]
        result.append({
            "subject": s["subject"],
            "name": s["name"],
            "played": played,
            "wins": wins,
            "win_rate": round(wins / played * 100, 1) if played > 0 else 0.0,
        })

    return sorted(result, key=lambda x: -x["played"])
