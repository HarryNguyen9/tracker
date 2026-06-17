import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { getSql } from "../../../lib/db";
import { jsonError } from "../../../lib/http";
import { ensureTrackerSchema } from "../../../lib/schema";

function parsePlayerIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Player order is required.");
  }

  const ids = value.map((item) => String(item));
  if (ids.length === 0 || ids.some((id) => id.trim().length === 0)) {
    throw new Error("Player order is invalid.");
  }

  return ids;
}

export async function PATCH(request: Request) {
  try {
    requireEditAccess();
    const body = await request.json();
    const playerIds = parsePlayerIds(body.playerIds);
    const sql = getSql();
    await ensureTrackerSchema(sql);

    for (const [index, playerId] of playerIds.entries()) {
      await sql`
        update players
        set display_order = ${index + 1}, updated_at = now()
        where id = ${playerId}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("permission") ? 401 : 400);
  }
}
