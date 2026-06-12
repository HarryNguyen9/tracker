import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { getSql, type RecordRow } from "../../../lib/db";
import { jsonError } from "../../../lib/http";
import { mapRecord } from "../../../lib/mappers";
import { ensureTrackerSchema, ensureTrackerSchemaIfNeeded } from "../../../lib/schema";
import { calculateRecordValues, cleanOptionalText, cleanText, parseGreaterThanZeroNumber, parseNonNegativeNumber, parseResultType } from "../../../lib/validation";

type Params = { params: { id: string } };
type Sql = ReturnType<typeof getSql>;

async function updateRecord(sql: Sql, id: string, body: Record<string, unknown>, note: string | null) {
  const [existing] = (await sql`
    select id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, created_at, updated_at
    from records
    where id = ${id}
      and deleted_at is null
  `) as RecordRow[];

  if (!existing) {
    return null;
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
      where id = ${id}
      returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, created_at, updated_at
    `) as RecordRow[];
    return record;
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
    where id = ${id}
    returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, created_at, updated_at
  `) as RecordRow[];

  return record;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = (await request.json()) as Record<string, unknown>;
    const note = cleanOptionalText(body.note);
    const sql = getSql();
    let record: RecordRow | null;
    try {
      record = await updateRecord(sql, params.id, body, note);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      record = await updateRecord(sql, params.id, body, note);
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

export async function DELETE(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json().catch(() => ({}));
    const reason = cleanText(body.reason, "Delete reason");
    const sql = getSql();
    await ensureTrackerSchema(sql);
    const [record] = (await sql`
      update records
      set deleted_at = now(),
          delete_reason = ${reason},
          updated_at = now()
      where id = ${params.id}
        and deleted_at is null
      returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, created_at, updated_at
    `) as RecordRow[];

    if (!record) {
      return jsonError(new Error("Record was not found."), 404);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
