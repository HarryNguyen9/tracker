import { NextResponse } from "next/server";
import { requireEditAccess } from "../../lib/auth";
import { getSql, isDatabaseConfigError, type PlayerRow } from "../../lib/db";
import { jsonError } from "../../lib/http";
import { mapPlayer, toNumber } from "../../lib/mappers";
import { ensureTrackerSchema, ensureTrackerSchemaIfNeeded } from "../../lib/schema";
import type { PlayerSummary } from "../../lib/types";
import { cleanText } from "../../lib/validation";

type Sql = ReturnType<typeof getSql>;
type SummaryValue = string | number;
type PlayerSummaryRow = PlayerRow & {
  total_amount: SummaryValue;
  total_return: SummaryValue;
  total_profit: SummaryValue;
  record_count: SummaryValue;
  finalized_record_count: SummaryValue;
  pending_record_count: SummaryValue;
  trashed_record_count: SummaryValue;
  win_count: SummaryValue;
  loss_count: SummaryValue;
  draw_count: SummaryValue;
};

async function loadPlayerSummaries(sql: Sql): Promise<PlayerSummary[]> {
  const rows = (await sql`
    select
      p.id,
      p.name,
      p.created_at,
      p.updated_at,
      coalesce(sum(r.amount) filter (where r.deleted_at is null and r.status = 'finalized'), 0) as total_amount,
      coalesce(sum(r.return_amount) filter (where r.deleted_at is null and r.status = 'finalized'), 0) as total_return,
      coalesce(sum(r.profit) filter (where r.deleted_at is null and r.status = 'finalized'), 0) as total_profit,
      count(r.id) filter (where r.deleted_at is null) as record_count,
      count(r.id) filter (where r.deleted_at is null and r.status = 'finalized') as finalized_record_count,
      count(r.id) filter (where r.deleted_at is null and r.status = 'pending') as pending_record_count,
      count(r.id) filter (where r.deleted_at is not null) as trashed_record_count,
      count(r.id) filter (where r.deleted_at is null and r.status = 'finalized' and r.result_type = 'win') as win_count,
      count(r.id) filter (where r.deleted_at is null and r.status = 'finalized' and r.result_type = 'loss') as loss_count,
      count(r.id) filter (where r.deleted_at is null and r.status = 'finalized' and r.result_type = 'draw') as draw_count
    from players p
    left join records r on r.player_id = p.id
    group by p.id, p.name, p.created_at, p.updated_at
    order by p.created_at asc
  `) as PlayerSummaryRow[];

  return rows.map((row) => {
    const player = mapPlayer(row);
    const totalProfit = toNumber(row.total_profit);

    return {
      ...player,
      totalAmount: toNumber(row.total_amount),
      totalReturn: toNumber(row.total_return),
      totalProfit,
      balance: totalProfit,
      recordCount: toNumber(row.record_count),
      finalizedRecordCount: toNumber(row.finalized_record_count),
      pendingRecordCount: toNumber(row.pending_record_count),
      trashedRecordCount: toNumber(row.trashed_record_count),
      winCount: toNumber(row.win_count),
      lossCount: toNumber(row.loss_count),
      drawCount: toNumber(row.draw_count),
    };
  });
}

export async function GET() {
  try {
    const sql = getSql();
    let summaries: PlayerSummary[];
    try {
      summaries = await loadPlayerSummaries(sql);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      summaries = await loadPlayerSummaries(sql);
    }

    return NextResponse.json({ players: summaries });
  } catch (error) {
    console.error("Unable to load players", error);
    if (isDatabaseConfigError(error)) {
      return jsonError(error, 500, "Database is not configured. Add DATABASE_URL and restart the app.");
    }
    return jsonError(error, 500, "Unable to load data. Please try again.");
  }
}

export async function POST(request: Request) {
  try {
    requireEditAccess();
    const body = await request.json();
    const name = cleanText(body.name, "Player name");
    const sql = getSql();
    await ensureTrackerSchema(sql);
    const [player] = (await sql`
      insert into players (name)
      values (${name})
      returning id, name, created_at, updated_at
    `) as PlayerRow[];

    return NextResponse.json({ player: mapPlayer(player) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
