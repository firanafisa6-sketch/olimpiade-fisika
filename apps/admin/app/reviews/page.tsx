import { AdminShell } from "@/components/admin-shell";
import { ReviewQuestionForm, type ReviewActionState } from "@/components/review-question-form";
import { StimulusReviewForm } from "@/components/stimulus-review-form";
import { ColumnToggleTable } from "@/components/column-toggle-table";
import { PaginationControls } from "@/components/pagination-controls";
import { BlueprintReferencePanel } from "@/components/blueprint-reference-panel";
import { getHtml, optionalText, requiredText } from "@/lib/db-helpers";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import { db } from "@seleksi/database";
import { ContentStatus, ValidationTaskStatus, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { BookOpenText, CheckCircle2, ChevronDown, Pencil, RotateCcw, ShieldCheck, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const optionLabels = ["A", "B", "C", "D", "E"] as const;
const difficultyLabels: Record<string, string> = {
  EASY: "Mudah",
  MEDIUM: "Sedang",
  HARD: "Sulit",
};
const statusLabels: Record<string, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  REVISION_REQUIRED: "Perlu Revisi",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  NEEDS_ALIGNMENT_REVIEW: "Perlu Cek Keselarasan",
};

function hasMeaningfulHtml(html?: string | null) {
  return Boolean(html?.replace(/<[^>]*>/g, "").trim());
}

function readOptions(formData: FormData) {
  return optionLabels.map((label, index) => ({
    label,
    sortOrder: index + 1,
    contentHtml: getHtml(formData, `option${label}`, true),
  }));
}

function statusFromDecision(value: string): ContentStatus {
  if (value === "APPROVE") return ContentStatus.APPROVED;
  if (value === "REJECT") return ContentStatus.REJECTED;
  if (value === "REQUEST_REVISION") return ContentStatus.REVISION_REQUIRED;
  return ContentStatus.IN_REVIEW;
}

async function validateQuestion(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  "use server";
  try {
    const user = await requireActionUser(["QUESTION_VALIDATOR", "SUPER_ADMIN"]);
    const id = requiredText(formData, "id");
    const decision = String(formData.get("decision") || "APPROVE");
    const status = statusFromDecision(decision);
    let savedQuestionCode = "";

    await db.$transaction(async (tx) => {
      const existing = await tx.question.findUnique({
        where: { id },
        include: {
          currentVersion: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          validationAssignments: {
            where: { assignedToId: user.id, status: { not: ValidationTaskStatus.CANCELLED } },
          },
        },
      });
      if (!existing?.currentVersion) throw new Error("Soal tidak ditemukan.");
      if (
        !user.roles.includes("SUPER_ADMIN") &&
        existing.validationAssignments.length === 0
      ) {
        throw new Error("Soal ini tidak diplot kepada Anda.");
      }

      savedQuestionCode = existing.code;
      const nextVersion = (existing.versions[0]?.versionNumber ?? 0) + 1;
      const answerKey = String(
        formData.get("answerKey") || existing.currentVersion.answerKey,
      ) as "A" | "B" | "C" | "D" | "E";
      const version = await tx.questionVersion.create({
        data: {
          questionId: id,
          versionNumber: nextVersion,
          blueprintVersionId: existing.currentVersion.blueprintVersionId,
          stimulusVersionId: existing.currentVersion.stimulusVersionId,
          orderInStimulus: existing.currentVersion.orderInStimulus,
          stemHtml: getHtml(formData, "stem", true),
          explanationHtml: getHtml(formData, "explanation"),
          difficulty: String(
            formData.get("difficulty") || existing.currentVersion.difficulty,
          ) as "EASY" | "MEDIUM" | "HARD",
          answerKey,
          keyChanged: answerKey !== existing.currentVersion.answerKey,
          changeSummaryHtml:
            getHtml(formData, "validatorNotes") ??
            "<p>Perubahan validasi soal.</p>",
          createdById: user.id,
          options: { create: readOptions(formData) },
        },
      });

      await tx.question.update({
        where: { id },
        data: { currentVersionId: version.id, status },
      });
      await tx.questionValidationAssignment.updateMany({
        where: {
          questionId: id,
          assignedToId: user.id,
          status: { not: ValidationTaskStatus.CANCELLED },
        },
        data: { status: status === ContentStatus.IN_REVIEW ? ValidationTaskStatus.IN_REVIEW : ValidationTaskStatus.DONE },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: `QUESTION_${decision}`,
          entityType: "Question",
          entityId: id,
          metadata: { status, versionNumber: nextVersion },
        },
      });
    });
    revalidatePath("/reviews");
    revalidatePath("/questions");
    revalidatePath("/packages");
    revalidatePath("/assignments");
    revalidatePath("/");

    const successMessages: Record<string, string> = {
      APPROVE: `Soal ${savedQuestionCode} berhasil disimpan dan disetujui.`,
      EDIT_AND_FORWARD: `Perbaikan dan catatan validator untuk soal ${savedQuestionCode} berhasil disimpan.`,
      REQUEST_REVISION: `Permintaan revisi untuk soal ${savedQuestionCode} berhasil disimpan.`,
      REJECT: `Penolakan soal ${savedQuestionCode} berhasil disimpan.`,
    };
    return {
      ok: true,
      message: successMessages[decision] ?? `Validasi soal ${savedQuestionCode} berhasil disimpan.`,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Validasi soal tidak dapat disimpan.",
      timestamp: Date.now(),
    };
  }
}

