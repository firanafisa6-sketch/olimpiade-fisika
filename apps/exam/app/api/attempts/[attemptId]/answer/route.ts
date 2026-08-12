import { NextResponse } from "next/server";
import { db } from "@seleksi/database";
import { getCurrentParticipant } from "@/lib/auth";

const VALID_LABELS = new Set(["A", "B", "C", "D", "E"]);

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { attemptId } = await params;
  const body = await request.json().catch(() => ({}));
  const snapshotId = String(body.snapshotId ?? "");
  const label = body.label == null ? null : String(body.label);
  const isFlagged = Boolean(body.isFlagged);
  if (!snapshotId || (label !== null && !VALID_LABELS.has(label))) {
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  }

  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, examSession: { participantId: participant.id } },
    include: { examSession: { include: { examPackage: true } } },
  });
  if (!attempt || attempt.status !== "ACTIVE" || attempt.examSession.status !== "ACTIVE" || !attempt.startedAt) {
    return NextResponse.json({ error: "ATTEMPT_NOT_ACTIVE" }, { status: 409 });
  }
  const durationDeadline = new Date(attempt.startedAt.getTime() + attempt.examSession.examPackage.durationMinutes * 60_000);
  const deadline = durationDeadline < attempt.examSession.endsAt ? durationDeadline : attempt.examSession.endsAt;
  if (deadline <= new Date()) {
    await db.attempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED", submittedAt: new Date() } });
    return NextResponse.json({ error: "TIME_EXPIRED" }, { status: 410 });
  }

  const result = await db.attemptQuestionSnapshot.updateMany({
    where: { id: snapshotId, attemptId: attempt.id },
    data: { selectedLabel: label as "A" | "B" | "C" | "D" | "E" | null, isFlagged },
  });
  if (!result.count) return NextResponse.json({ error: "QUESTION_NOT_FOUND" }, { status: 404 });
  await db.attempt.update({ where: { id: attempt.id }, data: { lastSavedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
