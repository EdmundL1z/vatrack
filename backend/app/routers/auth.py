import os
from fastapi import APIRouter, Header, HTTPException
from app.services.cookie_store import get_expires_at, is_valid, save_cookies

router = APIRouter()

_SYNC_TOKEN = os.getenv("COOKIE_SYNC_TOKEN", "")


@router.post("/cookies")
def receive_cookies(payload: dict, x_sync_token: str = Header(...)):
    if not _SYNC_TOKEN or x_sync_token != _SYNC_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid sync token")
    cookies = payload.get("cookies", [])
    if not cookies:
        raise HTTPException(status_code=400, detail="No cookies provided")
    save_cookies(cookies)
    return {"status": "ok", "count": len(cookies)}


@router.get("/cookies/status")
def cookie_status():
    return {"valid": is_valid(), "expires_at": get_expires_at()}
