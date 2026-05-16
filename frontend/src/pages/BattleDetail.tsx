import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getBattle } from '../api/client';
import type { MatchDetail, Player } from '../api/client';
import { useGameData } from '../hooks/useGameData';

function formatDuration(secs: number): string {
  return `${Math.floor(secs / 60)}分${String(secs % 60).padStart(2, '0')}秒`;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

type Tab = '战绩' | '特殊';

function multiKillColor(count: number | null | undefined): string | undefined {
  if (!count || count < 3) return undefined;
  if (count >= 5) return '#ff4655';
  if (count >= 4) return '#ff8c00';
  return '#f0a500';
}

function StatCell({ value }: { value: string | number | null | undefined }) {
  const display = (value == null || value === 0) ? '—' : String(value);
  return (
    <div style={{ textAlign: 'center' as CSSProperties['textAlign'], color: display === '—' ? 'var(--muted)' : 'var(--subtext)' }}>
      {display}
    </div>
  );
}

const COL_PERF    = '80px 1fr 55px 80px 50px 70px 55px';
const COL_SPECIAL = '80px 1fr 40px 40px 40px 40px 50px 40px 40px 55px';
const PERF_HEADERS    = ['英雄', '玩家', 'ACS', 'K/D/A', 'HS%', '伤害', 'KAST%'];
const SPECIAL_HEADERS = ['英雄', '玩家', '首杀', '三杀', '四杀', '五杀', 'Clutch', '种弹', '拆弹', '经济分'];

function PlayerRow({ p, highlight, tab, cols, agentNameFn }: {
  p: Player; highlight: boolean; tab: Tab; cols: string; agentNameFn: (uuid: string) => string;
}) {
  const name = p.name ?? p.subject.slice(0, 8);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols,
      padding: '7px 12px', borderBottom: '1px solid var(--border)',
      background: highlight ? '#162536' : 'transparent',
      fontSize: 12, alignItems: 'center', gap: 4,
    }}>
      <div style={{ color: 'var(--subtext)', fontSize: 11 }}>{agentNameFn(p.character_id)}</div>
      <div>
        {name}
        {p.is_match_mvp && <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 5 }}>MVP</span>}
        {p.is_team_mvp && !p.is_match_mvp && <span style={{ color: '#f0a500', fontSize: 10, marginLeft: 5 }}>SVP</span>}
      </div>

      {tab === '战绩' ? <>
        <StatCell value={p.acs != null ? Math.round(p.acs) : null} />
        <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
          {p.kills}<span style={{ color: 'var(--muted)' }}>/</span>
          <span style={{ color: 'var(--loss)' }}>{p.deaths}</span>
          <span style={{ color: 'var(--muted)' }}>/</span>{p.assists}
        </div>
        <StatCell value={p.hs_pct != null ? `${p.hs_pct}%` : null} />
        <StatCell value={p.total_damage > 0 ? p.total_damage.toLocaleString() : null} />
        <StatCell value={p.kast != null ? `${Math.round(p.kast * 100)}%` : null} />
      </> : <>
        <StatCell value={p.first_kills} />
        <div style={{ textAlign: 'center', color: multiKillColor(p.triple_kills) ?? 'var(--muted)' }}>
          {p.triple_kills || '—'}
        </div>
        <div style={{ textAlign: 'center', color: multiKillColor(p.quadra_kills) ?? 'var(--muted)' }}>
          {p.quadra_kills || '—'}
        </div>
        <div style={{ textAlign: 'center', color: multiKillColor(p.penta_kills) ?? 'var(--muted)' }}>
          {p.penta_kills || '—'}
        </div>
        <StatCell value={p.clutch_count} />
        <StatCell value={p.bomb_plants} />
        <StatCell value={p.bomb_defuses} />
        <StatCell value={p.economy_score} />
      </>}
    </div>
  );
}

function TeamSection({ label, color, players, mySubject, tab, agentNameFn }: {
  label: string; color: string; players: Player[]; mySubject: string; tab: Tab;
  agentNameFn: (uuid: string) => string;
}) {
  const cols = tab === '战绩' ? COL_PERF : COL_SPECIAL;
  const headers = tab === '战绩' ? PERF_HEADERS : SPECIAL_HEADERS;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ background: color + '22', color, padding: '4px 12px', fontWeight: 'bold', fontSize: 11 }}>
        {label}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, padding: '4px 12px',
        color: 'var(--muted)', fontSize: 10, borderBottom: '1px solid var(--border)', gap: 4,
      }}>
        {headers.map((h, i) => (
          <span key={h} style={{ textAlign: (i === 0 || i === 1) ? 'left' : 'center' }}>{h}</span>
        ))}
      </div>
      {players.map(p => (
        <PlayerRow key={p.subject} p={p} highlight={p.subject === mySubject}
          tab={tab} cols={cols} agentNameFn={agentNameFn} />
      ))}
    </div>
  );
}