async function validateStimulus(formData: FormData) {
  "use server";
  const user = await requireActionUser(["QUESTION_VALIDATOR", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id");
  const decision = String(formData.get("decision") || "APPROVE");
  const status = statusFromDecision(decision);

  await db.$transaction(async (tx) => {
    const existing = await tx.stimulus.findUnique({
      where: { id },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });
    if (!existing?.currentVersion || !existing.blueprintId)
      throw new Error("Stimulus tidak ditemukan.");
    if (!user.roles.includes("SUPER_ADMIN")) {
      const assignment = await tx.questionValidationAssignment.findFirst({
        where: {
          assignedToId: user.id,
          status: { not: ValidationTaskStatus.CANCELLED },
          question: { blueprintId: existing.blueprintId },
        },
        select: { id: true },
      });
      if (!assignment)
        throw new Error("Stimulus ini tidak diplot kepada Anda.");
    }

    const versionNumber = (existing.versions[0]?.versionNumber ?? 0) + 1;
    const version = await tx.stimulusVersion.create({
      data: {
        stimulusId: id,
        versionNumber,
        titleHtml: getHtml(formData, "title", true),
        instructionsHtml: getHtml(formData, "instructions", true),
        contentHtml: getHtml(formData, "content", true),
        source: optionalText(formData, "source"),
        copyrightNote: optionalText(formData, "copyrightNote"),
        expectedQuestions: existing.currentVersion.expectedQuestions,
        changeSummaryHtml:
          getHtml(formData, "validatorNotes") ?? "<p>Validasi stimulus.</p>",
        createdById: user.id,
      },
    });
    await tx.stimulus.update({
      where: { id },
      data: { currentVersionId: version.id, status },
    });
    if (status === ContentStatus.REVISION_REQUIRED) {
      await tx.question.updateMany({
        where: {
          blueprintId: existing.blueprintId,
          status: { in: [ContentStatus.SUBMITTED, ContentStatus.IN_REVIEW, ContentStatus.APPROVED] },
        },
        data: { status: ContentStatus.NEEDS_ALIGNMENT_REVIEW },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: `STIMULUS_${decision}`,
        entityType: "Stimulus",
        entityId: id,
        metadata: { status, versionNumber },
      },
    });
  });
  revalidatePath("/reviews");
  revalidatePath("/questions");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

type PageProps = { searchParams?: Promise<{ page?: string; size?: string }> };

export default async function ReviewsPage({ searchParams }: PageProps) {
  const user = await requirePageUser(["QUESTION_VALIDATOR", "SUPER_ADMIN"]);
  const canSeeAll = user.roles.includes("SUPER_ADMIN");
  const params = await searchParams;
  const reviewStatuses: ContentStatus[] = [
    ContentStatus.SUBMITTED,
    ContentStatus.IN_REVIEW,
    ContentStatus.REVISION_REQUIRED,
    ContentStatus.APPROVED,
    ContentStatus.REJECTED,
    ContentStatus.NEEDS_ALIGNMENT_REVIEW,
  ];

  const reviewWhere: Prisma.QuestionWhereInput = {
    status: { in: reviewStatuses },
    ...(canSeeAll
      ? {}
      : {
          validationAssignments: {
            some: {
              assignedToId: user.id,
              status: { not: ValidationTaskStatus.CANCELLED },
            },
          },
        }),
  };
  const [totalQuestions, validatedQuestions] = await Promise.all([
    db.question.count({ where: reviewWhere }),
    db.question.count({
      where: {
        ...reviewWhere,
        status: {
          in: [
            ContentStatus.APPROVED,
            ContentStatus.REVISION_REQUIRED,
            ContentStatus.REJECTED,
          ],
        },
      },
    }),
  ]);
  const unvalidatedQuestions = Math.max(0, totalQuestions - validatedQuestions);
  const pagination = paginationWindow(totalQuestions, parsePage(params?.page), parsePageSize(params?.size));

  const questions = await db.question.findMany({
    where: reviewWhere,
    orderBy: [{ blueprint: { createdAt: "desc" } }, { code: "asc" }],
    skip: pagination.skip,
    ...(pagination.take ? { take: pagination.take } : {}),
    include: {
      blueprint: {
        include: {
          currentVersion: true,
          stimulus: { include: { currentVersion: true } },
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
  });

  const groupMap = new Map<string, any>();
  for (const question of questions) {
    const group = groupMap.get(question.blueprintId);
    if (group) group.questions.push(question);
    else
      groupMap.set(question.blueprintId, {
        blueprint: question.blueprint,
        questions: [question],
      });
  }
  const groups = Array.from(groupMap.values());

  return (
    <AdminShell
      title="Validasi Soal"
      subtitle="Validasi stimulus dan soal dalam satu kelompok kode kisi-kisi"
      allowedRoles={["QUESTION_VALIDATOR", "SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <p className="eyebrow">Ruang kerja validator</p>
          <h2>Antrian validasi per kisi-kisi</h2>
          <p>
            Reading text ditampilkan sekali bersama seluruh pertanyaan terkait
            agar keselarasan soal 1–5 dapat diperiksa.
          </p>
        </div>
        <div className="question-page-stats">
          <span>
            <strong>{totalQuestions}</strong> jumlah soal
          </span>
          <span>
            <strong>{validatedQuestions}</strong> sudah divalidasi
          </span>
          <span>
            <strong>{unvalidatedQuestions}</strong> belum divalidasi
          </span>
        </div>
      </div>

      <section className="review-groups">
        {groups.map((group) => {
          const blueprint = group.blueprint;
          const stimulus = blueprint.stimulus;
          const approved = group.questions.filter(
            (question: any) => question.status === "APPROVED",
          ).length;
          return (
            <details className="question-group card" key={blueprint.id} open>
              <summary className="question-group-summary">
                <div className="question-group-title">
                  <span className="question-group-icon">
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <strong>{blueprint.code}</strong>
                    <span>
                      {(
                        blueprint.currentVersion?.testGroupHtml ??
                        blueprint.currentVersion?.titleHtml ??
                        "Kisi-kisi"
                      ).replace(/<[^>]+>/g, "")}
                    </span>
                  </div>
                </div>
                <div className="question-group-progress">
                  <strong>
                    {approved}/{group.questions.length}
                  </strong>
                  <span>soal disetujui</span>
                  <ChevronDown className="details-chevron" size={18} />
                </div>
              </summary>

              {blueprint.currentVersion?.questionMode === "STIMULUS_GROUP" &&
              stimulus?.currentVersion ? (
                <section className="review-stimulus-panel">
                  <div className="stimulus-workspace-heading">
                    <div>
                      <span className="eyebrow">Stimulus yang divalidasi</span>
                      <strong>{stimulus.code}</strong>
                    </div>
                    <span
                      className={`badge ${stimulus.status === "APPROVED" ? "success" : "warning"}`}
                    >
                      {stimulus.language.toUpperCase()} ·{" "}
                      {stimulus.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="stimulus-reading-card">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: stimulus.currentVersion.titleHtml,
                      }}
                    />
                    <div
                      className="stimulus-instructions"
                      dangerouslySetInnerHTML={{
                        __html: stimulus.currentVersion.instructionsHtml,
                      }}
                    />
                    <div
                      className="stimulus-content"
                      dangerouslySetInnerHTML={{
                        __html: stimulus.currentVersion.contentHtml,
                      }}
                    />
                    {stimulus.currentVersion.source ? (
                      <p className="stimulus-source">
                        Sumber: {stimulus.currentVersion.source}
                      </p>
                    ) : null}
                  </div>
                  <details className="action-details stimulus-review-details">
                    <summary className="secondary-button">
                      <BookOpenText size={15} /> Perbaiki stimulus
                    </summary>
                    <StimulusReviewForm
                      action={validateStimulus}
                      initial={{
                        id: stimulus.id,
                        titleHtml: stimulus.currentVersion.titleHtml,
                        instructionsHtml:
                          stimulus.currentVersion.instructionsHtml,
                        contentHtml: stimulus.currentVersion.contentHtml,
                        source: stimulus.currentVersion.source,
                        copyrightNote: stimulus.currentVersion.copyrightNote,
                      }}
                    />
                  </details>
                </section>
              ) : null}

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
                  storageKey="soalflow-reviews-columns"
                  columns={[
                    { key: "code", label: "Kode soal", index: 1, locked: true },
                    { key: "question", label: "Tampilan soal", index: 2 },
                    { key: "author", label: "Penulis", index: 3 },
                    { key: "status", label: "Status", index: 4 },
                    { key: "action", label: "Aksi", index: 5 },
                  ]}
                >
                  <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kode soal</th>
                      <th>Tampilan soal</th>
                      <th>Penulis</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.questions.map((row: any) => {
                      const current = row.currentVersion;
                      const options = current?.options ?? [];
                      const values = Object.fromEntries(
                        optionLabels.map((label) => [
                          label,
                          options.find((opt: any) => opt.label === label)?.contentHtml ?? "<p></p>",
                        ]),
                      ) as Record<string, string>;
                      const answerKey = current?.answerKey ?? "-";
                      const difficulty = current?.difficulty
                        ? difficultyLabels[current.difficulty] ?? current.difficulty
                        : "-";
                      const statusLabel = statusLabels[row.status] ?? row.status.replaceAll("_", " ");
                      const validatorNotesHtml = [
                        "APPROVED",
                        "IN_REVIEW",
                        "REVISION_REQUIRED",
                        "REJECTED",
                      ].includes(row.status)
                        ? current?.changeSummaryHtml
                        : null;
                      return (
                        <tr key={row.id}>
                          <td>
                            <strong className="code-label">{row.code}</strong>
                            <div className="question-code-meta">
                              <span className="muted-text">Kunci: {answerKey}</span>
                              <span className={`badge compact-status ${row.status === "APPROVED" ? "success" : "warning"}`}>
                                {statusLabel}
                              </span>
                            </div>
                          </td>
                          <td>
                            <article className="question-preview-card">
                              <div className="question-preview-header">
                                <div>
                                  <span className="eyebrow">Tampilan soal</span>
                                  <strong>Preview untuk validator</strong>
                                </div>
                                <div className="question-preview-badges">
                                  <span className="badge">Kunci {answerKey}</span>
                                  <span className="badge warning">{difficulty}</span>
                                </div>
                              </div>
                              <div
                                className="rich-preview question-stem-preview"
                                dangerouslySetInnerHTML={{
                                  __html: current?.stemHtml ?? "<p>Soal belum tersedia.</p>",
                                }}
                              />
                              <div className="answer-option-list">
                                {optionLabels.map((label) => (
                                  <div
                                    className={`answer-option-preview ${label === answerKey ? "is-answer" : ""}`}
                                    key={label}
                                  >
                                    <span>{label}</span>
                                    <div
                                      className="rich-preview"
                                      dangerouslySetInnerHTML={{ __html: values[label] }}
                                    />
                                  </div>
                                ))}
                              </div>
                              {hasMeaningfulHtml(current?.explanationHtml) ? (
                                <details className="question-explanation-preview">
                                  <summary>Pembahasan / jawaban</summary>
                                  <div
                                    className="rich-preview"
                                    dangerouslySetInnerHTML={{
                                      __html: current?.explanationHtml ?? "",
                                    }}
                                  />
                                </details>
                              ) : null}
                              {hasMeaningfulHtml(validatorNotesHtml) ? (
                                <section className="validator-note-preview">
                                  <strong>Catatan validator tersimpan</strong>
                                  <div
                                    className="rich-preview"
                                    dangerouslySetInnerHTML={{ __html: validatorNotesHtml ?? "" }}
                                  />
                                </section>
                              ) : null}
                            </article>
                          </td>
                          <td>{current?.createdBy.name ?? "-"}</td>
                          <td>
                            <span
                              className={`badge ${row.status === "APPROVED" ? "success" : "warning"}`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td>
                            {(() => {
                              const reviewFormId = `review-question-form-${row.id}`;
                              return (
                                <div className="review-action-stack">
                                  <div className="button-row-wrap review-decision-buttons">
                                    <button
                                      className="primary-button"
                                      type="submit"
                                      form={reviewFormId}
                                      name="decision"
                                      value="APPROVE"
                                    >
                                      <CheckCircle2 size={16} /> Setujui
                                    </button>
                                    <button
                                      className="secondary-button"
                                      type="submit"
                                      form={reviewFormId}
                                      name="decision"
                                      value="REQUEST_REVISION"
                                    >
                                      <RotateCcw size={16} /> Minta revisi
                                    </button>
                                    <button
                                      className="danger-button"
                                      type="submit"
                                      form={reviewFormId}
                                      name="decision"
                                      value="REJECT"
                                    >
                                      <XCircle size={16} /> Tolak
                                    </button>
                                  </div>
                                  <details className="action-details question-fix-details">
                                    <summary className="secondary-button">
                                      <Pencil size={15} /> Perbaiki
                                    </summary>
                                    <p className="muted-text review-action-hint">
                                      Buka editor hanya jika konten soal perlu diperbaiki.
                                    </p>
                                    <ReviewQuestionForm
                                      action={validateQuestion}
                                      formId={reviewFormId}
                                      initial={{
                                        id: row.id,
                                        stemHtml: current?.stemHtml,
                                        explanationHtml: current?.explanationHtml,
                                        validatorNotesHtml,
                                        answerKey: current?.answerKey,
                                        difficulty: current?.difficulty,
                                        options: values,
                                      }}
                                    />
                                  </details>
                                </div>
                              );
                            })()}
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
        {groups.length ? (
          <PaginationControls
            basePath="/reviews"
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={totalQuestions}
            totalPages={pagination.totalPages}
            from={pagination.from}
            to={pagination.to}
            itemLabel="soal"
          />
        ) : null}
        {!groups.length ? (
          <section className="card panel empty-workspace">
            <ShieldCheck size={36} />
            <h3>Belum ada kelompok yang dikirim</h3>
            <p className="muted-text">
              Soal akan muncul setelah penulis mengirim satu kelompok kode
              kisi-kisi.
            </p>
          </section>
        ) : null}
      </section>
    </AdminShell>
  );
}
