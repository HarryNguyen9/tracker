import { NextResponse } from "next/server";
import { requireEditAccess } from "../../../lib/auth";
import { jsonError } from "../../../lib/http";
import { mapPlayer } from "../../../lib/mappers";
import { getServerClient, type PlayerRow } from "../../../lib/supabase";
import { cleanText } from "../../../lib/validation";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const body = await request.json();
    const name = cleanText(body.name, "Player name");
    const client = getServerClient();
    const { data, error } = await client
      .from("players")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select("id,name,created_at,updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ player: mapPlayer(data as PlayerRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("access") ? 401 : 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    requireEditAccess();
    const client = getServerClient();
    const { error } = await client.from("players").delete().eq("id", params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(error, message.includes("access") ? 401 : 400);
  }
}
