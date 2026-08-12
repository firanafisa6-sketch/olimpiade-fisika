import { NextResponse } from "next/server";
import { db } from "@seleksi/database";
import { canUsePengawasApp } from "@/lib/access";
import { createSessionCookieValue, createUserSession, getSessionCookieOptions, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { identity?: string; email?: string; password?: string } | null;
  const rawIdentity = (body?.identity ?? body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";

  if (!rawIdentity || !password) {
    return NextResponse.json({ message: "Username dan password wajib diisi." }, { status: 400 });
  }

  const candidates = rawIdentity.includes("@") ? [rawIdentity] : [rawIdentity, `${rawIdentity}@pengawas.local`];
  const user = await db.user.findFirst({
    where: { email: { in: candidates } },
    include: { roles: { include: { role: true } } }
  });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ message: "Username atau password tidak sesuai." }, { status: 401 });
  }

  const roleCodes = user.roles.map((item) => item.role.code);
  if (!canUsePengawasApp(roleCodes)) {
    return NextResponse.json({ message: "Akun ini tidak memiliki akses ke aplikasi pengawas." }, { status: 403 });
  }

  const session = await createUserSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const response = NextResponse.json({ ok: true, redirectTo: "/" });
  const { name, ...cookieOptions } = getSessionCookieOptions();
  response.cookies.set(name, createSessionCookieValue(session.id), cookieOptions);
  return response;
}
