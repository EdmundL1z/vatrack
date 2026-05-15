type Page = 'list' | 'detail' | 'agents' | 'maps' | 'trends';

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

const NAV: { label: string; icon: string; page: Page }[] = [
  { label: '对局记录', icon: '▤', page: 'list' },
  { label: '英雄统计', icon: '◎', page: 'agents' },
  { label: '地图统计', icon: '◈', page: 'maps' },
  { label: 'RR 趋势',  icon: '◉', page: 'trends' },
];

export default function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside style={{
      width: 130,
      minHeight: '100vh',
      background: 'var(--sidebar)',
      borderRight: '1px solid var(--border)',
      padding: '16px 12px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        color: 'var(--accent)',
        fontWeight: 'bold',
        fontSize: 15,
        letterSpacing: 2,
        marginBottom: 24,
      }}>
        VATRACK
      </div>
      {NAV.map(({ label, icon, page: p }) => (
        <button
          key={p}
          onClick={() => onNavigate(p)}
          style={{
            background: page === p ? 'var(--border)' : 'none',
            border: 'none',
            color: page === p ? 'var(--accent)' : 'var(--muted)',
            textAlign: 'left',
            padding: '6px 8px',
            borderRadius: 4,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {icon} {label}
        </button>
      ))}
    </aside>
  );
}
