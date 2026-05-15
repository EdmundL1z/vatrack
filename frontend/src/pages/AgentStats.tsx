import { useEffect, useState } from 'react';
import { getAgentStats } from '../api/client';
import type { AgentStat } from '../api/client';

const AGENT_NAMES: Record<string, string> = {
  '9f0d8ba9-4140-b941-57d3-a7ad57c6b417': 'Brimstone',
  '707eab51-4836-f488-046a-cda6bf494859': 'Viper',
  '8e253930-4c05-31dd-1b6c-968525494517': 'Omen',
  '1e58de9c-4950-5125-93e9-a0aee9f98746': 'Killjoy',
  '117ed9e3-49f3-6512-3ccf-0cada7e3823b': 'Cypher',
  '320b2a48-4d9b-a075-30f1-1f93a9b638fa': 'Sova',
  '569fdd95-4d10-43ab-ca70-79becc718b46': 'Sage',
  'eb93336a-449b-9c1e-0ac7-dfe9992400f5': 'Phoenix',
  'add6443a-41bd-e414-f6ad-e58d267f4e95': 'Jett',
  'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc': 'Reyna',
  'f94c3b30-42be-e959-889c-5aa313dba261': 'Raze',
  '5f8d3a7f-467b-97f3-062c-13acf203c006': 'Breach',
  '6f2a04ca-43e0-be17-7f36-b3908627744d': 'Skye',
  '7f94d92c-4234-0a36-9646-3a87eb8b5c89': 'Yoru',
  '41fb69c1-4189-7b37-f117-bcaf1e96f1bf': 'Astra',
  '601dbbe7-43ce-be57-2a40-4abd24953621': 'KAY/O',
  '22697a3d-45bf-8dd7-4fec-84a9e28c69d4': 'Chamber',
  'bb2a4828-46eb-8cd1-e765-15848195d751': 'Neon',
  'dade69b4-4f5a-8528-247b-219e5a1facd6': 'Fade',
  '95b78ed7-4637-86d9-7e41-71ba8c293152': 'Harbor',
  'e370fa57-4757-3604-3648-499e1f642d3f': 'Gekko',
  'cc8b64c8-4b25-4ff9-6e7f-37b4da43d235': 'Deadlock',
  '0e38b510-41a8-5780-5e8f-568b2a4f2d6c': 'Iso',
  '1dbf2ded-4bfd-8cbe-be13-b6f85beac82d': 'Clove',
  'efba5359-4016-a1e5-7626-b1ae1db4294e': 'Vyse',
};

function agentName(characterId: string): string {
  return AGENT_NAMES[characterId.toLowerCase()] ?? characterId.slice(0, 8);
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
