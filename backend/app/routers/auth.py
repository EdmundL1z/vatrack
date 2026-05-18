import os
from fastapi import APIRouter, Header, HTTPException
from app.services.cookie_store import get_expires_at, is_valid, save_cookies
from app.services.sync import run_incremental_sync
from app.services.sync_job_state import mark_sync_failure, mark_sync_success

router = APIRouter()

_SYNC_TOKEN = os.getenv("COOKIE_SYNC_TOKEN", "")


@router.post("/cookies")
async def receive_cookies(payload: dict, x_sync_token: str = Header(...)):
    if not _SYNC_TOKEN or x_sync_token != _SYNC_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid sync token")
    cookies = payload.get("cookies", [])
    if not cookies:
        raise HTTPException(status_code=400, detail="No cookies provided")

    save_cookies(cookies)
    response = {"status": "ok", "count": len(cookies), "sync_triggered": True}
    try:
        sync_result = await run_incremental_sync()
        mark_sync_success(sync_result)
        response["sync_result"] = sync_result
    except Exception as exc:
        mark_sync_failure(exc)
        response["sync_error"] = f"{type(exc).__name__}: {exc}"
    return response


@router.get("/cookies/status")
def cookie_status():
    return {"valid": is_valid(), "expires_at": get_expires_at()}
