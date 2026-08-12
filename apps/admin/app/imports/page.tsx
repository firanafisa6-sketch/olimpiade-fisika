import { AdminShell } from "@/components/admin-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import {
  asHtmlParagraph,
  generateBlueprintCode,
  generateStimulusCode,
  questionOrderFromCode,
  syncBlueprintQuestionStimulus,
  syncQuestionSlots,
} from "@/lib/db-helpers";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileQuestion,
  FileSpreadsheet,
  History,
  UploadCloud,
} from "lucide-react";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const optionLabels = ["A", "B", "C", "D", "E"] as const;

type SheetRow = Record<string, unknown>;
type ImportKind = "BLUEPRINT" | "QUESTION";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string; page?: string; size?: string }>;
};

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizedRow(row: SheetRow) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_"),
      value,
    ]),
  ) as SheetRow;
}

function requiredCell(row: SheetRow, key: string, label = key) {
  const value = cell(row[key]);
  if (!value) throw new Error(`${label} wajib diisi.`);
  return value;
}

function integerCell(value: unknown, fallback = 1) {
  const parsed = Number(cell(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function parseWorkbook(file: File) {
  if (!file || !file.name) throw new Error("Pilih file Excel terlebih dahulu.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran file maksimum 8 MB.");
  if (!/\.(xlsx|xls)$/i.test(file.name))
    throw new Error("Format file harus .xlsx atau .xls.");
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("Workbook tidak memiliki sheet.");
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils
      .sheet_to_json<SheetRow>(sheet, { defval: "", raw: false })
      .map(normalizedRow);
  });
}

async function requireSuperAdmin() {
  return requireActionUser(["SUPER_ADMIN"]);
}

async function createJob(
  kind: ImportKind,
  filename: string,
  userId: string,
  totalRows: number,
) {
  return db.importJob.create({
    data: {
      type: kind,
      originalFilename: filename,
      status: "PARSING",
      totalRows,
      requestedById: userId,
    },
  });
}

async function finishJob(
  jobId: string,
  validRows: number,
  invalidRows: number,
) {
  await db.importJob.update({
    where: { id: jobId },
    data: {
      status: invalidRows > 0 && validRows === 0 ? "FAILED" : "COMPLETED",
      validRows,
      invalidRows,
      warningRows: 0,
      completedAt: new Date(),
    },
  });
}

async function uploadBlueprints(formData: FormData) {
  "use server";
  const user = await requireSuperAdmin();
  const file = formData.get("file");
  if (!(file instanceof File))
    throw new Error("File kisi-kisi tidak ditemukan.");
  const rows = await parseWorkbook(file);
  if (!rows.length) throw new Error("File tidak berisi data kisi-kisi.");

  const job = await createJob("BLUEPRINT", file.name, user.id, rows.length);
  let validRows = 0;
  let invalidRows = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    try {
      const result = await db.$transaction(async (tx) => {
        const periodCode = cell(row.period_code) || "PMB-2026";
        const periodName =
          cell(row.period_name) || periodCode.replace(/-/g, " ");
        const period = await tx.selectionPeriod.upsert({
          where: { code: periodCode },
          update: { name: periodName },
          create: { code: periodCode, name: periodName },
        });

        const requestedCode = cell(row.kode_kisi) || cell(row.blueprint_code);
        const code = requestedCode || (await generateBlueprintCode(tx));
        const testGroup = requiredCell(row, "kelompok_tes", "kelompok_tes");
        const testTopic = requiredCell(row, "topik_tes", "topik_tes");
        const competency = cell(row.kompetensi) || testTopic;
        const indicator = requiredCell(row, "indikator", "indikator");
        const grid = requiredCell(row, "kisi_kisi", "kisi_kisi");
        const expectedQuestionCount = integerCell(row.jumlah_soal, 1);
        const modeRaw = (
          cell(row.bentuk_soal) ||
          cell(row.jenis_soal) ||
          "INDEPENDENT"
        ).toUpperCase();
        const questionMode = [
          "STIMULUS",
          "STIMULUS_GROUP",
          "READING",
          "READING_TEXT",
          "KELOMPOK_STIMULUS",
        ].includes(modeRaw)
          ? ("STIMULUS_GROUP" as const)
          : ("INDEPENDENT" as const);

        const existing = await tx.blueprint.findUnique({
          where: { code },
          include: {
            versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          },
        });
        const blueprint =
          existing ??
          (await tx.blueprint.create({
            data: { code, periodId: period.id, status: "DRAFT" },
          }));
        const versionNumber = (existing?.versions[0]?.versionNumber ?? 0) + 1;
        const version = await tx.blueprintVersion.create({
          data: {
            blueprintId: blueprint.id,
            versionNumber,
            titleHtml: asHtmlParagraph(testGroup)!,
            testGroupHtml: asHtmlParagraph(testGroup),
            testTopicHtml: asHtmlParagraph(testTopic),
            competencyHtml: asHtmlParagraph(competency)!,
            indicatorHtml: asHtmlParagraph(indicator)!,
            materialHtml: asHtmlParagraph(cell(row.materi)) ?? null,
            gridHtml: asHtmlParagraph(grid),
            confidentialLabel: cell(row.label_rahasia) || "SANGAT RAHASIA",
            cognitiveLevel: cell(row.level_kognitif) || null,
            expectedQuestionCount,
            questionMode,
            changeSummaryHtml: existing
              ? "<p>Pembaruan melalui upload Excel oleh Super Admin.</p>"
              : "<p>Versi awal melalui upload Excel oleh Super Admin.</p>",
            createdById: user.id,
          },
        });
        await tx.blueprint.update({
          where: { id: blueprint.id },
          data: {
            currentVersionId: version.id,
            periodId: period.id,
            status: "DRAFT",
          },
        });

        const existingStimulus = await tx.stimulus.findUnique({
          where: { blueprintId: blueprint.id },
          include: {
            versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          },
        });
        if (questionMode === "STIMULUS_GROUP") {
          const title = requiredCell(row, "judul_stimulus", "judul_stimulus");
          const instructions =
            cell(row.petunjuk_stimulus) ||
            "Read the following text and answer the questions.";
          const content = requiredCell(row, "isi_stimulus", "isi_stimulus");
          const stimulus =
            existingStimulus ??
            (await tx.stimulus.create({
              data: {
                code:
                  cell(row.kode_stimulus) ||
                  (await generateStimulusCode(code, tx)),
                blueprintId: blueprint.id,
                type: (cell(row.jenis_stimulus) || "TEXT").toUpperCase() as any,
                language: cell(row.bahasa_stimulus) || "en",
                status: "DRAFT",
              },
            }));
          const stimulusVersion = await tx.stimulusVersion.create({
            data: {
              stimulusId: stimulus.id,
              versionNumber:
                (existingStimulus?.versions[0]?.versionNumber ?? 0) + 1,
              titleHtml: asHtmlParagraph(title)!,
              instructionsHtml: asHtmlParagraph(instructions)!,
              contentHtml: asHtmlParagraph(content)!,
              source: cell(row.sumber_stimulus) || null,
              copyrightNote: cell(row.catatan_hak_cipta) || null,
              expectedQuestions: expectedQuestionCount,
              changeSummaryHtml: existingStimulus
                ? "<p>Pembaruan stimulus melalui upload Excel.</p>"
                : "<p>Versi awal stimulus melalui upload Excel.</p>",
              createdById: user.id,
            },
          });
          await tx.stimulus.update({
            where: { id: stimulus.id },
            data: {
              currentVersionId: stimulusVersion.id,
              type: (cell(row.jenis_stimulus) || "TEXT").toUpperCase() as any,
              language: cell(row.bahasa_stimulus) || "en",
              status: "DRAFT",
            },
          });
        } else if (existingStimulus) {
          await tx.stimulus.update({
            where: { id: existingStimulus.id },
            data: { status: "ARCHIVED" },
          });
        }

        await syncBlueprintQuestionStimulus(blueprint.id, tx);
        await syncQuestionSlots(blueprint.id, expectedQuestionCount, tx);
        await tx.questionWritingAssignment.updateMany({
          where: { blueprintId: blueprint.id, status: { not: "CANCELLED" } },
          data: { targetCount: expectedQuestionCount },
        });
        return code;
      });

      await db.importRow.create({
        data: {
          importJobId: job.id,
          rowNumber,
          entityType: "BLUEPRINT",
          entityCode: result,
          status: "IMPORTED",
          payload: row as any,
          messages: ["Kisi-kisi berhasil diimpor."] as any,
        },
      });
      validRows += 1;
    } catch (error) {
      invalidRows += 1;
      await db.importRow.create({
        data: {
          importJobId: job.id,
          rowNumber,
          entityType: "BLUEPRINT",
          entityCode: cell(row.kode_kisi) || null,
          status: "ERROR",
          payload: row as any,
          messages: [
            error instanceof Error
              ? error.message
              : "Gagal mengimpor baris kisi-kisi.",
          ] as any,
        },
      });
    }
  }

  await finishJob(job.id, validRows, invalidRows);
  revalidatePath("/imports");
  revalidatePath("/blueprints");
  revalidatePath("/questions");
  revalidatePath("/assignments");
  revalidatePath("/");
  redirect(
    `/imports?success=${encodeURIComponent(`${validRows} kisi-kisi berhasil diimpor, ${invalidRows} gagal.`)}`,
  );
}

