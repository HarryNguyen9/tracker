import { NextResponse } from "next/server";
import { requireEditAccess } from "../../lib/auth";
import { getSql, isDatabaseConfigError, type RecordRow } from "../../lib/db";
import { jsonError } from "../../lib/http";
import { mapRecord, withBalance } from "../../lib/mappers";
import { ensureTrackerSchema, ensureTrackerSchemaIfNeeded } from "../../lib/schema";
import { cleanOptionalText, parseGreaterThanZeroNumber, parseNonNegativeNumber } from "../../lib/validation";
import type { ComboLegRow } from "../../lib/types";

type Sql = ReturnType<typeof getSql>;

async function insertPendingRecord(sql: Sql, playerId: string, amount: number, rate: number, note: string | null, comboLegs: ComboLegRow[] | null) {
  const [record] = (await sql`
    insert into records (player_id, amount, rate, status, result_type, return_amount, profit, note, combo_legs)
    values (${playerId}, ${amount}, ${rate}, 'pending', null, 0, 0, ${note}, ${comboLegs ? JSON.stringify(comboLegs) : null})
    returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, combo_legs, deleted_at, delete_reason, created_at, updated_at
  `) as RecordRow[];

  return record;
}

async function loadRecordRows(sql: Sql, playerId: string, trash: boolean) {
  return trash
    ? ((await sql`
        select id, player_id, amount, rate, status, result_type, return_amount, profit, note, combo_legs, deleted_at, delete_reason, created_at, updated_at
        from records
        where player_id = ${playerId}
          and deleted_at is not null
        order by deleted_at desc
      `) as RecordRow[])
    : ((await sql`
        select id, player_id, amount, rate, status, result_type, return_amount, profit, note, combo_legs, deleted_at, delete_reason, created_at, updated_at
        from records
        where player_id = ${playerId}
          and deleted_at is null
        order by created_at asc
      `) as RecordRow[]);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");
    const trash = searchParams.get("trash") === "1";

    if (!playerId) {
      return jsonError(new Error("playerId is required."));
    }

    const sql = getSql();
    let rows: RecordRow[];
    try {
      rows = await loadRecordRows(sql, playerId, trash);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      rows = await loadRecordRows(sql, playerId, trash);
    }

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

    const isCombo = body.comboMode === true;
    const comboLegs: ComboLegRow[] | null = isCombo && Array.isArray(body.comboLegs) && body.comboLegs.length > 0
      ? body.comboLegs.map((leg: { amount: number; rate: number }) => ({
          amount: Number(leg.amount),
          rate: Number(leg.rate),
        }))
      : null;

    let amount: number;
    let rate: number;

    if (comboLegs) {
      // Combo: total amount = sum of legs, rate = effective rate
      amount = comboLegs.reduce((sum, leg) => sum + leg.amount, 0);
      rate = amount > 0 ? comboLegs.reduce((sum, leg) => sum + leg.amount * leg.rate, 0) / amount : 0;
    } else {
      amount = parseGreaterThanZeroNumber(body.amount, "Amount");
      rate = parseNonNegativeNumber(body.rate, "Rate");
    }

    const note = cleanOptionalText(body.note);
    const sql = getSql();
    let record: RecordRow;
    try {
      record = await insertPendingRecord(sql, playerId, amount, rate, note, comboLegs);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      record = await insertPendingRecord(sql, playerId, amount, rate, note, comboLegs);
    }

    return NextResponse.json({ record: mapRecord(record) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}