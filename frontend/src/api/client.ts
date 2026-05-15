import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
});

export interface MatchSummary {
  match_id: string;
  queue_id: string;
  map_id: string;
  map_name: string;
  character_id: string;
  started_at: number;
  duration_seconds: number;
  won_match: boolean;
  kills: number;
  deaths: number;
  assists: number;
  acs: number | null;
  is_mvp: boolean;
  is_svp: boolean;
  first_kills: number;
  rr_change: number | null;
  tier_before: number | null;
  tier_after: number | null;
}

export interface Player {
  subject: string;
  name: string;
  team_id: string;
  character_id: string;
  kills: number;
  deaths: number;
  assists: number;
  acs: number | null;
  is_match_mvp: boolean;
  is_team_mvp: boolean;
  headshots: number;
  bodyshots: number;
  legshots: number;
  hs_pct: number | null;
  total_damage: number;
  kast: number;
  first_kills: number;
  triple_kills: number;
  quadra_kills: number;
  penta_kills: number;
  clutch_count: number;
  bomb_plants: number;
  bomb_defuses: number;
  is_friend: boolean;
}

export interface MatchDetail extends MatchSummary {
  ap_event_id: string;
  players: Player[];
}

export interface BattleListResponse {
  total: number;
  matches: MatchSummary[];
}

export const getBattles = (limit = 50) =>
  client.get<BattleListResponse>("/battles", { params: { limit } });

export const getBattle = (id: string) =>
  client.get<MatchDetail>(`/battles/${id}`);

export interface AgentStat {
  character_id: string;
  played: number;
  wins: number;
  win_rate: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  kd_ratio: number;
}

export interface MapStat {
  map_id: string;
  map_name: string;
  played: number;
  wins: number;
  win_rate: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
}

export interface TrendMatch {
  match_id: string;
  started_at: number;
  map_name: string;
  won_match: boolean;
  kills: number;
  deaths: number;
  rr_change: number | null;
  tier_after: number | null;
}

export const getAgentStats = () =>
  client.get<AgentStat[]>('/stats/agents');

export const getMapStats = () =>
  client.get<MapStat[]>('/stats/maps');

export const getTrendStats = (days = 30) =>
  client.get<TrendMatch[]>('/stats/trends', { params: { days } });
