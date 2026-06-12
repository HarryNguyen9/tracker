import { NextResponse } from "next/server";
import { requireEditAccess } from "../../lib/auth";
import { getSql, type RecordRow } from "../../lib/db";
import { jsonError } from "../../lib/http";
import { mapRecord, withBalance } from "../../lib/mappers";
import { cleanOptionalText, parsePositiveNumber } from "../../lib/validation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");

    if (!playerId) {
      return jsonError(new Error("playerId is required."));
    }

    const sql = getSql();
    const rows = (await sql`
      select id, player_id, amount, rate, return_amount, profit, note, created_at, updated_at
      from records
      where player_id = ${playerId}
      order by created_at asc
    `) as RecordRow[];

    const records = withBalance(rows.map(mapRecord));
    return NextResponse.json({ records });
  } catch (error) {
    return jsonError(error, 500);
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

    const amount = parsePositiveNumber(body.amount, "Amount");
    const rate = parsePositiveNumber(body.rate, "Rate");
    const returnAmount = amount * rate;
    const profit = returnAmount - amount;
    const note = cleanOptionalText(body.note);
    const sql = getSql();
    const [record] = (await sql`
      insert into records (player_id, amount, rate, return_amount, profit, note)
      values (${playerId}, ${amount}, ${rate}, ${returnAmount}, ${profit}, ${note})
      returning id, player_id, amount, rate, return_amount, profit, note, created_at, updated_at
    `) as RecordRow[];

    return NextResponse.json({ record: mapRecord(record) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("access") ? 401 : 400);
  }
}
