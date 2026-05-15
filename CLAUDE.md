# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal Valorant match tracking dashboard for WeGame CN users. Deployed on a Hong Kong Linux server. Supports a small friend group (~5 users). Full design spec is in `valorant_tracker_tech_doc.md`.

## Development Workflow

Local Windows development → `git push` → HK Linux server deployment. All local tools (extension, cookie extractor) are never deployed to the server.

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

### Cookie Extractor (Node.js, local only — alternative to extension)
```bash
# Install deps
npm install

# Extract cookies via CDP and push to server
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
cookie-extractor/
  extension/               # Chrome extension — primary match sync method
    manifest.json          # MV3, host_permissions for wegame.com.cn + server IP
    content.js             # Injected into WeGame tab; calls GetBattleList/GetBattleDetail
    popup.js               # UI: fetches existing IDs from server, triggers content.js, pushes data
    popup.html
  scripts/
    sync_cookies.js        # Alternative: Node.js CDP → extract WeGame cookies → POST /api/cookies

backend/
  app/
    main.py                # FastAPI app, mounts routers
    models.py              # SQLAlchemy ORM (Match, MatchDetail, Player)
    database.py            # SQLite engine + session factory
    routers/
      battles.py           # GET /battles, GET /battles/{id}
      stats.py             # GET /stats/agents, /stats/maps, etc.
      sync.py              # GET /battles/ids, POST /sync (receives match data from extension)
      auth.py              # POST /cookies (receives cookies from CDP script — alternative path)
    services/
      wegame.py            # WeGame API client (used if server-side pull is ever needed)
      sync.py              # Scheduled hourly pull logic (TODO — not yet implemented)
    scheduler.py           # APScheduler hourly job (wired up, sync logic is TODO)

frontend/
  src/
    pages/                 # BattleList, BattleDetail, AgentStats, MapStats, TrendStats
    components/            # Sidebar, BattleCard, etc.
    api/client.ts          # Axios client + typed API functions
```

### Data Flow

**Primary (Chrome extension):**
1. User opens WeGame tab in Chrome and clicks the VaTrack Collector extension popup.
2. Extension calls `GET /api/battles/ids` to get all match IDs already on the server.
3. Content script calls `GetBattleList(size=100)` on WeGame, then `GetBattleDetail` for each new match.
4. Extension POSTs all new matches to `POST /api/sync` with the sync token.
5. Backend deduplicates by `matchId` and persists to SQLite.

**Alternative (CDP cookie sync + server-side pull — not currently active):**
1. `scripts/sync_cookies.js` reads Chrome cookies via CDP, POSTs to `/api/cookies`.
2. Stored cookies would allow the backend scheduler to call WeGame API server-side.
3. This path exists in code (`auth.py`, `services/wegame.py`, `scheduler.py`) but the scheduled pull logic in `services/sync.py` is not yet implemented.

### WeGame API

Base URL: `https://www.wegame.com.cn/api/v1/wegame.pallas.game.ValBattle/`

All endpoints are **HTTP POST with JSON body**. The extension calls them from the browser using `credentials: "include"` (browser cookies). The CDP path would pass cookies via `Cookie` header server-side.

| Endpoint | Key param | Note |
|----------|-----------|------|
| `GetBattleList` | `size: N` | Returns last N matches; extension uses size=100 |
| `GetBattleDetail` | `apEventId` | **Use `apEventId`, not `matchId`** |
| `GetBattleReport` | `sid, queueID` | Season summary |
| `GetChampion` | — | All-agent historical stats |

`GetBattleDetail` returns full 10-player data including headshot counts, KAST, economy score, clutch count, etc.

## Key Domain Notes

- `apEventId` ≠ `matchId` — always use `apEventId` to fetch match details.
- Dedup key in DB is `matchId` (from list response), but detail fetch uses `apEventId`.
- RR change field: `CompetitiveTierRankedRatingEarned` (long name, from list response).
- `character_id` values are standard Valorant UUIDs (e.g. `dade69b4-...`), not asset paths.
- Ranked-only fields (tier, RR) are absent for unranked queue matches — handle nulls.
