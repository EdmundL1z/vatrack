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
