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

const COL = '1fr 56px 56px 80px 56px 56px 56px 60px';

function WinRateCell({ value }: { value: number }) {
  const color = value >= 50 ? 'var(--win)' : 'var(--loss)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color }}>{value}%</span>
      <div style={{ width: '85%', height: 3, background: 'var(--border)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function MonoCell({ value }: { value: string | number }) {
  return (
    <span style={{ display: 'block', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--subtext)' }}>
      {value}
    </span>
  );
}

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
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...stats].sort((a, b) => {
    const v = a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0;
    return sortDir === 'asc' ? v : -v;
  });

  if (loading) return <p className="loading-text">LOADING...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (stats.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无竞技数据</p>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', lineHeight: 1, marginBottom: 6 }}>英雄统计</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 2, background: 'var(--accent)' }} />
          <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.14em', fontFamily: 'var(--font-mono)' }}>仅竞技模式</span>
        </div>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: COL,
          padding: '7px 16px',
          background: 'var(--surface-hi)',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>英雄</span>
          {COLUMNS.map(c => (
            <span
              key={c.key}
              onClick={() => handleSort(c.key)}
              style={{
                textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                fontSize: 10, letterSpacing: '0.06em',
                color: sortKey === c.key ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              {c.label}{sortKey === c.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
            </span>
          ))}
        </div>
        {sorted.map(s => {
          const color = agentColor(s.character_id);
          return (
            <div
              key={s.character_id}
              className="stat-row"
              style={{
                display: 'grid', gridTemplateColumns: COL,
                padding: '11px 16px',
                borderBottom: '1px solid var(--border)',
                borderLeft: `4px solid ${color}`,
                boxShadow: `inset 5px 0 24px ${color}18`,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>{agentName(s.character_id)}</span>
              <MonoCell value={s.played} />
              <MonoCell value={s.wins} />
              <WinRateCell value={s.win_rate} />
              <MonoCell value={s.avg_kills} />
              <MonoCell value={s.avg_deaths} />
              <MonoCell value={s.avg_assists} />
              <MonoCell value={s.kd_ratio} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
