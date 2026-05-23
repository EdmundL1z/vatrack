import { useEffect, useState } from 'react';
import { getBattles, getBattleFilters } from '../api/client';
import type { MatchSummary, BattleListFilters } from '../api/client';
import { useGameData } from '../hooks/useGameData';

const PAGE_SIZE = 20;

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 2) return '昨天';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}天前`;
  const d = new Date(ts * 1000);
  const now = new Date();
  const prefix = d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}/` : '';
  return `${prefix}${d.getMonth() + 1}/${d.getDate()}`;
}

interface Props {
  onSelectMatch: (id: string) => void;
}

const selectStyle: React.CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  outline: 'none',
  letterSpacing: '0.06em',
};

const pageBtn = (active: boolean, disabled = false): React.CSSProperties => ({
  background: active ? 'var(--accent)' : 'var(--surface)',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  color: disabled ? 'var(--muted)' : active ? '#fff' : 'var(--text)',
  borderRadius: 2,
  padding: '5px 12px',
  cursor: disabled ? 'default' : 'pointer',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  fontWeight: active ? 700 : 400,
  boxShadow: active ? '0 0 12px rgba(255,70,85,0.35)' : 'none',
  letterSpacing: '0.04em',
});

export default function BattleList({ onSelectMatch }: Props) {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<BattleListFilters>({ queues: [], maps: [], character_ids: [] });
  const [queue, setQueue] = useState('');
  const [mapId, setMapId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { agentName, agentColor, mapName, queueName } = useGameData();

  useEffect(() => {
    getBattleFilters().then(r => setFilters(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const skip = (page - 1) * PAGE_SIZE;
    getBattles({
      queue: queue || undefined,
      map_id: mapId || undefined,
      character_id: characterId || undefined,
      skip,
      limit: PAGE_SIZE,
    })
      .then(r => { setMatches(r.data.matches); setTotal(r.data.total); })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [queue, mapId, characterId, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={queue} onChange={handleFilterChange(setQueue)} style={selectStyle}>
          <option value="">全部模式</option>
          {filters.queues.map(q => <option key={q} value={q}>{queueName(q)}</option>)}
        </select>
        <select value={mapId} onChange={handleFilterChange(setMapId)} style={selectStyle}>
          <option value="">全部地图</option>
          {filters.maps.map(m => <option key={m.id} value={m.id}>{mapName(m.name)}</option>)}
        </select>
        <select value={characterId} onChange={handleFilterChange(setCharacterId)} style={selectStyle}>
          <option value="">全部英雄</option>
          {filters.character_ids.map(id => <option key={id} value={id}>{agentName(id)}</option>)}
        </select>
        <span style={{ color: 'var(--subtext)', fontSize: 11, marginLeft: 'auto', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', fontWeight: 500 }}>
          {total} MATCHES
        </span>
      </div>

      {loading && <p className="loading-text">LOADING...</p>}
      {error   && <p style={{ color: 'var(--loss)' }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {matches.map(m => {
          const isDm = m.queue_id === 'deathmatch';
          const resultColor = isDm ? '#3a5068' : m.won_match ? '#00d4a0' : '#ff4655';
          const glowColor = isDm ? 'rgba(58,80,104,0.14)' : m.won_match ? 'rgba(0,212,160,0.1)' : 'rgba(255,70,85,0.1)';
          const rrLabel = m.rr_change != null
            ? (m.rr_change >= 0 ? `+${m.rr_change}` : `${m.rr_change}`)
            : null;
          const color = agentColor(m.character_id);

          return (
            <div
              key={m.match_id}
              className="battle-card"
              onClick={() => onSelectMatch(m.match_id)}
              style={{
                background: 'var(--surface)',
                borderLeft: `5px solid ${resultColor}`,
                boxShadow: `inset 6px 0 28px ${glowColor}`,
                borderRadius: 2,
                padding: '11px 16px 11px 14px',
                display: 'grid',
                gridTemplateColumns: '120px 88px 54px 44px 86px 54px 64px',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              <div style={{
                fontSize: 14, fontWeight: 700, letterSpacing: '0.04em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: color,
              }}>
                {agentName(m.character_id)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mapName(m.map_name)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--subtext)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {queueName(m.queue_id)}
              </div>
              <div style={{ color: resultColor, fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center' }}>
                {isDm ? 'DM' : m.won_match ? '胜' : '负'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{m.kills}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span style={{ color: 'var(--loss)' }}>{m.deaths}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span style={{ color: 'var(--subtext)' }}>{m.assists}</span>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'right',
                color: !rrLabel ? 'var(--muted)' : (m.rr_change ?? -1) >= 0 ? 'var(--win)' : 'var(--loss)',
              }}>
                {rrLabel ?? '—'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--subtext)', textAlign: 'right' }}>
                {relativeTime(m.started_at)}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 24, alignItems: 'center' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(false, page === 1)}>←</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = page <= 4 ? i + 1 : page + i - 3;
            if (p < 1 || p > totalPages) return null;
            return (
              <button key={p} onClick={() => setPage(p)} style={pageBtn(p === page)}>{p}</button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn(false, page === totalPages)}>→</button>
        </div>
      )}
    </div>
  );
}
