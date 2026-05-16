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
          display: 'grid',
          gridTemplateColumns: colTemplate,
          padding: '6px 12px',
          color: 'var(--muted)',
          fontSize: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <span>地图</span>
          {COLUMNS.map(c => (
            <span
              key={c.key}
              onClick={() => handleSort(c.key)}
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                color: sortKey === c.key ? 'var(--text)' : 'var(--muted)',
              }}
            >
              {c.label}{sortKey === c.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
            </span>
          ))}
        </div>
        {sorted.map(s => (
          <div
            key={s.map_id}
            style={{
              display: 'grid',
              gridTemplateColumns: colTemplate,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)'}`,
              fontSize: 13,
              alignItems: 'center',
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
