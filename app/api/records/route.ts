import { NextResponse } from "next/server";
import { requireEditAccess } from "../../lib/auth";
import { jsonError } from "../../lib/http";
import { mapRecord, withBalance } from "../../lib/mappers";
import { getServerClient, type RecordRow } from "../../lib/supabase";
import { cleanOptionalText, parsePositiveNumber } from "../../lib/validation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");

    if (!playerId) {
      return jsonError(new Error("playerId is required."));
    }

    const client = getServerClient();
    const { data, error } = await client
      .from("records")
      .select("id,player_id,amount,rate,return_amount,profit,note,created_at,updated_at")
      .eq("player_id", playerId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const records = withBalance(((data ?? []) as RecordRow[]).map(mapRecord));
    return NextResponse.json({ records });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    requireEditAccess();
    const body = await request.json();
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    if (!playerId) {
      throw new Error("Player is required.");
    }

    const amount = parsePositiveNumber(body.amount, "Amount");
    const rate = parsePositiveNumber(body.rate, "Rate");
    const returnAmount = amount * rate;
    const profit = returnAmount - amount;
    const note = cleanOptionalText(body.note);
    const client = getServerClient();
    const { data, error } = await client
      .from("records")
      .insert({ player_id: playerId, amount, rate, return_amount: returnAmount, profit, note })
      .select("id,player_id,amount,rate,return_amount,profit,note,created_at,updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ record: mapRecord(data as RecordRow) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("access") ? 401 : 400);
  }
}
