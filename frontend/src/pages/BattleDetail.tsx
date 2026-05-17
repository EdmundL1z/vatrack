import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getBattle } from '../api/client';
import type { MatchDetail, Player } from '../api/client';
import { useGameData } from '../hooks/useGameData';

function formatDuration(secs: number): string {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
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
  return '#f0c040';
}

function StatCell({ value }: { value: string | number | null | undefined }) {
  const display = (value == null || value === 0) ? '—' : String(value);
  return (
    <div style={{
      textAlign: 'center' as CSSProperties['textAlign'],
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: display === '—' ? 'var(--muted)' : 'var(--subtext)',
    }}>
      {display}
    </div>
  );
}

const COL_PERF    = '38px 160px 92px 60px 50px 72px 52px';
const COL_SPECIAL = '38px 160px 40px 40px 40px 40px 52px 40px 40px 56px';
const PERF_HEADERS    = ['英雄', '玩家', 'K/D/A', 'ACS', 'HS%', '伤害', 'KAST%'];
const SPECIAL_HEADERS = ['英雄', '玩家', '首杀', '三杀', '四杀', '五杀', 'Clutch', '种弹', '拆弹', '经济分'];

function PlayerRow({ p, highlight, tab, cols, agentNameFn }: {
  p: Player; highlight: boolean; tab: Tab; cols: string; agentNameFn: (uuid: string) => string;
}) {
  const name = p.name ?? p.subject.slice(0, 8);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols,
      padding: '8px 14px', borderBottom: '1px solid var(--border)',
      background: highlight ? 'rgba(255,70,85,0.06)' : 'transparent',
      borderLeft: highlight ? '2px solid rgba(255,70,85,0.5)' : '2px solid transparent',
      fontSize: 12, alignItems: 'center', gap: 4,
    }}>
      <div style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {agentNameFn(p.character_id)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: highlight ? 600 : 400 }}>
          {name}
        </span>
        {p.is_match_mvp && (
          <span style={{ color: 'var(--accent)', fontSize: 9, flexShrink: 0, letterSpacing: '0.06em' }}>MVP</span>
        )}
        {p.is_team_mvp && !p.is_match_mvp && (
          <span style={{ color: 'var(--gold)', fontSize: 9, flexShrink: 0, letterSpacing: '0.06em' }}>SVP</span>
        )}
        {p.is_friend && (
          <span style={{
            fontSize: 9, flexShrink: 0, color: 'var(--win)',
            border: '1px solid rgba(0,212,160,0.35)', borderRadius: 1,
            padding: '1px 4px', letterSpacing: '0.04em',
          }}>友</span>
        )}
      </div>

      {tab === '战绩' ? <>
        {/* KDA first — most-watched stat */}
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {p.kills}<span style={{ color: 'var(--muted)' }}>/</span>
          <span style={{ color: 'var(--loss)' }}>{p.deaths}</span>
          <span style={{ color: 'var(--muted)' }}>/</span>{p.assists}
        </div>
        <StatCell value={p.acs != null ? Math.round(p.acs) : null} />
        <StatCell value={p.hs_pct != null ? `${p.hs_pct}%` : null} />
        <StatCell value={p.total_damage > 0 ? p.total_damage.toLocaleString() : null} />
        <StatCell value={p.kast != null ? `${Math.round(p.kast * 100)}%` : null} />
      </> : <>
        <StatCell value={p.first_kills} />
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: multiKillColor(p.triple_kills) ?? 'var(--muted)' }}>
          {p.triple_kills || '—'}
        </div>
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: multiKillColor(p.quadra_kills) ?? 'var(--muted)' }}>
          {p.quadra_kills || '—'}
        </div>
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: multiKillColor(p.penta_kills) ?? 'var(--muted)' }}>
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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px',
        background: 'var(--surface-hi)',
        borderLeft: `2px solid ${color}`,
      }}>
        <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>{label}</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, padding: '5px 14px',
        color: 'var(--muted)', fontSize: 10, letterSpacing: '0.06em',
        borderBottom: '1px solid var(--border)', gap: 4,
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

  if (loading) return <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em' }}>LOADING...</p>;
  if (error || !match) return <p style={{ color: 'var(--loss)' }}>{error ?? '加载失败'}</p>;

  const isDm = match.queue_id === 'deathmatch';
  const resultColor = match.won_match ? '#00d4a0' : '#ff4655';
  const rrLabel = match.rr_change != null
    ? (match.rr_change >= 0 ? `+${match.rr_change} RR` : `${match.rr_change} RR`)
    : null;
  const rrColor = (match.rr_change ?? -1) >= 0 ? 'var(--win)' : 'var(--loss)';
  const score = match.rounds_won != null && match.total_rounds != null
    ? `${match.rounds_won} : ${match.total_rounds - match.rounds_won}`
    : null;

  const myCandidates = match.players.filter(p => p.character_id === match.character_id);
  const myPlayer = myCandidates.length <= 1
    ? myCandidates[0]
    : (myCandidates.find(p => p.kills === match.kills && p.deaths === match.deaths) ?? myCandidates[0]);
  const myTeamId = myPlayer?.team_id;
  const sortByAcs = (ps: Player[]) => [...ps].sort((a, b) => (b.acs ?? b.kills) - (a.acs ?? a.kills));
  const myTeam  = sortByAcs(match.players.filter(p => p.team_id === myTeamId));
  const enemies = sortByAcs(match.players.filter(p => p.team_id !== myTeamId));

  const tabStyle = (t: Tab): CSSProperties => ({
    padding: '7px 22px', cursor: 'pointer', fontSize: 13, border: 'none',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    color: tab === t ? 'var(--text)' : 'var(--muted)',
    fontFamily: 'var(--font-ui)',
    letterSpacing: '0.04em',
    fontWeight: tab === t ? 600 : 400,
  });

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', color: 'var(--muted)',
          fontSize: 13, cursor: 'pointer', marginBottom: 16,
          letterSpacing: '0.06em', padding: 0,
          fontFamily: 'var(--font-ui)',
        }}
      >
        ← 返回
      </button>

      <div style={{
        background: 'var(--surface)',
        borderRadius: 2,
        border: '1px solid var(--border)',
        borderLeft: `2px solid ${resultColor}`,
        boxShadow: `inset 4px 0 24px ${resultColor}10`,
        padding: '16px 20px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ color: resultColor, fontSize: 26, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1 }}>
            {isDm ? 'DM' : match.won_match ? '胜' : '负'}
          </span>
          {score && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--text)', letterSpacing: '0.08em' }}>
              {score}
            </span>
          )}
          <span style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: '0.04em', marginLeft: 4 }}>
            {mapName(match.map_name)} · {queueName(match.queue_id)}
            {match.duration_seconds ? ` · ${formatDuration(match.duration_seconds)}` : ''}
            {match.started_at ? ` · ${formatDateTime(match.started_at)}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 1,
            background: agentColor(match.character_id),
            boxShadow: `0 0 6px ${agentColor(match.character_id)}`,
            flexShrink: 0,
          }} />
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '0.02em' }}>{agentName(match.character_id)}</span>
          {myPlayer && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--subtext)' }}>
              {myPlayer.kills}/{myPlayer.deaths}/{myPlayer.assists}
            </span>
          )}
          {myPlayer?.acs != null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
              ACS {Math.round(myPlayer.acs)}
            </span>
          )}
          {rrLabel && (
            <span style={{ color: rrColor, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {rrLabel}
            </span>
          )}
          {match.is_mvp && <span style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: '0.08em' }}>★ MVP</span>}
          {match.is_svp && !match.is_mvp && <span style={{ color: 'var(--gold)', fontSize: 11, letterSpacing: '0.08em' }}>★ SVP</span>}
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
        {(['战绩', '特殊'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>{t}</button>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 2, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {isDm ? (
          <TeamSection label="所有玩家" color="var(--muted)"
            players={sortByAcs(match.players)} mySubject={myPlayer?.subject ?? ''}
            tab={tab} agentNameFn={agentName} />
        ) : (
          <>
            <TeamSection label="我方" color="#00d4a0" players={myTeam}
              mySubject={myPlayer?.subject ?? ''} tab={tab} agentNameFn={agentName} />
            <TeamSection label="对方" color="#ff4655" players={enemies}
              mySubject={myPlayer?.subject ?? ''} tab={tab} agentNameFn={agentName} />
          </>
        )}
      </div>
    </div>
  );
}
