import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../../lib/auth";
import { getSql, type RecordRow } from "../../../../lib/db";
import { jsonError } from "../../../../lib/http";
import { mapRecord } from "../../../../lib/mappers";
import { calculateRecordValues, parseResultType } from "../../../../lib/validation";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json();
    const resultType = parseResultType(body.resultType);
    const sql = getSql();
    const [existing] = (await sql`
      select id, player_id, amount, rate, status, result_type, return_amount, profit, note, created_at, updated_at
      from records
      where id = ${params.id}
    `) as RecordRow[];

    if (!existing) {
      return jsonError(new Error("Record was not found."), 404);
    }

    const amount = Number(existing.amount);
    const rate = Number(existing.rate);
    const { returnAmount, profit } = calculateRecordValues(amount, rate, resultType);
    const [record] = (await sql`
      update records
      set status = 'finalized',
          result_type = ${resultType},
          return_amount = ${returnAmount},
          profit = ${profit},
          updated_at = now()
      where id = ${params.id}
      returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, created_at, updated_at
    `) as RecordRow[];

    return NextResponse.json({ record: mapRecord(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
