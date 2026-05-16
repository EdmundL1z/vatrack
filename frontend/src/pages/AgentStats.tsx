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
          display: 'grid',
          gridTemplateColumns: colTemplate,
          padding: '6px 12px',
          color: 'var(--muted)',
          fontSize: 10,
          borderBottom: '1px solid var(--border)',
        }}>
          <span>英雄</span>
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
            key={s.character_id}
            style={{
              display: 'grid',
              gridTemplateColumns: colTemplate,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${agentColor(s.character_id)}`,
              fontSize: 13,
              alignItems: 'center',
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
