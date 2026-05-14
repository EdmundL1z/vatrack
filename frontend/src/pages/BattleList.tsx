import { useEffect, useState } from 'react';
import { getBattles, MatchSummary } from '../api/client';

const QUEUE_NAMES: Record<string, string> = {
  competitive: '竞技',
  unrated:     '普通',
  deathmatch:  '死亡竞赛',
  spikerush:   '单挑',
};

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (d.toDateString() === now.toDateString()) return `今天 ${time}`;
  return `${d.getMonth() + 1}-${d.getDate()} ${time}`;
}

interface Props {
  onSelectMatch: (id: string) => void;
}

export default function BattleList({ onSelectMatch }: Props) {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBattles(50)
      .then(r => { setMatches(r.data.matches); setTotal(r.data.total); })
      .catch(() => setError('加载失败，请检查服务器连接'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error)   return <p style={{ color: 'var(--loss)' }}>{error}</p>;

  return (
    <div>
      <h2 style={{ marginBottom: 16, fontSize: 15, fontWeight: 'bold' }}>
        近期对局
        <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 'normal', marginLeft: 8 }}>
          {total} 场
        </span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map(m => {
          const isDm = m.queue_id === 'deathmatch';
          const borderColor = isDm ? 'var(--muted)' : m.won_match ? 'var(--win)' : 'var(--loss)';
          const rrLabel = m.rr_change != null
            ? (m.rr_change >= 0 ? `+${m.rr_change}` : `${m.rr_change}`)
            : null;

          return (
            <div
              key={m.match_id}
              onClick={() => onSelectMatch(m.match_id)}
              style={{
                background: 'var(--surface)',
                borderLeft: `3px solid ${borderColor}`,
                borderRadius: 6,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 64 }}>
                <div style={{ color: borderColor, fontSize: 11, fontWeight: 'bold' }}>
                  {isDm ? 'DM' : m.won_match ? '胜' : '负'}
                </div>
                <div style={{ fontWeight: 'bold', fontSize: 13 }}>{m.map_name}</div>
              </div>

              <div style={{ color: 'var(--muted)', fontSize: 11, minWidth: 52 }}>
                {QUEUE_NAMES[m.queue_id] ?? m.queue_id}
              </div>

              <div style={{ flex: 1, fontSize: 13 }}>
                <span style={{ color: 'var(--text)' }}>{m.kills}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span style={{ color: 'var(--loss)' }}>{m.deaths}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span>{m.assists}</span>
                {m.acs != null && (
                  <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>
                    ACS {Math.round(m.acs)}
                  </span>
                )}
              </div>

              <div style={{
                minWidth: 36,
                textAlign: 'right',
                fontWeight: 'bold',
                fontSize: 13,
                color: !rrLabel ? 'var(--muted)'
                  : m.rr_change! >= 0 ? 'var(--win)' : 'var(--loss)',
              }}>
                {rrLabel ?? '—'}
              </div>

              <div style={{ color: 'var(--muted)', fontSize: 11, minWidth: 72, textAlign: 'right' }}>
                {formatTime(m.started_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
