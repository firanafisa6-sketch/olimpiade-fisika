import { db } from "@seleksi/database";

const FINAL_ATTEMPT_STATUSES = ["SUBMITTED", "EXPIRED"] as const;
const OPTION_LABELS = ["A", "B", "C", "D", "E"] as const;

type SnapshotLike = {
  id: string;
  sourceQuestionId: string;
  sourceQuestionVersionId: string;
  blueprintCode: string;
  questionCode: string;
  fieldName: string;
  displayOrder: number;
  stemHtml: string;
  optionsJson: unknown;
  answerKey: string;
  selectedLabel: string | null;
};

type AttemptLike = {
  id: string;
  status: string;
  startedAt: Date | null;
  submittedAt: Date | null;
  examSession: {
    participant: {
      id: string;
      username: string | null;
      externalId: string;
      name: string;
    };
  };
  questionSnapshots: SnapshotLike[];
  score?: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    finalScore: unknown;
  } | null;
};

export type ParticipantScoreRow = {
  attemptId: string;
  username: string;
  participantName: string;
  status: string;
  startedAt: Date | null;
  submittedAt: Date | null;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  score: number;
};

export type DistractorRow = {
  label: string;
  isKey: boolean;
  selectedCount: number;
  percentage: number;
  functionStatus: "Kunci" | "Berfungsi" | "Tidak berfungsi" | "Tidak dipilih";
};

export type ItemParameterRow = {
  sourceQuestionId: string;
  sourceQuestionVersionId: string;
  fieldName: string;
  blueprintCode: string;
  questionCode: string;
  stemText: string;
  participantCount: number;
  correctCount: number;
  unansweredCount: number;
  difficultyIndex: number;
  difficultyCategory: string;
  discriminationIndex: number | null;
  discriminationCategory: string;
  pointBiserial: number | null;
  validityCategory: string;
  distractors: DistractorRow[];
};

export type ReliabilityRow = {
  scope: string;
  unitCount: number;
  participantCount: number;
  coefficient: number | null;
  method: string;
  category: string;
};

export type PackageAnalysis = {
  packageInfo: {
    id: string;
    code: string;
    name: string;
    fields: string[];
  };
  scores: ParticipantScoreRow[];
  items: ItemParameterRow[];
  reliability: ReliabilityRow[];
  summary: {
    participantCount: number;
    itemCount: number;
    averageScore: number;
    minimumScore: number;
    maximumScore: number;
    medianScore: number;
  };
};

function plainText(html: string | null | undefined) {
  return (html ?? "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sampleVariance(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function pearson(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 3) return null;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquares += leftDelta ** 2;
    rightSquares += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftSquares * rightSquares);
  return denominator > 0 ? numerator / denominator : null;
}

function difficultyCategory(value: number) {
  if (value < 0.3) return "Sukar";
  if (value <= 0.7) return "Sedang";
  return "Mudah";
}

function discriminationCategory(value: number | null) {
  if (value === null) return "Data belum cukup";
  if (value < 0) return "Negatif / bermasalah";
  if (value < 0.2) return "Rendah";
  if (value < 0.4) return "Cukup";
  if (value < 0.7) return "Baik";
  return "Sangat baik";
}

function validityCategory(value: number | null) {
  if (value === null) return "Data belum cukup";
  if (value < 0) return "Negatif / bermasalah";
  if (value < 0.2) return "Rendah";
  if (value < 0.3) return "Perlu revisi";
  if (value < 0.4) return "Baik";
  return "Sangat baik";
}

function reliabilityCategory(value: number | null) {
  if (value === null) return "Data belum cukup";
  if (value < 0) return "Negatif / periksa struktur tes";
  if (value < 0.6) return "Rendah";
  if (value < 0.7) return "Marginal";
  if (value < 0.8) return "Cukup";
  if (value < 0.9) return "Baik";
  return "Sangat baik";
}

function cronbachAlpha(matrix: number[][]) {
  if (matrix.length < 2 || !matrix[0] || matrix[0].length < 2) return null;
  const unitCount = matrix[0].length;
  const unitVariances = Array.from({ length: unitCount }, (_, unitIndex) =>
    sampleVariance(matrix.map((row) => row[unitIndex])),
  );
  const totals = matrix.map((row) => row.reduce((sum, value) => sum + value, 0));
  const totalVariance = sampleVariance(totals);
  if (totalVariance <= 0) return null;
  return (unitCount / (unitCount - 1)) *
    (1 - unitVariances.reduce((sum, value) => sum + value, 0) / totalVariance);
}

function isBinaryMatrix(matrix: number[][]) {
  return matrix.every((row) => row.every((value) => value === 0 || value === 1));
}

