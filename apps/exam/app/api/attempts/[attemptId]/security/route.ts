import { NextResponse } from "next/server";
import { db } from "@seleksi/database";
import { getCurrentParticipant } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { attemptId } = await params;
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, examSession: { participantId: participant.id } },
    select: { id: true },
  });
  if (!attempt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const eventType = String(body.eventType ?? "UNKNOWN").slice(0, 80);
  const detail = body.detail && typeof body.detail === "object" ? body.detail : undefined;
  await db.examSecurityEvent.create({ data: { attemptId: attempt.id, eventType, detail } });
  return NextResponse.json({ ok: true });
}
