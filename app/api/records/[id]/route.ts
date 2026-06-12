import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { getSql, type RecordRow } from "../../../lib/db";
import { jsonError } from "../../../lib/http";
import { mapRecord } from "../../../lib/mappers";
import { ensureTrackerSchema } from "../../../lib/schema";
import { calculateRecordValues, cleanOptionalText, parseGreaterThanZeroNumber, parseNonNegativeNumber, parseResultType } from "../../../lib/validation";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json();
    const note = cleanOptionalText(body.note);
    const sql = getSql();
    await ensureTrackerSchema(sql);
    const [existing] = (await sql`
      select id, player_id, amount, rate, status, result_type, return_amount, profit, note, created_at, updated_at
      from records
      where id = ${params.id}
    `) as RecordRow[];

    if (!existing) {
      return jsonError(new Error("Record was not found."), 404);
    }

    if (existing.status === "pending") {
      const amount = parseGreaterThanZeroNumber(body.amount, "Amount");
      const rate = parseNonNegativeNumber(body.rate, "Rate");
      const [record] = (await sql`
        update records
        set amount = ${amount},
            rate = ${rate},
            note = ${note},
            status = 'pending',
            result_type = null,
            return_amount = 0,
            profit = 0,
            updated_at = now()
        where id = ${params.id}
        returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, created_at, updated_at
      `) as RecordRow[];
      return NextResponse.json({ record: mapRecord(record) });
    }

    const amount = body.amount === undefined ? Number(existing.amount) : parseGreaterThanZeroNumber(body.amount, "Amount");
    const rate = body.rate === undefined ? Number(existing.rate) : parseNonNegativeNumber(body.rate, "Rate");
    const resultType = body.resultType === undefined ? existing.result_type : parseResultType(body.resultType);

    if (!resultType) {
      throw new Error("Result is required.");
    }

    const { returnAmount, profit } = calculateRecordValues(amount, rate, resultType);
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
      returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, created_at, updated_at
    `) as RecordRow[];

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
    await ensureTrackerSchema(sql);
    await sql`delete from records where id = ${params.id}`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
