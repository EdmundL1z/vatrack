import { useCallback, useEffect, useState } from 'react';
import { getBattleFilters, getCustomStats, getFriendStats } from '../api/client';
import type {
  BattleListFilters,
  CustomAgentRow,
  CustomFriendRow,
  CustomGroupBy,
  CustomMapRow,
  CustomSummary,
  FriendStat,
} from '../api/client';
import { useGameData } from '../hooks/useGameData';

// ─── tiny shared display components ──────────────────────────────────────────

function WinRateBar({ value }: { value: number }) {
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

function Mono({ value }: { value: string | number }) {
  return (
    <span style={{ display: 'block', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--subtext)' }}>
      {value}
    </span>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', width: 40, flexShrink: 0, paddingTop: 5 }}>
        {label}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(255,70,85,0.12)' : 'transparent',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color: active ? 'var(--accent)' : 'var(--subtext)',
        borderRadius: 2,
        padding: '3px 10px',
        fontSize: 11,
        letterSpacing: '0.05em',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {children}
    </button>
  );
}

// ─── result tables ────────────────────────────────────────────────────────────

const MAP_COL = '1fr 56px 56px 80px 56px 56px 56px';

function MapTable({ rows, mapNameFn }: { rows: CustomMapRow[]; mapNameFn: (n: string) => string }) {
  if (rows.length === 0) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>无匹配数据</p>;
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: MAP_COL, padding: '7px 16px', background: 'var(--surface-hi)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>地图</span>
        {['场次', '胜场', '胜率', '均K', '均D', '均A'].map(h => (
          <span key={h} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em' }}>{h}</span>
        ))}
      </div>
      {rows.map(r => {
        const c = r.win_rate >= 50 ? '#00d4a0' : '#ff4655';
        return (
          <div key={r.map_id} className="stat-row" style={{ display: 'grid', gridTemplateColumns: MAP_COL, padding: '11px 16px', borderBottom: '1px solid var(--border)', borderLeft: `4px solid ${c}`, boxShadow: `inset 5px 0 24px ${c}18`, alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>{mapNameFn(r.map_name)}</span>
            <Mono value={r.played} />
            <Mono value={r.wins} />
            <WinRateBar value={r.win_rate} />
            <Mono value={r.avg_kills} />
            <Mono value={r.avg_deaths} />
            <Mono value={r.avg_assists} />
          </div>
        );
      })}
    </div>
  );
}

const AGENT_COL = '1fr 56px 56px 80px 56px 56px 56px 60px';

function AgentTable({ rows, agentNameFn, agentColorFn }: {
  rows: CustomAgentRow[];
  agentNameFn: (id: string) => string;
  agentColorFn: (id: string) => string;
}) {
  if (rows.length === 0) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>无匹配数据</p>;
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: AGENT_COL, padding: '7px 16px', background: 'var(--surface-hi)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>英雄</span>
        {['场次', '胜场', '胜率', '均K', '均D', '均A', 'K/D'].map(h => (
          <span key={h} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em' }}>{h}</span>
        ))}
      </div>
      {rows.map(r => {
        const color = agentColorFn(r.character_id);
        const kd = r.avg_deaths > 0 ? Math.round(r.avg_kills / r.avg_deaths * 100) / 100 : r.avg_kills;
        return (
          <div key={r.character_id} className="stat-row" style={{ display: 'grid', gridTemplateColumns: AGENT_COL, padding: '11px 16px', borderBottom: '1px solid var(--border)', borderLeft: `4px solid ${color}`, boxShadow: `inset 5px 0 24px ${color}18`, alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>{agentNameFn(r.character_id)}</span>
            <Mono value={r.played} />
            <Mono value={r.wins} />
            <WinRateBar value={r.win_rate} />
            <Mono value={r.avg_kills} />
            <Mono value={r.avg_deaths} />
            <Mono value={r.avg_assists} />
            <Mono value={kd} />
          </div>
        );
      })}
    </div>
  );
}

const FRIEND_COL = '1fr 64px 64px 100px';

function FriendTable({ rows }: { rows: CustomFriendRow[] }) {
  if (rows.length === 0) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>无匹配数据</p>;
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: FRIEND_COL, padding: '7px 14px', background: 'var(--surface-hi)', borderBottom: '1px solid var(--border)' }}>
        {['好友', '场次', '胜场', '同队胜率'].map((h, i) => (
          <span key={h} style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--muted)', textAlign: i === 0 ? 'left' : 'center' }}>{h}</span>
        ))}
      </div>
      {rows.map(r => {
        const c = r.win_rate >= 50 ? '#00d4a0' : '#ff4655';
        return (
          <div key={r.subject} className="stat-row" style={{ display: 'grid', gridTemplateColumns: FRIEND_COL, padding: '10px 14px', borderBottom: '1px solid var(--border)', borderLeft: `2px solid ${c}`, boxShadow: `inset 3px 0 18px ${c}28`, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>{r.name}</span>
            <Mono value={r.played} />
            <Mono value={r.wins} />
            <WinRateBar value={r.win_rate} />
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ data }: { data: CustomSummary }) {
  if (data.played === 0) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>无匹配数据</p>;
  const color = data.win_rate >= 50 ? 'var(--win)' : 'var(--loss)';
  const stat = (label: string, value: string | number, highlight?: string) => (
    <div>
      <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', color: highlight }}>{value}</div>
    </div>
  );
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2, padding: '24px 32px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
      {stat('PLAYED', data.played)}
      {stat('WIN RATE', `${data.win_rate}%`, color)}
      {stat('AVG K/D/A', `${data.avg_kills} / ${data.avg_deaths} / ${data.avg_assists}`)}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

const GROUP_OPTIONS: { value: CustomGroupBy; label: string }[] = [
  { value: 'map',    label: '按地图' },
  { value: 'agent',  label: '按英雄' },
  { value: 'friend', label: '按好友' },
  { value: 'none',   label: '汇总' },
];

const DAY_PRESETS = [
  { value: 0,  label: '全部' },
  { value: 7,  label: '7天' },
  { value: 30, label: '30天' },
  { value: 90, label: '90天' },
];

export default function CustomStats() {
  const { agentName, agentColor, mapName } = useGameData();

  const [filterOpts, setFilterOpts] = useState<BattleListFilters | null>(null);
  const [friends, setFriends] = useState<FriendStat[]>([]);

  const [groupBy, setGroupBy]           = useState<CustomGroupBy>('map');
  const [queue, setQueue]               = useState('competitive');
  const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [friendSubject, setFriendSubject]   = useState('');
  const [days, setDays]                 = useState(0);

  const [mapRows,    setMapRows]    = useState<CustomMapRow[]>([]);
  const [agentRows,  setAgentRows]  = useState<CustomAgentRow[]>([]);
  const [friendRows, setFriendRows] = useState<CustomFriendRow[]>([]);
  const [summary,    setSummary]    = useState<CustomSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    getBattleFilters().then(r => setFilterOpts(r.data)).catch(() => {});
    getFriendStats().then(r => setFriends(r.data)).catch(() => {});
  }, []);

  const fetchResults = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {
      group_by: groupBy,
      queue,
      ...(selectedMaps.length   > 0 && { map_ids:       selectedMaps.join(',') }),
      ...(selectedAgents.length > 0 && { character_ids: selectedAgents.join(',') }),
      ...(friendSubject          && { friend_subject: friendSubject }),
      ...(days > 0               && { days }),
    };
    getCustomStats(params)
      .then(r => {
        const data = r.data;
        setMapRows([]);
        setAgentRows([]);
        setFriendRows([]);
        setSummary(null);
        if (groupBy === 'map')    setMapRows(data as CustomMapRow[]);
        if (groupBy === 'agent')  setAgentRows(data as CustomAgentRow[]);
        if (groupBy === 'friend') setFriendRows(data as CustomFriendRow[]);
        if (groupBy === 'none')   setSummary(data as CustomSummary);
      })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [groupBy, queue, selectedMaps, selectedAgents, friendSubject, days]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const toggleMap   = (id: string) => setSelectedMaps(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAgent = (id: string) => setSelectedAgents(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleFriend = (subj: string) => setFriendSubject(p => p === subj ? '' : subj);

  return (
    <div>
      {/* header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', lineHeight: 1, marginBottom: 6 }}>自定义统计</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 2, background: 'var(--accent)' }} />
          <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.14em', fontFamily: 'var(--font-mono)' }}>CUSTOM ANALYSIS</span>
        </div>
      </div>

      {/* filter panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2, padding: '16px 20px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FilterRow label="队列">
          {[{ v: 'competitive', l: '竞技' }, { v: 'all', l: '全部' }].map(o => (
            <Chip key={o.v} active={queue === o.v} onClick={() => setQueue(o.v)}>{o.l}</Chip>
          ))}
        </FilterRow>

        <FilterRow label="时间">
          {DAY_PRESETS.map(p => (
            <Chip key={p.value} active={days === p.value} onClick={() => setDays(p.value)}>{p.label}</Chip>
          ))}
        </FilterRow>

        {filterOpts && (
          <FilterRow label="地图">
            {filterOpts.maps.map(m => (
              <Chip key={m.id} active={selectedMaps.includes(m.id)} onClick={() => toggleMap(m.id)}>
                {mapName(m.name)}
              </Chip>
            ))}
            {selectedMaps.length > 0 && (
              <Chip active={false} onClick={() => setSelectedMaps([])}>清除</Chip>
            )}
          </FilterRow>
        )}

        {filterOpts && (
          <FilterRow label="英雄">
            {filterOpts.character_ids.map(id => (
              <Chip key={id} active={selectedAgents.includes(id)} onClick={() => toggleAgent(id)}>
                {agentName(id)}
              </Chip>
            ))}
            {selectedAgents.length > 0 && (
              <Chip active={false} onClick={() => setSelectedAgents([])}>清除</Chip>
            )}
          </FilterRow>
        )}

        {friends.length > 0 && (
          <FilterRow label="好友">
            {friends.map(f => (
              <Chip key={f.subject} active={friendSubject === f.subject} onClick={() => toggleFriend(f.subject)}>
                {f.name}
              </Chip>
            ))}
            {friendSubject && (
              <Chip active={false} onClick={() => setFriendSubject('')}>清除</Chip>
            )}
          </FilterRow>
        )}
      </div>

      {/* group-by selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {GROUP_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => setGroupBy(o.value)}
            style={{
              background: groupBy === o.value ? 'rgba(255,70,85,0.15)' : 'var(--surface)',
              border: `1px solid ${groupBy === o.value ? 'var(--accent)' : 'var(--border)'}`,
              color: groupBy === o.value ? 'var(--text)' : 'var(--subtext)',
              borderRadius: 2,
              padding: '7px 18px',
              fontSize: 13,
              fontWeight: groupBy === o.value ? 700 : 400,
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* results */}
      {loading && <p className="loading-text">LOADING...</p>}
      {error && <p style={{ color: 'var(--loss)' }}>{error}</p>}
      {!loading && !error && groupBy === 'map'    && <MapTable    rows={mapRows}    mapNameFn={mapName} />}
      {!loading && !error && groupBy === 'agent'  && <AgentTable  rows={agentRows}  agentNameFn={agentName} agentColorFn={agentColor} />}
      {!loading && !error && groupBy === 'friend' && <FriendTable rows={friendRows} />}
      {!loading && !error && groupBy === 'none'   && summary && <SummaryCard data={summary} />}
    </div>
  );
}
