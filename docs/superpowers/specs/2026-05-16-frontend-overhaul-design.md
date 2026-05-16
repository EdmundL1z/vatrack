# Frontend Overhaul Design Spec
Date: 2026-05-16

## Overview

Full-optimization pass on the VaTrack frontend: official Chinese localization, win-rate calculation fix, BattleList redesign, TrendStats multi-chart dashboard, BattleDetail expansion, and sortable stat tables.

---

## 1. Data Config Layer

### New files

```
frontend/src/
  config/
    agents.json     # { "<uuid>": { "name_cn": "不死鸟", "name_en": "Phoenix", "color": "#ff4655" }, ... }
    maps.json       # { "Bind": { "name_cn": "绑定" }, ... }
    queues.json     # { "competitive": "竞技", "unrated": "非排位", ... }
  hooks/
    useGameData.ts  # exposes agentName(), mapName(), queueName()
```

### agents.json

Key is the full agent UUID (character_id from DB). Fields:
- `name_cn`: official Simplified Chinese name from `valorant-api.com/v1/agents?language=zh-CN`
- `name_en`: English name (for fallback/debugging)
- `color`: hex color for UI accent (agent theme color)

Must include ALL agents, including new ones (Chamber, Phoenix, Clove, Waylay, Tejo, Vyse, etc.) that currently display as truncated UUIDs.

### maps.json

Key is the map English ID as used in `map_id` DB column (e.g. `"Bind"`, `"Haven"`). Source: `valorant-api.com/v1/maps?language=zh-CN`.

### queues.json

Official names from WeGame CN UI:
- `competitive` → 竞技
- `unrated` → 非排位
- `spikerush` → 辐能抢攻（NOT 飙升 or 单挑）
- `deathmatch` → 死斗
- `swiftplay` → 极速
- `premier` → 甲级联赛
- `teamdeathmatch` → 团队死斗

### useGameData hook

```ts
export function useGameData() {
  const agentName = (uuid: string): string => agents[uuid]?.name_cn ?? uuid.slice(0, 8);
  const agentColor = (uuid: string): string => agents[uuid]?.color ?? '#888';
  const mapName   = (id: string): string   => maps[id]?.name_cn ?? id;
  const queueName = (id: string): string   => queues[id] ?? id;
  return { agentName, agentColor, mapName, queueName };
}
```

Static import, no useEffect, no network request. All pages consume this hook instead of local mapping objects.

---

## 2. Backend Changes

### 2a. Stats competitive filter

`GET /stats/agents` and `GET /stats/maps`: add `.filter(Match.queue_id == "competitive")` to all queries.

### 2b. BattleList pagination + filtering

`GET /api/battles` new query params:
- `page` (int, default 1)
- `page_size` (int, default 20)
- `queue` (str, optional) — filter by queue_id
- `map_id` (str, optional)
- `character_id` (str, optional)

Response shape:
```json
{ "items": [...], "total": 312, "page": 1, "page_size": 20 }
```

Frontend requests new page on filter change or pagination click, resets to page 1 on any filter change.

### 2c. Filter options endpoint

`GET /api/battles/filters` — returns distinct values present in DB for populating dropdowns:
```json
{ "queues": ["competitive", "unrated", ...], "map_ids": ["Bind", "Haven", ...], "character_ids": ["uuid1", ...] }
```

Frontend calls this once on mount to build filter dropdown options.

---

## 3. BattleList Page

### Card layout (one card per match, single row)

```
[英雄色块] 英雄名   地图名   模式   [胜/负]   K/D/A   RR变化   相对时间
```

- Agent color block: small square using `agents[uuid].color`
- 胜: green badge, 负: red badge
- KDA: deaths in red
- RR change: `+18` green / `-12` red; hidden for non-competitive matches
- Time: relative ("3小时前", "昨天", "5天前")

### Filter bar (top)

```
[全部模式 ▼]   [全部地图 ▼]   [全部英雄 ▼]
```

