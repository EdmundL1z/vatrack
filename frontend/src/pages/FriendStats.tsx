import { useEffect, useState } from 'react';
import { getFriendStats } from '../api/client';
import type { FriendStat } from '../api/client';

const COL = '1fr 64px 64px 100px';

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

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  padding: '6px 10px',
  outline: 'none',
  width: 220,
  letterSpacing: '0.03em',
};

export default function FriendStats() {
  const [stats, setStats] = useState<FriendStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getFriendStats()
      .then(r => setStats(r.data))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;

  const filtered = search
    ? stats.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : stats;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.08em' }}>好友统计</h2>
        <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.1em' }}>同队竞技对局</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索好友名..."
          style={inputStyle}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {stats.length === 0 ? '暂无好友同队数据' : '无匹配好友'}
        </p>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: COL,
            padding: '7px 14px',
            background: 'var(--surface-hi)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['好友', '场次', '胜场', '同队胜率'].map((h, i) => (
              <span key={h} style={{
                fontSize: 10, letterSpacing: '0.06em', color: 'var(--muted)',
                textAlign: i === 0 ? 'left' : 'center',
              }}>{h}</span>
            ))}
          </div>
          {filtered.map(s => (
            <div
              key={s.subject}
              className="stat-row"
              style={{
                display: 'grid', gridTemplateColumns: COL,
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                borderLeft: `2px solid ${s.win_rate >= 50 ? '#00d4a0' : '#ff4655'}`,
                boxShadow: `inset 3px 0 18px ${s.win_rate >= 50 ? 'rgba(0,212,160,0.08)' : 'rgba(255,70,85,0.08)'}`,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>{s.name}</span>
              <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--subtext)' }}>{s.played}</span>
              <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--subtext)' }}>{s.wins}</span>
              <WinRateCell value={s.win_rate} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
