import { cookies, headers } from "next/headers";
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@seleksi/database";

const COOKIE_NAME = "soalflow_participant_session";
const SESSION_SECONDS = 60 * 60 * 12;
const ALGORITHM = "sha256";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyParticipantPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [algorithmName, iterationsText, salt, hash] = storedHash.split("$");
  if (algorithmName !== `pbkdf2_${ALGORITHM}` || !iterationsText || !salt || !hash) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;
  const expected = Buffer.from(hash, "hex");
  const candidate = pbkdf2Sync(password, salt, iterations, expected.length, ALGORITHM);
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export async function createParticipantLoginSession(participantId: string) {
  const token = randomBytes(32).toString("base64url");
  const headerList = await headers();
  await db.$transaction([
    db.participantSession.updateMany({
      where: { participantId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.participantSession.create({
      data: {
        participantId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
        ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip"),
        userAgent: headerList.get("user-agent"),
      },
    }),
  ]);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function getCurrentParticipant() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const authSession = await db.participantSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { participant: true },
  });
  if (
    !authSession ||
    authSession.revokedAt ||
    authSession.expiresAt <= new Date() ||
    !authSession.participant.isActive
  ) {
    return null;
  }
  return authSession.participant;
}

export async function revokeCurrentParticipantSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.participantSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(COOKIE_NAME);
}
