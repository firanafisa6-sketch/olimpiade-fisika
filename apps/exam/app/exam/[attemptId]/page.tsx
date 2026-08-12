import { notFound, redirect } from "next/navigation";
import { db } from "@seleksi/database";
import { getCurrentParticipant } from "@/lib/auth";
import { SecureExam, type ExamSnapshot } from "@/components/secure-exam";
import type { OptionLabel } from "@seleksi/question-renderer";

export const dynamic = "force-dynamic";

export default async function ExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const participant = await getCurrentParticipant();
  if (!participant) redirect("/");
  const { attemptId } = await params;
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, examSession: { participantId: participant.id } },
    include: {
      examSession: { include: { examPackage: true } },
      questionSnapshots: { orderBy: { displayOrder: "asc" } },
    },
  });
  if (!attempt) notFound();
  if (["SUBMITTED", "PAUSED"].includes(attempt.status) || attempt.examSession.status !== "ACTIVE") redirect("/dashboard");
  if (!attempt.startedAt || !attempt.questionSnapshots.length) redirect("/dashboard");

  const durationDeadline = new Date(attempt.startedAt.getTime() + attempt.examSession.examPackage.durationMinutes * 60_000);
  const deadline = durationDeadline < attempt.examSession.endsAt ? durationDeadline : attempt.examSession.endsAt;
  if (deadline <= new Date()) {
    await db.attempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED", submittedAt: new Date() } });
    redirect("/dashboard");
  }

  const snapshots: ExamSnapshot[] = attempt.questionSnapshots.map((item: any) => ({
    id: item.id,
    displayOrder: item.displayOrder,
    groupOrder: item.groupOrder,
    blueprintCode: item.blueprintCode,
    questionCode: item.questionCode,
    fieldName: item.fieldName,
    fieldOrder: item.fieldOrder,
    stimulusCode: item.stimulusCode,
    stimulusTitleHtml: item.stimulusTitleHtml,
    stimulusInstructionsHtml: item.stimulusInstructionsHtml,
    stimulusContentHtml: item.stimulusContentHtml,
    stemHtml: item.stemHtml,
    options: item.optionsJson as Array<{ label: OptionLabel; contentHtml: string }>,
    selectedLabel: item.selectedLabel as OptionLabel | null,
    isFlagged: item.isFlagged,
  }));

  return (
    <SecureExam
      attemptId={attempt.id}
      username={participant.username ?? participant.externalId}
      participantName={participant.name}
      packageName={attempt.examSession.examPackage.name}
      deadlineIso={deadline.toISOString()}
      snapshots={snapshots}
    />
  );
}
