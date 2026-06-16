-- Migration 002: Add combo_legs column to records table
-- This stores the individual legs of a combo bet with their amounts and outcomes

alter table records
  add column if not exists combo_legs jsonb;

-- Add index for querying combo records
create index if not exists records_combo_legs_idx on records using gin (combo_legs);