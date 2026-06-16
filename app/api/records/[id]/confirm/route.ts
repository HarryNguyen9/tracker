import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../../lib/auth";
import { getSql, type RecordRow, parseComboLegs } from "../../../../lib/db";
import { jsonError } from "../../../../lib/http";
import { mapRecord } from "../../../../lib/mappers";
import { ensureTrackerSchemaIfNeeded } from "../../../../lib/schema";
import { calculateRecordValues, parseResultType } from "../../../../lib/validation";
import { calculateComboResult } from "../../../../lib/combo";
import type { ResultType, ComboLegRow } from "../../../../lib/types";

type Params = { params: { id: string } };
type Sql = ReturnType<typeof getSql>;

async function confirmStoredRecord(sql: Sql, id: string, body: { resultType?: string; legResults?: string[] }) {
  const [existing] = (await sql`
    select id, player_id, amount, rate, status, result_type, return_amount, profit, note, combo_legs, deleted_at, delete_reason, created_at, updated_at
    from records
    where id = ${id}
      and deleted_at is null
  `) as RecordRow[];

  if (!existing) {
    return null;
  }

  const comboLegs = parseComboLegs(existing.combo_legs);

  let returnAmount: number;
  let profit: number;
  let resultType: ResultType | null = null;

  if (comboLegs && comboLegs.length > 0 && Array.isArray(body.legResults) && body.legResults.length === comboLegs.length) {
    // Combo confirm: each leg gets its own result
    const legResults = body.legResults.map(parseResultType);
    const result = calculateComboResult(comboLegs, legResults);
    returnAmount = result.totalReturn;
    profit = result.totalProfit;
    // Store leg results as a special note prefix, or store in combo_legs as extended data
    // For now, store the combined result_type as aggregated
    resultType = profit >= 0 ? "win" : "loss";
  } else {
    // Single record confirm
    resultType = parseResultType(body.resultType);
    const amount = Number(existing.amount);
    const rate = Number(existing.rate);
    const result = calculateRecordValues(amount, rate, resultType);
    returnAmount = result.returnAmount;
    profit = result.profit;
  }

  const [record] = (await sql`
    update records
    set status = 'finalized',
        result_type = ${resultType},
        return_amount = ${returnAmount},
        profit = ${profit},
        updated_at = now()
    where id = ${id}
    returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, combo_legs, deleted_at, delete_reason, created_at, updated_at
  `) as RecordRow[];

  return record;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json();
    const sql = getSql();
    let record: RecordRow | null;
    try {
      record = await confirmStoredRecord(sql, params.id, body);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      record = await confirmStoredRecord(sql, params.id, body);
    }

    if (!record) {
      return jsonError(new Error("Record was not found."), 404);
    }

    return NextResponse.json({ record: mapRecord(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}