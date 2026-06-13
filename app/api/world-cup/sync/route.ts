import { NextResponse } from "next/server";
import { getSql, isDatabaseConfigError } from "../../../lib/db";
import { fetchWorldCupMatches } from "../../../lib/football-data";
import { jsonError } from "../../../lib/http";
import { mapWorldCupMatch } from "../../../lib/mappers";
import { ensureTrackerSchema } from "../../../lib/schema";
import { loadWorldCupMatchRows, upsertWorldCupMatches } from "../../../lib/world-cup-store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const providerMatches = await fetchWorldCupMatches();
    const sql = getSql();
    await ensureTrackerSchema(sql);
    await upsertWorldCupMatches(sql, providerMatches);
    const rows = await loadWorldCupMatchRows(sql);

    return NextResponse.json({
      matches: rows.map(mapWorldCupMatch),
      syncedCount: providerMatches.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Unable to sync World Cup matches", error);
    if (isDatabaseConfigError(error)) {
      return jsonError(error, 500, "Database is not configured. Add DATABASE_URL and restart the app.");
    }
    return jsonError(error, 500);
  }
}
