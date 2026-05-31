import json
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match, MatchDetail
from app.services.cookie_store import is_valid, get_expires_at
from app.services.sync_job_state import _read_state
from app.services.sync import run_incremental_sync, run_full_sync

router = APIRouter()

SYNC_TOKEN = os.environ.get("COOKIE_SYNC_TOKEN", "")


class MatchPayload(BaseModel):
    match_id: str
    ap_event_id: str
    list_data: Any
    detail_data: Optional[Any] = None


class SyncRequest(BaseModel):
    matches: list[MatchPayload]


@router.get("/sync/status")
def sync_status():
    """Cookie validity, expiry, and hourly sync job state for monitoring."""
    return {
        "cookie_valid": is_valid(),
        "cookie_expires_at": get_expires_at(),
        "sync_job": _read_state(),
    }


@router.post("/sync/ack-failure")
def ack_sync_failure(x_sync_token: str = Header(default="")):
    """Acknowledge the active sync failure so future failures can alert again."""
    if SYNC_TOKEN and x_sync_token != SYNC_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid sync token")
    from app.services.sync_job_state import _write_state

    state = _read_state()
    if state.get("active_failure"):
        state["acknowledged"] = True
        state["notified"] = True
        _write_state(state)
    return {"status": "ok", "sync_job": state}


@router.post("/sync/trigger")
async def trigger_sync(full: bool = False):
    """Manually trigger a sync. Use ?full=true for a 100-match backfill."""
    result = await run_full_sync() if full else await run_incremental_sync()
    return result


@router.get("/debug/battle-fields")
async def debug_battle_fields():
    """Return all raw fields from the first battle in GetBattleList — use to inspect available API fields."""
    from app.services.wegame import get_battle_list
    resp = await get_battle_list(size=2)
    battles = resp.get("battles", [])
    if not battles:
        return {"error": "no battles returned"}
    return {"fields": battles[0]}


@router.get("/battles/ids")
def get_battle_ids(db: Session = Depends(get_db)):
    return [row[0] for row in db.query(Match.match_id).all()]


@router.post("/sync")
def sync_matches(
    payload: SyncRequest,
    x_sync_token: str = Header(default=""),
    db: Session = Depends(get_db),
):
    if SYNC_TOKEN and x_sync_token != SYNC_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid sync token")

    inserted = skipped = detail_filled = 0
    for item in payload.matches:
        if db.get(Match, item.match_id):
            if item.detail_data and not db.get(MatchDetail, item.match_id):
                db.add(MatchDetail(match_id=item.match_id, raw_json=json.dumps(item.detail_data)))
                detail_filled += 1
            else:
                skipped += 1
            continue
        db.add(_parse_match(item))
        if item.detail_data:
            db.add(MatchDetail(match_id=item.match_id, raw_json=json.dumps(item.detail_data)))
        inserted += 1

    db.commit()
    return {"inserted": inserted, "skipped": skipped, "detail_filled": detail_filled}


def _parse_match(item: MatchPayload) -> Match:
    d = item.list_data or {}

    def _int(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    return Match(
        match_id=item.match_id,
        ap_event_id=item.ap_event_id,
        queue_id=d.get("queueId"),
        map_id=d.get("mapId"),
        character_id=d.get("characterId"),
        started_at=_int(d.get("gameStartMillis", 0)) // 1000 if d.get("gameStartMillis") else None,
        duration_seconds=_int(d.get("gameLengthMillis", 0)) // 1000 if d.get("gameLengthMillis") else None,
        won_match=bool(d.get("wonMatch")),
        rounds_won=d.get("roundsWon"),
        total_rounds=d.get("roundsPlayed"),
        kills=d.get("statsKills"),
        deaths=d.get("statsDeaths"),
        assists=d.get("statsAssists"),
        acs=None,  # calculated from detail data; statsScore is raw combat score
        is_mvp=bool(d.get("isMatchMvp")),
        is_svp=bool(d.get("isTeamMvp")),
        first_kills=d.get("firstKillCount"),
        rr_change=_int(d.get("CompetitiveTierRankedRatingEarned")),
        tier_before=_int(d.get("CompetitiveTierBefore")),
        tier_after=_int(d.get("CompetitiveTierAfter")),
        rr_after=_int(
            d.get("CompetitiveTierRankedRatingAfterUpdate")
            or d.get("rankedRatingAfterUpdate")
            or d.get("CompetitiveTierRankedRatingAfter")
            or d.get("rankedRatingAfter")
        ),
    )
