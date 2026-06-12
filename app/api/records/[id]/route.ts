import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { jsonError } from "../../../lib/http";
import { mapRecord } from "../../../lib/mappers";
import { getServerClient, type RecordRow } from "../../../lib/supabase";
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
    const client = getServerClient();
    const { data, error } = await client
      .from("records")
      .update({ amount, rate, return_amount: returnAmount, profit, note, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select("id,player_id,amount,rate,return_amount,profit,note,created_at,updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ record: mapRecord(data as RecordRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("access") ? 401 : 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const client = getServerClient();
    const { error } = await client.from("records").delete().eq("id", params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("access") ? 401 : 400);
  }
}
