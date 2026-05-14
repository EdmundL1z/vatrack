import json
import os
from pathlib import Path
from typing import Optional

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
_COOKIES_FILE = DATA_DIR / "cookies.json"
_STATUS_FILE = DATA_DIR / "cookie_status.json"


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def save_cookies(cookies: list) -> None:
    _ensure_dir()
    _COOKIES_FILE.write_text(json.dumps(cookies, ensure_ascii=False))
    _write_status(True, _min_expiry(cookies))


def load_cookies() -> dict:
    if not _COOKIES_FILE.exists():
        return {}
    return {c["name"]: c["value"] for c in json.loads(_COOKIES_FILE.read_text())}


def mark_invalid() -> None:
    status = _read_status()
    _write_status(False, status.get("expires_at"))


def is_valid() -> bool:
    return _read_status().get("valid", False)


def get_expires_at() -> Optional[float]:
    return _read_status().get("expires_at")


def _min_expiry(cookies: list) -> Optional[float]:
    expiries = [c["expires"] for c in cookies if c.get("expires", -1) > 0]
    return min(expiries) if expiries else None


def _read_status() -> dict:
    if not _STATUS_FILE.exists():
        return {}
    return json.loads(_STATUS_FILE.read_text())


def _write_status(valid: bool, expires_at: Optional[float]) -> None:
    _ensure_dir()
    _STATUS_FILE.write_text(json.dumps({"valid": valid, "expires_at": expires_at}))
