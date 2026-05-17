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
  rounds_won: number | null;
  total_rounds: number | null;
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
  name: string | null;
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
  kast: number | null;
  economy_score: number | null;
  first_kills: number | null;
  triple_kills: number | null;
  quadra_kills: number | null;
  penta_kills: number | null;
  clutch_count: number | null;
  bomb_plants: number | null;
  bomb_defuses: number | null;
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

export interface BattleListFilters {
  queues: string[];
  maps: { id: string; name: string }[];
  character_ids: string[];
}

export interface BattleListParams {
  queue?: string;
  map_id?: string;
  character_id?: string;
  skip?: number;
  limit?: number;
}

export const getBattles = (params: BattleListParams = {}) =>
  client.get<BattleListResponse>('/battles', { params });

export const getBattleFilters = () =>
  client.get<BattleListFilters>('/battles/filters');

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
  character_id: string | null;
  won_match: boolean;
  kills: number;
  deaths: number;
  assists: number;
  rr_change: number | null;
  tier_after: number | null;
}

export const getAgentStats = () =>
  client.get<AgentStat[]>('/stats/agents');

export const getMapStats = () =>
  client.get<MapStat[]>('/stats/maps');

export const getTrendStats = (days = 30) =>
  client.get<TrendMatch[]>('/stats/trends', { params: { days } });

export interface FriendStat {
  subject: string;
  name: string;
  played: number;
  wins: number;
  win_rate: number;
}

export const getFriendStats = (subject?: string) =>
  client.get<FriendStat[]>('/stats/friends', subject ? { params: { subject } } : {});
