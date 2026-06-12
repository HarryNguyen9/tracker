import type { getSql } from "./db";

type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;

export async function ensureTrackerSchema(sql: Sql) {
  schemaReady ??= applyTrackerSchema(sql).catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}

async function applyTrackerSchema(sql: Sql) {
  await sql`create extension if not exists pgcrypto`;

  await sql`
    create table if not exists players (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
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
    )
  `;

  await sql`alter table records add column if not exists status text not null default 'pending'`;
  await sql`alter table records add column if not exists result_type text`;
  await sql`alter table records alter column result_type drop not null`;
  await sql`alter table records alter column result_type drop default`;
  await sql`update records set result_type = 'draw' where result_type = 'pu' || 'sh'`;
  await sql`
    update records
    set status = 'finalized'
    where status = 'pending'
      and result_type is not null
  `;
  await sql`alter table records drop constraint if exists records_status_check`;
  await sql`
    alter table records
    add constraint records_status_check
    check (status in ('pending', 'finalized'))
  `;
  await sql`alter table records drop constraint if exists records_result_type_check`;
  await sql`
    alter table records
    add constraint records_result_type_check
    check (result_type is null or result_type in ('win', 'loss', 'draw'))
  `;
  await sql`create index if not exists records_player_id_created_at_idx on records (player_id, created_at)`;
}
