# Frontend Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the VaTrack frontend with official Chinese localization, fixed win-rate stats (competitive only), redesigned BattleList cards with pagination/filters, expanded BattleDetail with two-tab scoreboard, and a multi-chart TrendStats dashboard.

**Architecture:** Foundation-first — Tasks 1-5 create config files, a shared `useGameData` hook, and backend fixes that all UI tasks depend on. Tasks 6-10 are independent UI pages that consume the foundation. Use the frontend-design skill when implementing UI tasks.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React 19 + TypeScript + Recharts + Vite (frontend), SQLite

**Spec:** `docs/superpowers/specs/2026-05-16-frontend-overhaul-design.md`

---

## File Map

**Create:**
- `frontend/src/config/agents.json`
- `frontend/src/config/maps.json`
- `frontend/src/config/queues.json`
- `frontend/src/hooks/useGameData.ts`

**Modify:**
- `backend/app/routers/battles.py` — add map_id/character_id filters, rounds fields, /filters endpoint
- `backend/app/routers/stats.py` — competitive filter on agents/maps, add character_id to trends
- `frontend/src/api/client.ts` — updated types and API functions
- `frontend/src/pages/AgentStats.tsx` — useGameData + competitive filter + sorting
- `frontend/src/pages/MapStats.tsx` — useGameData + competitive filter + sorting
- `frontend/src/pages/BattleList.tsx` — rich cards + filter bar + backend pagination
- `frontend/src/pages/TrendStats.tsx` — 4-chart dashboard + RR reconstruction
- `frontend/src/pages/BattleDetail.tsx` — hero banner + two-tab scoreboard

---

## Task 1: Create agent/map/queue config JSON files

**Files:**
- Create: `frontend/src/config/agents.json`
- Create: `frontend/src/config/maps.json`
- Create: `frontend/src/config/queues.json`

- [ ] **Step 1: Fetch official agent data from valorant-api.com**

```bash
curl "https://valorant-api.com/v1/agents?language=zh-CN&isPlayableCharacter=true" > /tmp/agents_raw.json
```

Parse the response. Each agent has `uuid`, `displayName` (Chinese), `background` (ignored), and `displayIcon`. We need `uuid` and `displayName` (Chinese name), plus the English name from a second call:

```bash
curl "https://valorant-api.com/v1/agents?isPlayableCharacter=true" > /tmp/agents_en.json
```

- [ ] **Step 2: Create `frontend/src/config/agents.json`**

Build a dict keyed by lowercase UUID. Use zh-CN `displayName` for `name_cn`, English `displayName` for `name_en`. For `color`, use the first entry of `backgroundGradientColors` from the API (a hex string without `#` — prepend `#`).

The file must include ALL playable agents. Critical ones currently showing as UUIDs (from screenshot):
- `22697a3d-45bf-8dd7-4fec-84a9e28c69d7` → 尚勃勃 (Chamber)
- `eb93336a-449b-9c1b-0a54-a891f7921d69` → 不死鸟 (Phoenix)  
- `1dbf2edd-4729-0984-3115-daa5eed44993` → 珂樂芙 (Clove)
- `df1cb487-4902-002e-5c17-d28e83e78588` → 禁灭 (Waylay)
- `efba5359-4016-a1e5-7626-b1ae76895940` → 维斯 (Vyse)
- `7c8a4701-4de6-9355-b254-e09bc2a34b72` → (fetch from API)

Example structure:
```json
{
  "9f0d8ba9-4140-b941-57d3-a7ad57c6b417": {
    "name_cn": "烈焰",
    "name_en": "Brimstone",
    "color": "#5d7fb2"
  },
  "add6443a-41bd-e414-f6ad-e58d267f4e95": {
    "name_cn": "捷特",
    "name_en": "Jett",
    "color": "#d4e0e3"
  }
}
```

Note: Use the UUIDs from the API response, not from the old `AGENT_NAMES` dict in `AgentStats.tsx` (several UUIDs there are wrong — the API is authoritative).

- [ ] **Step 3: Fetch official map data**

```bash
curl "https://valorant-api.com/v1/maps?language=zh-CN" > /tmp/maps_raw.json
```

- [ ] **Step 4: Create `frontend/src/config/maps.json`**

Key by the English display name (e.g. `"Bind"`) since the backend already converts map paths to English names via `MAP_NAMES` in `battles.py`. The frontend receives `map_name` (English) and looks up the Chinese name.

```json
{
  "Bind":     { "name_cn": "绑定" },
  "Haven":    { "name_cn": "避风港" },
  "Split":    { "name_cn": "裂隙" },
  "Icebox":   { "name_cn": "冰箱" },
  "Breeze":   { "name_cn": "微风" },
  "Fracture": { "name_cn": "断层" },
  "Pearl":    { "name_cn": "珍珠" },
  "Lotus":    { "name_cn": "莲花" },
  "Sunset":   { "name_cn": "落日" },
  "Abyss":    { "name_cn": "深渊" }
}
```

Verify Chinese names against the valorant-api.com response; correct as needed.

- [ ] **Step 5: Create `frontend/src/config/queues.json`**

```json
{
  "competitive":    "竞技",
  "unrated":        "非排位",
  "spikerush":      "辐能抢攻",
  "deathmatch":     "死斗",
  "swiftplay":      "极速",
  "premier":        "甲级联赛",
  "teamdeathmatch": "团队死斗",
  "newmap":         "新地图"
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/config/
git commit -m "feat: add agent/map/queue localization config JSON files"
```

---

## Task 2: Create useGameData hook

**Files:**
- Create: `frontend/src/hooks/useGameData.ts`

- [ ] **Step 1: Create the hook**

