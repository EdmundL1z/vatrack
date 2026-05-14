import { useState } from 'react';
import Sidebar from './components/Sidebar';
import BattleList from './pages/BattleList';
import BattleDetail from './pages/BattleDetail';

type Page = 'list' | 'detail';

export default function App() {
  const [page, setPage] = useState<Page>('list');
  const [matchId, setMatchId] = useState<string | null>(null);

  const goToDetail = (id: string) => { setMatchId(id); setPage('detail'); };
  const goToList   = () => { setPage('list'); setMatchId(null); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onNavigate={goToList} />
      <main style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        {page === 'list' && <BattleList onSelectMatch={goToDetail} />}
        {page === 'detail' && matchId && (
          <BattleDetail matchId={matchId} onBack={goToList} />
        )}
      </main>
    </div>
  );
}
