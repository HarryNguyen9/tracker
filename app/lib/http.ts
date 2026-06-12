import { NextResponse } from "next/server";

export function jsonError(error: unknown, status = 400, publicMessage?: string) {
  const message = publicMessage ?? (error instanceof Error ? error.message : "Something went wrong.");
  return NextResponse.json({ error: message }, { status });
}