```typescript
// frontend/src/hooks/useGameData.ts
import agents from '../config/agents.json';
import maps from '../config/maps.json';
import queues from '../config/queues.json';

type AgentEntry = { name_cn: string; name_en: string; color: string };
type MapEntry   = { name_cn: string };

const agentsMap = agents as Record<string, AgentEntry>;
const mapsMap   = maps   as Record<string, MapEntry>;
const queuesMap = queues as Record<string, string>;

export function useGameData() {
  const agentName  = (uuid: string): string => agentsMap[uuid?.toLowerCase()]?.name_cn ?? uuid?.slice(0, 8) ?? '—';
  const agentColor = (uuid: string): string => agentsMap[uuid?.toLowerCase()]?.color   ?? '#555555';
  const mapName    = (en: string):   string => mapsMap[en]?.name_cn  ?? en;
  const queueName  = (id: string):   string => queuesMap[id]         ?? id;
  return { agentName, agentColor, mapName, queueName };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useGameData.ts
git commit -m "feat: add useGameData hook for agent/map/queue localization"
```

---

## Task 3: Backend — battles.py updates

**Files:**
- Modify: `backend/app/routers/battles.py`

Changes: add `map_id` and `character_id` filters to `GET /battles`, add `rounds_won`/`total_rounds` to `_match_summary`, add `GET /battles/filters` endpoint.

- [ ] **Step 1: Update `_match_summary` to include rounds**

In `battles.py`, modify `_match_summary`:

```python
def _match_summary(m: Match) -> dict:
    return {
        "match_id": m.match_id,
        "queue_id": m.queue_id,
        "map_id": m.map_id,
        "map_name": map_name(m.map_id),
        "character_id": m.character_id,
        "started_at": m.started_at,
        "duration_seconds": m.duration_seconds,
        "won_match": m.won_match,
        "rounds_won": m.rounds_won,
        "total_rounds": m.total_rounds,
        "kills": m.kills,
        "deaths": m.deaths,
        "assists": m.assists,
        "acs": m.acs,
        "is_mvp": m.is_mvp,
        "is_svp": m.is_svp,
        "first_kills": m.first_kills,
        "rr_change": m.rr_change,
        "tier_before": m.tier_before,
        "tier_after": m.tier_after,
    }
```

- [ ] **Step 2: Update `list_battles` to add map_id and character_id filters**

Replace the existing `list_battles` function:

```python
@router.get("/battles")
def list_battles(
    queue: str | None = None,
    map_id: str | None = None,
    character_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Match).order_by(Match.started_at.desc())
    if queue:
        q = q.filter(Match.queue_id == queue)
    if map_id:
        q = q.filter(Match.map_id == map_id)
    if character_id:
        q = q.filter(Match.character_id == character_id)
    total = q.count()
    matches = q.offset(skip).limit(limit).all()
    return {
        "total": total,
        "matches": [_match_summary(m) for m in matches],
    }
```

- [ ] **Step 3: Add `/battles/filters` endpoint**

Add this route before `list_battles` (FastAPI matches routes in order; `/battles/filters` must come before `/battles/{match_id}`):

```python
@router.get("/battles/filters")
def get_battle_filters(db: Session = Depends(get_db)):
    from sqlalchemy import distinct
    queues = [r[0] for r in db.query(distinct(Match.queue_id)).filter(Match.queue_id.isnot(None)).all()]
    # Return maps with both raw map_id (for filtering) and English display name (for frontend lookup)
    raw_map_ids = [r[0] for r in db.query(distinct(Match.map_id)).filter(Match.map_id.isnot(None)).all()]
    maps = [{"id": mid, "name": map_name(mid)} for mid in raw_map_ids]
    char_ids = [r[0] for r in db.query(distinct(Match.character_id)).filter(Match.character_id.isnot(None)).all()]
    return {"queues": queues, "maps": maps, "character_ids": char_ids}
```

- [ ] **Step 4: Also add `rounds_won` and `total_rounds` to `get_battle` response**

In the `get_battle` function, add to the returned dict:

```python
    return {
        "match_id": match.match_id,
        "ap_event_id": match.ap_event_id,
        "queue_id": match.queue_id,
        "map_id": match.map_id,
        "map_name": map_name(match.map_id),
        "character_id": match.character_id,
        "started_at": match.started_at,
        "duration_seconds": match.duration_seconds,
        "won_match": match.won_match,
        "rounds_won": match.rounds_won,
        "total_rounds": match.total_rounds,
        "kills": match.kills,
        "deaths": match.deaths,
        "assists": match.assists,
        "acs": match.acs,
        "is_mvp": match.is_mvp,
        "is_svp": match.is_svp,
        "rr_change": match.rr_change,
        "tier_before": match.tier_before,
        "tier_after": match.tier_after,
        "players": players,
    }
```

- [ ] **Step 5: Start backend and verify**

```bash
cd backend && uvicorn app.main:app --reload
```

Test:
```bash
curl "http://localhost:8000/api/battles/filters"
# Expected: {"queues": [...], "map_ids": [...], "character_ids": [...]}

curl "http://localhost:8000/api/battles?queue=competitive&limit=2"
# Expected: {"total": N, "matches": [...]} with rounds_won and total_rounds fields
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/battles.py
git commit -m "feat: add map/character filters, rounds fields, and filters endpoint to battles router"
```

---

## Task 4: Backend — stats.py updates

**Files:**
- Modify: `backend/app/routers/stats.py`

Changes: add `.filter(Match.queue_id == "competitive")` to agents and maps stats, add `character_id` to trends response.

- [ ] **Step 1: Add competitive filter to agent_stats**

In `stats.py`, in `agent_stats()`, add `.filter(Match.queue_id == "competitive")` after `.filter(Match.character_id.isnot(None))`:

