# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal Valorant match tracking dashboard for WeGame CN users. Deployed on a Hong Kong Linux server. Supports a small friend group (~5 users). Full design spec is in `valorant_tracker_tech_doc.md`.

## Development Workflow

Local Windows development → `git push` → HK Linux server deployment. The cookie extraction script runs **only locally** and is never deployed to the server.

Environment config lives in `.env` (gitignored). Maintain separate `.env.local` and `.env.production` templates as `.env.example`.

## Commands

### Backend (FastAPI)
```bash
# Install deps
pip install -r requirements.txt

# Run dev server (auto-reload)
uvicorn app.main:app --reload

# Run a specific test
pytest tests/test_battles.py -v

# Run all tests
pytest
```

### Cookie Extractor (Node.js, local only)
```bash
# Install deps
npm install

# Extract and push cookies to server
node scripts/sync_cookies.js
```

### Server Deployment
```bash
# On the server: pull and restart
git pull && systemctl restart vatrack
```

## Architecture

### Component Map

```
cookie-extractor/          # Node.js, local-only, never deployed
  sync_cookies.js          # CDP → extract WeGame cookies → POST to server

backend/
  app/
    main.py                # FastAPI app, mounts routers
    models.py              # SQLAlchemy ORM (Match, MatchDetail, Player)
    database.py            # SQLite engine + session factory
    routers/
      battles.py           # GET /battles, GET /battles/{id}
      stats.py             # GET /stats/agents, /stats/maps, etc.
      auth.py              # POST /cookies (receive from local extractor)
    services/
      wegame.py            # WeGame API client (all fetch logic here)
      sync.py              # Scheduled hourly pull logic
    scheduler.py           # APScheduler hourly job

frontend/                  # React or Vue, TBD
```

### Data Flow

1. **Cookie sync**: Local Node.js reads Chrome cookies via CDP (`Network.getCookies`), POSTs to `/api/cookies` on server. Triggered by Windows Task Scheduler weekly, or manually when dashboard shows auth warning.

2. **Match ingestion**: APScheduler runs every hour → `sync.py` calls `GetBattleList(size=20)` → deduplicates by `matchId` → fetches `GetBattleDetail` for new matches only.

3. **Full history init**: One-time on first run, calls `GetBattleList` with max `size` → fetches all details. Size ceiling TBD (test during dev).

### WeGame API

Base URL: `https://www.wegame.com.cn/api/v1/wegame.pallas.game.ValBattle/`

All endpoints are **HTTP POST with JSON body**, authenticated via HttpOnly cookies (passed as `Cookie` header server-side).

| Endpoint | Key param | Note |
|----------|-----------|------|
| `GetBattleList` | `size: N` | Returns last N matches |
| `GetBattleDetail` | `apEventId` | **Use `apEventId`, not `matchId`** |
| `GetBattleReport` | `sid, queueID` | Season summary |
| `GetChampion` | — | All-agent historical stats |

`GetBattleDetail` returns full 10-player data including headshot counts, KAST, economy score, clutch count, etc.

### Cookie Auth State Machine

Server tracks cookie validity. If a WeGame API call returns 401/unauthorized, the server sets a flag. The frontend polls this flag and renders a red banner prompting the user to re-run the local sync script.

## Key Domain Notes

- `apEventId` ≠ `matchId` — always use `apEventId` to fetch match details.
- Dedup key in DB is `matchId` (from list response), but detail fetch uses `apEventId`.
- RR change field: `CompetitiveTierRankedRatingEarned` (long name, from list response).
- Cookie source: Chrome must be launched with `--remote-debugging-port=9222 --user-data-dir=<actual profile path>` for CDP to work.
- Ranked-only fields (tier, RR) are absent for unranked queue matches — handle nulls.
