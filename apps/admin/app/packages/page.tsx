import { AdminShell } from "@/components/admin-shell";
import { PaginationControls } from "@/components/pagination-controls";
import {
  PackageFieldsBuilder,
  type PackageFieldDefault,
} from "@/components/package-fields-builder";
import { getOrCreateDefaultPeriod, requiredText } from "@/lib/db-helpers";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import {
  BookOpenText,
  CalendarClock,
  Layers3,
  Pencil,
  Shuffle,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

export const dynamic = "force-dynamic";

type SelectionMode = "ALL" | "RANDOM_ONE";

type ParsedPackageField = {
  key: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  sortOrder: number;
  rules: Array<{
    blueprintId: string;
    selectionMode: SelectionMode;
    sortOrder: number;
  }>;
};

function plainText(html: string | null | undefined) {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} wajib diisi.`);
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}:00+07:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} tidak valid.`);
  return date;
}

function datetimeLocal(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
  return parts.replace(" ", "T");
}

function displayWib(value: Date | null | undefined) {
  return value?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "-";
}

async function readPackageFields(formData: FormData): Promise<ParsedPackageField[]> {
  const fieldKeys = Array.from(
    new Set(formData.getAll("fieldKeys").map(String).map((value) => value.trim()).filter(Boolean)),
  );
  if (!fieldKeys.length) throw new Error("Tambahkan minimal satu bidang ujian.");

  const rawFields = fieldKeys.map((key, fieldIndex) => {
    const name = requiredText(formData, `fieldName:${key}`);
    const description = String(formData.get(`fieldDescription:${key}`) ?? "").trim() || null;
    const durationMinutes = Number(formData.get(`fieldDuration:${key}`) ?? 0);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      throw new Error(`Durasi bidang “${name}” minimal 1 menit.`);
    }

    const blueprintIds = Array.from(
      new Set(
        formData
          .getAll(`fieldBlueprintIds:${key}`)
          .map(String)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
    if (!blueprintIds.length) {
      throw new Error(`Pilih minimal satu kode kisi-kisi untuk bidang “${name}”.`);
    }

    return {
      key,
      name,
      description,
      durationMinutes,
      sortOrder: fieldIndex + 1,
      blueprintIds,
    };
  });

  const allBlueprintIds = rawFields.flatMap((field) => field.blueprintIds);
  if (new Set(allBlueprintIds).size !== allBlueprintIds.length) {
    throw new Error("Satu kode kisi-kisi hanya boleh dipakai pada satu bidang dalam paket yang sama.");
  }

  const blueprints = await db.blueprint.findMany({
    where: { id: { in: allBlueprintIds } },
    include: {
      currentVersion: true,
      stimulus: true,
      questions: { where: { status: "APPROVED" }, select: { id: true } },
    },
  });
  if (blueprints.length !== allBlueprintIds.length) {
    throw new Error("Sebagian kisi-kisi tidak ditemukan.");
  }
  const blueprintMap = new Map<string, any>(
    blueprints.map((blueprint: any) => [blueprint.id, blueprint]),
  );

  return rawFields.map((field) => ({
    key: field.key,
    name: field.name,
    description: field.description,
    durationMinutes: field.durationMinutes,
    sortOrder: field.sortOrder,
    rules: field.blueprintIds.map((blueprintId, ruleIndex) => {
      const blueprint = blueprintMap.get(blueprintId);
      if (!blueprint?.currentVersion) throw new Error("Versi kisi-kisi belum tersedia.");
      if (!blueprint.questions.length) {
        throw new Error(`${blueprint.code} belum memiliki soal APPROVED.`);
      }
      if (
        blueprint.currentVersion.questionMode === "STIMULUS_GROUP" &&
        blueprint.stimulus?.status !== "APPROVED"
      ) {
        throw new Error(`Stimulus ${blueprint.code} belum APPROVED.`);
      }

      const rawMode = String(
        formData.get(`selectionMode:${field.key}:${blueprintId}`) ?? "RANDOM_ONE",
      );
      const selectionMode: SelectionMode = rawMode === "ALL" ? "ALL" : "RANDOM_ONE";
      if (
        selectionMode === "ALL" &&
        blueprint.questions.length < blueprint.currentVersion.expectedQuestionCount
      ) {
        throw new Error(
          `${blueprint.code} belum lengkap: ${blueprint.questions.length}/${blueprint.currentVersion.expectedQuestionCount} soal APPROVED.`,
        );
      }

      return { blueprintId, selectionMode, sortOrder: ruleIndex + 1 };
    }),
  }));
}

async function createFieldRows(
  tx: any,
  examPackageId: string,
  fields: ParsedPackageField[],
) {
  for (const field of fields) {
    const createdField = await tx.examPackageField.create({
      data: {
        examPackageId,
        name: field.name,
        description: field.description,
        durationMinutes: field.durationMinutes,
        sortOrder: field.sortOrder,
      },
    });
    await tx.examPackageBlueprintRule.createMany({
      data: field.rules.map((rule) => ({
        examPackageId,
        examPackageFieldId: createdField.id,
        blueprintId: rule.blueprintId,
        selectionMode: rule.selectionMode,
        sortOrder: rule.sortOrder,
      })),
    });
  }
}

async function createPackage(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const period = await getOrCreateDefaultPeriod();
  const fields = await readPackageFields(formData);
  const code = requiredText(formData, "code").toUpperCase();
  const name = requiredText(formData, "name");
  const scheduledStartAt = parseDate(formData.get("scheduledStartAt"), "Waktu mulai");
  const scheduledEndAt = parseDate(formData.get("scheduledEndAt"), "Waktu selesai");
  if (scheduledEndAt <= scheduledStartAt) throw new Error("Waktu selesai harus setelah waktu mulai.");
  const status = String(formData.get("status")) === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const durationMinutes = fields.reduce((total, field) => total + field.durationMinutes, 0);

  await db.$transaction(async (tx: any) => {
    const pack = await tx.examPackage.create({
      data: {
        code,
        name,
        subjectName: fields.length === 1 ? fields[0].name : "Multi Bidang",
        periodId: period.id,
        durationMinutes,
        scheduledStartAt,
        scheduledEndAt,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        shuffleBlocks: formData.get("shuffleBlocks") === "on",
        shuffleQuestions: false,
        shuffleOptions: formData.get("shuffleOptions") === "on",
      },
    });
    await createFieldRows(tx, pack.id, fields);
  });

  revalidatePath("/packages");
  revalidatePath("/");
}

async function updatePackage(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id");
  const startedAttempts = await db.attempt.count({
    where: { examSession: { examPackageId: id } },
  });
  if (startedAttempts) {
    throw new Error("Struktur paket tidak dapat diubah setelah ada peserta yang memulai ujian.");
  }

  const fields = await readPackageFields(formData);
  const name = requiredText(formData, "name");
  const scheduledStartAt = parseDate(formData.get("scheduledStartAt"), "Waktu mulai");
  const scheduledEndAt = parseDate(formData.get("scheduledEndAt"), "Waktu selesai");
  if (scheduledEndAt <= scheduledStartAt) throw new Error("Waktu selesai harus setelah waktu mulai.");
  const status = String(formData.get("status")) === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const durationMinutes = fields.reduce((total, field) => total + field.durationMinutes, 0);

  await db.$transaction(async (tx: any) => {
    await tx.examPackageBlueprintRule.deleteMany({ where: { examPackageId: id } });
    await tx.examPackageField.deleteMany({ where: { examPackageId: id } });
    await tx.examPackage.update({
      where: { id },
      data: {
        name,
        subjectName: fields.length === 1 ? fields[0].name : "Multi Bidang",
        durationMinutes,
        scheduledStartAt,
        scheduledEndAt,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        shuffleBlocks: formData.get("shuffleBlocks") === "on",
        shuffleOptions: formData.get("shuffleOptions") === "on",
      },
    });
    await createFieldRows(tx, id, fields);
    await tx.examSession.updateMany({
      where: { examPackageId: id, attempt: null },
      data: { startsAt: scheduledStartAt, endsAt: scheduledEndAt },
    });
  });

  revalidatePath("/packages");
  revalidatePath("/");
}

async function plotParticipants(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const examPackageId = requiredText(formData, "examPackageId");
  const participantIds = Array.from(
    new Set(formData.getAll("participantIds").map(String).filter(Boolean)),
  );
  const startsAt = parseDate(formData.get("startsAt"), "Waktu mulai peserta");
  const endsAt = parseDate(formData.get("endsAt"), "Waktu selesai peserta");
  if (endsAt <= startsAt) throw new Error("Waktu selesai harus setelah waktu mulai.");

  const existing = await db.examSession.findMany({
    where: { examPackageId },
    include: { attempt: true },
  });
  const selected = new Set(participantIds);

  await db.$transaction(async (tx: any) => {
    for (const participantId of participantIds) {
      await tx.examSession.upsert({
        where: { examPackageId_participantId: { examPackageId, participantId } },
        update: { startsAt, endsAt },
        create: { examPackageId, participantId, startsAt, endsAt },
      });
    }

    const removableIds = existing
      .filter((session) => !selected.has(session.participantId) && !session.attempt)
      .map((session) => session.id);
    if (removableIds.length) {
      await tx.examSession.deleteMany({ where: { id: { in: removableIds } } });
    }
  });

  revalidatePath("/packages");
}

async function deletePackage(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id");
  const attempts = await db.attempt.count({ where: { examSession: { examPackageId: id } } });
  if (attempts) throw new Error("Paket yang sudah dikerjakan peserta tidak dapat dihapus.");
  await db.$transaction([
    db.examSession.deleteMany({ where: { examPackageId: id } }),
    db.examPackage.delete({ where: { id } }),
  ]);
  revalidatePath("/packages");
  revalidatePath("/");
}

type PageProps = { searchParams?: Promise<{ page?: string; size?: string }> };

export default async function PackagesPage({ searchParams }: PageProps) {
  await requirePageUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const params = await searchParams;
  const totalPackages = await db.examPackage.count();
  const pagination = paginationWindow(totalPackages, parsePage(params?.page), parsePageSize(params?.size));
  const [blueprints, packages, participants] = await Promise.all([
    db.blueprint.findMany({
      where: { currentVersionId: { not: null } },
      orderBy: { code: "asc" },
      include: {
        currentVersion: true,
        stimulus: true,
        questions: { where: { status: "APPROVED" }, select: { id: true } },
      },
    }),
    db.examPackage.findMany({
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      ...(pagination.take ? { take: pagination.take } : {}),
      include: {
        fields: {
          orderBy: { sortOrder: "asc" },
          include: {
            blueprintRules: {
              orderBy: { sortOrder: "asc" },
              include: { blueprint: { include: { currentVersion: true } } },
            },
          },
        },
        blueprintRules: {
          orderBy: { sortOrder: "asc" },
          include: { blueprint: { include: { currentVersion: true } } },
        },
        sessions: {
          orderBy: { participant: { name: "asc" } },
          include: {
            participant: true,
            attempt: { include: { _count: { select: { securityEvents: true } } } },
          },
        },
      },
    }),
    db.participant.findMany({
      where: { isActive: true, username: { not: null } },
      orderBy: [{ name: "asc" }, { username: "asc" }],
    }),
  ]);

  const choices = blueprints.map((blueprint) => {
    const version = blueprint.currentVersion!;
    const stimulusApproved = blueprint.stimulus?.status === "APPROVED";
    const ready =
      blueprint.questions.length > 0 &&
      (version.questionMode !== "STIMULUS_GROUP" || stimulusApproved);
    return {
      id: blueprint.id,
      code: blueprint.code,
      title: plainText(version.titleHtml) || blueprint.code,
      testGroup: plainText(version.testGroupHtml),
      testTopic: plainText(version.testTopicHtml),
      questionMode: version.questionMode,
      approvedCount: blueprint.questions.length,
      expectedCount: version.expectedQuestionCount,
      stimulusApproved,
      ready,
    };
  });

  const now = new Date();
  const defaultStart = datetimeLocal(new Date(now.getTime() + 60 * 60 * 1000));
  const defaultEnd = datetimeLocal(new Date(now.getTime() + 4 * 60 * 60 * 1000));

  return (
    <AdminShell
      title="Buat Paket Ujian"
      subtitle="Susun paket soal; plotting peserta dipindahkan ke menu Sesi Ujian & Ruang"
      allowedRoles={["EXAM_ADMIN", "SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <h2>Paket ujian multi bidang</h2>
          <p>
            Tambahkan bidang sebanyak yang dibutuhkan. Setiap bidang memiliki kisi-kisi dan durasi sendiri.
          </p>
        </div>
        <span className="badge">Versi 2.9</span>
      </div>

      <section className="package-flow-card package-flow-five card">
        <div><span>1</span><strong>Data paket</strong></div>
        <div><span>2</span><strong>Tambah bidang</strong></div>
        <div><span>3</span><strong>Pilih kisi-kisi</strong></div>
        <div><span>4</span><strong>Simpan paket soal</strong></div>
        <div><span>5</span><strong>Plot di Sesi & Ruang</strong></div>
      </section>

      <form action={createPackage} className="card panel form-grid package-create-form">
        <div className="panel-heading">
          <h3><Layers3 size={19} /> Buat paket baru</h3>
        </div>
        <div className="two-columns">
          <label className="field-block">
            <span className="field-label">Kode paket</span>
            <input className="text-input" name="code" placeholder="PAKET-UTAMA-A" required />
          </label>
          <label className="field-block">
            <span className="field-label">Nama paket</span>
            <input className="text-input" name="name" placeholder="Paket Olimpiade Fisika Gelombang A" required />
          </label>
        </div>
        <div className="two-columns">
          <label className="field-block">
            <span className="field-label">Mulai tersedia</span>
            <input className="text-input" name="scheduledStartAt" type="datetime-local" defaultValue={defaultStart} required />
          </label>
          <label className="field-block">
            <span className="field-label">Batas selesai</span>
            <input className="text-input" name="scheduledEndAt" type="datetime-local" defaultValue={defaultEnd} required />
          </label>
        </div>

        <PackageFieldsBuilder blueprints={choices} />

        <div className="two-columns">
          <label className="check-row"><input type="checkbox" name="shuffleBlocks" /> Acak urutan kisi-kisi di dalam bidang</label>
          <label className="check-row"><input type="checkbox" name="shuffleOptions" /> Acak urutan pilihan jawaban</label>
        </div>
        <label className="field-block">
          <span className="field-label">Status paket</span>
          <select className="select-input" name="status" defaultValue="DRAFT">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published — dapat dilihat peserta terplot</option>
          </select>
        </label>
        <button className="primary-button" type="submit">Simpan paket dan bidang</button>
      </form>

      <section className="package-list-section">
        <div className="panel-heading">
          <h3>Daftar paket</h3>
          <span className="badge">{totalPackages} paket</span>
        </div>
        <div className="package-card-list">
          {packages.map((pack: any) => {
            const legacyRules = pack.blueprintRules.filter(
              (rule: any) => !rule.examPackageFieldId,
            );
            const fieldViews = pack.fields.length
              ? pack.fields
              : [
                  {
                    id: `legacy-${pack.id}`,
                    name: pack.subjectName,
                    description: "Paket dari versi sebelumnya",
                    durationMinutes: pack.durationMinutes,
                    sortOrder: 1,
                    blueprintRules: legacyRules,
                  },
                ];
            const defaultFields: PackageFieldDefault[] = fieldViews.map((field: any) => ({
              key: field.id,
              name: field.name,
              description: field.description ?? "",
              durationMinutes: field.durationMinutes,
              modes: Object.fromEntries(
                field.blueprintRules.map((rule: any) => [
                  rule.blueprintId,
                  rule.selectionMode as SelectionMode,
                ]),
              ),
            }));
            const totalRules = fieldViews.reduce(
              (total: number, field: any) => total + field.blueprintRules.length,
              0,
            );
            const lockedParticipants = pack.sessions.filter((session: any) => session.attempt).length;

            return (
              <article className="card package-summary-card" key={pack.id}>
                <header>
                  <div>
                    <span className="eyebrow">{fieldViews.length} bidang ujian</span>
                    <h3>{pack.code} — {pack.name}</h3>
                    <p className="muted-text">
                      {pack.durationMinutes} menit total · {totalRules} kisi-kisi · {pack.sessions.length} peserta
                    </p>
                  </div>
                  <span className={`badge ${pack.status === "DRAFT" ? "warning" : ""}`}>{pack.status}</span>
                </header>

                <div className="package-field-summary-list">
                  {fieldViews.map((field: any, index: number) => (
                    <section className="package-field-summary" key={field.id}>
                      <div>
                        <span className="package-field-number">{index + 1}</span>
                        <div>
                          <strong>{field.name}</strong>
                          <small>{field.durationMinutes} menit · {field.blueprintRules.length} kisi-kisi</small>
                        </div>
                      </div>
                      <div className="package-rule-chips">
                        {field.blueprintRules.map((rule: any) => (
                          <span className="role-pill" key={rule.id}>
                            {rule.selectionMode === "RANDOM_ONE" ? <Shuffle size={13} /> : <BookOpenText size={13} />}
                            {rule.blueprint.code}: {rule.selectionMode === "RANDOM_ONE" ? "random 1" : "semua"}
                          </span>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="package-schedule-line">
                  <CalendarClock size={16} />
                  {pack.scheduledStartAt ? displayWib(pack.scheduledStartAt) : "Belum dijadwalkan"} — {displayWib(pack.scheduledEndAt)} WIB
                </div>

                <div className="package-action-grid">
                  <details className="action-details">
                    <summary className="secondary-button"><Pencil size={16} /> Edit paket dan bidang</summary>
                    <form action={updatePackage} className="inline-edit-form form-grid package-edit-form">
                      <input type="hidden" name="id" value={pack.id} />
                      <div className="two-columns">
                        <label className="field-block"><span className="field-label">Nama paket</span><input className="text-input" name="name" defaultValue={pack.name} required /></label>
                        <label className="field-block"><span className="field-label">Status</span><select className="select-input" name="status" defaultValue={pack.status}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></label>
                      </div>
                      <div className="two-columns">
                        <label className="field-block"><span className="field-label">Mulai</span><input className="text-input" name="scheduledStartAt" type="datetime-local" defaultValue={datetimeLocal(pack.scheduledStartAt)} required /></label>
                        <label className="field-block"><span className="field-label">Selesai</span><input className="text-input" name="scheduledEndAt" type="datetime-local" defaultValue={datetimeLocal(pack.scheduledEndAt)} required /></label>
                      </div>
                      <PackageFieldsBuilder blueprints={choices} defaults={defaultFields} />
                      <div className="two-columns">
                        <label className="check-row"><input type="checkbox" name="shuffleBlocks" defaultChecked={pack.shuffleBlocks} /> Acak kisi-kisi dalam bidang</label>
                        <label className="check-row"><input type="checkbox" name="shuffleOptions" defaultChecked={pack.shuffleOptions} /> Acak pilihan</label>
                      </div>
                      {lockedParticipants ? (
                        <p className="form-alert warning">Struktur tidak dapat diubah karena {lockedParticipants} peserta sudah memulai ujian.</p>
                      ) : null}
                      <button className="primary-button" type="submit" disabled={Boolean(lockedParticipants)}>Simpan perubahan</button>
                    </form>
                  </details>

                  <a className="secondary-button" href="/exam-sessions"><UsersRound size={16} /> Plot peserta di Sesi & Ruang ({pack.sessions.length})</a>

                  <form action={deletePackage}>
                    <input type="hidden" name="id" value={pack.id} />
                    <button className="danger-button" type="submit"><Trash2 size={16} /> Hapus</button>
                  </form>
                </div>
              </article>
            );
          })}
          {!packages.length ? <div className="card empty-package-card"><p className="muted-text">Belum ada paket ujian.</p></div> : null}
        </div>
        <PaginationControls
          basePath="/packages"
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={totalPackages}
          totalPages={pagination.totalPages}
          from={pagination.from}
          to={pagination.to}
          itemLabel="paket"
        />
      </section>
    </AdminShell>
  );
}
