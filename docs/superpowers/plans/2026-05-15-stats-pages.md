# Stats Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three statistics pages (agent stats, map stats, RR trends) behind three sidebar navigation entries.

**Architecture:** Extend `App.tsx` page type and `Sidebar.tsx` buttons; add types + fetch functions to `api/client.ts`; implement three page components (`AgentStats.tsx`, `MapStats.tsx`, `TrendStats.tsx`); install Recharts for the RR trend line chart.

**Tech Stack:** React + TypeScript + Vite, Recharts, Axios (existing), CSS custom properties (existing design tokens)

---

## File Map

| Action | File |
|--------|------|
| Modify | `frontend/src/api/client.ts` |
| Modify | `frontend/src/App.tsx` |
| Modify | `frontend/src/components/Sidebar.tsx` |
| Replace | `frontend/src/pages/AgentStats.tsx` |
| Create | `frontend/src/pages/MapStats.tsx` |
| Create | `frontend/src/pages/TrendStats.tsx` |

---

### Task 1: API types and fetch functions

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add interfaces and fetch functions**

Append to the bottom of `frontend/src/api/client.ts`:

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

export const getAgentStats = () =>
  client.get<AgentStat[]>('/stats/agents');

export const getMapStats = () =>
  client.get<MapStat[]>('/stats/maps');

export const getTrendStats = (days = 30) =>
  client.get<TrendMatch[]>('/stats/trends', { params: { days } });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add stats API types and fetch functions"
```

---

### Task 2: Install Recharts

**Files:**
- Modify: `frontend/package.json` (via npm)

- [ ] **Step 1: Install**

Run from `frontend/`:
```
npm install recharts
```

- [ ] **Step 2: Verify build still works**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add recharts dependency"
```

---

### Task 3: AgentStats page

**Files:**
- Replace: `frontend/src/pages/AgentStats.tsx`

- [ ] **Step 1: Implement AgentStats**

Replace the entire content of `frontend/src/pages/AgentStats.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { getAgentStats } from '../api/client';
import type { AgentStat } from '../api/client';

function agentName(characterId: string): string {
  const parts = characterId.split('/').filter(Boolean);
  const seg = parts[parts.length - 2] ?? parts[parts.length - 1] ?? characterId;
  return seg.length > 0 ? seg : characterId.slice(0, 12);
}

export default function AgentStats() {
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAgentStats()
      .then(r => setStats(r.data))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (stats.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无数据</p>;

  return (
    <div>
      <h2 style={{ marginBottom: 16, fontSize: 15, fontWeight: 'bold' }}>英雄统计</h2>
      <div style={{ background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 60px 60px 60px 60px 60px 60px',
          padding: '6px 12px',
          color: 'var(--muted)',
          fontSize: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <span>英雄</span>
          <span style={{ textAlign: 'center' }}>场数</span>
          <span style={{ textAlign: 'center' }}>胜率</span>
          <span style={{ textAlign: 'center' }}>均K</span>
          <span style={{ textAlign: 'center' }}>均D</span>
          <span style={{ textAlign: 'center' }}>均A</span>
          <span style={{ textAlign: 'center' }}>K/D</span>
        </div>
        {stats.map(s => (
          <div
            key={s.character_id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 60px 60px 60px 60px 60px 60px',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)'}`,
              fontSize: 13,
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text)' }}>{agentName(s.character_id)}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.played}</span>
            <span style={{ textAlign: 'center', color: s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)' }}>
              {s.win_rate}%
            </span>
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

- [ ] **Step 2: Verify TypeScript**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AgentStats.tsx
git commit -m "feat: implement AgentStats page"
```

---

### Task 4: MapStats page

**Files:**
- Create: `frontend/src/pages/MapStats.tsx`

- [ ] **Step 1: Create MapStats**

Create `frontend/src/pages/MapStats.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getMapStats } from '../api/client';
import type { MapStat } from '../api/client';

