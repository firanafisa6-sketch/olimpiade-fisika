import { AdminShell } from "@/components/admin-shell";
import { BlueprintForm } from "@/components/blueprint-form";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { ColumnToggleTable } from "@/components/column-toggle-table";
import { PaginationControls } from "@/components/pagination-controls";
import {
  ensureAllQuestionSlots,
  generateBlueprintCode,
  generateStimulusCode,
  getHtml,
  getOrCreateDefaultPeriod,
  optionalText,
  requiredText,
  syncBlueprintQuestionStimulus,
  syncQuestionSlots,
} from "@/lib/db-helpers";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import { ChevronDown, Pencil, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

function fallbackTitle(html?: string | null) {
  return html ?? "<p>-</p>";
}

async function saveBlueprintStimulus(
  tx: any,
  blueprintId: string,
  blueprintCode: string,
  userId: string,
  formData: FormData,
  expectedQuestionCount: number,
) {
  const questionMode = String(formData.get("questionMode") || "INDEPENDENT") as
    | "INDEPENDENT"
    | "STIMULUS_GROUP";
  const existing = await tx.stimulus.findUnique({
    where: { blueprintId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });

  if (questionMode !== "STIMULUS_GROUP") {
    if (existing)
      await tx.stimulus.update({
        where: { id: existing.id },
        data: { status: "ARCHIVED" },
      });
    await syncBlueprintQuestionStimulus(blueprintId, tx);
    return;
  }

  const stimulus =
    existing ??
    (await tx.stimulus.create({
      data: {
        code: await generateStimulusCode(blueprintCode, tx),
        blueprintId,
        type: String(formData.get("stimulusType") || "TEXT") as any,
        language: String(formData.get("stimulusLanguage") || "en"),
        status: "DRAFT",
      },
    }));
  const versionNumber = (existing?.versions[0]?.versionNumber ?? 0) + 1;
  const stimulusVersion = await tx.stimulusVersion.create({
    data: {
      stimulusId: stimulus.id,
      versionNumber,
      titleHtml: getHtml(formData, "stimulusTitle", true),
      instructionsHtml: getHtml(formData, "stimulusInstructions", true),
      contentHtml: getHtml(formData, "stimulusContent", true),
      source: optionalText(formData, "stimulusSource"),
      copyrightNote: optionalText(formData, "stimulusCopyrightNote"),
      expectedQuestions: expectedQuestionCount,
      changeSummaryHtml: existing
        ? "<p>Pembaruan stimulus dari kisi-kisi.</p>"
        : "<p>Versi awal stimulus dari kisi-kisi.</p>",
      createdById: userId,
    },
  });
  await tx.stimulus.update({
    where: { id: stimulus.id },
    data: {
      currentVersionId: stimulusVersion.id,
      type: String(formData.get("stimulusType") || "TEXT") as any,
      language: String(formData.get("stimulusLanguage") || "en"),
      status: "DRAFT",
    },
  });
  await syncBlueprintQuestionStimulus(blueprintId, tx);
}

async function createBlueprint(formData: FormData) {
  "use server";
  const user = await requireActionUser(["BLUEPRINT_AUTHOR", "SUPER_ADMIN"]);
  const period = await getOrCreateDefaultPeriod();
  const expectedQuestionCount = Math.max(
    1,
    Number(formData.get("expectedQuestionCount") || 1),
  );
  const confidentialLabel =
    optionalText(formData, "confidentialLabel") ?? "SANGAT RAHASIA";

  await db.$transaction(async (tx) => {
    const code = await generateBlueprintCode(tx);
    const testGroupHtml = getHtml(formData, "testGroup", true) ?? "<p></p>";
    const testTopicHtml = getHtml(formData, "testTopic", true) ?? "<p></p>";
    const indicatorHtml = getHtml(formData, "indicator", true) ?? "<p></p>";
    const materialHtml = getHtml(formData, "material");
    const gridHtml = getHtml(formData, "grid", true) ?? "<p></p>";
    const blueprint = await tx.blueprint.create({
      data: { code, periodId: period.id, status: "DRAFT" },
    });
    const version = await tx.blueprintVersion.create({
      data: {
        blueprintId: blueprint.id,
        versionNumber: 1,
        titleHtml: testGroupHtml,
        testGroupHtml,
        testTopicHtml,
        competencyHtml: testTopicHtml,
        indicatorHtml,
        materialHtml,
        gridHtml,
        confidentialLabel,
        cognitiveLevel: optionalText(formData, "cognitiveLevel"),
        expectedQuestionCount,
        questionMode: String(formData.get("questionMode") || "INDEPENDENT") as
          | "INDEPENDENT"
          | "STIMULUS_GROUP",
        changeSummaryHtml: "<p>Versi awal kisi-kisi format PMB 2026.</p>",
        createdById: user.id,
      },
    });
    await tx.blueprint.update({
      where: { id: blueprint.id },
      data: { currentVersionId: version.id },
    });
    await saveBlueprintStimulus(
      tx,
      blueprint.id,
      blueprint.code,
      user.id,
      formData,
      expectedQuestionCount,
    );
    await syncQuestionSlots(blueprint.id, expectedQuestionCount, tx);
  });
  revalidatePath("/blueprints");
  revalidatePath("/questions");
  revalidatePath("/assignments");
  revalidatePath("/");
}

async function updateBlueprint(formData: FormData) {
  "use server";
  const user = await requireActionUser(["BLUEPRINT_AUTHOR", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id");
  const expectedQuestionCount = Math.max(
    1,
    Number(formData.get("expectedQuestionCount") || 1),
  );
  const confidentialLabel =
    optionalText(formData, "confidentialLabel") ?? "SANGAT RAHASIA";

  await db.$transaction(async (tx) => {
    const existing = await tx.blueprint.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!existing) throw new Error("Kisi-kisi tidak ditemukan.");
    const authoredCount = await tx.question.count({
      where: { blueprintId: id, currentVersionId: { not: null } },
    });
    if (expectedQuestionCount < authoredCount) {
      throw new Error(
        `Target soal tidak dapat dikurangi menjadi ${expectedQuestionCount} karena sudah ada ${authoredCount} soal yang terisi.`,
      );
    }
    const nextVersion = (existing.versions[0]?.versionNumber ?? 0) + 1;
    const testGroupHtml = getHtml(formData, "testGroup", true) ?? "<p></p>";
    const testTopicHtml = getHtml(formData, "testTopic", true) ?? "<p></p>";
    const indicatorHtml = getHtml(formData, "indicator", true) ?? "<p></p>";
    const materialHtml = getHtml(formData, "material");
    const gridHtml = getHtml(formData, "grid", true) ?? "<p></p>";
    const version = await tx.blueprintVersion.create({
      data: {
        blueprintId: id,
        versionNumber: nextVersion,
        titleHtml: testGroupHtml,
        testGroupHtml,
        testTopicHtml,
        competencyHtml: testTopicHtml,
        indicatorHtml,
        materialHtml,
        gridHtml,
        confidentialLabel,
        cognitiveLevel: optionalText(formData, "cognitiveLevel"),
        expectedQuestionCount,
        questionMode: String(formData.get("questionMode") || "INDEPENDENT") as
          | "INDEPENDENT"
          | "STIMULUS_GROUP",
        changeSummaryHtml:
          getHtml(formData, "changeSummary") ??
          "<p>Perubahan kisi-kisi oleh penulis.</p>",
        createdById: user.id,
      },
    });
    await tx.blueprint.update({
      where: { id },
      data: { currentVersionId: version.id, status: "DRAFT" },
    });
    await saveBlueprintStimulus(
      tx,
      id,
      existing.code,
      user.id,
      formData,
      expectedQuestionCount,
    );
    await syncQuestionSlots(id, expectedQuestionCount, tx);
    await tx.questionWritingAssignment.updateMany({
      where: { blueprintId: id },
      data: { targetCount: expectedQuestionCount },
    });
  });
  revalidatePath("/blueprints");
  revalidatePath("/questions");
  revalidatePath("/assignments");
  revalidatePath("/");
}

async function deleteBlueprint(formData: FormData) {
  "use server";

  await requireActionUser(["BLUEPRINT_AUTHOR", "SUPER_ADMIN"]);

  const id = requiredText(formData, "id");

  await db.$transaction(async (tx) => {
    const blueprintVersionIds = (
      await tx.blueprintVersion.findMany({
        where: { blueprintId: id },
        select: { id: true },
      })
    ).map((row) => row.id);

    const stimulusVersionIds = (
      await tx.stimulusVersion.findMany({
        where: {
          stimulus: {
            blueprintId: id,
          },
        },
        select: { id: true },
      })
    ).map((row) => row.id);

    const questionVersionIds = (
      await tx.questionVersion.findMany({
        where: {
          question: {
            blueprintId: id,
          },
        },
        select: { id: true },
      })
    ).map((row) => row.id);

    await tx.reviewAssignment.deleteMany({
      where: {
        OR: [
          { blueprintVersionId: { in: blueprintVersionIds } },
          { stimulusVersionId: { in: stimulusVersionIds } },
          { questionVersionId: { in: questionVersionIds } },
        ],
      },
    });

    await tx.question.updateMany({
      where: { blueprintId: id },
      data: {
        currentVersionId: null,
        stimulusId: null,
      },
    });

    await tx.stimulus.updateMany({
      where: { blueprintId: id },
      data: {
        currentVersionId: null,
      },
    });

    await tx.blueprint.update({
      where: { id },
      data: {
        currentVersionId: null,
      },
    });

    await tx.question.deleteMany({
      where: { blueprintId: id },
    });

    await tx.blueprint.delete({
      where: { id },
    });
  });

  revalidatePath("/blueprints");
  revalidatePath("/questions");
  revalidatePath("/assignments");
  revalidatePath("/");
}

type PageProps = { searchParams?: Promise<{ page?: string; size?: string }> };

export default async function BlueprintsPage({ searchParams }: PageProps) {
  await requirePageUser(["BLUEPRINT_AUTHOR", "SUPER_ADMIN"]);
  await ensureAllQuestionSlots();
  const params = await searchParams;
  const totalRows = await db.blueprint.count();
  const pagination = paginationWindow(totalRows, parsePage(params?.page), parsePageSize(params?.size));

  const rows = await db.blueprint.findMany({
    orderBy: [{ createdAt: "desc" }, { code: "desc" }],
    skip: pagination.skip,
    ...(pagination.take ? { take: pagination.take } : {}),
    include: {
      currentVersion: { include: { createdBy: true } },
      stimulus: { include: { currentVersion: true } },
      questions: {
        orderBy: { code: "asc" },
        include: {
          currentVersion: {
            include: { options: { orderBy: { sortOrder: "asc" } } },
          },
          validationAssignments: { include: { assignedTo: true } },
        },
      },
      writingAssignments: { include: { assignedTo: true } },
    },
  });

  return (
    <AdminShell
      title="Kisi-kisi"
      subtitle="Daftar kisi-kisi, target slot soal, dan identitas format PMB"
      allowedRoles={["BLUEPRINT_AUTHOR", "SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <p className="eyebrow">Perencanaan soal</p>
          <h2>Daftar kisi-kisi</h2>
          <p>
            Setiap kisi-kisi langsung membuat slot soal dan kode soal sesuai
            target jumlah yang ditentukan.
          </p>
        </div>
        <span className="badge">{totalRows} kisi-kisi</span>
      </div>

      <details className="create-panel-toggle card">
        <summary className="create-panel-summary">
          <span>
            <Plus size={18} /> Tambahkan kisi-kisi
          </span>
          <ChevronDown size={19} className="details-chevron" />
        </summary>
        <div className="create-panel-body">
          <BlueprintForm action={createBlueprint} />
        </div>
      </details>

      <section className="card panel blueprint-list-panel">
        <div className="panel-heading blueprint-list-heading">
          <div>
            <h3>Daftar kisi-kisi aktif</h3>
            <p className="muted-text">
              Gunakan tombol kolom untuk menyembunyikan atau menampilkan
              informasi tabel.
            </p>
          </div>
          <span className="badge">Kode otomatis</span>
        </div>

        <ColumnToggleTable
          columns={[
            { key: "code", label: "Kode", index: 1, locked: true },
            { key: "identity", label: "Identitas", index: 2 },
            { key: "questions", label: "Soal", index: 3 },
            { key: "plotting", label: "Plotting", index: 4 },
            { key: "actions", label: "Aksi", index: 5 },
          ]}
        >
          <table className="data-table blueprint-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Identitas</th>
                <th>Slot Soal & Kunci</th>
                <th>Plotting</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const current = row.currentVersion;
                const filledQuestions = row.questions.filter(
                  (question) => question.currentVersion,
                );
                const validatorNames: string[] = Array.from(
                  new Set<string>(
                    row.questions.flatMap((question) =>
                      question.validationAssignments.map(
                        (item) => item.assignedTo.name,
                      ),
                    ),
                  ),
                );
                return (
                  <tr key={row.id}>
                    <td>
                      <strong className="code-label">{row.code}</strong>
                      <br />
                      <span className="badge warning">
                        v{current?.versionNumber ?? 0}
                      </span>
                      <div className="slot-progress">
                        <strong>
                          {filledQuestions.length}/{row.questions.length}
                        </strong>
                        <span>soal terisi</span>
                      </div>
                      <span className="muted-text">
                        {current?.confidentialLabel ?? "SANGAT RAHASIA"}
                      </span>
                    </td>
                    <td>
                      <div className="identity-table-mini">
                        <div>
                          <span>Kelompok Uji</span>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: fallbackTitle(
                                current?.testGroupHtml ?? current?.titleHtml,
                              ),
                            }}
                          />
                        </div>
                        <div>
                          <span>Topik Uji</span>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: fallbackTitle(
                                current?.testTopicHtml ??
                                  current?.competencyHtml,
                              ),
                            }}
                          />
                        </div>
                        <div>
                          <span>Indikator</span>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: fallbackTitle(current?.indicatorHtml),
                            }}
                          />
                        </div>
                        <div>
                          <span>Materi Uji</span>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: fallbackTitle(current?.materialHtml),
                            }}
                          />
                        </div>
                        <div>
                          <span>Kisi-Kisi</span>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: fallbackTitle(current?.gridHtml),
                            }}
                          />
                        </div>
                        <div>
                          <span>Bentuk Soal</span>
                          <div>
                            <strong>
                              {current?.questionMode === "STIMULUS_GROUP"
                                ? "Kelompok stimulus"
                                : "Soal mandiri"}
                            </strong>
                          </div>
                        </div>
                      </div>
                      {current?.questionMode === "STIMULUS_GROUP" &&
                      row.stimulus?.currentVersion ? (
                        <details className="stimulus-preview-compact">
                          <summary>
                            Reading text · {row.stimulus.code} ·{" "}
                            {row.stimulus.language.toUpperCase()}
                          </summary>
                          <div className="stimulus-reading-card">
                            <div
                              dangerouslySetInnerHTML={{
                                __html: row.stimulus.currentVersion.titleHtml,
                              }}
                            />
                            <div
                              className="stimulus-instructions"
                              dangerouslySetInnerHTML={{
                                __html:
                                  row.stimulus.currentVersion.instructionsHtml,
                              }}
                            />
                            <div
                              className="stimulus-content"
                              dangerouslySetInnerHTML={{
                                __html: row.stimulus.currentVersion.contentHtml,
                              }}
                            />
                          </div>
                        </details>
                      ) : null}
                    </td>
                    <td>
                      <div className="mini-question-table">
                        <div className="mini-question-head">
                          <span>No</span>
                          <span>Kode / Soal</span>
                          <span>Kunci</span>
                        </div>
                        {row.questions.map((question, index) => (
                          <div className="mini-question-row" key={question.id}>
                            <span>{index + 1}</span>
                            <div>
                              <strong>{question.code}</strong>
                              {question.currentVersion ? (
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: question.currentVersion.stemHtml,
                                  }}
                                />
                              ) : (
                                <span className="muted-text">
                                  Slot belum ditulis
                                </span>
                              )}
                            </div>
                            <strong>
                              {question.currentVersion?.answerKey ?? "-"}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="assignment-stack">
                        <span className="assignment-caption">Penulis</span>
                        {row.writingAssignments.length ? (
                          row.writingAssignments.map((item) => (
                            <span className="role-pill" key={item.id}>
                              {item.assignedTo.name}
                            </span>
                          ))
                        ) : (
                          <span className="muted-text">Belum diplot</span>
                        )}
                        <span className="assignment-caption">Validator</span>
                        {validatorNames.length ? (
                          validatorNames.map((name) => (
                            <span className="role-pill" key={name}>
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="muted-text">Belum diplot</span>
                        )}
                      </div>
                    </td>
                    <td className="table-actions">
                      <details className="action-details">
                        <summary className="secondary-button">
                          <Pencil size={15} /> Edit
                        </summary>
                        <BlueprintForm
                          action={updateBlueprint}
                          compact
                          submitLabel="Simpan versi baru"
                          initial={{
                            id: row.id,
                            code: row.code,
                            testGroupHtml: current?.testGroupHtml,
                            testTopicHtml: current?.testTopicHtml,
                            titleHtml: current?.titleHtml,
                            competencyHtml: current?.competencyHtml,
                            indicatorHtml: current?.indicatorHtml,
                            materialHtml: current?.materialHtml,
                            gridHtml: current?.gridHtml,
                            confidentialLabel: current?.confidentialLabel,
                            cognitiveLevel: current?.cognitiveLevel,
                            expectedQuestionCount:
                              current?.expectedQuestionCount,
                            questionMode: current?.questionMode,
                            stimulusCode: row.stimulus?.code,
                            stimulusLanguage: row.stimulus?.language,
                            stimulusType: row.stimulus?.type,
                            stimulusTitleHtml:
                              row.stimulus?.currentVersion?.titleHtml,
                            stimulusInstructionsHtml:
                              row.stimulus?.currentVersion?.instructionsHtml,
                            stimulusContentHtml:
                              row.stimulus?.currentVersion?.contentHtml,
                            stimulusSource:
                              row.stimulus?.currentVersion?.source,
                            stimulusCopyrightNote:
                              row.stimulus?.currentVersion?.copyrightNote,
                          }}
                        />
                      </details>
                      <ConfirmDeleteForm
                        action={deleteBlueprint}
                        id={row.id}
                        message={`Yakin ingin menghapus kisi-kisi ${row.code}? Semua slot soal, stimulus, plotting, dan riwayat review terkait akan ikut terhapus.`}
                      />
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <p>Belum ada kisi-kisi.</p>
                      <span>
                        Tambahkan kisi-kisi untuk membuat slot soal otomatis.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </ColumnToggleTable>
        <PaginationControls
          basePath="/blueprints"
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={totalRows}
          totalPages={pagination.totalPages}
          from={pagination.from}
          to={pagination.to}
          itemLabel="kisi-kisi"
        />
      </section>

    </AdminShell>
  );
}
