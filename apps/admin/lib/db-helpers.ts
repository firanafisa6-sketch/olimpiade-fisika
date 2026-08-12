import { db } from "@seleksi/database";

export async function getOrCreateDefaultPeriod() {
  return db.selectionPeriod.upsert({
    where: { code: "PMB-2026" },
    update: { name: "PMB 2026" },
    create: {
      code: "PMB-2026",
      name: "PMB 2026"
    }
  });
}

export function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} wajib diisi.`);
  return value;
}

export function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

export function asHtmlParagraph(value: string | undefined) {
  const clean = (value ?? "").trim();
  if (!clean) return undefined;
  if (clean.startsWith("<")) return clean;
  return `<p>${clean.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br />")}</p>`;
}

function pad4(value: number) {
  return String(value).padStart(4, "0");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export async function generateBlueprintCode(tx: any = db) {
  let sequence = (await tx.blueprint.count()) + 1;
  while (true) {
    const code = `KK-${pad4(sequence)}`;
    const exists = await tx.blueprint.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
    sequence += 1;
  }
}


export function questionOrderFromCode(code: string) {
  const match = code.match(/-S(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

export async function generateStimulusCode(blueprintCode: string, tx: any = db) {
  const base = `ST-${blueprintCode}`;
  let code = base;
  let sequence = 2;
  while (await tx.stimulus.findUnique({ where: { code }, select: { id: true } })) {
    code = `${base}-${sequence}`;
    sequence += 1;
  }
  return code;
}

export async function syncBlueprintQuestionStimulus(blueprintId: string, tx: any = db) {
  const blueprint = await tx.blueprint.findUnique({
    where: { id: blueprintId },
    include: { currentVersion: true, stimulus: { select: { id: true } } }
  });
  if (!blueprint?.currentVersion) return;
  const stimulusId = blueprint.currentVersion.questionMode === "STIMULUS_GROUP"
    ? blueprint.stimulus?.id ?? null
    : null;
  await tx.question.updateMany({ where: { blueprintId }, data: { stimulusId } });
}

export async function generateQuestionCode(blueprintId: string, tx: any = db) {
  const blueprint = await tx.blueprint.findUnique({ where: { id: blueprintId }, select: { code: true } });
  if (!blueprint) throw new Error("Kisi-kisi tidak ditemukan untuk generate kode soal.");

  let sequence = (await tx.question.count({ where: { blueprintId } })) + 1;
  while (true) {
    const code = `${blueprint.code}-S${pad2(sequence)}`;
    const exists = await tx.question.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
    sequence += 1;
  }
}

/**
 * Menyamakan jumlah slot soal dengan target pada kisi-kisi.
 * Slot dibuat tanpa versi soal agar penulis tinggal memilih tombol "Buat".
 * Plotting validator yang sudah ada ikut disalin ke slot baru.
 */
export async function syncQuestionSlots(blueprintId: string, expectedCount: number, tx: any = db) {
  const requestedTarget = Math.max(1, Math.floor(Number.isFinite(expectedCount) ? expectedCount : 1));
  const blueprint = await tx.blueprint.findUnique({
    where: { id: blueprintId },
    include: { currentVersion: true, stimulus: { select: { id: true } } }
  });
  if (!blueprint) throw new Error("Kisi-kisi tidak ditemukan saat membuat slot soal.");
  const stimulusId = blueprint.currentVersion?.questionMode === "STIMULUS_GROUP" ? blueprint.stimulus?.id ?? null : null;
  await tx.question.updateMany({ where: { blueprintId }, data: { stimulusId } });

  let questions = await tx.question.findMany({
    where: { blueprintId },
    orderBy: { code: "asc" },
    select: { id: true, code: true, currentVersionId: true }
  });

  const authoredCount = questions.filter((item: any) => Boolean(item.currentVersionId)).length;
  const target = Math.max(requestedTarget, authoredCount);

  if (questions.length > target) {
    const removable = questions
      .filter((item: any) => !item.currentVersionId)
      .sort((a: any, b: any) => b.code.localeCompare(a.code))
      .slice(0, questions.length - target);

    if (removable.length < questions.length - target) {
      throw new Error("Target soal tidak dapat dikurangi karena sebagian slot sudah berisi soal.");
    }

    await tx.question.deleteMany({ where: { id: { in: removable.map((item: any) => item.id) } } });
    questions = questions.filter((item: any) => !removable.some((removed: any) => removed.id === item.id));
  }

  if (questions.length >= target) return;

  const existingAssignments = await tx.questionValidationAssignment.findMany({
    where: { question: { blueprintId } },
    orderBy: { createdAt: "asc" },
    select: {
      assignedToId: true,
      assignedById: true,
      noteHtml: true,
      status: true
    }
  });
  const validatorTemplates = Array.from(
    new Map(existingAssignments.map((item: any) => [item.assignedToId, item])).values()
  ) as any[];

  const usedNumbers = new Set<number>();
  for (const item of questions) {
    const match = item.code.match(/-S(\d+)$/);
    if (match) usedNumbers.add(Number(match[1]));
  }

  let nextNumber = 1;
  const missing = target - questions.length;
  for (let index = 0; index < missing; index += 1) {
    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    const code = `${blueprint.code}-S${pad2(nextNumber)}`;
    usedNumbers.add(nextNumber);
    nextNumber += 1;

    const question = await tx.question.create({
      data: {
        code,
        blueprintId,
        stimulusId,
        status: "DRAFT"
      },
      select: { id: true }
    });

    if (validatorTemplates.length) {
      await tx.questionValidationAssignment.createMany({
        data: validatorTemplates.map((template: any) => ({
          questionId: question.id,
          assignedToId: template.assignedToId,
          assignedById: template.assignedById,
          noteHtml: template.noteHtml,
          status: template.status === "CANCELLED" ? "CANCELLED" : "ASSIGNED"
        })),
        skipDuplicates: true
      });
    }
  }
}

export async function ensureAllQuestionSlots() {
  const blueprints = await db.blueprint.findMany({
    where: { currentVersionId: { not: null } },
    select: {
      id: true,
      currentVersion: { select: { expectedQuestionCount: true } }
    }
  });

  for (const blueprint of blueprints) {
    await syncQuestionSlots(blueprint.id, blueprint.currentVersion?.expectedQuestionCount ?? 1);
    await syncBlueprintQuestionStimulus(blueprint.id);
  }

  // Migrasi kompatibel: plotting validator versi lama yang hanya menunjuk satu soal
  // diperluas ke seluruh slot dalam kode kisi-kisi yang sama.
  const legacyAssignments = await db.questionValidationAssignment.findMany({
    include: { question: { select: { blueprintId: true } } },
    orderBy: { createdAt: "asc" }
  });
  const groups = new Map<string, any>();
  for (const assignment of legacyAssignments) {
    const key = `${assignment.question.blueprintId}:${assignment.assignedToId}`;
    if (!groups.has(key)) groups.set(key, assignment);
  }
  for (const assignment of groups.values()) {
    const blueprintId = assignment.question.blueprintId;
    const questions = await db.question.findMany({ where: { blueprintId }, select: { id: true } });
    await db.questionValidationAssignment.createMany({
      data: questions.map((question) => ({
        questionId: question.id,
        assignedToId: assignment.assignedToId,
        assignedById: assignment.assignedById,
        noteHtml: assignment.noteHtml,
        status: assignment.status === "CANCELLED" ? "CANCELLED" : "ASSIGNED"
      })),
      skipDuplicates: true
    });
  }
}

export function getHtml(formData: FormData, key: string, required: true): string;
export function getHtml(formData: FormData, key: string, required?: false): string | undefined;
export function getHtml(formData: FormData, key: string, required = false) {
  return required
    ? asHtmlParagraph(requiredText(formData, key))!
    : asHtmlParagraph(optionalText(formData, key));
}
