import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../../lib/auth";
import { getSql, type RecordRow } from "../../../../lib/db";
import { jsonError } from "../../../../lib/http";
import { mapRecord } from "../../../../lib/mappers";
import { ensureTrackerSchemaIfNeeded } from "../../../../lib/schema";
import { calculateRecordValues, parseResultType } from "../../../../lib/validation";
import { applyComboOutcome, summarizeComboLegs } from "../../../../lib/combo";
import type { ComboLeg } from "../../../../lib/types";

type Params = { params: { id: string } };
type Sql = ReturnType<typeof getSql>;

async function confirmStoredRecord(sql: Sql, id: string, resultType: ReturnType<typeof parseResultType>, legIndex: number | null) {
  const [existing] = (await sql`
    select id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, combo_legs, created_at, updated_at
    from records
    where id = ${id}
      and deleted_at is null
  `) as RecordRow[];

  if (!existing) {
    return null;
  }

  const comboLegs = existing.combo_legs ? (typeof existing.combo_legs === "string" ? JSON.parse(existing.combo_legs) : existing.combo_legs) : null;
  let finalAmount = Number(existing.amount);
  let finalRate = Number(existing.rate);
  let finalReturnAmount: number;
  let finalProfit: number;
  let finalResultType: string | null;
  let finalStatus = "finalized";
  let nextComboLegs = comboLegs;

  if (comboLegs && Array.isArray(comboLegs) && comboLegs.length > 0) {
    if (legIndex === null) {
      throw new Error("Combo leg is required.");
    }
    const comboResult = applyComboOutcome(finalAmount, comboLegs as ComboLeg[], legIndex, resultType);
    nextComboLegs = comboResult.legs;
    finalAmount = comboResult.summary.amount;
    finalRate = comboResult.summary.rate;
    finalReturnAmount = comboResult.finalized && comboResult.resultType === "loss" ? 0 : comboResult.finalized ? comboResult.summary.returnAmount : 0;
    finalProfit = comboResult.finalized ? finalReturnAmount - comboResult.summary.amount : 0;
    finalResultType = comboResult.resultType;
    finalStatus = comboResult.finalized ? "finalized" : "pending";
  } else {
    const rate = Number(existing.rate);
    const amount = Number(existing.amount);
    const { returnAmount, profit } = calculateRecordValues(amount, rate, resultType);
    finalReturnAmount = returnAmount;
    finalProfit = profit;
    finalResultType = resultType;
  }

  if (nextComboLegs && Array.isArray(nextComboLegs) && finalStatus === "pending") {
    const pendingSummary = summarizeComboLegs(finalAmount, nextComboLegs as ComboLeg[]);
    finalAmount = pendingSummary.amount;
    finalRate = pendingSummary.rate;
  }

  const [record] = (await sql`
    update records
    set amount = ${finalAmount},
        rate = ${finalRate},
        status = ${finalStatus},
        result_type = ${finalResultType},
        return_amount = ${finalReturnAmount},
        profit = ${finalProfit},
        combo_legs = ${nextComboLegs ? JSON.stringify(nextComboLegs) : null},
        updated_at = now()
    where id = ${id}
    returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, combo_legs, created_at, updated_at
  `) as RecordRow[];

  return record;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json();
    const resultType = parseResultType(body.resultType);
    const legIndex = typeof body.legIndex === "number" ? body.legIndex : null;
    const sql = getSql();
    let record: RecordRow | null;
    try {
      record = await confirmStoredRecord(sql, params.id, resultType, legIndex);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      record = await confirmStoredRecord(sql, params.id, resultType, legIndex);
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
