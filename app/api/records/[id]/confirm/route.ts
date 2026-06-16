import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../../lib/auth";
import { getSql, type RecordRow } from "../../../../lib/db";
import { jsonError } from "../../../../lib/http";
import { mapRecord } from "../../../../lib/mappers";
import { ensureTrackerSchemaIfNeeded } from "../../../../lib/schema";
import { calculateRecordValues, parseResultType } from "../../../../lib/validation";
import { calculateComboBet, type Selection } from "../../../../lib/combo";

type Params = { params: { id: string } };
type Sql = ReturnType<typeof getSql>;

async function confirmStoredRecord(sql: Sql, id: string, resultType: ReturnType<typeof parseResultType>) {
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
  const amount = Number(existing.amount);
  const rate = Number(existing.rate);

  let finalReturnAmount: number;
  let finalProfit: number;
  let finalResultType: string;

  if (comboLegs && Array.isArray(comboLegs) && comboLegs.length > 0) {
    // Combo: apply resultType to all legs and calculate
    const selections: Selection[] = comboLegs.map((leg: { rate: number; amount: number }) => ({
      originalRate: leg.rate,
      amount: leg.amount,
      outcome: resultType as Selection["outcome"],
    }));
    const comboResult = calculateComboBet(selections);
    finalReturnAmount = comboResult.totalReturn;
    finalProfit = comboResult.netProfit;
    finalResultType = comboResult.netProfit > 0 ? "win" : comboResult.netProfit < 0 ? "loss" : "draw";
  } else {
    // Single bet
    const { returnAmount, profit } = calculateRecordValues(amount, rate, resultType);
    finalReturnAmount = returnAmount;
    finalProfit = profit;
    finalResultType = resultType;
  }

  const [record] = (await sql`
    update records
    set status = 'finalized',
        result_type = ${finalResultType},
        return_amount = ${finalReturnAmount},
        profit = ${finalProfit},
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
    const sql = getSql();
    let record: RecordRow | null;
    try {
      record = await confirmStoredRecord(sql, params.id, resultType);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      record = await confirmStoredRecord(sql, params.id, resultType);
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