function buildReliability(attempts: AttemptLike[]): ReliabilityRow[] {
  if (!attempts.length) return [];

  const participantUnits = attempts.map((attempt) => {
    const grouped = new Map<string, { fieldName: string; correct: number; total: number }>();
    for (const snapshot of attempt.questionSnapshots) {
      const current = grouped.get(snapshot.blueprintCode) ?? {
        fieldName: snapshot.fieldName || "Umum",
        correct: 0,
        total: 0,
      };
      current.total += 1;
      if (snapshot.selectedLabel === snapshot.answerKey) current.correct += 1;
      grouped.set(snapshot.blueprintCode, current);
    }
    return grouped;
  });

  const commonBlueprints = Array.from(participantUnits[0]?.keys() ?? []).filter((key) =>
    participantUnits.every((units) => units.has(key)),
  );

  const rows: ReliabilityRow[] = [];
  const appendReliability = (scope: string, keys: string[]) => {
    const matrix = participantUnits.map((units) =>
      keys.map((key) => {
        const unit = units.get(key)!;
        return unit.total ? unit.correct / unit.total : 0;
      }),
    );
    const coefficient = cronbachAlpha(matrix);
    rows.push({
      scope,
      unitCount: keys.length,
      participantCount: attempts.length,
      coefficient,
      method: isBinaryMatrix(matrix)
        ? "KR-20 / Cronbach's Alpha (unit kisi-kisi dikotomis)"
        : "Cronbach's Alpha (skor proporsi per kisi-kisi)",
      category: reliabilityCategory(coefficient),
    });
  };

  if (commonBlueprints.length >= 2) appendReliability("Seluruh paket", commonBlueprints);
  else {
    rows.push({
      scope: "Seluruh paket",
      unitCount: commonBlueprints.length,
      participantCount: attempts.length,
      coefficient: null,
      method: "Cronbach's Alpha",
      category: "Minimal 2 kisi-kisi dan 2 peserta",
    });
  }

  const fields = new Map<string, string[]>();
  for (const key of commonBlueprints) {
    const field = participantUnits[0].get(key)?.fieldName ?? "Umum";
    const keys = fields.get(field) ?? [];
    keys.push(key);
    fields.set(field, keys);
  }
  for (const [field, keys] of fields) {
    if (keys.length >= 2) appendReliability(`Bidang: ${field}`, keys);
  }

  return rows;
}

