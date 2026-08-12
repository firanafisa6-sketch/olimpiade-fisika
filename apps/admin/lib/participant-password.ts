import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITHM = "sha256";
const ITERATIONS = 210_000;
const KEY_LENGTH = 32;

export function hashParticipantPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, ALGORITHM).toString("hex");
  return `pbkdf2_${ALGORITHM}$${ITERATIONS}$${salt}$${hash}`;
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
