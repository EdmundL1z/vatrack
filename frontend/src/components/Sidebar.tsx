type Page = 'list' | 'detail' | 'agents' | 'maps' | 'trends';

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

const NAV: { label: string; page: Page }[] = [
  { label: '对局记录', page: 'list' },
  { label: '英雄统计', page: 'agents' },
  { label: '地图统计', page: 'maps' },
  { label: 'RR 趋势',  page: 'trends' },
];

export default function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside style={{
      width: 148,
      minHeight: '100vh',
      background: 'var(--sidebar)',
      borderRight: '1px solid var(--border)',
      padding: '24px 0',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '0 20px 28px' }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: 17,
          letterSpacing: '0.2em',
          textShadow: '0 0 18px rgba(255,70,85,0.45)',
        }}>
          <span style={{ color: 'var(--accent)' }}>VA</span>
          <span style={{ color: 'var(--text)' }}>TRACK</span>
        </div>
        <div style={{
          height: 1,
          marginTop: 10,
          background: 'linear-gradient(90deg, var(--accent) 0%, transparent 80%)',
          opacity: 0.6,
        }} />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
        {NAV.map(({ label, page: p }) => {
          const active = page === p || (page === 'detail' && p === 'list');
          return (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              style={{
                background: active ? 'rgba(255,70,85,0.08)' : 'transparent',
                border: 'none',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                color: active ? 'var(--text)' : 'var(--muted)',
                textAlign: 'left',
                padding: '9px 12px',
                borderRadius: '0 2px 2px 0',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: active ? 'inset 4px 0 12px rgba(255,70,85,0.06)' : 'none',
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
