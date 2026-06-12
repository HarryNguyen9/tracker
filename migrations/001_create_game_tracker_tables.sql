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
  result_type text not null default 'win',
  return_amount numeric not null default 0,
  profit numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table records
  add column if not exists result_type text not null default 'win';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'records_result_type_check'
  ) then
    alter table records
      add constraint records_result_type_check
      check (result_type in ('win', 'loss', 'push'));
  end if;
end $$;

create index if not exists records_player_id_created_at_idx on records (player_id, created_at);
