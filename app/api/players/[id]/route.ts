import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { getSql, type PlayerRow } from "../../../lib/db";
import { jsonError } from "../../../lib/http";
import { mapPlayer } from "../../../lib/mappers";
import { ensureTrackerSchema } from "../../../lib/schema";
import { cleanText } from "../../../lib/validation";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json();
    const name = cleanText(body.name, "Player name");
    const sql = getSql();
    await ensureTrackerSchema(sql);
    const [player] = (await sql`
      update players
      set name = ${name}, updated_at = now()
      where id = ${params.id}
      returning id, name, display_order, created_at, updated_at
    `) as PlayerRow[];

    if (!player) {
      return jsonError(new Error("Player was not found."), 404);
    }

    return NextResponse.json({ player: mapPlayer(player) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json().catch(() => ({}));
    if (body.deletePassword !== "123123") {
      return jsonError(new Error("Delete password is incorrect."), 400);
    }
    const sql = getSql();
    await ensureTrackerSchema(sql);
    await sql`delete from players where id = ${params.id}`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
