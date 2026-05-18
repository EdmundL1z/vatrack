import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.sync import run_incremental_sync
from app.services.sync_job_state import mark_sync_failure, mark_sync_success

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def run_incremental_sync_job():
    try:
        result = await run_incremental_sync()
    except Exception as exc:
        state = mark_sync_failure(exc)
        failure = state.get("active_failure") or {}
        if not state.get("notified"):
            logger.error(
                "VaTrack hourly sync failed; notification pending. fingerprint=%s message=%s",
                failure.get("fingerprint"),
                failure.get("message"),
            )
        else:
            logger.warning(
                "VaTrack hourly sync still failing; notification already pending. fingerprint=%s count=%s",
                failure.get("fingerprint"),
                failure.get("count"),
            )
        return

    mark_sync_success(result)
    logger.info("VaTrack hourly sync succeeded: %s", result)


def start_scheduler():
    if scheduler.get_job("hourly_sync"):
        return
    scheduler.add_job(run_incremental_sync_job, "interval", hours=1, id="hourly_sync")
    scheduler.start()
