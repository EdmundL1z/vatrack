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

const COL = '1fr 56px 56px 80px 56px 56px 56px';

function WinRateCell({ value }: { value: number }) {
  const color = value >= 50 ? 'var(--win)' : 'var(--loss)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color }}>{value}%</span>
      <div style={{ width: '80%', height: 2, background: 'var(--border)', borderRadius: 1 }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 1 }} />
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

  if (loading) return <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;
  if (stats.length === 0) return <p style={{ color: 'var(--muted)' }}>暂无竞技数据</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.08em' }}>地图统计</h2>
        <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.1em' }}>仅竞技模式</span>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: COL,
          padding: '7px 14px',
          background: 'var(--surface-hi)',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>地图</span>
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
          const winColor = s.win_rate >= 50 ? '#00d4a0' : '#ff4655';
          return (
            <div
              key={s.map_id}
              className="stat-row"
              style={{
                display: 'grid', gridTemplateColumns: COL,
                padding: '9px 14px',
                borderBottom: '1px solid var(--border)',
                borderLeft: `2px solid ${winColor}`,
                boxShadow: `inset 3px 0 18px ${winColor}18`,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>{mapName(s.map_name)}</span>
              <MonoCell value={s.played} />
              <MonoCell value={s.wins} />
              <WinRateCell value={s.win_rate} />
              <MonoCell value={s.avg_kills} />
              <MonoCell value={s.avg_deaths} />
              <MonoCell value={s.avg_assists} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
