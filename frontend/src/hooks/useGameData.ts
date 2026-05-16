import agents from '../config/agents.json';
import maps from '../config/maps.json';
import queues from '../config/queues.json';

type AgentEntry = { name_cn: string; name_en: string; color: string };
type MapEntry   = { name_cn: string };

const agentsMap = agents as Record<string, AgentEntry>;
const mapsMap   = maps   as Record<string, MapEntry>;
const queuesMap = queues as Record<string, string>;

export function useGameData() {
  const agentName  = (uuid: string): string => agentsMap[uuid?.toLowerCase()]?.name_cn ?? uuid?.slice(0, 8) ?? '—';
  const agentColor = (uuid: string): string => agentsMap[uuid?.toLowerCase()]?.color   ?? '#555555';
  const mapName    = (en: string):   string => mapsMap[en]?.name_cn  ?? en;
  const queueName  = (id: string):   string => queuesMap[id]         ?? id;
  return { agentName, agentColor, mapName, queueName };
}