All dropdowns populated from actual data in DB (not hardcoded lists). Filters combine with AND. URL params preserve filter state (`?queue=competitive&map=Bind&character_id=xxx`).

### Pagination (bottom)

```
← 1  2  3  4  5 →    共 312 场，每页 20 场
```

Backend pagination. Filter change resets to page 1.

---

## 4. AgentStats Page

### Changes
- Replace UUID display with `agentName(uuid)` from useGameData — fixes truncated UUID rows
- Add `.filter(Match.queue_id == "competitive")` on backend
- Add column sort: every column header clickable, toggles asc/desc with arrow indicator (↑↓)
- Default sort: played descending

### Columns
场次 / 胜场 / 胜率 / 均K / 均D / 均A / KD比

---

## 5. MapStats Page

### Changes
- Replace map_id with `mapName(id)` from useGameData
- Add `.filter(Match.queue_id == "competitive")` on backend
- Add column sort (same as AgentStats)
- Default sort: played descending

### Columns
地图 / 场次 / 胜场 / 胜率 / 均K / 均D / 均A

---

## 6. TrendStats Page (multi-chart dashboard)

### Layout

```
[时间范围: 7天 | 30天 | 全部]

图1: RR 走势折线图
图2: KDA 趋势折线图
图3: 英雄使用分布柱状图
图4: 胜负连续性条形图
```

All charts filter to competitive only. Time range selector applies to all charts simultaneously.

### 图1: RR 走势

- Data: reconstruct absolute RR from anchor point (user-provided, stored as frontend constant: tier=Platinum2, rr=6 as of 2026-05-16) + walk backwards through match history using `rr_change` and `tier_before`/`tier_after`
- Y axis: `tier_index * 100 + rr_within_tier`, labels show tier name (e.g. 铂金2, 铂金3)
- Tier names from a local tier map (Iron1=0 through Radiant=2400+)
- Demotion/promotion boundary logic handled at implementation time

### 图2: KDA 趋势

- Three lines: K (blue) / D (red) / A (green), one point per match
- Optional 5-match moving average overlay

### 图3: 英雄使用分布

- Stacked bar chart: X axis = agent names (Chinese), Y axis = games played
- Stacks: wins (green) + losses (red)
- Filtered to time range

### 图4: 胜负连续性

- One cell per match, horizontal left-to-right (newest right)
- Win = green cell, Loss = red cell
- Tooltip on hover showing map + KDA

---

## 7. BattleDetail Page

### Header (hero area)

```
← 返回

██ 胜  13 : 8   绑定 · 竞技 · 32分钟 · 2026-05-15 20:14
不死鸟    12 / 3 / 5    ACS 287    +18 RR    ☆ MVP
```

- WIN/LOSS in large text with strong color
- Score displayed as `rounds_won : (total_rounds - rounds_won)` — DB stores rounds_won + total_rounds
- Agent name in Chinese
- Personal KDA + ACS + RR change in one line
- MVP/SVP badge if applicable

### Scoreboard (two tabs)

**Tab 1: 战绩**

Columns: 英雄 | 玩家 | ACS | K/D/A | HS% | 伤害 | KAST%

- Own row highlighted
- Sorted by ACS descending within each team
- Player name: use existing display logic (name if available, else truncated subject)

**Tab 2: 特殊**

Columns: 英雄 | 玩家 | 首杀 | 三杀 | 四杀 | 五杀 | Clutch | 种弹 | 拆弹 | 经济分

- Multi-kill cells colored: 三杀=yellow, 四杀=orange, 五杀=red
- Zero values displayed as `—`

Both tabs show my team first, then enemy team, each with team color header.

---

## 8. Extensibility Notes

- No multi-account schema changes in this iteration. DB has no account identifier on `matches` table. Future multi-account would be a separate DB or new column — no current code should assume single-account in a way that's hard to undo.
- agents.json / maps.json are manually updated when Riot releases new agents/maps. Update process: web search official CN name → edit JSON file.
- RR anchor point is a hardcoded frontend constant. When a new season starts or anchor drifts, update the constant manually.