```python
    rows = (
        db.query(...)
        .filter(Match.character_id.isnot(None))
        .filter(Match.queue_id == "competitive")
        .group_by(Match.character_id)
        .order_by(func.count().desc())
        .all()
    )
```

- [ ] **Step 2: Add competitive filter to map_stats**

Same change in `map_stats()`:

```python
    rows = (
        db.query(...)
        .filter(Match.map_id.isnot(None))
        .filter(Match.queue_id == "competitive")
        .group_by(Match.map_id)
        .order_by(func.count().desc())
        .all()
    )
```

- [ ] **Step 3: Add character_id to trend_stats response**

In `trend_stats()`, update the return list comprehension:

```python
    return [
        {
            "match_id": m.match_id,
            "started_at": m.started_at,
            "map_name": map_name(m.map_id),
            "character_id": m.character_id,
            "won_match": m.won_match,
            "kills": m.kills,
            "deaths": m.deaths,
            "assists": m.assists,
            "rr_change": m.rr_change,
            "tier_after": m.tier_after,
        }
        for m in rows
    ]
```

- [ ] **Step 4: Verify**

```bash
curl "http://localhost:8000/api/stats/agents"
# Expected: only competitive matches counted

curl "http://localhost:8000/api/stats/trends?days=30"
# Expected: each item now has "character_id" and "assists" fields
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/stats.py
git commit -m "fix: filter agent/map stats to competitive only; add character_id and assists to trends"
```

---

## Task 5: Update frontend client.ts

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Update `MatchSummary` interface**

Add `rounds_won` and `total_rounds`:

```typescript
export interface MatchSummary {
  match_id: string;
  queue_id: string;
  map_id: string;
  map_name: string;
  character_id: string;
  started_at: number;
  duration_seconds: number;
  won_match: boolean;
  rounds_won: number | null;
  total_rounds: number | null;
  kills: number;
  deaths: number;
  assists: number;
  acs: number | null;
  is_mvp: boolean;
  is_svp: boolean;
  first_kills: number;
  rr_change: number | null;
  tier_before: number | null;
  tier_after: number | null;
}
```

- [ ] **Step 2: Update `MatchDetail` to include rounds**

`MatchDetail extends MatchSummary` so rounds fields are inherited automatically. Add `economy_score` to `Player`:

```typescript
export interface Player {
  subject: string;
  name: string | null;
  team_id: string;
  character_id: string;
  kills: number;
  deaths: number;
  assists: number;
  acs: number | null;
  is_match_mvp: boolean;
  is_team_mvp: boolean;
  headshots: number;
  bodyshots: number;
  legshots: number;
  hs_pct: number | null;
  total_damage: number;
  kast: number | null;
  economy_score: number | null;
  first_kills: number | null;
  triple_kills: number | null;
  quadra_kills: number | null;
  penta_kills: number | null;
  clutch_count: number | null;
  bomb_plants: number | null;
  bomb_defuses: number | null;
  is_friend: boolean;
}
```

- [ ] **Step 3: Update `TrendMatch` interface**

Add `character_id` and `assists`:

```typescript
export interface TrendMatch {
  match_id: string;
  started_at: number;
  map_name: string;
  character_id: string | null;
  won_match: boolean;
  kills: number;
  deaths: number;
  assists: number;
  rr_change: number | null;
  tier_after: number | null;
}
```

- [ ] **Step 4: Update `BattleListResponse` and `getBattles`**

```typescript
export interface BattleListFilters {
  queues: string[];
  maps: { id: string; name: string }[];   // id = raw map_id path, name = English display name
  character_ids: string[];
}

export interface BattleListParams {
  queue?: string;
  map_id?: string;
  character_id?: string;
  skip?: number;
  limit?: number;
}

export const getBattles = (params: BattleListParams = {}) =>
  client.get<BattleListResponse>('/battles', { params });

export const getBattleFilters = () =>
  client.get<BattleListFilters>('/battles/filters');
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Fix any type errors before proceeding.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: update client types for rounds, economy_score, battle filters API"
```

---

## Task 6: AgentStats — localization + competitive filter + sorting

**Files:**
- Modify: `frontend/src/pages/AgentStats.tsx`

Note: The competitive filter is already applied on the backend (Task 4). This task is purely frontend.

- [ ] **Step 1: Invoke frontend-design skill**

Before writing code, invoke the `frontend-design` skill to guide the UI implementation.

- [ ] **Step 2: Rewrite AgentStats.tsx**

Replace the entire file. Key changes:
- Remove local `AGENT_NAMES` dict and `agentName()` function — use `useGameData` hook
- Add sort state: `sortKey` (column name) and `sortDir` (`'asc' | 'desc'`)
- Clickable column headers toggle sort

