import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { getTrendStats } from '../api/client';
import type { TrendMatch } from '../api/client';
import { useGameData } from '../hooks/useGameData';

// Update when your rank changes significantly or a new season resets RR.
// Check your actual tier ID: curl http://localhost:8000/api/stats/trends?days=7 | grep tier_after
// Then find it in TIER_NAMES below and set RR_ANCHOR.tier to that ID.
const RR_ANCHOR = { tier: 16, rr: 6 };

// Valorant tier ID → Chinese name. Verify tier IDs against actual DB values.
const TIER_NAMES: Record<number, string> = {
  0: '无级',
  3: '铁牌1', 4: '铁牌2', 5: '铁牌3',
  6: '青铜1', 7: '青铜2', 8: '青铜3',
  9: '白银1', 10: '白银2', 11: '白银3',
  12: '黄金1', 13: '黄金2', 14: '黄金3',
  15: '铂金1', 16: '铂金2', 17: '铂金3',
  18: '钻石1', 19: '钻石2', 20: '钻石3',
  21: '超凡1', 22: '超凡2', 23: '超凡3',
  24: '不朽1', 25: '不朽2', 26: '不朽3',
  27: '辉耀',
};

const ALL_DAYS = 3650; // ~10 years; backend cap is 36500

type DayRange = 7 | 30 | 0;

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface RRPoint {
  date: string;
  absRR: number;
  rrChange: number;
}

function buildRRData(matches: TrendMatch[]): RRPoint[] {
  const competitive = matches.filter(m => m.rr_change !== null && m.tier_after !== null);
  if (competitive.length === 0) return [];

  const points: RRPoint[] = new Array(competitive.length);
  let currentAbsRR = RR_ANCHOR.tier * 100 + RR_ANCHOR.rr;

  for (let i = competitive.length - 1; i >= 0; i--) {
    const m = competitive[i];
    points[i] = {
      date: formatDate(m.started_at),
      absRR: currentAbsRR,
      rrChange: m.rr_change!,
    };
    currentAbsRR = currentAbsRR - m.rr_change!;
  }
  return points;
}

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

interface AgentBar {
  name: string;
  wins: number;
  losses: number;
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
    .map(([uuid, v]) => ({ name: agentNameFn(uuid), wins: v.wins, losses: v.losses }))
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
}

const btnStyle = (active: boolean): CSSProperties => ({
  background: active ? 'var(--accent)' : 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 12,
});

const chartCard: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 6,
  padding: '16px 8px',
  marginBottom: 16,
};

export default function TrendStats() {
  const [allMatches, setAllMatches] = useState<TrendMatch[]>([]);
  const [days, setDays] = useState<DayRange>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { agentName, mapName } = useGameData();

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTrendStats(days === 0 ? ALL_DAYS : days)
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
        {rrData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rrData}>
              <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                tickFormatter={(v: number) => TIER_NAMES[Math.floor(v / 100)] ?? `${v}`}
                width={52}
              />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }}
                wrapperStyle={{ transform: 'translateY(-110%)' }}
                formatter={(value) => {
                  if (typeof value !== 'number') return ['—', '段位'] as [string, string];
                  const tier = TIER_NAMES[Math.floor(value / 100)] ?? '';
                  const rr = value % 100;
                  return [`${tier} ${rr}分`, '段位'] as [string, string];
                }}
              />
              <Line
                type="monotone" dataKey="absRR" stroke="#ff4655"
                dot={{ r: 3, fill: '#ff4655' }} strokeWidth={2} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 12, paddingLeft: 8 }}>无竞技数据</p>
        )}
      </div>

      {/* Chart 2: KDA Trend */}
      <div style={chartCard}>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 8, paddingLeft: 8 }}>KDA 趋势</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={kdaData}>
            <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }} wrapperStyle={{ transform: 'translateY(-110%)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
            <Line type="monotone" dataKey="kills"   stroke="#5bc0eb" dot={false} strokeWidth={2} isAnimationActive={false} name="击杀" />
            <Line type="monotone" dataKey="deaths"  stroke="#ff4655" dot={false} strokeWidth={2} isAnimationActive={false} name="死亡" />
            <Line type="monotone" dataKey="assists" stroke="#4caf50" dot={false} strokeWidth={2} isAnimationActive={false} name="助攻" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Agent Distribution */}
      {agentData.length > 0 && (
        <div style={chartCard}>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 8, paddingLeft: 8 }}>英雄使用分布</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={agentData}>
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }} wrapperStyle={{ transform: 'translateY(-110%)' }} />
              <Bar dataKey="wins"   name="胜" stackId="a" fill="var(--win)"  isAnimationActive={false} />
              <Bar dataKey="losses" name="负" stackId="a" fill="var(--loss)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Chart 4: Win/Loss Streak */}
      <div style={chartCard}>
        <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 8, paddingLeft: 8 }}>胜负连续（旧→新）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '0 8px' }}>
          {allMatches.map(m => (
            <div
              key={m.match_id}
              data-tip={`${mapName(m.map_name)} ${m.kills}/${m.deaths}/${m.assists}`}
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
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
