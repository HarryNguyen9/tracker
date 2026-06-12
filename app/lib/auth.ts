import { cookies } from "next/headers";

export const EDIT_COOKIE = "game_tracker_edit";
const EDIT_COOKIE_VALUE = "allowed";

export function hasEditAccess() {
  return cookies().get(EDIT_COOKIE)?.value === EDIT_COOKIE_VALUE;
}

export function requireEditAccess() {
  if (!hasEditAccess()) {
    throw new Error("Edit permission is needed.");
  }
}

export function editCookieSettings() {
  return {
    name: EDIT_COOKIE,
    value: EDIT_COOKIE_VALUE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}
