import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { getSql, type RecordRow } from "../../../lib/db";
import { jsonError } from "../../../lib/http";
import { mapRecord } from "../../../lib/mappers";
import { cleanOptionalText, parsePositiveNumber } from "../../../lib/validation";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json();
    const amount = parsePositiveNumber(body.amount, "Amount");
    const rate = parsePositiveNumber(body.rate, "Rate");
    const returnAmount = amount * rate;
    const profit = returnAmount - amount;
    const note = cleanOptionalText(body.note);
    const sql = getSql();
    const [record] = (await sql`
      update records
      set amount = ${amount},
          rate = ${rate},
          return_amount = ${returnAmount},
          profit = ${profit},
          note = ${note},
          updated_at = now()
      where id = ${params.id}
      returning id, player_id, amount, rate, return_amount, profit, note, created_at, updated_at
    `) as RecordRow[];

    if (!record) {
      return jsonError(new Error("Record was not found."), 404);
    }

    return NextResponse.json({ record: mapRecord(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("access") ? 401 : 400);
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
    return jsonError(error, message.includes("access") ? 401 : 400);
  }
}