async function uploadQuestions(formData: FormData) {
  "use server";
  const user = await requireSuperAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("File soal tidak ditemukan.");
  const rows = await parseWorkbook(file);
  if (!rows.length) throw new Error("File tidak berisi data soal.");

  const job = await createJob("QUESTION", file.name, user.id, rows.length);
  let validRows = 0;
  let invalidRows = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    try {
      const result = await db.$transaction(async (tx) => {
        const blueprintCode = requiredCell(row, "kode_kisi", "kode_kisi");
        const blueprint = await tx.blueprint.findUnique({
          where: { code: blueprintCode },
          include: {
            currentVersion: true,
            stimulus: { include: { currentVersion: true } },
          },
        });
        if (!blueprint?.currentVersion)
          throw new Error(
            `Kisi-kisi ${blueprintCode} tidak ditemukan atau belum aktif.`,
          );

        await syncQuestionSlots(
          blueprint.id,
          blueprint.currentVersion.expectedQuestionCount,
          tx,
        );
        const requestedQuestionCode = cell(row.kode_soal);
        const question = requestedQuestionCode
          ? await tx.question.findUnique({
              where: { code: requestedQuestionCode },
            })
          : await tx.question.findFirst({
              where: { blueprintId: blueprint.id, currentVersionId: null },
              orderBy: { code: "asc" },
            });
        if (!question) {
          if (requestedQuestionCode)
            throw new Error(
              `Kode soal ${requestedQuestionCode} tidak ditemukan.`,
            );
          throw new Error(
            `Tidak ada slot kosong pada ${blueprintCode}. Tambah jumlah_soal pada kisi-kisi terlebih dahulu.`,
          );
        }
        if (question.blueprintId !== blueprint.id)
          throw new Error(
            `Kode soal ${question.code} bukan milik ${blueprintCode}.`,
          );

        const answerKey = requiredCell(
          row,
          "kunci_jawaban",
          "kunci_jawaban",
        ).toUpperCase();
        if (!optionLabels.includes(answerKey as (typeof optionLabels)[number]))
          throw new Error("kunci_jawaban harus A, B, C, D, atau E.");
        const difficultyRaw = (cell(row.kesulitan) || "MEDIUM").toUpperCase();
        const difficultyMap: Record<string, "EASY" | "MEDIUM" | "HARD"> = {
          EASY: "EASY",
          MUDAH: "EASY",
          MEDIUM: "MEDIUM",
          SEDANG: "MEDIUM",
          HARD: "HARD",
          SULIT: "HARD",
        };
        const difficulty = difficultyMap[difficultyRaw];
        if (!difficulty)
          throw new Error(
            "kesulitan harus MUDAH/SEDANG/SULIT atau EASY/MEDIUM/HARD.",
          );

        const latest = await tx.questionVersion.findFirst({
          where: { questionId: question.id },
          orderBy: { versionNumber: "desc" },
          select: { versionNumber: true },
        });
        const version = await tx.questionVersion.create({
          data: {
            questionId: question.id,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            blueprintVersionId: blueprint.currentVersion.id,
            stimulusVersionId:
              blueprint.currentVersion.questionMode === "STIMULUS_GROUP"
                ? (blueprint.stimulus?.currentVersion?.id ?? null)
                : null,
            orderInStimulus:
              blueprint.currentVersion.questionMode === "STIMULUS_GROUP"
                ? integerCell(
                    row.urutan_stimulus,
                    questionOrderFromCode(question.code) ?? 1,
                  )
                : null,
            stemHtml: asHtmlParagraph(requiredCell(row, "soal", "soal"))!,
            explanationHtml: asHtmlParagraph(cell(row.pembahasan)) ?? null,
            difficulty,
            answerKey: answerKey as "A" | "B" | "C" | "D" | "E",
            changeSummaryHtml: latest
              ? "<p>Pembaruan soal melalui upload Excel oleh Super Admin.</p>"
              : "<p>Versi awal soal melalui upload Excel oleh Super Admin.</p>",
            createdById: user.id,
            options: {
              create: optionLabels.map((label, optionIndex) => ({
                label,
                sortOrder: optionIndex + 1,
                contentHtml: asHtmlParagraph(
                  requiredCell(
                    row,
                    `opsi_${label.toLowerCase()}`,
                    `opsi_${label.toLowerCase()}`,
                  ),
                )!,
              })),
            },
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

        const [total, filled] = await Promise.all([
          tx.question.count({ where: { blueprintId: blueprint.id } }),
          tx.question.count({
            where: {
              blueprintId: blueprint.id,
              currentVersionId: { not: null },
            },
          }),
        ]);
        await tx.questionWritingAssignment.updateMany({
          where: { blueprintId: blueprint.id, status: { not: "CANCELLED" } },
          data: {
            status: total > 0 && filled >= total ? "COMPLETED" : "IN_PROGRESS",
          },
        });
        return question.code;
      });

      await db.importRow.create({
        data: {
          importJobId: job.id,
          rowNumber,
          entityType: "QUESTION",
          entityCode: result,
          status: "IMPORTED",
          payload: row as any,
          messages: ["Soal berhasil disimpan sebagai draft."] as any,
        },
      });
      validRows += 1;
    } catch (error) {
      invalidRows += 1;
      await db.importRow.create({
        data: {
          importJobId: job.id,
          rowNumber,
          entityType: "QUESTION",
          entityCode: cell(row.kode_soal) || null,
          status: "ERROR",
          payload: row as any,
          messages: [
            error instanceof Error
              ? error.message
              : "Gagal mengimpor baris soal.",
          ] as any,
        },
      });
    }
  }

  await finishJob(job.id, validRows, invalidRows);
  revalidatePath("/imports");
  revalidatePath("/questions");
  revalidatePath("/reviews");
  revalidatePath("/blueprints");
  revalidatePath("/");
  redirect(
    `/imports?success=${encodeURIComponent(`${validRows} soal berhasil diimpor sebagai draft, ${invalidRows} gagal.`)}`,
  );
}

export default async function ImportsPage({ searchParams }: PageProps) {
  await requirePageUser(["SUPER_ADMIN"]);
  const params = await searchParams;
  const totalJobs = await db.importJob.count();
  const pagination = paginationWindow(totalJobs, parsePage(params?.page), parsePageSize(params?.size));
  const jobs = await db.importJob.findMany({
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    ...(pagination.take ? { take: pagination.take } : {}),
    include: {
      requestedBy: { select: { name: true } },
      rows: {
        where: { status: "ERROR" },
        orderBy: { rowNumber: "asc" },
        take: 3,
      },
    },
  });

  return (
    <AdminShell
      title="Upload Kisi-kisi & Soal"
      subtitle="Impor Excel khusus Super Admin dengan validasi per baris"
      allowedRoles={["SUPER_ADMIN"]}
    >
      <div className="page-header import-page-header">
        <div>
          <p className="eyebrow">Impor terkontrol</p>
          <h2>Upload kisi-kisi dan soal</h2>
          <p>
            Gunakan template resmi. Data soal masuk sebagai draft dan baru
            dikirim melalui satu tombol pada kode kisi-kisi.
          </p>
        </div>
      </div>

      {params?.success ? (
        <div className="notice-banner success">
          <CheckCircle2 size={18} />
          <span>{params.success}</span>
        </div>
      ) : null}
      {params?.error ? (
        <div className="notice-banner danger">
          <AlertCircle size={18} />
          <span>{params.error}</span>
        </div>
      ) : null}

      <section className="upload-card-grid">
        <article className="card panel upload-panel">
          <div className="upload-panel-heading">
            <span className="upload-panel-icon">
              <FileSpreadsheet size={25} />
            </span>
            <div>
              <h3>Upload kisi-kisi</h3>
              <p className="muted-text">
                Membuat atau memperbarui kisi-kisi, reading text, dan slot soal
                otomatis.
              </p>
            </div>
          </div>
          <a
            className="secondary-button template-download"
            href="/templates/template-upload-kisi-kisi-v2.6.xlsx"
            download
          >
            <Download size={17} /> Unduh template kisi-kisi
          </a>
          <form action={uploadBlueprints} className="upload-form">
            <label className="file-drop-field">
              <UploadCloud size={32} />
              <strong>Pilih file Excel kisi-kisi</strong>
              <span>.xlsx atau .xls, maksimum 8 MB</span>
              <input type="file" name="file" accept=".xlsx,.xls" required />
            </label>
            <button className="primary-button" type="submit">
              <UploadCloud size={17} /> Upload kisi-kisi
            </button>
          </form>
        </article>

        <article className="card panel upload-panel">
          <div className="upload-panel-heading">
            <span className="upload-panel-icon question">
              <FileQuestion size={25} />
            </span>
            <div>
              <h3>Upload soal</h3>
              <p className="muted-text">
                Mengisi pertanyaan berdasarkan kode kisi-kisi; reading text
                tetap diambil dari data stimulus.
              </p>
            </div>
          </div>
          <a
            className="secondary-button template-download"
            href="/templates/template-upload-soal-v2.6.xlsx"
            download
          >
            <Download size={17} /> Unduh template soal
          </a>
          <form action={uploadQuestions} className="upload-form">
            <label className="file-drop-field">
              <UploadCloud size={32} />
              <strong>Pilih file Excel soal</strong>
              <span>
                `kode_soal` boleh kosong untuk memakai slot berikutnya
              </span>
              <input type="file" name="file" accept=".xlsx,.xls" required />
            </label>
            <button className="primary-button" type="submit">
              <UploadCloud size={17} /> Upload soal
            </button>
          </form>
        </article>
      </section>

      <section className="card panel import-history-panel">
        <div className="panel-heading">
          <div>
            <h3>
              <History size={18} /> Riwayat upload
            </h3>
            <p className="muted-text">
              Baris gagal tidak membatalkan baris lain yang valid.
            </p>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Jenis</th>
                <th>File</th>
                <th>Hasil</th>
                <th>Status</th>
                <th>Kesalahan awal</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length ? (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.createdAt.toLocaleString("id-ID")}</td>
                    <td>
                      <span className="badge">
                        {job.type === "BLUEPRINT" ? "KISI-KISI" : "SOAL"}
                      </span>
                    </td>
                    <td>
                      <strong>{job.originalFilename}</strong>
                      <br />
                      <span className="muted-text">
                        oleh {job.requestedBy.name}
                      </span>
                    </td>
                    <td>
                      <strong>{job.validRows}</strong> berhasil
                      <br />
                      <span
                        className={
                          job.invalidRows ? "danger-text" : "muted-text"
                        }
                      >
                        {job.invalidRows} gagal
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${job.status === "FAILED" ? "danger" : job.status === "COMPLETED" ? "success" : "warning"}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td>
                      {job.rows.length ? (
                        job.rows.map((row) => (
                          <div className="import-error-line" key={row.id}>
                            Baris {row.rowNumber}:{" "}
                            {Array.isArray(row.messages)
                              ? String(row.messages[0])
                              : "Data tidak valid"}
                          </div>
                        ))
                      ) : (
                        <span className="muted-text">Tidak ada</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-table-state">
                      Belum ada riwayat upload.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/imports"
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={totalJobs}
          totalPages={pagination.totalPages}
          from={pagination.from}
          to={pagination.to}
          itemLabel="riwayat upload"
          params={{ success: params?.success, error: params?.error }}
        />
      </section>
    </AdminShell>
  );
}
