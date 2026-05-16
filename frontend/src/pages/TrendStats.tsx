import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { getTrendStats } from '../api/client';
import type { TrendMatch } from '../api/client';
import { useGameData } from '../hooks/useGameData';

const RR_ANCHOR = { tier: 16, rr: 6 };

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

const ALL_DAYS = 3650;

type DayRange = 7 | 30 | 0;

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface RRPoint { date: string; absRR: number; rrChange: number; }

function buildRRData(matches: TrendMatch[]): RRPoint[] {
  const competitive = matches.filter(m => m.rr_change !== null && m.tier_after !== null);
  if (competitive.length === 0) return [];
  const points: RRPoint[] = new Array(competitive.length);
  let currentAbsRR = RR_ANCHOR.tier * 100 + RR_ANCHOR.rr;
  for (let i = competitive.length - 1; i >= 0; i--) {
    const m = competitive[i];
    points[i] = { date: formatDate(m.started_at), absRR: currentAbsRR, rrChange: m.rr_change! };
    currentAbsRR = currentAbsRR - m.rr_change!;
  }
  return points;
}

interface KDAPoint { date: string; kills: number; deaths: number; assists: number; }

function buildKDAData(matches: TrendMatch[]): KDAPoint[] {
  return matches.map(m => ({
    date: formatDate(m.started_at),
    kills: m.kills, deaths: m.deaths, assists: m.assists,
  }));
}

interface AgentBar { name: string; wins: number; losses: number; }

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

const chartTooltip: CSSProperties = {
  background: '#0c1520', border: '1px solid #192840',
  fontSize: 11, borderRadius: 2,
};

const btnStyle = (active: boolean): CSSProperties => ({
  background: active ? 'rgba(255,70,85,0.15)' : 'transparent',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  color: active ? 'var(--text)' : 'var(--muted)',
  borderRadius: 2,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'var(--font-ui)',
  letterSpacing: '0.04em',
  boxShadow: active ? '0 0 8px rgba(255,70,85,0.2)' : 'none',
});

const chartCard: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 2,
  border: '1px solid var(--border)',
  padding: '16px 8px',
  marginBottom: 12,
};

const sectionLabel: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 10,
  letterSpacing: '0.12em',
  marginBottom: 12,
  paddingLeft: 8,
  textTransform: 'uppercase' as const,
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

  if (loading) return <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (allMatches.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无竞技数据</p>;

  const rrData    = buildRRData(allMatches);
  const kdaData   = buildKDAData(allMatches);
  const agentData = buildAgentData(allMatches, agentName);

  const axisTick = { fill: '#3a5068', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.08em' }}>趋势统计</h2>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {([7, 30, 0] as DayRange[]).map(d => (
            <button key={d} onClick={() => setDays(d)} style={btnStyle(days === d)}>
              {d === 0 ? '全部' : `${d}天`}
            </button>
          ))}
        </div>
      </div>

      <div style={chartCard}>
        <div style={sectionLabel}>段位走势</div>
        {rrData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rrData}>
              <XAxis dataKey="date" tick={axisTick} />
              <YAxis
                tick={axisTick}
                tickFormatter={(v: number) => TIER_NAMES[Math.floor(v / 100)] ?? `${v}`}
                width={52}
              />
              <Tooltip
                contentStyle={chartTooltip}
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

      <div style={chartCard}>
        <div style={sectionLabel}>KDA 趋势</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={kdaData}>
            <XAxis dataKey="date" tick={axisTick} />
            <YAxis tick={axisTick} />
            <Tooltip contentStyle={chartTooltip} wrapperStyle={{ transform: 'translateY(-110%)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#3a5068' }} />
            <Line type="monotone" dataKey="kills"   stroke="#00d4a0" dot={false} strokeWidth={2} isAnimationActive={false} name="击杀" />
            <Line type="monotone" dataKey="deaths"  stroke="#ff4655" dot={false} strokeWidth={2} isAnimationActive={false} name="死亡" />
            <Line type="monotone" dataKey="assists" stroke="#7a96b0" dot={false} strokeWidth={2} isAnimationActive={false} name="助攻" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {agentData.length > 0 && (
        <div style={chartCard}>
          <div style={sectionLabel}>英雄使用分布</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={agentData}>
              <XAxis dataKey="name" tick={axisTick} />
              <YAxis tick={axisTick} />
              <Tooltip contentStyle={chartTooltip} wrapperStyle={{ transform: 'translateY(-110%)' }} />
              <Bar dataKey="wins"   name="胜" stackId="a" fill="#00d4a0" isAnimationActive={false} />
              <Bar dataKey="losses" name="负" stackId="a" fill="#ff4655" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={chartCard}>
        <div style={sectionLabel}>胜负连续（旧→新）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '0 8px' }}>
          {allMatches.map(m => (
            <div
              key={m.match_id}
              data-tip={`${mapName(m.map_name)} ${m.kills}/${m.deaths}/${m.assists}`}
              style={{
                width: 14, height: 14, borderRadius: 1,
                background: m.won_match ? '#00d4a0' : '#ff4655',
                opacity: 0.8,
                cursor: 'default',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
