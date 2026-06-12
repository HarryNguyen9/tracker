import { NextResponse } from "next/server";
import { requireEditAccess } from "../../lib/auth";
import { getSql, type PlayerRow, type RecordRow } from "../../lib/db";
import { jsonError } from "../../lib/http";
import { mapPlayer, mapRecord } from "../../lib/mappers";
import { cleanText } from "../../lib/validation";

export async function GET() {
  try {
    const sql = getSql();
    const players = (await sql`
      select id, name, created_at, updated_at
      from players
      order by created_at asc
    `) as PlayerRow[];
    const records = (await sql`
      select id, player_id, amount, rate, status, result_type, return_amount, profit, note, created_at, updated_at
      from records
      order by created_at asc
    `) as RecordRow[];

    const recordItems = records.map(mapRecord);
    const summaries = players.map((row) => {
      const player = mapPlayer(row);
      const ownItems = recordItems.filter((item) => item.playerId === player.id);
      const finalizedItems = ownItems.filter((item) => item.status === "finalized");
      const pendingItems = ownItems.filter((item) => item.status === "pending");
      const totalAmount = finalizedItems.reduce((sum, item) => sum + item.amount, 0);
      const totalReturn = finalizedItems.reduce((sum, item) => sum + item.returnAmount, 0);
      const totalProfit = finalizedItems.reduce((sum, item) => sum + item.profit, 0);

      return {
        ...player,
        totalAmount,
        totalReturn,
        totalProfit,
        balance: totalProfit,
        recordCount: ownItems.length,
        finalizedRecordCount: finalizedItems.length,
        pendingRecordCount: pendingItems.length,
      };
    });

    return NextResponse.json({ players: summaries });
  } catch (error) {
    console.error("Unable to load players", error);
    return jsonError(error, 500, "Unable to load data. Please try again.");
  }
}

export async function POST(request: Request) {
  try {
    requireEditAccess();
    const body = await request.json();
    const name = cleanText(body.name, "Player name");
    const sql = getSql();
    const [player] = (await sql`
      insert into players (name)
      values (${name})
      returning id, name, created_at, updated_at
    `) as PlayerRow[];

    return NextResponse.json({ player: mapPlayer(player) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
