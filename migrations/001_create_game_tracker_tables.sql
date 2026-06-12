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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table records
  add column if not exists status text not null default 'pending';

alter table records
  add column if not exists result_type text;

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