```typescript
import { useEffect, useState } from 'react';
import { getAgentStats } from '../api/client';
import type { AgentStat } from '../api/client';
import { useGameData } from '../hooks/useGameData';

type SortKey = 'played' | 'wins' | 'win_rate' | 'avg_kills' | 'avg_deaths' | 'avg_assists' | 'kd_ratio';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'played',      label: '场次' },
  { key: 'wins',        label: '胜场' },
  { key: 'win_rate',    label: '胜率' },
  { key: 'avg_kills',   label: '均K' },
  { key: 'avg_deaths',  label: '均D' },
  { key: 'avg_assists', label: '均A' },
  { key: 'kd_ratio',    label: 'K/D' },
];

export default function AgentStats() {
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('played');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { agentName, agentColor } = useGameData();

  useEffect(() => {
    getAgentStats()
      .then(r => setStats(r.data))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...stats].sort((a, b) => {
    const v = a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0;
    return sortDir === 'asc' ? v : -v;
  });

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (stats.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无竞技数据</p>;

  const colTemplate = '1fr 60px 60px 60px 60px 60px 60px 60px';

  return (
    <div>
      <h2 style={{ marginBottom: 16, fontSize: 15, fontWeight: 'bold' }}>
        英雄统计
        <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 'normal', marginLeft: 8 }}>仅竞技模式</span>
      </h2>
      <div style={{ background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: colTemplate,
          padding: '6px 12px', color: 'var(--muted)', fontSize: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <span>英雄</span>
          {COLUMNS.map(c => (
            <span
              key={c.key}
              onClick={() => handleSort(c.key)}
              style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                color: sortKey === c.key ? 'var(--text)' : 'var(--muted)' }}
            >
              {c.label}{sortKey === c.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
            </span>
          ))}
        </div>
        {sorted.map(s => (
          <div
            key={s.character_id}
            style={{
              display: 'grid', gridTemplateColumns: colTemplate,
              padding: '8px 12px', borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${agentColor(s.character_id)}`,
              fontSize: 13, alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text)' }}>{agentName(s.character_id)}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.played}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.wins}</span>
            <span style={{ textAlign: 'center', color: s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)' }}>{s.win_rate}%</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.avg_kills}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.avg_deaths}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.avg_assists}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.kd_ratio}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Start dev server: `cd frontend && npm run dev`

Navigate to 英雄统计. Verify:
- No UUID rows — all agents show Chinese names
- Clicking column headers sorts ascending/descending
- Arrow indicator shows active sort
- Header shows "仅竞技模式"

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AgentStats.tsx
git commit -m "feat: AgentStats — Chinese names, competitive filter notice, column sorting"
```

---

## Task 7: MapStats — localization + sorting

**Files:**
- Modify: `frontend/src/pages/MapStats.tsx`

- [ ] **Step 1: Rewrite MapStats.tsx**

```typescript
import { useEffect, useState } from 'react';
import { getMapStats } from '../api/client';
import type { MapStat } from '../api/client';
import { useGameData } from '../hooks/useGameData';

type SortKey = 'played' | 'wins' | 'win_rate' | 'avg_kills' | 'avg_deaths' | 'avg_assists';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'played',      label: '场次' },
  { key: 'wins',        label: '胜场' },
  { key: 'win_rate',    label: '胜率' },
  { key: 'avg_kills',   label: '均K' },
  { key: 'avg_deaths',  label: '均D' },
  { key: 'avg_assists', label: '均A' },
];

