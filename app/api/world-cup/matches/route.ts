import { NextResponse } from "next/server";
import { getSql, isDatabaseConfigError, type WorldCupMatchRow } from "../../../lib/db";
import { jsonError } from "../../../lib/http";
import { mapWorldCupMatch } from "../../../lib/mappers";
import { ensureTrackerSchemaIfNeeded } from "../../../lib/schema";
import { loadWorldCupMatchRows } from "../../../lib/world-cup-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSql();
    let rows: WorldCupMatchRow[];
    try {
      rows = await loadWorldCupMatchRows(sql);
    } catch (error) {
      if (!(await ensureTrackerSchemaIfNeeded(error, sql))) {
        throw error;
      }
      rows = await loadWorldCupMatchRows(sql);
    }

    return NextResponse.json({ matches: rows.map(mapWorldCupMatch) });
  } catch (error) {
    console.error("Unable to load World Cup matches", error);
    if (isDatabaseConfigError(error)) {
      return jsonError(error, 500, "Database is not configured. Add DATABASE_URL and restart the app.");
    }
    return jsonError(error, 500, "Unable to load World Cup schedule. Please try again.");
  }
}
