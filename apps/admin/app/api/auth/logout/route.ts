import { NextResponse } from "next/server";
import { getSessionCookieOptions, revokeCurrentSession } from "@/lib/auth";

export async function POST() {
  await revokeCurrentSession();

  const response = NextResponse.json({ ok: true });
  const { name, ...cookieOptions } = getSessionCookieOptions();
  response.cookies.set(name, "", {
    ...cookieOptions,
    maxAge: 0
  });

  return response;
}
