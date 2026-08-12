"use server";

import { db } from "@seleksi/database";
import { redirect } from "next/navigation";
import {
  createParticipantLoginSession,
  getCurrentParticipant,
  revokeCurrentParticipantSession,
  verifyParticipantPassword,
} from "@/lib/auth";
import { createOrResumeAttempt } from "@/lib/attempt";

export type LoginState = { error?: string };

export async function loginParticipant(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Username dan password wajib diisi." };

  const participant = await db.participant.findUnique({ where: { username } });
  if (!participant || !participant.isActive || !verifyParticipantPassword(password, participant.passwordHash)) {
    return { error: "Username atau password tidak sesuai." };
  }

  await createParticipantLoginSession(participant.id);
  await db.participant.update({ where: { id: participant.id }, data: { lastLoginAt: new Date() } });
  redirect("/dashboard");
}

export async function logoutParticipant() {
  await revokeCurrentParticipantSession();
  redirect("/");
}

export async function startExam(formData: FormData) {
  const participant = await getCurrentParticipant();
  if (!participant) redirect("/");
  const examSessionId = String(formData.get("examSessionId") ?? "");
  const attempt = await createOrResumeAttempt(examSessionId, participant.id);
  redirect(`/exam/${attempt.id}`);
}
