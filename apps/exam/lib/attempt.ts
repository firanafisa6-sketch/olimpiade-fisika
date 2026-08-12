import { randomInt } from "node:crypto";
import { db } from "@seleksi/database";

type OptionSnapshot = { label: "A" | "B" | "C" | "D" | "E"; contentHtml: string };
const LABELS = ["A", "B", "C", "D", "E"] as const;

function shuffled<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export async function createOrResumeAttempt(examSessionId: string, participantId: string) {
  const session = await db.examSession.findFirst({
    where: { id: examSessionId, participantId },
    include: {
      attempt: { include: { questionSnapshots: true } },
      examPackage: {
        include: {
          fields: {
            orderBy: { sortOrder: "asc" },
            include: {
              blueprintRules: {
                orderBy: { sortOrder: "asc" },
                include: {
                  blueprint: {
                    include: {
                      currentVersion: true,
                      stimulus: { include: { currentVersion: true } },
                      questions: {
                        where: { status: "APPROVED", currentVersionId: { not: null } },
                        orderBy: { code: "asc" },
                        include: {
                          currentVersion: {
                            include: { options: { orderBy: { sortOrder: "asc" } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          blueprintRules: {
            where: { examPackageFieldId: null },
            orderBy: { sortOrder: "asc" },
            include: {
              blueprint: {
                include: {
                  currentVersion: true,
                  stimulus: { include: { currentVersion: true } },
                  questions: {
                    where: { status: "APPROVED", currentVersionId: { not: null } },
                    orderBy: { code: "asc" },
                    include: {
                      currentVersion: {
                        include: { options: { orderBy: { sortOrder: "asc" } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) throw new Error("Sesi ujian tidak ditemukan.");
  const now = new Date();
  if (session.examPackage.status !== "PUBLISHED") throw new Error("Paket belum dipublikasikan.");
  if (now < session.startsAt) throw new Error("Waktu ujian belum dimulai.");
  if (now >= session.endsAt) throw new Error("Waktu ujian sudah berakhir.");
  if (session.status === "WAITING") throw new Error("Ujian belum dibuka oleh pengawas.");
  if (session.status === "PAUSED") throw new Error("Ujian sedang dijeda oleh pengawas.");
  if (session.status === "CLOSED") throw new Error("Sesi ujian sudah ditutup.");

  const fieldGroups = session.examPackage.fields.length
    ? session.examPackage.fields.map((field: any) => ({
        name: field.name,
        sortOrder: field.sortOrder,
        rules: field.blueprintRules,
      }))
    : [
        {
          name: session.examPackage.subjectName || "Umum",
          sortOrder: 1,
          rules: session.examPackage.blueprintRules,
        },
      ];

  if (!fieldGroups.some((field: any) => field.rules.length)) {
    throw new Error("Paket belum memiliki kisi-kisi.");
  }
  if (session.attempt?.questionSnapshots.length) return session.attempt;
  if (
    session.attempt &&
    ["SUBMITTED", "EXPIRED", "TERMINATED"].includes(session.attempt.status)
  ) {
    return session.attempt;
  }

  const rows: Array<{
    sourceQuestionId: string;
    sourceQuestionVersionId: string;
    blueprintCode: string;
    questionCode: string;
    fieldName: string;
    fieldOrder: number;
    displayOrder: number;
    groupOrder: number;
    stimulusCode: string | null;
    stimulusTitleHtml: string | null;
    stimulusInstructionsHtml: string | null;
    stimulusContentHtml: string | null;
    stemHtml: string;
    optionsJson: OptionSnapshot[];
    answerKey: "A" | "B" | "C" | "D" | "E";
  }> = [];

  let displayOrder = 1;
  let groupOrder = 1;

  for (const field of fieldGroups) {
    const fieldRules = session.examPackage.shuffleBlocks
      ? shuffled(field.rules)
      : field.rules;

    for (const rule of fieldRules) {
      const blueprint = rule.blueprint;
      const validQuestions = blueprint.questions.filter((question: any) => question.currentVersion);
      if (!validQuestions.length) throw new Error(`${blueprint.code} tidak memiliki soal APPROVED.`);
      if (
        blueprint.currentVersion?.questionMode === "STIMULUS_GROUP" &&
        blueprint.stimulus?.status !== "APPROVED"
      ) {
        throw new Error(`Stimulus ${blueprint.code} belum APPROVED.`);
      }

      const picked =
        rule.selectionMode === "RANDOM_ONE"
          ? [validQuestions[randomInt(validQuestions.length)]]
          : validQuestions;
      const ordered =
        rule.selectionMode === "ALL" &&
        blueprint.currentVersion?.questionMode !== "STIMULUS_GROUP" &&
        session.examPackage.shuffleQuestions
          ? shuffled(picked)
          : [...picked].sort(
              (left: any, right: any) =>
                (left.currentVersion?.orderInStimulus ?? 9999) -
                  (right.currentVersion?.orderInStimulus ?? 9999) ||
                left.code.localeCompare(right.code),
            );

      for (const question of ordered) {
        const version = question.currentVersion!;
        const originalOptions = version.options.map((option: any) => ({
          originalLabel: option.label as "A" | "B" | "C" | "D" | "E",
          contentHtml: option.contentHtml,
        }));
        const arranged = session.examPackage.shuffleOptions
          ? shuffled(originalOptions)
          : originalOptions;
        const optionsJson: OptionSnapshot[] = arranged.map((option: any, index: number) => ({
          label: LABELS[index],
          contentHtml: option.contentHtml,
        }));
        const answerIndex = arranged.findIndex(
          (option: any) => option.originalLabel === version.answerKey,
        );
        if (answerIndex < 0) {
          throw new Error(`Kunci jawaban ${question.code} tidak ditemukan pada opsi.`);
        }

        const stimulusVersion = blueprint.stimulus?.currentVersion;
        rows.push({
          sourceQuestionId: question.id,
          sourceQuestionVersionId: version.id,
          blueprintCode: blueprint.code,
          questionCode: question.code,
          fieldName: field.name,
          fieldOrder: field.sortOrder,
          displayOrder,
          groupOrder,
          stimulusCode: blueprint.stimulus?.code ?? null,
          stimulusTitleHtml: stimulusVersion?.titleHtml ?? null,
          stimulusInstructionsHtml: stimulusVersion?.instructionsHtml ?? null,
          stimulusContentHtml: stimulusVersion?.contentHtml ?? null,
          stemHtml: version.stemHtml,
          optionsJson,
          answerKey: LABELS[answerIndex],
        });
        displayOrder += 1;
      }
      groupOrder += 1;
    }
  }

  return db.$transaction(async (tx: any) => {
    const attempt = await tx.attempt.upsert({
      where: { examSessionId },
      update: { status: "ACTIVE", startedAt: session.attempt?.startedAt ?? now },
      create: { examSessionId, status: "ACTIVE", startedAt: now },
    });
    const existing = await tx.attemptQuestionSnapshot.count({
      where: { attemptId: attempt.id },
    });
    if (!existing) {
      await tx.attemptQuestionSnapshot.createMany({
        data: rows.map((row) => ({ ...row, attemptId: attempt.id })),
      });
    }
    return attempt;
  });
}
