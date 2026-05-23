type Page = 'list' | 'detail' | 'agents' | 'maps' | 'trends' | 'friends';

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

const NAV: { label: string; page: Page }[] = [
  { label: '对局记录', page: 'list' },
  { label: '英雄统计', page: 'agents' },
  { label: '地图统计', page: 'maps' },
  { label: 'RR 趋势',  page: 'trends' },
  { label: '好友统计', page: 'friends' },
];

export default function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside style={{
      width: 168,
      minHeight: '100vh',
      background: 'var(--sidebar)',
      borderRight: '1px solid var(--border)',
      padding: '28px 0',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '0 18px 28px' }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: '0.24em',
          lineHeight: 1,
          marginBottom: 8,
        }}>
          <span style={{ color: 'var(--accent)', textShadow: '0 0 24px rgba(255,70,85,0.55)' }}>VA</span>
          <span style={{ color: 'var(--text)' }}>TRACK</span>
        </div>
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, var(--accent) 0%, rgba(255,70,85,0.2) 60%, transparent 100%)',
          marginBottom: 5,
        }} />
        <div style={{
          fontSize: 8,
          letterSpacing: '0.22em',
          color: 'var(--muted)',
          fontFamily: 'var(--font-mono)',
        }}>STAT TRACKER</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
        {NAV.map(({ label, page: p }) => {
          const active = page === p || (page === 'detail' && p === 'list');
          return (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              className="nav-btn"
              style={{
                background: active ? 'rgba(255,70,85,0.1)' : 'transparent',
                border: 'none',
                borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                color: active ? 'var(--text)' : 'var(--subtext)',
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: '0 3px 3px 0',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                boxShadow: active ? 'inset 4px 0 16px rgba(255,70,85,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
