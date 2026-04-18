export type MoveClassification =
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface MoveData {
  ply_number: number;
  move_number: number;
  color: "white" | "black";
  san: string;
  uci: string;
  fen_before: string;
  fen_after: string;
  eval_before_cp: number | null;
  eval_after_cp: number | null;
  eval_before_mate: number | null;
  eval_after_mate: number | null;
  eval_delta_cp: number | null;
  best_move_san: string | null;
  best_move_uci: string | null;
  classification: MoveClassification | null;
  explanation: string | null;
  pattern_tag: "fork" | "hanging" | "pin" | "skewer" | "discovered_attack" | "back_rank" | null;
}

export interface GameSummaryData {
  accuracy_white: number | null;
  accuracy_black: number | null;
  blunders_white: number;
  blunders_black: number;
  mistakes_white: number;
  mistakes_black: number;
  inaccuracies_white: number;
  inaccuracies_black: number;
  critical_moment_ply: number | null;
  summary_text: string | null;
}

export interface GameData {
  game_id: string;
  status: "pending" | "processing" | "done" | "failed";
  source: "chess_com" | "manual_pgn";
  white_player: string | null;
  black_player: string | null;
  user_color: "white" | "black" | null;
  result: string | null;
  time_control: string | null;
  eco_code: string | null;
  opening_name: string | null;
  white_elo: number | null;
  black_elo: number | null;
  played_at: string | null;
  created_at: string;
  moves: MoveData[];
  summary: GameSummaryData | null;
}

export interface GameStatusData {
  game_id: string;
  status: "pending" | "processing" | "done" | "failed";
  error_message: string | null;
}

export interface SubmitResponse {
  game_id: string;
  status: string;
}

export interface ImportChessComResponse {
  username: string;
  queued: number;
  skipped: number;
}

export interface ColorStats {
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  avg_accuracy: number | null;
}

export interface OpeningStatsItem {
  opening_name: string | null;
  eco_code: string | null;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  avg_accuracy: number | null;
  is_gambit: boolean;
  gambit_color: "white" | "black" | null;
  as_white: ColorStats | null;
  as_black: ColorStats | null;
}

export interface GameListItem {
  game_id: string;
  status: "pending" | "processing" | "done" | "failed";
  source: "chess_com" | "lichess" | "manual_pgn";
  white_player: string | null;
  black_player: string | null;
  user_color: "white" | "black" | null;
  result: string | null;
  opening_name: string | null;
  eco_code: string | null;
  time_control: string | null;
  white_elo: number | null;
  black_elo: number | null;
  played_at: string | null;
  created_at: string;
  accuracy_white: number | null;
  accuracy_black: number | null;
  blunders_white: number | null;
  blunders_black: number | null;
  mistakes_white: number | null;
  mistakes_black: number | null;
  inaccuracies_white: number | null;
  inaccuracies_black: number | null;
}
