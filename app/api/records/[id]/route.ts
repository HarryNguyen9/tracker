import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { getSql, type RecordRow } from "../../../lib/db";
import { jsonError } from "../../../lib/http";
import { mapRecord } from "../../../lib/mappers";
import { ensureTrackerSchema, ensureTrackerSchemaIfNeeded } from "../../../lib/schema";
import { cleanOptionalText, cleanText, parseGreaterThanZeroNumber, parseNonNegativeNumber, prepareFinalizedRecordUpdate } from "../../../lib/validation";
import { normalizeComboSelections, summarizeComboLegs } from "../../../lib/combo";
import type { ComboSelection } from "../../../lib/types";

type Params = { params: { id: string } };
type Sql = ReturnType<typeof getSql>;

async function updateRecord(sql: Sql, id: string, body: Record<string, unknown>) {
  const [existing] = (await sql`
    select id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, combo_legs, created_at, updated_at
    from records
    where id = ${id}
      and deleted_at is null
  `) as RecordRow[];

  if (!existing) {
    return null;
  }

  if (existing.status === "pending") {
    const note = cleanOptionalText(body.note);
    const comboLegs = Array.isArray(body.comboLegs) ? normalizeComboSelections(body.comboLegs as ComboSelection[]) : null;
    const amount = parseGreaterThanZeroNumber(body.amount, "Amount");
    const comboSummary = comboLegs ? summarizeComboLegs(amount, comboLegs) : null;
    const rate = comboSummary ? comboSummary.rate : parseNonNegativeNumber(body.rate, "Rate");
    const [record] = (await sql`
      update records
      set amount = ${amount},
          rate = ${rate},
          note = ${note},
          status = 'pending',
          result_type = null,
          return_amount = 0,
          profit = 0,
          combo_legs = ${comboLegs ? JSON.stringify(comboLegs) : null},
          updated_at = now()
      where id = ${id}
      returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, combo_legs, created_at, updated_at
    `) as RecordRow[];
    return record;
  }

  const update = prepareFinalizedRecordUpdate({
    body,
    existingAmount: Number(existing.amount),
    existingNote: existing.note,
    existingRate: Number(existing.rate),
    existingResultType: existing.result_type,
  });
  const [record] = (await sql`
    update records
    set amount = ${update.amount},
        rate = ${update.rate},
        result_type = ${update.resultType},
        return_amount = ${update.returnAmount},
        profit = ${update.profit},
        note = ${update.note},
        updated_at = now()
    where id = ${id}
    returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, combo_legs, created_at, updated_at
  `) as RecordRow[];

  return record;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = (await request.json()) as Record<string, unknown>;
    const sql = getSql();
    let record: RecordRow | null;
    try {
      record = await updateRecord(sql, params.id, body);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      record = await updateRecord(sql, params.id, body);
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
      returning id, player_id, amount, rate, status, result_type, return_amount, profit, note, deleted_at, delete_reason, combo_legs, created_at, updated_at
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
