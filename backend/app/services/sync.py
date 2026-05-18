import json
import logging
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Match, MatchDetail
from app.services.cookie_store import is_valid
from app.services.wegame import get_battle_list, get_battle_detail

logger = logging.getLogger(__name__)


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _parse_match(match_id: str, ap_event_id: str, d: dict) -> Match:
    return Match(
        match_id=match_id,
        ap_event_id=ap_event_id,
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
        acs=None,
        is_mvp=bool(d.get("isMatchMvp")),
        is_svp=bool(d.get("isTeamMvp")),
        first_kills=d.get("firstKillCount"),
        rr_change=_int(d.get("CompetitiveTierRankedRatingEarned")),
        tier_before=_int(d.get("CompetitiveTierBefore")),
        tier_after=_int(d.get("CompetitiveTierAfter")),
    )


async def _sync(battles: list) -> dict:
    """Insert new matches and their details. Returns counts."""
    db: Session = SessionLocal()
    inserted = skipped = detail_failed = 0
    try:
        for b in battles:
            match_id    = b.get("matchId")    or b.get("match_id")
            ap_event_id = b.get("apEventId")  or b.get("ap_event_id")
            if not match_id or not ap_event_id:
                continue

            if db.get(Match, match_id):
                skipped += 1
                continue

            detail_data = None
            try:
                detail_resp = await get_battle_detail(ap_event_id)
                detail_data = detail_resp.get("data") or detail_resp
            except Exception as e:
                logger.warning("Detail fetch failed for %s: %s", ap_event_id, e)
                detail_failed += 1

            db.add(_parse_match(match_id, ap_event_id, b))
            if detail_data:
                db.add(MatchDetail(match_id=match_id, raw_json=json.dumps(detail_data)))
            inserted += 1

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return {"inserted": inserted, "skipped": skipped, "detail_failed": detail_failed}


async def run_incremental_sync() -> dict:
    """Hourly job: fetch the latest matches, insert only new ones."""
    if not is_valid():
        logger.info("Skipping incremental sync: no valid WeGame session stored.")
        return {"skipped_reason": "no_cookies"}

    logger.info("Starting incremental sync...")
    try:
        resp = await get_battle_list(size=100)
        battles = resp.get("battles", [])
        result = await _sync(battles)
        logger.info("Incremental sync done: %s", result)
        return result
    except Exception as e:
        logger.error("Incremental sync failed: %s", e)
        raise


async def run_full_sync() -> dict:
    """One-time backfill: fetch up to 100 matches and insert all new ones."""
    if not is_valid():
        logger.info("Skipping full sync: no valid WeGame session stored.")
        return {"skipped_reason": "no_cookies"}

    logger.info("Starting full sync (up to 100 matches)...")
    try:
        resp = await get_battle_list(size=100)
        battles = resp.get("battles", [])
        result = await _sync(battles)
        logger.info("Full sync done: %s", result)
        return result
    except Exception as e:
        logger.error("Full sync failed: %s", e)
        raise
