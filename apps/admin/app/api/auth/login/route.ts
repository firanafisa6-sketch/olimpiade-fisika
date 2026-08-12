import { NextResponse } from "next/server";
import { db } from "@seleksi/database";
import {
  createSessionCookieValue,
  createUserSession,
  getSessionCookieOptions,
  verifyPassword
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const identity = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";

  if (!identity || !password) {
    return NextResponse.json({ message: "Email/username dan password wajib diisi." }, { status: 400 });
  }

  const candidates = identity.includes("@") ? [identity] : [identity, `${identity}@pengawas.local`];
  const user = await db.user.findFirst({ where: { email: { in: candidates } }, include: { roles: { include: { role: true } } } });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ message: "Email/username atau password tidak sesuai." }, { status: 401 });
  }

  const session = await createUserSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const roleCodes = user.roles.map((item) => item.role.code);
  const supervisorOnly = roleCodes.includes("EXAM_SUPERVISOR") && !roleCodes.some((role) => ["EXAM_ADMIN", "SUPER_ADMIN"].includes(role));
  const pengawasUrl = process.env.NEXT_PUBLIC_PENGAWAS_URL ?? "http://localhost:3002";
  const response = NextResponse.json({ ok: true, redirectTo: supervisorOnly ? pengawasUrl : undefined });
  const { name, ...cookieOptions } = getSessionCookieOptions();
  response.cookies.set(name, createSessionCookieValue(session.id), cookieOptions);

  return response;
}