export default function MapStats() {
  const [stats, setStats] = useState<MapStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('played');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { mapName } = useGameData();

  useEffect(() => {
    getMapStats()
      .then(r => setStats(r.data))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...stats].sort((a, b) => {
    const v = a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0;
    return sortDir === 'asc' ? v : -v;
  });

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (stats.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无竞技数据</p>;

  const colTemplate = '1fr 60px 60px 60px 60px 60px 60px';

  return (
    <div>
      <h2 style={{ marginBottom: 16, fontSize: 15, fontWeight: 'bold' }}>
        地图统计
        <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 'normal', marginLeft: 8 }}>仅竞技模式</span>
      </h2>
      <div style={{ background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: colTemplate,
          padding: '6px 12px', color: 'var(--muted)', fontSize: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <span>地图</span>
          {COLUMNS.map(c => (
            <span
              key={c.key}
              onClick={() => handleSort(c.key)}
              style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                color: sortKey === c.key ? 'var(--text)' : 'var(--muted)' }}
            >
              {c.label}{sortKey === c.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
            </span>
          ))}
        </div>
        {sorted.map(s => (
          <div
            key={s.map_id}
            style={{
              display: 'grid', gridTemplateColumns: colTemplate,
              padding: '8px 12px', borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)'}`,
              fontSize: 13, alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text)' }}>{mapName(s.map_name)}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.played}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.wins}</span>
            <span style={{ textAlign: 'center', color: s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)' }}>{s.win_rate}%</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.avg_kills}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.avg_deaths}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.avg_assists}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to 地图统计. Verify Chinese map names, sorting works, "仅竞技模式" label shows.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/MapStats.tsx
git commit -m "feat: MapStats — Chinese names, competitive filter notice, column sorting"
```

---

## Task 8: BattleList — rich cards + filter bar + pagination

**Files:**
- Modify: `frontend/src/pages/BattleList.tsx`

- [ ] **Step 1: Invoke frontend-design skill**

Before writing code, invoke the `frontend-design` skill to guide the UI.

- [ ] **Step 2: Rewrite BattleList.tsx**

```typescript
import { useEffect, useState } from 'react';
import { getBattles, getBattleFilters } from '../api/client';
import type { MatchSummary, BattleListFilters } from '../api/client';
import { useGameData } from '../hooks/useGameData';

const PAGE_SIZE = 20;

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600)  return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 2) return '昨天';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Props {
  onSelectMatch: (id: string) => void;
}

export default function BattleList({ onSelectMatch }: Props) {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<BattleListFilters>({ queues: [], maps: [], character_ids: [] });
  const [queue, setQueue] = useState('');
  const [mapId, setMapId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { agentName, agentColor, mapName, queueName } = useGameData();

  useEffect(() => {
    getBattleFilters().then(r => setFilters(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const skip = (page - 1) * PAGE_SIZE;
    getBattles({ queue: queue || undefined, map_id: mapId || undefined,
                 character_id: characterId || undefined, skip, limit: PAGE_SIZE })
      .then(r => { setMatches(r.data.matches); setTotal(r.data.total); })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [queue, mapId, characterId, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '5px 8px', fontSize: 12, cursor: 'pointer',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={queue} onChange={handleFilterChange(setQueue)} style={selectStyle}>
          <option value="">全部模式</option>
          {filters.queues.map(q => <option key={q} value={q}>{queueName(q)}</option>)}
        </select>
        <select value={mapId} onChange={handleFilterChange(setMapId)} style={selectStyle}>
          <option value="">全部地图</option>
          {filters.maps.map(m => <option key={m.id} value={m.id}>{mapName(m.name)}</option>)}
        </select>
        <select value={characterId} onChange={handleFilterChange(setCharacterId)} style={selectStyle}>
          <option value="">全部英雄</option>
          {filters.character_ids.map(id => <option key={id} value={id}>{agentName(id)}</option>)}
        </select>
        <span style={{ color: 'var(--muted)', fontSize: 12, alignSelf: 'center', marginLeft: 'auto' }}>
          共 {total} 场
        </span>
      </div>

      {loading && <p style={{ color: 'var(--muted)' }}>加载中...</p>}
      {error   && <p style={{ color: 'var(--loss)' }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {matches.map(m => {
          const isDm = m.queue_id === 'deathmatch';
          const resultColor = isDm ? 'var(--muted)' : m.won_match ? 'var(--win)' : 'var(--loss)';
          const rrLabel = m.rr_change != null
            ? (m.rr_change >= 0 ? `+${m.rr_change}` : `${m.rr_change}`)
            : null;
          const color = agentColor(m.character_id);

          return (
            <div
              key={m.match_id}
              onClick={() => onSelectMatch(m.match_id)}
              style={{
                background: 'var(--surface)', borderLeft: `3px solid ${resultColor}`,
                borderRadius: 6, padding: '10px 14px',
                display: 'grid',
                gridTemplateColumns: '20px 100px 90px 70px 60px 80px 52px 80px',
                alignItems: 'center', gap: 12, cursor: 'pointer',
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 2, background: color, flexShrink: 0 }} />
              <div style={{ fontSize: 13, fontWeight: 500 }}>{agentName(m.character_id)}</div>
              <div style={{ fontSize: 13 }}>{mapName(m.map_name)}</div>
              <div style={{ color: 'var(--muted)', fontSize: 11 }}>{queueName(m.queue_id)}</div>
              <div style={{ color: resultColor, fontSize: 12, fontWeight: 'bold' }}>
                {isDm ? 'DM' : m.won_match ? '胜' : '负'}
              </div>
              <div style={{ fontSize: 12 }}>
                <span>{m.kills}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span style={{ color: 'var(--loss)' }}>{m.deaths}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span>{m.assists}</span>
              </div>
              <div style={{
                textAlign: 'right', fontWeight: 'bold', fontSize: 12,
                color: !rrLabel ? 'var(--muted)' : m.rr_change! >= 0 ? 'var(--win)' : 'var(--loss)',
              }}>
                {rrLabel ?? '—'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'right' }}>
                {relativeTime(m.started_at)}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16, alignItems: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
              borderRadius: 4, padding: '4px 10px', cursor: page === 1 ? 'default' : 'pointer' }}
          >←</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = page <= 4 ? i + 1 : page + i - 3;
            if (p < 1 || p > totalPages) return null;
            return (
              <button key={p} onClick={() => setPage(p)}
                style={{ background: p === page ? 'var(--accent)' : 'var(--surface)',
                  border: '1px solid var(--border)', color: 'var(--text)',
                  borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
              >{p}</button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
              borderRadius: 4, padding: '4px 10px', cursor: page === totalPages ? 'default' : 'pointer' }}
          >→</button>
        </div>
      )}
    </div>
  );
}
```

The map filter dropdown uses `filters.maps` which provides both `id` (full path, used as filter value) and `name` (English display name like "Bind"). `mapName(m.name)` converts English → Chinese via `maps.json`.

- [ ] **Step 3: Verify in browser**

- All match cards show Chinese agent name + color block
- Filter dropdowns show Chinese names
- Pagination appears and works
- Filter change resets to page 1

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/BattleList.tsx
git commit -m "feat: BattleList — rich cards, filter bar (queue/map/agent), backend pagination"
```

---

## Task 9: TrendStats — 4-chart dashboard with RR reconstruction

**Files:**
- Modify: `frontend/src/pages/TrendStats.tsx`

- [ ] **Step 1: Invoke frontend-design skill**

Before writing code, invoke the `frontend-design` skill.

- [ ] **Step 2: Define RR anchor and tier map constants**

At the top of `TrendStats.tsx` (before the component), add:

```typescript
// Update when your rank changes significantly or a new season starts.
// Platinum 2 = tier 14 in Valorant's tier system, 6 RR as of 2026-05-16.
const RR_ANCHOR = { tier: 14, rr: 6 };

// Valorant tier IDs (check actual values in your DB via tier_after column)
// These are approximate — verify against actual DB values
const TIER_NAMES: Record<number, string> = {
  0: '无级', 3: '铁牌1', 4: '铁牌2', 5: '铁牌3',
  6: '青铜1', 7: '青铜2', 8: '青铜3',
  9: '白银1', 10: '白银2', 11: '白银3',
  12: '黄金1', 13: '黄金2', 14: '黄金3',
  15: '铂金1', 16: '铂金2', 17: '铂金3',  // ← adjust if needed
  18: '钻石1', 19: '钻石2', 20: '钻石3',
  21: '超凡1', 22: '超凡2', 23: '超凡3',
  24: '不朽1', 25: '不朽2', 26: '不朽3',
  27: '辉耀',
};

// Verify RR_ANCHOR.tier by checking: what does tier_after show for your most recent competitive match?
// Run: curl "http://localhost:8000/api/stats/trends?days=7" and check tier_after values.
```

**Important:** Before implementing, query the actual tier values in your DB:
```bash
curl "http://localhost:8000/api/stats/trends?days=7" | python3 -m json.tool | grep tier_after
```
Use the actual tier IDs to correct `TIER_NAMES` and `RR_ANCHOR.tier`.

- [ ] **Step 3: Write RR reconstruction function**

```typescript
interface RRPoint {
  date: string;
  absRR: number;        // tier * 100 + rr_within_tier
  tierLabel: string;    // e.g. "铂金2"
  rrChange: number;
  matchId: string;
}

function buildRRData(matches: TrendMatch[]): RRPoint[] {
  // matches are in ascending time order (oldest first)
  const competitive = matches.filter(m => m.rr_change !== null && m.tier_after !== null);
  if (competitive.length === 0) return [];

  // Find anchor index: most recent match should end at RR_ANCHOR state
  // Walk backwards from newest to oldest, reconstructing rr_within_tier
  const points: RRPoint[] = new Array(competitive.length);
  let currentAbsRR = RR_ANCHOR.tier * 100 + RR_ANCHOR.rr;

  for (let i = competitive.length - 1; i >= 0; i--) {
    const m = competitive[i];
    const tier = m.tier_after!;
    // absRR at end of this match = currentAbsRR (we'll reconstruct backwards)
    points[i] = {
      date: formatDate(m.started_at),
      absRR: currentAbsRR,
      tierLabel: TIER_NAMES[tier] ?? `段位${tier}`,
      rrChange: m.rr_change!,
      matchId: m.match_id,
    };
    // Before this match: absRR was currentAbsRR - rr_change
    // But handle demotion: if tier_before < tier_after (promotion) or vice versa,
    // the boundary is at tier * 100 boundaries. For simplicity, just subtract.
    currentAbsRR = currentAbsRR - m.rr_change!;
  }
  return points;
}
```

- [ ] **Step 4: Write KDA chart data function**

```typescript
interface KDAPoint {
  date: string;
  kills: number;
  deaths: number;
  assists: number;
}

function buildKDAData(matches: TrendMatch[]): KDAPoint[] {
  return matches.map(m => ({
    date: formatDate(m.started_at),
    kills: m.kills,
    deaths: m.deaths,
    assists: m.assists,
  }));
}
```

- [ ] **Step 5: Write agent distribution data function**

```typescript
interface AgentBar {
  name: string;
  wins: number;
  losses: number;
  total: number;
}

function buildAgentData(matches: TrendMatch[], agentNameFn: (uuid: string) => string): AgentBar[] {
  const map = new Map<string, { wins: number; losses: number }>();
  for (const m of matches) {
    if (!m.character_id) continue;
    const entry = map.get(m.character_id) ?? { wins: 0, losses: 0 };
    if (m.won_match) entry.wins++; else entry.losses++;
    map.set(m.character_id, entry);
  }
  return Array.from(map.entries())
    .map(([uuid, v]) => ({ name: agentNameFn(uuid), wins: v.wins, losses: v.losses, total: v.wins + v.losses }))
    .sort((a, b) => b.total - a.total);
}
```

- [ ] **Step 6: Rewrite TrendStats component**

```typescript
import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { getTrendStats } from '../api/client';
import type { TrendMatch } from '../api/client';
import { useGameData } from '../hooks/useGameData';

// ... (paste constants and functions from steps 2-5 above)

type DayRange = 7 | 30 | 0; // 0 = all

export default function TrendStats() {
  const [allMatches, setAllMatches] = useState<TrendMatch[]>([]);
  const [days, setDays] = useState<DayRange>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { agentName, mapName } = useGameData();

  useEffect(() => {
    setLoading(true);
    getTrendStats(days === 0 ? 3650 : days)
      .then(r => setAllMatches(r.data))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (allMatches.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无竞技数据</p>;

  const rrData    = buildRRData(allMatches);
  const kdaData   = buildKDAData(allMatches);
  const agentData = buildAgentData(allMatches, agentName);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--accent)' : 'var(--surface)',
    border: '1px solid var(--border)', color: 'var(--text)',
    borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
  });

  const chartCard: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 6, padding: '16px 8px', marginBottom: 16,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 'bold', margin: 0 }}>趋势统计</h2>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {([7, 30, 0] as DayRange[]).map(d => (
            <button key={d} onClick={() => setDays(d)} style={btnStyle(days === d)}>
              {d === 0 ? '全部' : `${d}天`}
            </button>
          ))}
        </div>
      </div>

      {/* Chart 1: RR Trend */}
      <div style={chartCard}>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 8, paddingLeft: 8 }}>段位走势</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rrData}>
            <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
            <YAxis
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              tickFormatter={(v: number) => TIER_NAMES[Math.floor(v / 100)] ?? `${v}`}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }}
              formatter={(value: number, name: string) => {
                if (name === 'absRR') {
                  const tier = TIER_NAMES[Math.floor(value / 100)] ?? '';
                  const rr = value % 100;
                  return [`${tier} ${rr}分`, '段位'];
                }
                return [value, name];
              }}
            />
            <Line type="monotone" dataKey="absRR" stroke="#ff4655" dot={{ r: 3, fill: '#ff4655' }}
              strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: KDA Trend */}
      <div style={chartCard}>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 8, paddingLeft: 8 }}>KDA 趋势</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={kdaData}>
            <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }} />
            <Line type="monotone" dataKey="kills"   stroke="#5bc0eb" dot={false} strokeWidth={2} isAnimationActive={false} name="击杀" />
            <Line type="monotone" dataKey="deaths"  stroke="#ff4655" dot={false} strokeWidth={2} isAnimationActive={false} name="死亡" />
            <Line type="monotone" dataKey="assists" stroke="#4caf50" dot={false} strokeWidth={2} isAnimationActive={false} name="助攻" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Agent Distribution */}
      <div style={chartCard}>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 8, paddingLeft: 8 }}>英雄使用分布</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={agentData}>
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }} />
            <Bar dataKey="wins"   name="胜" stackId="a" fill="var(--win)"  isAnimationActive={false} />
            <Bar dataKey="losses" name="负" stackId="a" fill="var(--loss)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Win/Loss Streak */}
      <div style={chartCard}>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 8, paddingLeft: 8 }}>胜负连续（旧→新）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '0 8px' }}>
          {allMatches.map(m => (
            <div
              key={m.match_id}
              title={`${mapName(m.map_name)} ${m.kills}/${m.deaths}/${m.assists}`}
              style={{
                width: 14, height: 14, borderRadius: 2,
                background: m.won_match ? 'var(--win)' : 'var(--loss)',
                opacity: 0.85,
                cursor: 'default',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify tier IDs and adjust TIER_NAMES**

Run the backend and check what tier values appear:
```bash
curl "http://localhost:8000/api/stats/trends?days=365" | python3 -c "import json,sys; data=json.load(sys.stdin); [print(m['tier_after']) for m in data if m['tier_after']]"
```

Adjust `TIER_NAMES` and `RR_ANCHOR.tier` to match actual values. The RR chart y-axis should now show tier names instead of raw numbers, and the most recent point should be at approximately Platinum 2 / 6 RR.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/TrendStats.tsx
git commit -m "feat: TrendStats — 4-chart dashboard (RR/KDA/agent/streak) with time range selector"
```

---

## Task 10: BattleDetail — hero banner + two-tab scoreboard

**Files:**
- Modify: `frontend/src/pages/BattleDetail.tsx`

- [ ] **Step 1: Invoke frontend-design skill**

Before writing code, invoke the `frontend-design` skill.

- [ ] **Step 2: Rewrite BattleDetail.tsx**

```typescript
import { useEffect, useState } from 'react';
import { getBattle } from '../api/client';
import type { MatchDetail, Player } from '../api/client';
import { useGameData } from '../hooks/useGameData';

function formatDuration(secs: number): string {
  return `${Math.floor(secs / 60)}分${String(secs % 60).padStart(2, '0')}秒`;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

type Tab = '战绩' | '特殊';

function StatCell({ value, align = 'center' }: { value: string | number | null | undefined; align?: string }) {
  const display = value == null || value === 0 ? '—' : String(value);
  return (
    <div style={{ textAlign: align as React.CSSProperties['textAlign'], color: display === '—' ? 'var(--muted)' : 'var(--subtext)' }}>
      {display}
    </div>
  );
}

function multiKillColor(count: number | null | undefined): string | undefined {
  if (!count || count < 3) return undefined;
  if (count >= 5) return '#ff4655';
  if (count >= 4) return '#ff8c00';
  return '#f0a500';
}

function PlayerRow({ p, highlight, tab, agentNameFn }: {
  p: Player; highlight: boolean; tab: Tab; agentNameFn: (uuid: string) => string;
}) {
  const name = p.name ?? p.subject.slice(0, 8);
  const colPerf  = '80px 1fr 55px 80px 50px 70px 55px';
  const colSpecial = '80px 1fr 40px 40px 40px 40px 50px 40px 40px 55px';
  const cols = tab === '战绩' ? colPerf : colSpecial;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols,
      padding: '7px 12px', borderBottom: '1px solid var(--border)',
      background: highlight ? '#162536' : 'transparent',
      fontSize: 12, alignItems: 'center', gap: 4,
    }}>
      <div style={{ color: 'var(--subtext)', fontSize: 11 }}>{agentNameFn(p.character_id)}</div>
      <div>
        {name}
        {p.is_match_mvp && <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 5 }}>MVP</span>}
        {p.is_team_mvp && !p.is_match_mvp && <span style={{ color: '#f0a500', fontSize: 10, marginLeft: 5 }}>SVP</span>}
      </div>

      {tab === '战绩' ? <>
        <StatCell value={p.acs != null ? Math.round(p.acs) : null} />
        <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
          {p.kills}<span style={{ color: 'var(--muted)' }}>/</span>
          <span style={{ color: 'var(--loss)' }}>{p.deaths}</span>
          <span style={{ color: 'var(--muted)' }}>/</span>{p.assists}
        </div>
        <StatCell value={p.hs_pct != null ? `${p.hs_pct}%` : null} />
        <StatCell value={p.total_damage > 0 ? p.total_damage.toLocaleString() : null} />
        <StatCell value={p.kast != null ? `${Math.round(p.kast * 100)}%` : null} />
      </> : <>
        <StatCell value={p.first_kills} />
        <div style={{ textAlign: 'center', color: multiKillColor(p.triple_kills) ?? 'var(--muted)' }}>
          {p.triple_kills || '—'}
        </div>
        <div style={{ textAlign: 'center', color: multiKillColor(p.quadra_kills) ?? 'var(--muted)' }}>
          {p.quadra_kills || '—'}
        </div>
        <div style={{ textAlign: 'center', color: multiKillColor(p.penta_kills) ?? 'var(--muted)' }}>
          {p.penta_kills || '—'}
        </div>
        <StatCell value={p.clutch_count} />
        <StatCell value={p.bomb_plants} />
        <StatCell value={p.bomb_defuses} />
        <StatCell value={p.economy_score} />
      </>}
    </div>
  );
}

function TeamSection({ label, color, players, myCharacterId, tab, agentNameFn }: {
  label: string; color: string; players: Player[]; myCharacterId: string; tab: Tab;
  agentNameFn: (uuid: string) => string;
}) {
  const colPerf    = '80px 1fr 55px 80px 50px 70px 55px';
  const colSpecial = '80px 1fr 40px 40px 40px 40px 50px 40px 40px 55px';
  const cols = tab === '战绩' ? colPerf : colSpecial;

  const perfHeaders    = ['英雄', '玩家', 'ACS', 'K/D/A', 'HS%', '伤害', 'KAST%'];
  const specialHeaders = ['英雄', '玩家', '首杀', '三杀', '四杀', '五杀', 'Clutch', '种弹', '拆弹', '经济'];

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ background: color + '22', color, padding: '4px 12px', fontWeight: 'bold', fontSize: 11 }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '4px 12px',
        color: 'var(--muted)', fontSize: 10, borderBottom: '1px solid var(--border)', gap: 4 }}>
        {(tab === '战绩' ? perfHeaders : specialHeaders).map(h => (
          <span key={h} style={{ textAlign: h === '玩家' || h === '英雄' ? 'left' : 'center' }}>{h}</span>
        ))}
      </div>
      {players.map(p => (
        <PlayerRow key={p.subject} p={p} highlight={p.character_id === myCharacterId}
          tab={tab} agentNameFn={agentNameFn} />
      ))}
    </div>
  );
}

interface Props { matchId: string; onBack: () => void; }

export default function BattleDetail({ matchId, onBack }: Props) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('战绩');
  const { agentName, agentColor, mapName, queueName } = useGameData();

  useEffect(() => {
    setLoading(true);
    getBattle(matchId).then(r => setMatch(r.data)).catch(() => setError('加载失败')).finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error || !match) return <p style={{ color: 'var(--loss)' }}>{error ?? '加载失败'}</p>;

  const isDm = match.queue_id === 'deathmatch';
  const resultColor = match.won_match ? 'var(--win)' : 'var(--loss)';
  const rrLabel = match.rr_change != null
    ? (match.rr_change >= 0 ? `+${match.rr_change} RR` : `${match.rr_change} RR`)
    : null;
  const score = match.rounds_won != null && match.total_rounds != null
    ? `${match.rounds_won} : ${match.total_rounds - match.rounds_won}`
    : null;

  const myPlayer = match.players.find(p => p.character_id === match.character_id);
  const myTeamId = myPlayer?.team_id;
  const sorted = (ps: Player[]) => [...ps].sort((a, b) => (b.acs ?? b.kills) - (a.acs ?? a.kills));
  const myTeam  = sorted(match.players.filter(p => p.team_id === myTeamId));
  const enemies = sorted(match.players.filter(p => p.team_id !== myTeamId));

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '6px 20px', cursor: 'pointer', fontSize: 13, border: 'none',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent', color: tab === t ? 'var(--text)' : 'var(--muted)',
  });

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', marginBottom: 12 }}>
        ←
      </button>

      {/* Hero banner */}
      <div style={{
        background: 'var(--surface)', borderRadius: 8, padding: '16px 20px', marginBottom: 16,
        borderLeft: `4px solid ${resultColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <span style={{ color: resultColor, fontSize: 22, fontWeight: 'bold' }}>
            {isDm ? 'DM' : match.won_match ? '胜' : '负'}
          </span>
          {score && <span style={{ fontSize: 18, fontWeight: 'bold' }}>{score}</span>}
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {mapName(match.map_name)} · {queueName(match.queue_id)}
            {match.duration_seconds ? ` · ${formatDuration(match.duration_seconds)}` : ''}
            {match.started_at ? ` · ${formatDateTime(match.started_at)}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: agentColor(match.character_id) }} />
          <span style={{ fontWeight: 500 }}>{agentName(match.character_id)}</span>
          {myPlayer && <>
            <span style={{ color: 'var(--muted)' }}>
              {myPlayer.kills}/{myPlayer.deaths}/{myPlayer.assists}
            </span>
            {myPlayer.acs != null && (
              <span style={{ color: 'var(--muted)' }}>ACS {Math.round(myPlayer.acs)}</span>
            )}
          </>}
          {rrLabel && (
            <span style={{ color: match.rr_change! >= 0 ? 'var(--win)' : 'var(--loss)', fontWeight: 'bold' }}>
              {rrLabel}
            </span>
          )}
          {match.is_mvp && <span style={{ color: 'var(--accent)', fontSize: 11 }}>☆ MVP</span>}
          {match.is_svp && !match.is_mvp && <span style={{ color: '#f0a500', fontSize: 11 }}>☆ SVP</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
        {(['战绩', '特殊'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>{t}</button>
        ))}
      </div>

      {/* Scoreboard */}
      <div style={{ background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
        {isDm ? (
          <TeamSection label="所有玩家" color="var(--muted)"
            players={sorted(match.players)} myCharacterId={match.character_id}
            tab={tab} agentNameFn={agentName} />
        ) : (
          <>
            <TeamSection label="我方" color="var(--win)" players={myTeam}
              myCharacterId={match.character_id} tab={tab} agentNameFn={agentName} />
            <TeamSection label="对方" color="var(--loss)" players={enemies}
              myCharacterId={match.character_id} tab={tab} agentNameFn={agentName} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Open a match detail. Verify:
- Hero banner shows win/loss, score, agent name, KDA, RR, MVP badge
- 战绩 tab: all 10 players with ACS/KDA/HS%/伤害/KAST%
- 特殊 tab: first kills, multi-kills colored (yellow/orange/red), clutch, bomb, economy
- Zero values show as `—`
- Your row is highlighted

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/BattleDetail.tsx
git commit -m "feat: BattleDetail — hero banner, two-tab scoreboard (战绩/特殊)"
```

---

## Final: Build and deploy

- [ ] **Step 1: Production build**

```bash
cd frontend && npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 2: Deploy to server**

```bash
git push
```

On the server:
```bash
git pull && systemctl restart vatrack
```

- [ ] **Step 3: Smoke test on production**

Verify all 5 pages load and function correctly on `vatrack.edmund1z.cc`.
