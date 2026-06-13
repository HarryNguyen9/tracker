create extension if not exists pgcrypto;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  amount numeric not null default 0,
  rate numeric not null default 0,
  status text not null default 'pending',
  result_type text,
  return_amount numeric not null default 0,
  profit numeric not null default 0,
  note text,
  deleted_at timestamptz,
  delete_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists world_cup_matches (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'football-data',
  provider_match_id text not null,
  match_number integer,
  stage text,
  group_name text,
  home_team text,
  away_team text,
  home_score integer,
  away_score integer,
  kickoff_at timestamptz,
  venue text,
  city text,
  status text not null default 'scheduled',
  winner text,
  raw_data jsonb,
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table records
  add column if not exists status text not null default 'pending';

alter table records
  add column if not exists result_type text;

alter table records
  add column if not exists deleted_at timestamptz;

alter table records
  add column if not exists delete_reason text;

alter table records
  alter column result_type drop not null;

alter table records
  alter column result_type drop default;

update records
set result_type = 'draw'
where result_type = 'pu' || 'sh';

update records
set status = 'finalized'
where status = 'pending'
  and result_type is not null;

alter table records
  drop constraint if exists records_status_check;

alter table records
  add constraint records_status_check
  check (status in ('pending', 'finalized'));

alter table records
  drop constraint if exists records_result_type_check;

alter table records
  add constraint records_result_type_check
  check (result_type is null or result_type in ('win', 'loss', 'draw'));

create index if not exists records_player_id_created_at_idx on records (player_id, created_at);

create index if not exists records_player_id_deleted_at_idx on records (player_id, deleted_at);

alter table world_cup_matches
  add column if not exists provider text not null default 'football-data';

alter table world_cup_matches
  add column if not exists provider_match_id text;

alter table world_cup_matches
  add column if not exists match_number integer;

alter table world_cup_matches
  add column if not exists stage text;

alter table world_cup_matches
  add column if not exists group_name text;

alter table world_cup_matches
  add column if not exists home_team text;

alter table world_cup_matches
  add column if not exists away_team text;

alter table world_cup_matches
  add column if not exists home_score integer;

alter table world_cup_matches
  add column if not exists away_score integer;

alter table world_cup_matches
  add column if not exists kickoff_at timestamptz;

alter table world_cup_matches
  add column if not exists venue text;

alter table world_cup_matches
  add column if not exists city text;

alter table world_cup_matches
  add column if not exists status text not null default 'scheduled';

alter table world_cup_matches
  add column if not exists winner text;

alter table world_cup_matches
  add column if not exists raw_data jsonb;

alter table world_cup_matches
  add column if not exists last_synced_at timestamptz not null default now();

alter table world_cup_matches
  add column if not exists updated_at timestamptz not null default now();

alter table world_cup_matches
  drop constraint if exists world_cup_matches_status_check;

alter table world_cup_matches
  add constraint world_cup_matches_status_check
  check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled'));

create unique index if not exists world_cup_matches_provider_match_id_idx on world_cup_matches (provider, provider_match_id);

create index if not exists world_cup_matches_kickoff_at_idx on world_cup_matches (kickoff_at);
