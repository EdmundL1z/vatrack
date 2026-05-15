import { useState } from 'react';
import Sidebar from './components/Sidebar';
import BattleList from './pages/BattleList';
import BattleDetail from './pages/BattleDetail';
import AgentStats from './pages/AgentStats';
import MapStats from './pages/MapStats';
import TrendStats from './pages/TrendStats';

type Page = 'list' | 'detail' | 'agents' | 'maps' | 'trends';

export default function App() {
  const [page, setPage] = useState<Page>('list');
  const [matchId, setMatchId] = useState<string | null>(null);

  const goToDetail = (id: string) => { setMatchId(id); setPage('detail'); };
  const goToList   = () => { setPage('list'); setMatchId(null); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar page={page} onNavigate={setPage} />
      <main style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        {page === 'list'   && <BattleList onSelectMatch={goToDetail} />}
        {page === 'detail' && matchId && <BattleDetail matchId={matchId} onBack={goToList} />}
        {page === 'agents' && <AgentStats />}
        {page === 'maps'   && <MapStats />}
        {page === 'trends' && <TrendStats />}
      </main>
    </div>
  );
}
