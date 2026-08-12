import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@seleksi/database";
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { canAccess, SUPERVISOR_ALLOWED_ROLES } from "@/lib/access";

const AUTH_COOKIE = "seleksi_pengawas_session";
const HASH_ALGORITHM = "sha256";
const HASH_ITERATIONS = 210_000;
const HASH_KEY_LENGTH = 32;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

function getAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET wajib diisi pada environment production.");
  }
  return "dev-only-change-this-auth-secret-for-olimpiade-fisika-v1-0";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM).toString("hex");
  return `pbkdf2_${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  const [algorithmName, iterationsText, salt, hash] = storedHash.split("$");
  if (algorithmName !== `pbkdf2_${HASH_ALGORITHM}` || !iterationsText || !salt || !hash) return false;

  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;

  const candidate = pbkdf2Sync(password, salt, iterations, Buffer.from(hash, "hex").length, HASH_ALGORITHM);
  const expected = Buffer.from(hash, "hex");

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function createSessionCookieValue(sessionId: string) {
  return `${sessionId}.${sign(sessionId)}`;
}

export function readSessionCookieValue(value: string | undefined) {
  if (!value) return null;

  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) return null;

  const expected = sign(sessionId);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return sessionId;
}

export function getSessionCookieOptions() {
  return {
    name: AUTH_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}

export async function createUserSession(userId: string) {
  const headerList = await headers();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  return db.userSession.create({
    data: {
      userId,
      expiresAt,
      userAgent: headerList.get("user-agent"),
      ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip")
    }
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const sessionId = readSessionCookieValue(cookieStore.get(AUTH_COOKIE)?.value);
  if (!sessionId) return null;

  const session = await db.userSession.findUnique({
    where: { id: sessionId },
    include: { user: { include: { roles: { include: { role: true } } } } }
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: session.user.roles.map((userRole: { role: { code: string } }) => userRole.role.code)
  };
}

export async function requirePageUser(allowedRoles: string[] = [...SUPERVISOR_ALLOWED_ROLES]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccess(user.roles, allowedRoles)) redirect("/?access=denied");
  return user;
}

export async function requireActionUser(allowedRoles: string[] = [...SUPERVISOR_ALLOWED_ROLES]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sesi tidak valid. Silakan login kembali.");
  if (!canAccess(user.roles, allowedRoles)) throw new Error("Anda tidak memiliki izin untuk menjalankan tindakan ini.");
  return user;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const sessionId = readSessionCookieValue(cookieStore.get(AUTH_COOKIE)?.value);
  if (!sessionId) return;

  await db.userSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}
