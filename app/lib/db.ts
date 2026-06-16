import { neon } from "@neondatabase/serverless";
import type { RecordStatus, ResultType, WorldCupMatchStatus } from "./types";

export type PlayerRow = {
  id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
};

export type RecordRow = {
  id: string;
  player_id: string;
  amount: string | number;
  rate: string | number;
  status: RecordStatus;
  result_type: ResultType | null;
  return_amount: string | number;
  profit: string | number;
  note: string | null;
  deleted_at: string | Date | null;
  delete_reason: string | null;
  combo_legs: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

export type WorldCupMatchRow = {
  id: string;
  provider: string;
  provider_match_id: string;
  match_number: string | number | null;
  stage: string | null;
  group_name: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: string | number | null;
  away_score: string | number | null;
  kickoff_at: string | Date | null;
  venue: string | null;
  city: string | null;
  status: WorldCupMatchStatus;
  winner: string | null;
  last_synced_at: string | Date;
  updated_at: string | Date;
};

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Database connection string is missing.");
  }

  return neon(databaseUrl);
}

export function isDatabaseConfigError(error: unknown) {
  return error instanceof Error && error.message === "Database connection string is missing.";
}
