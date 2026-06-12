import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { getSql, type RecordRow } from "../../../lib/db";
import { jsonError } from "../../../lib/http";
import { mapRecord } from "../../../lib/mappers";
import { calculateRecordValues, cleanOptionalText, parseGreaterThanZeroNumber, parseNonNegativeNumber, parseResultType } from "../../../lib/validation";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json();
    const amount = parseGreaterThanZeroNumber(body.amount, "Amount");
    const rate = parseNonNegativeNumber(body.rate, "Rate");
    const resultType = parseResultType(body.resultType);
    const { returnAmount, profit } = calculateRecordValues(amount, rate, resultType);
    const note = cleanOptionalText(body.note);
    const sql = getSql();
    const [record] = (await sql`
      update records
      set amount = ${amount},
          rate = ${rate},
          result_type = ${resultType},
          return_amount = ${returnAmount},
          profit = ${profit},
          note = ${note},
          updated_at = now()
      where id = ${params.id}
      returning id, player_id, amount, rate, result_type, return_amount, profit, note, created_at, updated_at
    `) as RecordRow[];

    if (!record) {
      return jsonError(new Error("Record was not found."), 404);
    }

    return NextResponse.json({ record: mapRecord(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const sql = getSql();
    await sql`delete from records where id = ${params.id}`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
