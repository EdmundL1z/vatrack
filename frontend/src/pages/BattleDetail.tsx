import { useEffect, useState } from 'react';
import { getBattle, MatchDetail, Player } from '../api/client';

const QUEUE_NAMES: Record<string, string> = {
  competitive: '竞技',
  unrated:     '普通',
  deathmatch:  '死亡竞赛',
  spikerush:   '单挑',
};

function formatDuration(secs: number): string {
  return `${Math.floor(secs / 60)} 分钟`;
}

function PlayerRow({ p, highlight }: { p: Player; highlight: boolean }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 80px 60px 52px 72px',
      padding: '7px 12px',
      borderBottom: '1px solid var(--border)',
      background: highlight ? '#162536' : 'transparent',
      fontSize: 12,
      alignItems: 'center',
    }}>
      <div>
        <span style={{ color: 'var(--text)' }}>{p.name ?? p.subject.slice(0, 8)}</span>
        {p.is_match_mvp && (
          <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 6 }}>MVP</span>
        )}
        {p.is_team_mvp && !p.is_match_mvp && (
          <span style={{ color: '#f0a500', fontSize: 10, marginLeft: 6 }}>SVP</span>
        )}
      </div>
      <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
        {p.kills}
        <span style={{ color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--loss)' }}>{p.deaths}</span>
        <span style={{ color: 'var(--muted)' }}>/</span>
        {p.assists}
      </div>
      <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
        {p.acs != null ? Math.round(p.acs) : '—'}
      </div>
      <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
        {p.hs_pct != null ? `${p.hs_pct}%` : '—'}
      </div>
      <div style={{ textAlign: 'center', color: 'var(--subtext)' }}>
        {p.total_damage > 0 ? p.total_damage.toLocaleString() : '—'}
      </div>
    </div>
  );
}

function TeamSection({ label, color, players, myCharacterId }: {
  label: string; color: string; players: Player[]; myCharacterId: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        background: color + '22',
        color,
        padding: '5px 12px',
        fontWeight: 'bold',
        fontSize: 11,
        letterSpacing: 1,
      }}>
        {label}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 60px 52px 72px',
        padding: '4px 12px',
        color: 'var(--muted)',
        fontSize: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        <span>玩家</span>
        <span style={{ textAlign: 'center' }}>K/D/A</span>
        <span style={{ textAlign: 'center' }}>ACS</span>
        <span style={{ textAlign: 'center' }}>HS%</span>
        <span style={{ textAlign: 'center' }}>伤害</span>
      </div>
      {players.map(p => (
        <PlayerRow key={p.subject} p={p} highlight={p.character_id === myCharacterId} />
      ))}
    </div>
  );
}

interface Props {
  matchId: string;
  onBack: () => void;
}

export default function BattleDetail({ matchId, onBack }: Props) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getBattle(matchId)
      .then(r => setMatch(r.data))
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>加载中...</p>;
  if (error || !match) return <p style={{ color: 'var(--loss)' }}>{error}</p>;

  const isDm = match.queue_id === 'deathmatch';
  const resultColor = match.won_match ? 'var(--win)' : 'var(--loss)';

  const myPlayer = match.players.find(p => p.character_id === match.character_id);
  const myTeamId = myPlayer?.team_id;
  const sorted = (ps: Player[]) => [...ps].sort((a, b) => (b.acs ?? b.kills) - (a.acs ?? a.kills));
  const myTeam  = sorted(match.players.filter(p => p.team_id === myTeamId));
  const enemies = sorted(match.players.filter(p => p.team_id !== myTeamId));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>
            {match.map_name}
            <span style={{ color: resultColor, marginLeft: 10, fontSize: 14 }}>
              {match.won_match ? '胜' : '负'}
            </span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
            {QUEUE_NAMES[match.queue_id] ?? match.queue_id}
            {match.duration_seconds ? ` · ${formatDuration(match.duration_seconds)}` : ''}
            {match.rr_change != null && (
              <span style={{ color: match.rr_change >= 0 ? 'var(--win)' : 'var(--loss)', marginLeft: 8 }}>
                {match.rr_change >= 0 ? `+${match.rr_change}` : match.rr_change} RR
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
        {isDm ? (
          <TeamSection
            label="所有玩家"
            color="var(--muted)"
            players={sorted(match.players)}
            myCharacterId={match.character_id}
          />
        ) : (
          <>
            <TeamSection
              label="我方"
              color="var(--win)"
              players={myTeam}
              myCharacterId={match.character_id}
            />
            <TeamSection
              label="对方"
              color="var(--loss)"
              players={enemies}
              myCharacterId={match.character_id}
            />
          </>
        )}
      </div>
    </div>
  );
}
