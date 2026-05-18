#!/usr/bin/env python3
import json
import os
from pathlib import Path

BASE_URL = os.getenv("VATRACK_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
TOKEN = os.getenv("COOKIE_SYNC_TOKEN", "")
STATE_PATH = Path(os.getenv("DATA_DIR", "/home/edmund/vatrack/data")) / "sync_job_state.json"


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    return json.loads(STATE_PATH.read_text())


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    try:
        STATE_PATH.chmod(0o600)
    except OSError:
        pass


def mark_notified(state: dict) -> None:
    state["notified"] = True
    save_state(state)


def ack_hint() -> str:
    if TOKEN:
        return (
            "处理完后可确认该失败，避免同一失败继续保持待处理状态：\n"
            f"curl -fsS -X POST -H 'x-sync-token: {TOKEN}' {BASE_URL}/api/sync/ack-failure"
        )
    return "处理完后可 POST /api/sync/ack-failure 确认该失败。"


def main() -> int:
    state = load_state()
    failure = state.get("active_failure") or {}
    if state.get("status") != "failure" or not failure:
        print("NO_REPLY")
        return 0
    if state.get("notified"):
        print("NO_REPLY")
        return 0

    mark_notified(state)
    print(
        "VaTrack 每小时同步任务失败。\n\n"
        f"fingerprint: {failure.get('fingerprint')}\n"
        f"首次出现: {failure.get('first_seen_at')}\n"
        f"最近出现: {failure.get('last_seen_at')}\n"
        f"次数: {failure.get('count')}\n"
        f"错误: {failure.get('message')}\n\n"
        "同一失败在确认/恢复前不会重复提醒。\n"
        f"{ack_hint()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
