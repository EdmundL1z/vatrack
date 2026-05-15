# Stats Pages Design

**Goal:** Add three statistics pages (agent stats, map stats, RR trends) accessible via sidebar navigation.

**Architecture:** Three separate pages, each fetching from an existing backend endpoint. Sidebar gains two new nav buttons. RR trends page uses Recharts for a cumulative line chart. All UI is functional/schematic — visual polish deferred.

---

## Navigation

`App.tsx` `Page` type expands to `'list' | 'detail' | 'agents' | 'maps' | 'trends'`.

Sidebar replaces the single disabled "英雄统计" button with three buttons:
- 英雄统计 → `agents`
- 地图统计 → `maps`
- RR 趋势 → `trends`

All three are active (not disabled).

---

## API Layer (`frontend/src/api/client.ts`)

Three new interfaces and fetch functions added to the existing client:

```ts
export interface AgentStat {
  character_id: string;
  played: number;
  wins: number;
  win_rate: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  kd_ratio: number;
}

export interface MapStat {
  map_id: string;
  map_name: string;
  played: number;
  wins: number;
  win_rate: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
}

export interface TrendMatch {
  match_id: string;
  started_at: number;
  map_name: string;
  won_match: boolean;
  kills: number;
  deaths: number;
  rr_change: number | null;
  tier_after: number | null;
}
```

Fetch functions:
- `getAgentStats(): Promise<AgentStat[]>` — `GET /api/stats/agents`
- `getMapStats(): Promise<MapStat[]>` — `GET /api/stats/maps`
- `getTrendStats(days?: number): Promise<TrendMatch[]>` — `GET /api/stats/trends?days=30`

---

## AgentStats Page

**File:** `frontend/src/pages/AgentStats.tsx`

Fetches `/stats/agents`. Displays a table sorted by `played` descending.

Agent name extracted from `character_id`: take the second-to-last path segment (e.g. `/Game/Characters/Jett/Jett_PrimaryAsset` → `Jett`). If extraction fails, show the raw string truncated to 12 chars.

**Table columns:** 英雄 | 场数 | 胜率 | 平均K | 平均D | 平均A | K/D

Rows where `win_rate >= 50` get a subtle green left border (`var(--win)`); below 50 get red (`var(--loss)`).

---

## MapStats Page

**File:** `frontend/src/pages/MapStats.tsx` (new file)

Fetches `/stats/maps`. Same table pattern as AgentStats.

**Table columns:** 地图 | 场数 | 胜率 | 平均K | 平均D | 平均A

Win rate coloring: same rule as AgentStats (≥50 green border, <50 red).

---

## TrendStats Page

**File:** `frontend/src/pages/TrendStats.tsx` (new file)

Fetches `/stats/trends?days=30`. Only matches with `rr_change !== null` contribute to the chart.

**Chart:** Recharts `LineChart` with:
- X axis: formatted date (`M/D`)
- Y axis: cumulative RR (running sum of `rr_change`, starting from 0)
- Single `Line` with dot, color `var(--accent)` (`#ff4655`)
- `Tooltip` showing date + cumulative RR + that match's RR change
- `ReferenceLine` at y=0

**Below chart:** a table of all matches (with or without RR), columns: 日期 | 地图 | 输赢 | RR变化. RR change colored green (positive) or red (negative).

---

## Error & Loading States

Each page independently shows:
- Loading: `<p style={{ color: 'var(--muted)' }}>加载中...</p>`
- Error: `<p style={{ color: 'var(--loss)' }}>加载失败</p>`
- Empty data: `<p style={{ color: 'var(--muted)' }}>暂无数据</p>`
