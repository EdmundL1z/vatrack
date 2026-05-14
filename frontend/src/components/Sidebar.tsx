interface SidebarProps {
  onNavigate: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
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
      <button
        onClick={onNavigate}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          textAlign: 'left',
          padding: '6px 8px',
          borderRadius: 4,
          fontSize: 13,
        }}
      >
        ▤ 对局记录
      </button>
      <button
        disabled
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--muted)',
          textAlign: 'left',
          padding: '6px 8px',
          borderRadius: 4,
          fontSize: 13,
          cursor: 'not-allowed',
        }}
      >
        ◎ 英雄统计
      </button>
    </aside>
  );
}
