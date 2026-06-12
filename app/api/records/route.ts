import { NextResponse } from "next/server";
import { requireEditAccess } from "../../lib/auth";
import { getSql, isDatabaseConfigError, type RecordRow } from "../../lib/db";
import { jsonError } from "../../lib/http";
import { mapRecord, withBalance } from "../../lib/mappers";
import { ensureTrackerSchema } from "../../lib/schema";
import { cleanOptionalText, parseGreaterThanZeroNumber, parseNonNegativeNumber } from "../../lib/validation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");
    const trash = searchParams.get("trash") === "1";

    if (!playerId) {
      return jsonError(new Error("playerId is required."));
    }

    const sql = getSql();
    await ensureTrackerSchema(sql);
    const rows = trash
      ? ((await sql`
          select id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, created_at, updated_at
          from records
          where player_id = ${playerId}
            and deleted_at is not null
          order by deleted_at desc
        `) as RecordRow[])
      : ((await sql`
          select id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, created_at, updated_at
          from records
          where player_id = ${playerId}
            and deleted_at is null
          order by created_at asc
        `) as RecordRow[]);

    const records = trash ? rows.map(mapRecord).map((record) => ({ ...record, balance: null })) : withBalance(rows.map(mapRecord));
    return NextResponse.json({ records });
  } catch (error) {
    console.error("Unable to load records", error);
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
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    if (!playerId) {
      throw new Error("Player is required.");
    }

    const amount = parseGreaterThanZeroNumber(body.amount, "Amount");
    const rate = parseNonNegativeNumber(body.rate, "Rate");
    const note = cleanOptionalText(body.note);
    const sql = getSql();
    await ensureTrackerSchema(sql);
    const [record] = (await sql`
      insert into records (player_id, amount, rate, status, result_type, return_amount, profit, note)
      values (${playerId}, ${amount}, ${rate}, 'pending', null, 0, 0, ${note})
      returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, created_at, updated_at
    `) as RecordRow[];

    return NextResponse.json({ record: mapRecord(record) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
