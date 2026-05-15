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
                formatter={(value, name) => {
                  if (typeof value !== 'number') return '';
                  return name === 'cumRR' ? [`${value}`, '累计RR'] : [`${value > 0 ? '+' : ''}${value}`, '本场RR'];
                }}
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
