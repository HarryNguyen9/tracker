import { neon } from "@neondatabase/serverless";
import type { RecordStatus, ResultType } from "./types";

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
  created_at: string | Date;
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
