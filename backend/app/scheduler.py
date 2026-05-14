from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.sync import run_incremental_sync

scheduler = AsyncIOScheduler()


def start_scheduler():
    scheduler.add_job(run_incremental_sync, "interval", hours=1, id="hourly_sync")
    scheduler.start()
