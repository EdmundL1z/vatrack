import json
import logging
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Match, MatchDetail
from app.services.cookie_store import is_valid
from app.services.wegame import get_battle_list, get_battle_detail

logger = logging.getLogger(__name__)

PAGE_SIZE = 11
PAGE_ITEMS = PAGE_SIZE - 1
MAX_ITEMS = 100


def _match_id(battle: dict) -> str | None:
    return battle.get("matchId") or battle.get("match_id")


def _ap_event_id(battle: dict) -> str | None:
    return battle.get("apEventId") or battle.get("ap_event_id")


def _ms_to_after(ms) -> str | None:
    value = _int(ms)
    if value is None:
        return None
    from datetime import datetime
    return datetime.fromtimestamp(value / 1000).strftime("%Y%m%d%H%M%S")


async def _fetch_battle_pages(stop_on_existing: bool) -> dict:
    """Fetch battle list using the same size=11 + after lookahead paging as the extension."""
    db: Session = SessionLocal()
    items = []
    seen = set()
    after = None
    pages = 0
    caught_up = False
    try:
        while len(items) < MAX_ITEMS:
            resp = await get_battle_list(size=PAGE_SIZE, after=after)
            pages += 1
            page = resp.get("battles", [])
            real_items = page[:PAGE_ITEMS]

            for item in real_items:
                match_id = _match_id(item)
                if not match_id or match_id in seen:
                    continue
                if stop_on_existing and db.get(Match, match_id):
                    caught_up = True
                    break
                seen.add(match_id)
                items.append(item)
                if len(items) >= MAX_ITEMS:
                    break

            has_more = len(page) == PAGE_SIZE
            if caught_up or len(items) >= MAX_ITEMS or not has_more:
                break

            lookahead = page[PAGE_SIZE - 1]
            after = _ms_to_after(lookahead.get("gameStartMillis"))
            if not after:
                break
    finally:
        db.close()

    return {"battles": items, "pages": pages, "caught_up": caught_up}


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
            match_id    = _match_id(b)
            ap_event_id = _ap_event_id(b)
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
        fetched = await _fetch_battle_pages(stop_on_existing=True)
        result = await _sync(fetched["battles"])
        result.update({"fetched": len(fetched["battles"]), "pages": fetched["pages"], "caught_up": fetched["caught_up"]})
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
        fetched = await _fetch_battle_pages(stop_on_existing=False)
        result = await _sync(fetched["battles"])
        result.update({"fetched": len(fetched["battles"]), "pages": fetched["pages"], "caught_up": fetched["caught_up"]})
        logger.info("Full sync done: %s", result)
        return result
    except Exception as e:
        logger.error("Full sync failed: %s", e)
        raise
