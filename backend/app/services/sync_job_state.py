import hashlib
import json
import traceback
from datetime import datetime, timezone
from pathlib import Path

from app.services.cookie_store import DATA_DIR

_STATE_FILE = DATA_DIR / "sync_job_state.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_state() -> dict:
    if not _STATE_FILE.exists():
        return {}
    try:
        return json.loads(_STATE_FILE.read_text())
    except Exception:
        return {}


def _write_state(state: dict) -> None:
    _ensure_dir()
    _STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    try:
        _STATE_FILE.chmod(0o600)
    except OSError:
        pass


def mark_sync_success(result: dict) -> None:
    state = _read_state()
    state.update(
        {
            "status": "success",
            "last_run_at": _now(),
            "last_success_at": _now(),
            "last_result": result,
            "active_failure": None,
            "notified": False,
        }
    )
    _write_state(state)


def mark_sync_failure(exc: BaseException) -> dict:
    state = _read_state()
    message = f"{type(exc).__name__}: {exc}"
    tb = traceback.format_exc(limit=8)
    fingerprint = hashlib.sha256(message.encode("utf-8")).hexdigest()[:16]

    previous_failure = state.get("active_failure") or {}
    same_failure = previous_failure.get("fingerprint") == fingerprint

    failure = {
        "fingerprint": fingerprint,
        "message": message,
        "traceback": tb,
        "first_seen_at": previous_failure.get("first_seen_at") if same_failure else _now(),
        "last_seen_at": _now(),
        "count": (previous_failure.get("count", 0) + 1) if same_failure else 1,
    }

    state.update(
        {
            "status": "failure",
            "last_run_at": _now(),
            "last_failure_at": _now(),
            "active_failure": failure,
            # Keep notified=true for the same still-active failure; reset only for a new fingerprint.
            "notified": bool(state.get("notified")) if same_failure else False,
        }
    )
    _write_state(state)
    return state