export async function buildPackageAnalysis(packageId: string): Promise<PackageAnalysis | null> {
  const examPackage = await db.examPackage.findUnique({
    where: { id: packageId },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!examPackage) return null;

  const attempts = (await db.attempt.findMany({
    where: {
      status: { in: [...FINAL_ATTEMPT_STATUSES] },
      examSession: { examPackageId: packageId },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      examSession: { include: { participant: true } },
      questionSnapshots: { orderBy: { displayOrder: "asc" } },
      score: true,
    },
  })) as unknown as AttemptLike[];

  const versionIds = Array.from(
    new Set(
      attempts.flatMap((attempt) =>
        attempt.questionSnapshots.map((snapshot) => snapshot.sourceQuestionVersionId),
      ),
    ),
  );
  const questionVersions = versionIds.length
    ? await db.questionVersion.findMany({
        where: { id: { in: versionIds } },
        select: {
          id: true,
          answerKey: true,
          options: { select: { label: true, contentHtml: true } },
        },
      })
    : [];
  const versionMap = new Map<
    string,
    { answerKey: string; options: Array<{ label: string; contentHtml: string }> }
  >(
    questionVersions.map((version: any) => [
      version.id,
      {
        answerKey: String(version.answerKey),
        options: version.options.map((option: any) => ({
          label: String(option.label),
          contentHtml: String(option.contentHtml),
        })),
      },
    ] as [string, { answerKey: string; options: Array<{ label: string; contentHtml: string }> }]),
  );

  const scores: ParticipantScoreRow[] = attempts.map((attempt) => {
    const totalQuestions = attempt.questionSnapshots.length;
    const correctCount = attempt.score?.correctCount ?? attempt.questionSnapshots.filter(
      (snapshot) => snapshot.selectedLabel === snapshot.answerKey,
    ).length;
    const unansweredCount = attempt.score?.unansweredCount ?? attempt.questionSnapshots.filter(
      (snapshot) => snapshot.selectedLabel === null,
    ).length;
    const wrongCount = attempt.score?.wrongCount ?? Math.max(0, totalQuestions - correctCount - unansweredCount);
    return {
      attemptId: attempt.id,
      username:
        attempt.examSession.participant.username ?? attempt.examSession.participant.externalId,
      participantName: attempt.examSession.participant.name,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      totalQuestions,
      correctCount,
      wrongCount,
      unansweredCount,
      score: Number(attempt.score?.finalScore ?? (totalQuestions ? (correctCount / totalQuestions) * 100 : 0)),
    };
  });

  const totalCorrectByAttempt = new Map(
    attempts.map((attempt) => [
      attempt.id,
      attempt.questionSnapshots.filter((snapshot) => snapshot.selectedLabel === snapshot.answerKey).length,
    ]),
  );

  type ItemResponse = {
    itemCorrect: number;
    totalCorrect: number;
    correctedTotal: number;
    selectedLabel: string | null;
  };
  const itemGroups = new Map<
    string,
    {
      metadata: SnapshotLike;
      responses: ItemResponse[];
    }
  >();

  for (const attempt of attempts) {
    const totalCorrect = totalCorrectByAttempt.get(attempt.id) ?? 0;
    for (const snapshot of attempt.questionSnapshots) {
      const itemCorrect = snapshot.selectedLabel === snapshot.answerKey ? 1 : 0;
      const version = versionMap.get(snapshot.sourceQuestionVersionId);
      const displayedOptions = Array.isArray(snapshot.optionsJson)
        ? (snapshot.optionsJson as Array<{ label?: unknown; contentHtml?: unknown }>)
        : [];
      const selectedDisplayedOption = displayedOptions.find(
        (option) => String(option.label ?? "") === snapshot.selectedLabel,
      );
      const selectedContent = selectedDisplayedOption
        ? String(selectedDisplayedOption.contentHtml ?? "")
        : null;
      const selectedOriginalLabel = selectedContent && version
        ? version.options.find((option: { label: string; contentHtml: string }) =>
            option.contentHtml === selectedContent,
          )?.label ?? snapshot.selectedLabel
        : snapshot.selectedLabel;
      const groupKey = snapshot.sourceQuestionVersionId || snapshot.sourceQuestionId;
      const current = itemGroups.get(groupKey) ?? {
        metadata: snapshot,
        responses: [],
      };
      current.responses.push({
        itemCorrect,
        totalCorrect,
        correctedTotal: totalCorrect - itemCorrect,
        selectedLabel: selectedOriginalLabel,
      });
      itemGroups.set(groupKey, current);
    }
  }

  const items: ItemParameterRow[] = Array.from(itemGroups.values())
    .map(({ metadata, responses }) => {
      const participantCount = responses.length;
      const correctCount = responses.reduce((sum, response) => sum + response.itemCorrect, 0);
      const unansweredCount = responses.filter((response) => response.selectedLabel === null).length;
      const difficultyIndex = participantCount ? correctCount / participantCount : 0;

      let discriminationIndex: number | null = null;
      if (participantCount >= 4) {
        const sorted = [...responses].sort((left, right) => right.totalCorrect - left.totalCorrect);
        const groupSize = Math.max(1, Math.floor(participantCount * 0.27));
        if (groupSize * 2 <= participantCount) {
          const upper = sorted.slice(0, groupSize);
          const lower = sorted.slice(-groupSize);
          discriminationIndex =
            mean(upper.map((response) => response.itemCorrect)) -
            mean(lower.map((response) => response.itemCorrect));
        }
      }

      const pointBiserial = pearson(
        responses.map((response) => response.itemCorrect),
        responses.map((response) => response.correctedTotal),
      );

      const originalAnswerKey =
        versionMap.get(metadata.sourceQuestionVersionId)?.answerKey ?? metadata.answerKey;
      const distractors: DistractorRow[] = OPTION_LABELS.map((label) => {
        const selectedCount = responses.filter((response) => response.selectedLabel === label).length;
        const percentage = participantCount ? selectedCount / participantCount : 0;
        const isKey = label === originalAnswerKey;
        return {
          label,
          isKey,
          selectedCount,
          percentage,
          functionStatus: isKey
            ? "Kunci"
            : selectedCount === 0
              ? "Tidak dipilih"
              : percentage >= 0.05
                ? "Berfungsi"
                : "Tidak berfungsi",
        };
      });

      return {
        sourceQuestionId: metadata.sourceQuestionId,
        sourceQuestionVersionId: metadata.sourceQuestionVersionId,
        fieldName: metadata.fieldName || "Umum",
        blueprintCode: metadata.blueprintCode,
        questionCode: metadata.questionCode,
        stemText: plainText(metadata.stemHtml),
        participantCount,
        correctCount,
        unansweredCount,
        difficultyIndex,
        difficultyCategory: difficultyCategory(difficultyIndex),
        discriminationIndex,
        discriminationCategory: discriminationCategory(discriminationIndex),
        pointBiserial,
        validityCategory: validityCategory(pointBiserial),
        distractors,
      };
    })
    .sort(
      (left, right) =>
        left.fieldName.localeCompare(right.fieldName) ||
        left.blueprintCode.localeCompare(right.blueprintCode) ||
        left.questionCode.localeCompare(right.questionCode),
    );

  const numericScores = scores.map((row) => row.score);
  return {
    packageInfo: {
      id: examPackage.id,
      code: examPackage.code,
      name: examPackage.name,
      fields: examPackage.fields.map((field) => field.name),
    },
    scores,
    items,
    reliability: buildReliability(attempts),
    summary: {
      participantCount: scores.length,
      itemCount: items.length,
      averageScore: mean(numericScores),
      minimumScore: numericScores.length ? Math.min(...numericScores) : 0,
      maximumScore: numericScores.length ? Math.max(...numericScores) : 0,
      medianScore: median(numericScores),
    },
  };
}
