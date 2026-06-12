import { NextResponse } from "next/server";
import { requireEditAccess } from "../../lib/auth";
import { jsonError } from "../../lib/http";
import { mapPlayer, mapRecord } from "../../lib/mappers";
import { getServerClient, type PlayerRow, type RecordRow } from "../../lib/supabase";
import { cleanText } from "../../lib/validation";

export async function GET() {
  try {
    const client = getServerClient();
    const { data: players, error: playersError } = await client
      .from("players")
      .select("id,name,created_at,updated_at")
      .order("created_at", { ascending: true });

    if (playersError) {
      throw playersError;
    }

    const { data: records, error: recordsError } = await client
      .from("records")
      .select("id,player_id,amount,rate,return_amount,profit,note,created_at,updated_at")
      .order("created_at", { ascending: true });

    if (recordsError) {
      throw recordsError;
    }

    const recordItems = ((records ?? []) as RecordRow[]).map(mapRecord);
    const summaries = ((players ?? []) as PlayerRow[]).map((row) => {
      const player = mapPlayer(row);
      const ownItems = recordItems.filter((item) => item.playerId === player.id);
      const totalAmount = ownItems.reduce((sum, item) => sum + item.amount, 0);
      const totalReturn = ownItems.reduce((sum, item) => sum + item.returnAmount, 0);
      const totalProfit = ownItems.reduce((sum, item) => sum + item.profit, 0);

      return {
        ...player,
        totalAmount,
        totalReturn,
        totalProfit,
        balance: totalProfit,
        recordCount: ownItems.length,
      };
    });

    return NextResponse.json({ players: summaries });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    requireEditAccess();
    const body = await request.json();
    const name = cleanText(body.name, "Player name");
    const client = getServerClient();
    const { data, error } = await client
      .from("players")
      .insert({ name })
      .select("id,name,created_at,updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ player: mapPlayer(data as PlayerRow) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("access") ? 401 : 400);
  }
}
