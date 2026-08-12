import { AdminShell } from "@/components/admin-shell";
import { QuestionForm } from "@/components/question-form";
import { ColumnToggleTable } from "@/components/column-toggle-table";
import { PaginationControls } from "@/components/pagination-controls";
import { BlueprintReferencePanel } from "@/components/blueprint-reference-panel";
import {
  ensureAllQuestionSlots,
  getHtml,
  questionOrderFromCode,
  requiredText,
} from "@/lib/db-helpers";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import {
  ChevronDown,
  CircleCheck,
  CircleDashed,
  FilePlus2,
  Pencil,
  Send,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

const optionLabels = ["A", "B", "C", "D", "E"] as const;

function readOptions(formData: FormData) {
  return optionLabels.map((label, index) => ({
    label,
    sortOrder: index + 1,
    contentHtml: getHtml(formData, `option${label}`, true),
  }));
}

async function assertWritingAccess(blueprintId: string, user: { id: string; roles: string[] }) {
  if (user.roles.includes("SUPER_ADMIN")) return;

  const assignment = await db.questionWritingAssignment.findFirst({
    where: {
      blueprintId,
      assignedToId: user.id,
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new Error("Kode kisi-kisi ini tidak diplot kepada Anda.");
  }
}

async function refreshWritingProgress(
  tx: any,
  blueprintId: string,
  userId: string,
) {
  const [total, filled] = await Promise.all([
    tx.question.count({ where: { blueprintId } }),
    tx.question.count({
      where: { blueprintId, currentVersionId: { not: null } },
    }),
  ]);
  await tx.questionWritingAssignment.updateMany({
    where: { blueprintId, assignedToId: userId, status: { not: "CANCELLED" } },
    data: {
      status: total > 0 && filled >= total ? "COMPLETED" : "IN_PROGRESS",
    },
  });
}

async function fillQuestionSlot(formData: FormData) {
  "use server";
  const user = await requireActionUser(["QUESTION_AUTHOR", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id");
  const blueprintId = requiredText(formData, "blueprintId");
  await assertWritingAccess(blueprintId, user);
  await db.$transaction(async (tx) => {
    const [blueprint, question] = await Promise.all([
      tx.blueprint.findUnique({
        where: { id: blueprintId },
        include: {
          currentVersion: true,
          stimulus: { include: { currentVersion: true } },
        },
      }),
      tx.question.findUnique({ where: { id } }),
    ]);
    if (!blueprint?.currentVersion)
      throw new Error("Kisi-kisi belum memiliki versi aktif.");
    if (!question || question.blueprintId !== blueprintId)
      throw new Error("Slot soal tidak sesuai kisi-kisi.");
    if (question.currentVersionId)
      throw new Error("Slot soal sudah terisi. Gunakan tombol Edit.");

    const version = await tx.questionVersion.create({
      data: {
        questionId: question.id,
        versionNumber: 1,
        blueprintVersionId: blueprint.currentVersion.id,
        stimulusVersionId:
          blueprint.currentVersion.questionMode === "STIMULUS_GROUP"
            ? (blueprint.stimulus?.currentVersion?.id ?? null)
            : null,
        orderInStimulus:
          blueprint.currentVersion.questionMode === "STIMULUS_GROUP"
            ? questionOrderFromCode(question.code)
            : null,
        stemHtml: getHtml(formData, "stem", true),
        explanationHtml: getHtml(formData, "explanation"),
        difficulty: String(formData.get("difficulty") || "MEDIUM") as
          | "EASY"
          | "MEDIUM"
          | "HARD",
        answerKey: String(formData.get("answerKey") || "A") as
          | "A"
          | "B"
          | "C"
          | "D"
          | "E",
        changeSummaryHtml: "<p>Versi awal soal pada slot otomatis.</p>",
        createdById: user.id,
        options: { create: readOptions(formData) },
      },
    });
    await tx.question.update({
      where: { id: question.id },
      data: {
        currentVersionId: version.id,
        stimulusId:
          blueprint.currentVersion.questionMode === "STIMULUS_GROUP"
            ? (blueprint.stimulus?.id ?? null)
            : null,
        status: "DRAFT",
      },
    });
    await refreshWritingProgress(tx, blueprintId, user.id);
  });
  revalidatePath("/questions");
  revalidatePath("/reviews");
  revalidatePath("/assignments");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

async function updateQuestion(formData: FormData) {
  "use server";
  const user = await requireActionUser(["QUESTION_AUTHOR", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id");
  const blueprintId = requiredText(formData, "blueprintId");
  await assertWritingAccess(blueprintId, user);
  const blueprint = await db.blueprint.findUnique({
    where: { id: blueprintId },
    include: {
      currentVersion: true,
      stimulus: { include: { currentVersion: true } },
    },
  });
  if (!blueprint?.currentVersion)
    throw new Error("Kisi-kisi belum memiliki versi aktif.");
  await db.$transaction(async (tx) => {
    const existing = await tx.question.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!existing?.currentVersionId)
      throw new Error("Soal belum dibuat. Gunakan tombol Buat.");
    if (existing.blueprintId !== blueprintId)
      throw new Error("Kode kisi-kisi pada slot tidak dapat diubah.");
    const nextVersion = (existing.versions[0]?.versionNumber ?? 0) + 1;
    const version = await tx.questionVersion.create({
      data: {
        questionId: id,
        versionNumber: nextVersion,
        blueprintVersionId: blueprint.currentVersion!.id,
        stimulusVersionId:
          blueprint.currentVersion!.questionMode === "STIMULUS_GROUP"
            ? (blueprint.stimulus?.currentVersion?.id ?? null)
            : null,
        orderInStimulus:
          blueprint.currentVersion!.questionMode === "STIMULUS_GROUP"
            ? questionOrderFromCode(existing.code)
            : null,
        stemHtml: getHtml(formData, "stem", true),
        explanationHtml: getHtml(formData, "explanation"),
        difficulty: String(formData.get("difficulty") || "MEDIUM") as
          | "EASY"
          | "MEDIUM"
          | "HARD",
        answerKey: String(formData.get("answerKey") || "A") as
          | "A"
          | "B"
          | "C"
          | "D"
          | "E",
        changeSummaryHtml:
          getHtml(formData, "changeSummary") ??
          "<p>Perubahan soal oleh penulis.</p>",
        createdById: user.id,
        options: { create: readOptions(formData) },
      },
    });
    await tx.question.update({
      where: { id },
      data: {
        currentVersionId: version.id,
        stimulusId:
          blueprint.currentVersion!.questionMode === "STIMULUS_GROUP"
            ? (blueprint.stimulus?.id ?? null)
            : null,
        status: "DRAFT",
      },
    });
    await refreshWritingProgress(tx, blueprintId, user.id);
  });
  revalidatePath("/questions");
  revalidatePath("/reviews");
  revalidatePath("/packages");
  revalidatePath("/assignments");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

async function submitBlueprintQuestions(formData: FormData) {
  "use server";
  const user = await requireActionUser(["QUESTION_AUTHOR", "SUPER_ADMIN"]);
  const blueprintId = requiredText(formData, "blueprintId");

  const canSubmit =
    user.roles.includes("SUPER_ADMIN") ||
    Boolean(
      await db.questionWritingAssignment.findFirst({
        where: {
          blueprintId,
          assignedToId: user.id,
          status: { not: "CANCELLED" },
        },
        select: { id: true },
      }),
    );
  if (!canSubmit)
    throw new Error(
      "Anda tidak memiliki plotting penulisan untuk kode kisi-kisi ini.",
    );

  await db.$transaction(async (tx) => {
    const blueprint = await tx.blueprint.findUnique({
      where: { id: blueprintId },
      include: {
        currentVersion: true,
        stimulus: { include: { currentVersion: true } },
      },
    });
    if (!blueprint?.currentVersion)
      throw new Error("Kisi-kisi tidak ditemukan.");
    if (
      blueprint.currentVersion.questionMode === "STIMULUS_GROUP" &&
      !blueprint.stimulus?.currentVersion
    ) {
      throw new Error(
        `Stimulus/reading text untuk ${blueprint.code} belum lengkap.`,
      );
    }

    const questions = await tx.question.findMany({
      where: { blueprintId },
      include: {
        validationAssignments: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true },
        },
      },
      orderBy: { code: "asc" },
    });
    if (!questions.length)
      throw new Error(`Belum ada slot soal untuk ${blueprint.code}.`);

    const emptyCodes = questions
      .filter((question) => !question.currentVersionId)
      .map((question) => question.code);
    if (emptyCodes.length) {
      throw new Error(
        `Semua soal pada ${blueprint.code} harus diisi sebelum dikirim. Slot kosong: ${emptyCodes.join(", ")}.`,
      );
    }

    const noValidatorCodes = questions
      .filter((question) => question.validationAssignments.length === 0)
      .map((question) => question.code);
    if (noValidatorCodes.length) {
      throw new Error(
        `Validator belum diplot untuk ${blueprint.code}. Lakukan Plotting Validator Soal terlebih dahulu.`,
      );
    }

    const questionIds = questions.map((question) => question.id);
    await tx.question.updateMany({
      where: {
        id: { in: questionIds },
        status: {
          in: [
            "DRAFT",
            "REVISION_REQUIRED",
            "REJECTED",
            "NEEDS_ALIGNMENT_REVIEW",
          ],
        },
      },
      data: { status: "SUBMITTED" },
    });
    await tx.questionValidationAssignment.updateMany({
      where: { questionId: { in: questionIds }, status: { not: "CANCELLED" } },
      data: { status: "ASSIGNED" },
    });
    if (
      blueprint.currentVersion.questionMode === "STIMULUS_GROUP" &&
      blueprint.stimulus
    ) {
      await tx.stimulus.update({
        where: { id: blueprint.stimulus.id },
        data: { status: "SUBMITTED" },
      });
    }
    await tx.questionWritingAssignment.updateMany({
      where: {
        blueprintId,
        assignedToId: user.id,
        status: { not: "CANCELLED" },
      },
      data: { status: "COMPLETED" },
    });
  });

  revalidatePath("/questions");
  revalidatePath("/reviews");
  revalidatePath("/assignments");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

type PageProps = { searchParams?: Promise<{ page?: string; size?: string }> };

export default async function QuestionsPage({ searchParams }: PageProps) {
  const user = await requirePageUser(["QUESTION_AUTHOR", "SUPER_ADMIN"]);
  await ensureAllQuestionSlots();
  const canSeeAll = user.roles.includes("SUPER_ADMIN");
  const params = await searchParams;

  const assignments = await db.questionWritingAssignment.findMany({
    where: { assignedToId: user.id, status: { not: "CANCELLED" } },
    include: {
      blueprint: {
        include: {
          currentVersion: true,
          stimulus: { include: { currentVersion: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const assignedBlueprintIds = assignments.map((item) => item.blueprintId);
  const questionWhere = canSeeAll ? {} : { blueprintId: { in: assignedBlueprintIds } };
  const totalQuestions = await db.question.count({ where: questionWhere });
  const pagination = paginationWindow(totalQuestions, parsePage(params?.page), parsePageSize(params?.size));

  const [questions, totalFilled, totalSubmitted] = await Promise.all([
    db.question.findMany({
    where: questionWhere,
    orderBy: [{ blueprint: { createdAt: "desc" } }, { code: "asc" }],
    skip: pagination.skip,
    ...(pagination.take ? { take: pagination.take } : {}),
    include: {
      blueprint: {
        include: {
          currentVersion: true,
          stimulus: { include: { currentVersion: true } },
          writingAssignments: { include: { assignedTo: true } },
        },
      },
      validationAssignments: { include: { assignedTo: true } },
      currentVersion: {
        include: {
          options: { orderBy: { sortOrder: "asc" } },
          createdBy: true,
        },
      },
    },
  }),
    db.question.count({ where: { ...questionWhere, currentVersionId: { not: null } } }),
    db.question.count({
      where: {
        ...questionWhere,
        status: { in: ["SUBMITTED", "IN_REVIEW", "APPROVED", "REVISION_REQUIRED"] },
      },
    }),
  ]);

  const groupMap = questions.reduce((map, question) => {
    const existing = map.get(question.blueprintId);
    if (existing) {
      existing.questions.push(question);
      return map;
    }
    const assignment = assignments.find(
      (item) => item.blueprintId === question.blueprintId,
    );
    map.set(question.blueprintId, {
      blueprint: question.blueprint,
      assignment,
      questions: [question],
    });
    return map;
  }, new Map<string, any>());
  const groups: any[] = Array.from(groupMap.values());

  return (
    <AdminShell
      title="Tulis Soal"
      subtitle="Daftar slot soal dikelompokkan berdasarkan kode kisi-kisi"
      allowedRoles={["QUESTION_AUTHOR", "SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <p className="eyebrow">Ruang kerja penulis</p>
          <h2>Daftar soal</h2>
          <p>
            Setiap kode kisi-kisi memiliki slot soal otomatis. Klik{" "}
            <strong>Buat</strong> pada slot kosong untuk mulai menulis.
          </p>
        </div>
        <div className="question-page-stats">
          <span>
            <strong>{totalFilled}</strong> terisi
          </span>
          <span>
            <strong>{totalQuestions - totalFilled}</strong> belum dibuat
          </span>
          <span>
            <strong>{totalSubmitted}</strong> terkirim
          </span>
        </div>
      </div>

      {groups.length ? (
        <section className="question-groups">
          {groups.map((group) => {
            const blueprint = group.blueprint;
            const label = (
              blueprint.currentVersion?.testGroupHtml ??
              blueprint.currentVersion?.titleHtml ??
              "Kisi-kisi"
            ).replace(/<[^>]+>/g, "");
            const filled = group.questions.filter(
              (question: any) => question.currentVersion,
            ).length;
            const blueprintOption = [
              {
                id: blueprint.id,
                code: blueprint.code,
                label,
                target: blueprint.currentVersion?.expectedQuestionCount,
                assignedTarget: group.assignment?.targetCount,
                currentCount: filled,
                questionMode: blueprint.currentVersion?.questionMode,
                stimulusCode: blueprint.stimulus?.code,
                stimulusLanguage: blueprint.stimulus?.language,
                stimulusTitleHtml:
                  blueprint.stimulus?.currentVersion?.titleHtml,
                stimulusInstructionsHtml:
                  blueprint.stimulus?.currentVersion?.instructionsHtml,
                stimulusContentHtml:
                  blueprint.stimulus?.currentVersion?.contentHtml,
                stimulusSource: blueprint.stimulus?.currentVersion?.source,
              },
            ];

            return (
              <details className="question-group card" key={blueprint.id} open>
                <summary className="question-group-summary">
                  <div className="question-group-title">
                    <span className="question-group-icon">
                      <FilePlus2 size={20} />
                    </span>
                    <div>
                      <strong>{blueprint.code}</strong>
                      <span>{label}</span>
                    </div>
                  </div>
                  <div className="question-group-progress">
                    <strong>
                      {filled}/{group.questions.length}
                    </strong>
                    <span>soal terisi</span>
                    <ChevronDown className="details-chevron" size={18} />
                  </div>
                </summary>
                {blueprint.currentVersion?.questionMode === "STIMULUS_GROUP" &&
                blueprint.stimulus?.currentVersion ? (
                  <section className="stimulus-workspace-card">
                    <div className="stimulus-workspace-heading">
                      <div>
                        <span className="eyebrow">Reading text bersama</span>
                        <strong>{blueprint.stimulus.code}</strong>
                      </div>
                      <span className="badge">
                        {blueprint.stimulus.language.toUpperCase()} ·{" "}
                        {group.questions.length} soal
                      </span>
                    </div>
                    <div className="stimulus-split-preview">
                      <div className="stimulus-reading-card">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: blueprint.stimulus.currentVersion.titleHtml,
                          }}
                        />
                        <div
                          className="stimulus-instructions"
                          dangerouslySetInnerHTML={{
                            __html:
                              blueprint.stimulus.currentVersion
                                .instructionsHtml,
                          }}
                        />
                        <div
                          className="stimulus-content"
                          dangerouslySetInnerHTML={{
                            __html:
                              blueprint.stimulus.currentVersion.contentHtml,
                          }}
                        />
                        {blueprint.stimulus.currentVersion.source ? (
                          <p className="stimulus-source">
                            Sumber: {blueprint.stimulus.currentVersion.source}
                          </p>
                        ) : null}
                      </div>
                      <div className="stimulus-guidance">
                        <strong>
                          Penulisan soal 1–{group.questions.length}
                        </strong>
                        <p>
                          Jangan menyalin reading text ke stem. Isi stem hanya
                          dengan pertanyaan untuk nomor yang sedang dikerjakan.
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}
                <div className="question-group-submit-bar">
                  <div>
                    <strong>Kirim seluruh soal {blueprint.code}</strong>
                    <span>
                      {filled === group.questions.length
                        ? "Semua slot sudah terisi."
                        : `${group.questions.length - filled} slot masih kosong.`}
                    </span>
                  </div>
                  <form action={submitBlueprintQuestions}>
                    <input
                      type="hidden"
                      name="blueprintId"
                      value={blueprint.id}
                    />
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={
                        filled !== group.questions.length ||
                        group.questions.some(
                          (question: any) =>
                            question.validationAssignments.filter(
                              (item: any) => item.status !== "CANCELLED",
                            ).length === 0,
                        )
                      }
                      title={
                        filled !== group.questions.length
                          ? "Lengkapi semua soal terlebih dahulu"
                          : "Kirim satu kelompok kisi-kisi ke validator"
                      }
                    >
                      <Send size={16} /> Kirim ke validator
                    </button>
                  </form>
                </div>
                <div className="question-group-body">
                  <BlueprintReferencePanel
                    code={blueprint.code}
                    testGroupHtml={
                      blueprint.currentVersion?.testGroupHtml ??
                      blueprint.currentVersion?.titleHtml
                    }
                    testTopicHtml={
                      blueprint.currentVersion?.testTopicHtml ??
                      blueprint.currentVersion?.competencyHtml
                    }
                    indicatorHtml={blueprint.currentVersion?.indicatorHtml}
                    materialHtml={blueprint.currentVersion?.materialHtml}
                    gridHtml={blueprint.currentVersion?.gridHtml}
                  />
                  <ColumnToggleTable
                    storageKey="soalflow-questions-columns"
                    columns={[
                      { key: "code", label: "Kode soal", index: 1, locked: true },
                      { key: "content", label: "Isi soal", index: 2 },
                      { key: "validator", label: "Validator", index: 3 },
                      { key: "status", label: "Status", index: 4 },
                      { key: "action", label: "Aksi", index: 5 },
                    ]}
                  >
                    <table className="data-table question-slot-table">
                    <thead>
                      <tr>
                        <th>Kode soal</th>
                        <th>Isi soal</th>
                        <th>Validator</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.questions.map((row: any) => {
                        const current = row.currentVersion;
                        const values = Object.fromEntries(
                          (current?.options ?? []).map((option: any) => [
                            option.label,
                            option.contentHtml,
                          ]),
                        );
                        const isEmpty = !current;
                        return (
                          <tr
                            key={row.id}
                            className={isEmpty ? "question-slot-empty" : ""}
                          >
                            <td>
                              <strong className="code-label">{row.code}</strong>
                              <br />
                              {isEmpty ? (
                                <span className="slot-state">
                                  <CircleDashed size={14} /> Slot kosong
                                </span>
                              ) : (
                                <span className="slot-state is-filled">
                                  <CircleCheck size={14} /> Versi{" "}
                                  {current.versionNumber}
                                </span>
                              )}
                            </td>
                            <td>
                              {isEmpty ? (
                                <div className="slot-placeholder">
                                  <span>Belum ada isi soal</span>
                                  <small>
                                    Kode sudah disiapkan otomatis dari
                                    kisi-kisi.
                                  </small>
                                </div>
                              ) : (
                                <>
                                  <div
                                    className="rich-preview"
                                    dangerouslySetInnerHTML={{
                                      __html: current.stemHtml,
                                    }}
                                  />
                                  <div className="muted-text">
                                    Kunci: <strong>{current.answerKey}</strong>{" "}
                                    • Kesulitan: {current.difficulty}
                                  </div>
                                </>
                              )}
                            </td>
                            <td>
                              {row.validationAssignments.length ? (
                                row.validationAssignments.map((item: any) => (
                                  <span className="role-pill" key={item.id}>
                                    <ShieldCheck size={13} />{" "}
                                    {item.assignedTo.name}
                                  </span>
                                ))
                              ) : (
                                <span className="muted-text">Belum diplot</span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`badge ${isEmpty || row.status === "SUBMITTED" || row.status === "REVISION_REQUIRED" ? "warning" : ""}`}
                              >
                                {isEmpty
                                  ? "BELUM DIBUAT"
                                  : row.status.replaceAll("_", " ")}
                              </span>
                            </td>
                            <td>
                              <details className="action-details question-form-details">
                                <summary
                                  className={
                                    isEmpty
                                      ? "primary-button"
                                      : "secondary-button"
                                  }
                                >
                                  {isEmpty ? (
                                    <FilePlus2 size={15} />
                                  ) : (
                                    <Pencil size={15} />
                                  )}{" "}
                                  {isEmpty ? "Buat" : "Edit"}
                                </summary>
                                <QuestionForm
                                  action={
                                    isEmpty ? fillQuestionSlot : updateQuestion
                                  }
                                  compact
                                  isNewSlot={isEmpty}
                                  submitLabel={
                                    isEmpty
                                      ? "Simpan draft"
                                      : "Simpan perubahan"
                                  }
                                  blueprints={blueprintOption}
                                  initial={{
                                    id: row.id,
                                    code: row.code,
                                    blueprintId: row.blueprintId,
                                    stemHtml: current?.stemHtml,
                                    explanationHtml: current?.explanationHtml,
                                    answerKey: current?.answerKey,
                                    difficulty: current?.difficulty,
                                    status: row.status,
                                    orderInStimulus:
                                      current?.orderInStimulus ??
                                      questionOrderFromCode(row.code),
                                    options: values as Record<string, string>,
                                  }}
                                />
                              </details>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </ColumnToggleTable>
                </div>
              </details>
            );
          })}
          <PaginationControls
            basePath="/questions"
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={totalQuestions}
            totalPages={pagination.totalPages}
            from={pagination.from}
            to={pagination.to}
            itemLabel="soal"
          />
        </section>
      ) : (
        <section className="card panel empty-workspace">
          <FilePlus2 size={36} />
          <h3>Belum ada plotting kisi-kisi</h3>
          <p className="muted-text">
            Admin atau super admin perlu menugaskan kode kisi-kisi kepada
            penulis soal terlebih dahulu.
          </p>
        </section>
      )}
    </AdminShell>
  );
}