export default function MapStats() {
  const [stats, setStats] = useState<MapStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMapStats()
      .then(r => setStats(r.data))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (stats.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无数据</p>;

  return (
    <div>
      <h2 style={{ marginBottom: 16, fontSize: 15, fontWeight: 'bold' }}>地图统计</h2>
      <div style={{ background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 60px 60px 60px 60px 60px',
          padding: '6px 12px',
          color: 'var(--muted)',
          fontSize: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <span>地图</span>
          <span style={{ textAlign: 'center' }}>场数</span>
          <span style={{ textAlign: 'center' }}>胜率</span>
          <span style={{ textAlign: 'center' }}>均K</span>
          <span style={{ textAlign: 'center' }}>均D</span>
          <span style={{ textAlign: 'center' }}>均A</span>
        </div>
        {stats.map(s => (
          <div
            key={s.map_id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 60px 60px 60px 60px 60px',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)'}`,
              fontSize: 13,
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text)' }}>{s.map_name}</span>
            <span style={{ textAlign: 'center', color: 'var(--subtext)' }}>{s.played}</span>
            <span style={{ textAlign: 'center', color: s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)' }}>
              {s.win_rate}%
            </span>
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

- [ ] **Step 2: Verify TypeScript**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/MapStats.tsx
git commit -m "feat: implement MapStats page"
```

---

### Task 5: TrendStats page

**Files:**
- Create: `frontend/src/pages/TrendStats.tsx`

- [ ] **Step 1: Create TrendStats**

Create `frontend/src/pages/TrendStats.tsx`:

```tsx
import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { getTrendStats } from '../api/client';
import type { TrendMatch } from '../api/client';

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface ChartPoint {
  date: string;
  cumRR: number;
  rrChange: number;
}

function buildChartData(matches: TrendMatch[]): ChartPoint[] {
  let cum = 0;
  return matches
    .filter(m => m.rr_change !== null)
    .map(m => {
      cum += m.rr_change!;
      return { date: formatDate(m.started_at), cumRR: cum, rrChange: m.rr_change! };
    });
}

export default function TrendStats() {
  const [matches, setMatches] = useState<TrendMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTrendStats(30)
      .then(r => setMatches(r.data))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (matches.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无数据</p>;

  const chartData = buildChartData(matches);

  return (
    <div>
      <h2 style={{ marginBottom: 16, fontSize: 15, fontWeight: 'bold' }}>
        RR 趋势
        <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 'normal', marginLeft: 8 }}>
          近 30 天竞技场
        </span>
      </h2>

      {chartData.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 6, padding: '16px 8px', marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }}
                formatter={(value: number, name: string) =>
                  name === 'cumRR' ? [`${value}`, '累计RR'] : [`${value > 0 ? '+' : ''}${value}`, '本场RR']
                }
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Line
                type="monotone"
                dataKey="cumRR"
                stroke="#ff4655"
                dot={{ r: 3, fill: '#ff4655' }}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 48px 60px',
          padding: '6px 12px',
          color: 'var(--muted)',
          fontSize: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <span>日期</span>
          <span>地图</span>
          <span style={{ textAlign: 'center' }}>输赢</span>
          <span style={{ textAlign: 'right' }}>RR</span>
        </div>
        {matches.map(m => {
          const rr = m.rr_change;
          const rrLabel = rr === null ? '—' : rr >= 0 ? `+${rr}` : `${rr}`;
          const rrColor = rr === null ? 'var(--muted)' : rr >= 0 ? 'var(--win)' : 'var(--loss)';
          return (
            <div
              key={m.match_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 48px 60px',
                padding: '7px 12px',
                borderBottom: '1px solid var(--border)',
                fontSize: 12,
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>{formatDate(m.started_at)}</span>
              <span style={{ color: 'var(--text)' }}>{m.map_name}</span>
              <span style={{ textAlign: 'center', color: m.won_match ? 'var(--win)' : 'var(--loss)' }}>
                {m.won_match ? '胜' : '负'}
              </span>
              <span style={{ textAlign: 'right', color: rrColor }}>{rrLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TrendStats.tsx
git commit -m "feat: implement TrendStats page with Recharts line chart"
```

---

### Task 6: Wire up navigation (App.tsx + Sidebar.tsx)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Update App.tsx**

Replace the entire content of `frontend/src/App.tsx` with:

```tsx
import { useState } from 'react';
import Sidebar from './components/Sidebar';
import BattleList from './pages/BattleList';
import BattleDetail from './pages/BattleDetail';
import AgentStats from './pages/AgentStats';
import MapStats from './pages/MapStats';
import TrendStats from './pages/TrendStats';

type Page = 'list' | 'detail' | 'agents' | 'maps' | 'trends';

export default function App() {
  const [page, setPage] = useState<Page>('list');
  const [matchId, setMatchId] = useState<string | null>(null);

  const goToDetail = (id: string) => { setMatchId(id); setPage('detail'); };
  const goToList   = () => { setPage('list'); setMatchId(null); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar page={page} onNavigate={setPage} />
      <main style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        {page === 'list'   && <BattleList onSelectMatch={goToDetail} />}
        {page === 'detail' && matchId && <BattleDetail matchId={matchId} onBack={goToList} />}
        {page === 'agents' && <AgentStats />}
        {page === 'maps'   && <MapStats />}
        {page === 'trends' && <TrendStats />}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update Sidebar.tsx**

Replace the entire content of `frontend/src/components/Sidebar.tsx` with:

```tsx
type Page = 'list' | 'detail' | 'agents' | 'maps' | 'trends';

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

const NAV: { label: string; icon: string; page: Page }[] = [
  { label: '对局记录', icon: '▤', page: 'list' },
  { label: '英雄统计', icon: '◎', page: 'agents' },
  { label: '地图统计', icon: '◈', page: 'maps' },
  { label: 'RR 趋势',  icon: '◉', page: 'trends' },
];

export default function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside style={{
      width: 130,
      minHeight: '100vh',
      background: 'var(--sidebar)',
      borderRight: '1px solid var(--border)',
      padding: '16px 12px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        color: 'var(--accent)',
        fontWeight: 'bold',
        fontSize: 15,
        letterSpacing: 2,
        marginBottom: 24,
      }}>
        VATRACK
      </div>
      {NAV.map(({ label, icon, page: p }) => (
        <button
          key={p}
          onClick={() => onNavigate(p)}
          style={{
            background: page === p ? 'var(--border)' : 'none',
            border: 'none',
            color: page === p ? 'var(--accent)' : 'var(--muted)',
            textAlign: 'left',
            padding: '6px 8px',
            borderRadius: 4,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {icon} {label}
        </button>
      ))}
    </aside>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat: wire up stats pages navigation in App and Sidebar"
```

---

### Task 7: Final build verification and push

- [ ] **Step 1: Full build**

Run from `frontend/`:
```
npm run build
```
Expected: `✓ built in Xs` with no TypeScript errors.

- [ ] **Step 2: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 3: Verify**

Navigate in browser:
- Sidebar shows 4 entries: 对局记录 / 英雄统计 / 地图统计 / RR 趋势
- Active page button is highlighted
- Each stats page loads without error (may show "暂无数据" if DB is empty)
- Clicking a match in 对局记录 still opens detail view correctly
