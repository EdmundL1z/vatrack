import { useEffect, useState } from 'react';
import { getBattles, getBattleFilters } from '../api/client';
import type { MatchSummary, BattleListFilters } from '../api/client';
import { useGameData } from '../hooks/useGameData';

const PAGE_SIZE = 20;

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600)  return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 2) return '昨天';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const d = new Date(ts * 1000);
  const now = new Date();
  const prefix = d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}/` : '';
  return `${prefix}${d.getMonth() + 1}/${d.getDate()}`;
}

interface Props {
  onSelectMatch: (id: string) => void;
}

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

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '5px 8px',
    fontSize: 12,
    cursor: 'pointer',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 'auto' }}>
          共 {total} 场
        </span>
      </div>

      {loading && <p style={{ color: 'var(--muted)' }}>加载中...</p>}
      {error   && <p style={{ color: 'var(--loss)' }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {matches.map(m => {
          const isDm = m.queue_id === 'deathmatch';
          const resultColor = isDm ? 'var(--muted)' : m.won_match ? 'var(--win)' : 'var(--loss)';
          const rrLabel = m.rr_change != null
            ? (m.rr_change >= 0 ? `+${m.rr_change}` : `${m.rr_change}`)
            : null;
          const color = agentColor(m.character_id);

          return (
            <div
              key={m.match_id}
              onClick={() => onSelectMatch(m.match_id)}
              style={{
                background: 'var(--surface)',
                borderLeft: `3px solid ${resultColor}`,
                borderRadius: 6,
                padding: '10px 14px',
                display: 'grid',
                gridTemplateColumns: '12px 100px 90px 70px 60px 80px 52px 80px',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
              <div style={{ fontSize: 13, fontWeight: 500 }}>{agentName(m.character_id)}</div>
              <div style={{ fontSize: 13 }}>{mapName(m.map_name)}</div>
              <div style={{ color: 'var(--muted)', fontSize: 11 }}>{queueName(m.queue_id)}</div>
              <div style={{ color: resultColor, fontSize: 12, fontWeight: 'bold' }}>
                {isDm ? 'DM' : m.won_match ? '胜' : '负'}
              </div>
              <div style={{ fontSize: 12 }}>
                <span>{m.kills}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span style={{ color: 'var(--loss)' }}>{m.deaths}</span>
                <span style={{ color: 'var(--muted)' }}>/</span>
                <span>{m.assists}</span>
              </div>
              <div style={{
                textAlign: 'right',
                fontWeight: 'bold',
                fontSize: 12,
                color: !rrLabel ? 'var(--muted)' : (m.rr_change ?? -1) >= 0 ? 'var(--win)' : 'var(--loss)',
              }}>
                {rrLabel ?? '—'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'right' }}>
                {relativeTime(m.started_at)}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16, alignItems: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
              borderRadius: 4, padding: '4px 10px', cursor: page === 1 ? 'default' : 'pointer',
            }}
          >←</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = page <= 4 ? i + 1 : page + i - 3;
            if (p < 1 || p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  background: p === page ? 'var(--accent)' : 'var(--surface)',
                  border: '1px solid var(--border)', color: 'var(--text)',
                  borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                }}
              >{p}</button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
              borderRadius: 4, padding: '4px 10px', cursor: page === totalPages ? 'default' : 'pointer',
            }}
          >→</button>
        </div>
      )}
    </div>
  );
}