interface Props { matchId: string; onBack: () => void; }

export default function BattleDetail({ matchId, onBack }: Props) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('战绩');
  const { agentName, agentColor, mapName, queueName } = useGameData();

  useEffect(() => {
    setLoading(true);
    getBattle(matchId).then(r => setMatch(r.data)).catch(() => setError('加载失败')).finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error || !match) return <p style={{ color: 'var(--loss)' }}>{error ?? '加载失败'}</p>;

  const isDm = match.queue_id === 'deathmatch';
  const resultColor = match.won_match ? 'var(--win)' : 'var(--loss)';
  const rrLabel = match.rr_change != null
    ? (match.rr_change >= 0 ? `+${match.rr_change} RR` : `${match.rr_change} RR`)
    : null;
  const rrColor = (match.rr_change ?? -1) >= 0 ? 'var(--win)' : 'var(--loss)';
  const score = match.rounds_won != null && match.total_rounds != null
    ? `${match.rounds_won} : ${match.total_rounds - match.rounds_won}`
    : null;

  // character_id is the agent UUID we played; use kills/deaths as tiebreaker
  // in the rare case an enemy played the same agent (mirror picks are allowed cross-team)
  const myCandidates = match.players.filter(p => p.character_id === match.character_id);
  const myPlayer = myCandidates.length <= 1
    ? myCandidates[0]
    : (myCandidates.find(p => p.kills === match.kills && p.deaths === match.deaths) ?? myCandidates[0]);
  const myTeamId = myPlayer?.team_id;
  const sortByAcs = (ps: Player[]) => [...ps].sort((a, b) => (b.acs ?? b.kills) - (a.acs ?? a.kills));
  const myTeam  = sortByAcs(match.players.filter(p => p.team_id === myTeamId));
  const enemies = sortByAcs(match.players.filter(p => p.team_id !== myTeamId));

  const tabStyle = (t: Tab): CSSProperties => ({
    padding: '6px 20px', cursor: 'pointer', fontSize: 13, border: 'none',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent', color: tab === t ? 'var(--text)' : 'var(--muted)',
  });

  return (
    <div>
      <button onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', marginBottom: 12 }}>
        ←
      </button>

      <div style={{
        background: 'var(--surface)', borderRadius: 8, padding: '16px 20px', marginBottom: 16,
        borderLeft: `4px solid ${resultColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <span style={{ color: resultColor, fontSize: 22, fontWeight: 'bold' }}>
            {isDm ? 'DM' : match.won_match ? '胜' : '负'}
          </span>
          {score && <span style={{ fontSize: 18, fontWeight: 'bold' }}>{score}</span>}
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {mapName(match.map_name)} · {queueName(match.queue_id)}
            {match.duration_seconds ? ` · ${formatDuration(match.duration_seconds)}` : ''}
            {match.started_at ? ` · ${formatDateTime(match.started_at)}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: agentColor(match.character_id), flexShrink: 0 }} />
          <span style={{ fontWeight: 500 }}>{agentName(match.character_id)}</span>
          {myPlayer && (
            <span style={{ color: 'var(--muted)' }}>
              {myPlayer.kills} / {myPlayer.deaths} / {myPlayer.assists}
            </span>
          )}
          {myPlayer?.acs != null && (
            <span style={{ color: 'var(--muted)' }}>ACS {Math.round(myPlayer.acs)}</span>
          )}
          {rrLabel && (
            <span style={{ color: rrColor, fontWeight: 'bold' }}>
              {rrLabel}
            </span>
          )}
          {match.is_mvp && <span style={{ color: 'var(--accent)', fontSize: 11 }}>☆ MVP</span>}
          {match.is_svp && !match.is_mvp && <span style={{ color: '#f0a500', fontSize: 11 }}>☆ SVP</span>}
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
        {(['战绩', '特殊'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>{t}</button>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
        {isDm ? (
          <TeamSection label="所有玩家" color="var(--muted)"
            players={sortByAcs(match.players)} mySubject={myPlayer?.subject ?? ''}
            tab={tab} agentNameFn={agentName} />
        ) : (
          <>
            <TeamSection label="我方" color="var(--win)" players={myTeam}
              mySubject={myPlayer?.subject ?? ''} tab={tab} agentNameFn={agentName} />
            <TeamSection label="对方" color="var(--loss)" players={enemies}
              mySubject={myPlayer?.subject ?? ''} tab={tab} agentNameFn={agentName} />
          </>
        )}
      </div>
    </div>
  );
}
