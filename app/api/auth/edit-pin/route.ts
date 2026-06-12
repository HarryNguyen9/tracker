import { NextResponse } from "next/server";
import { editCookieSettings } from "../../../lib/auth";
import { jsonError } from "../../../lib/http";

export async function POST(request: Request) {
  try {
    const { pin } = (await request.json()) as { pin?: string };
    const adminPin = process.env.ADMIN_PIN;

    if (!adminPin) {
      return jsonError(new Error("Admin PIN is not configured."), 500);
    }

    if (!pin || pin !== adminPin) {
      return jsonError(new Error("PIN is not correct."), 401);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(editCookieSettings());
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
