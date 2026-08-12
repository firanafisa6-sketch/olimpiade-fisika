import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ValidationAssignmentForm, WritingAssignmentForm } from "@/components/assignment-forms";
import { ensureAllQuestionSlots, getHtml, optionalText, requiredText, syncQuestionSlots } from "@/lib/db-helpers";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import { ChevronDown, ClipboardCheck, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

function dateInput(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function selectedBlueprintIds(formData: FormData) {
  const selectedIds = formData.getAll("blueprintIds").map((value) => String(value)).filter(Boolean);
  const legacyId = optionalText(formData, "blueprintId");
  const ids = Array.from(new Set(selectedIds.length ? selectedIds : legacyId ? [legacyId] : []));
  if (!ids.length) throw new Error("Pilih minimal satu kisi-kisi.");
  return ids;
}

async function createWritingAssignment(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const assignedToId = requiredText(formData, "assignedToId");
  const blueprintIds = selectedBlueprintIds(formData);
  const dueAtText = optionalText(formData, "dueAt");
  const dueAt = dueAtText ? new Date(`${dueAtText}T00:00:00`) : null;
  const noteHtml = getHtml(formData, "note");

  await db.$transaction(async (tx) => {
    const blueprints = await tx.blueprint.findMany({
      where: { id: { in: blueprintIds } },
      include: { currentVersion: true }
    });
    if (blueprints.length !== blueprintIds.length) throw new Error("Sebagian kisi-kisi tidak ditemukan.");
    const invalidBlueprint = blueprints.find((item) => !item.currentVersion);
    if (invalidBlueprint) throw new Error(`Kisi-kisi ${invalidBlueprint.code} belum memiliki versi aktif.`);

    const existingAssignments = await tx.questionWritingAssignment.findMany({
      where: { blueprintId: { in: blueprintIds } },
      select: { blueprint: { select: { code: true } } }
    });
    if (existingAssignments.length) {
      const usedCodes = Array.from(new Set(existingAssignments.map((item) => item.blueprint.code))).join(", ");
      throw new Error(`Kisi-kisi berikut sudah diplot ke penulis: ${usedCodes}.`);
    }

    await tx.questionWritingAssignment.createMany({
      data: blueprints.map((blueprint) => ({
        blueprintId: blueprint.id,
        assignedToId,
        assignedById: user.id,
        targetCount: blueprint.currentVersion!.expectedQuestionCount,
        noteHtml,
        dueAt,
        status: "ASSIGNED" as const
      }))
    });
  });
  revalidatePath("/assignments");
  revalidatePath("/questions");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

async function updateWritingAssignment(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id");
  const blueprintId = requiredText(formData, "blueprintId");
  const assignedToId = requiredText(formData, "assignedToId");
  const dueAtText = optionalText(formData, "dueAt");
  const blueprint = await db.blueprint.findUnique({ where: { id: blueprintId }, include: { currentVersion: true } });
  if (!blueprint?.currentVersion) throw new Error("Kisi-kisi belum memiliki versi aktif.");

  await db.$transaction(async (tx) => {
    const existing = await tx.questionWritingAssignment.findUnique({ where: { id } });
    if (!existing) throw new Error("Plotting penulis tidak ditemukan.");
    const duplicateBlueprint = await tx.questionWritingAssignment.findFirst({
      where: { blueprintId, id: { not: id } },
      select: { blueprint: { select: { code: true } } }
    });
    if (duplicateBlueprint) throw new Error(`Kisi-kisi ${duplicateBlueprint.blueprint.code} sudah diplot ke penulis lain.`);
    if (existing.blueprintId !== blueprintId || existing.assignedToId !== assignedToId) {
      await tx.questionWritingAssignment.delete({ where: { id } });
      await tx.questionWritingAssignment.upsert({
        where: { blueprintId_assignedToId: { blueprintId, assignedToId } },
        update: {
          assignedById: user.id,
          targetCount: blueprint.currentVersion!.expectedQuestionCount,
          noteHtml: getHtml(formData, "note"),
          dueAt: dueAtText ? new Date(`${dueAtText}T00:00:00`) : null,
          status: String(formData.get("status") || "ASSIGNED") as "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
        },
        create: {
          blueprintId,
          assignedToId,
          assignedById: user.id,
          targetCount: blueprint.currentVersion!.expectedQuestionCount,
          noteHtml: getHtml(formData, "note"),
          dueAt: dueAtText ? new Date(`${dueAtText}T00:00:00`) : null,
          status: String(formData.get("status") || "ASSIGNED") as "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
        }
      });
    } else {
      await tx.questionWritingAssignment.update({
        where: { id },
        data: {
          assignedById: user.id,
          targetCount: blueprint.currentVersion!.expectedQuestionCount,
          noteHtml: getHtml(formData, "note"),
          dueAt: dueAtText ? new Date(`${dueAtText}T00:00:00`) : null,
          status: String(formData.get("status") || "ASSIGNED") as "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
        }
      });
    }
  });
  revalidatePath("/assignments");
  revalidatePath("/questions");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

async function deleteWritingAssignment(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  await db.questionWritingAssignment.delete({ where: { id: requiredText(formData, "id") } });
  revalidatePath("/assignments");
  revalidatePath("/questions");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

async function createValidationAssignment(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const assignedToId = requiredText(formData, "assignedToId");
  const blueprintIds = selectedBlueprintIds(formData);
  const noteHtml = getHtml(formData, "note");

  await db.$transaction(async (tx) => {
    const blueprints = await tx.blueprint.findMany({
      where: { id: { in: blueprintIds } },
      include: { currentVersion: true }
    });
    if (blueprints.length !== blueprintIds.length) throw new Error("Sebagian kisi-kisi tidak ditemukan.");
    const invalidBlueprint = blueprints.find((item) => !item.currentVersion);
    if (invalidBlueprint) throw new Error(`Kisi-kisi ${invalidBlueprint.code} belum memiliki versi aktif.`);

    const existingAssignments = await tx.questionValidationAssignment.findMany({
      where: { question: { blueprintId: { in: blueprintIds } } },
      select: { question: { select: { blueprint: { select: { code: true } } } } }
    });
    if (existingAssignments.length) {
      const usedCodes = Array.from(new Set(existingAssignments.map((item) => item.question.blueprint.code))).join(", ");
      throw new Error(`Kisi-kisi berikut sudah diplot ke validator: ${usedCodes}.`);
    }

    for (const blueprint of blueprints) {
      await syncQuestionSlots(blueprint.id, blueprint.currentVersion!.expectedQuestionCount, tx);
    }

    const questions = await tx.question.findMany({ where: { blueprintId: { in: blueprintIds } }, select: { id: true } });
    const questionIds = questions.map((item) => item.id);

    await tx.questionValidationAssignment.createMany({
      data: questionIds.map((questionId) => ({ questionId, assignedToId, assignedById: user.id, noteHtml, status: "ASSIGNED" as const })),
      skipDuplicates: true
    });
    await tx.question.updateMany({ where: { id: { in: questionIds }, status: "SUBMITTED" }, data: { status: "IN_REVIEW" } });
  });
  revalidatePath("/assignments");
  revalidatePath("/questions");
  revalidatePath("/reviews");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

async function updateValidationAssignment(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const oldBlueprintId = requiredText(formData, "originalBlueprintId");
  const oldAssignedToId = requiredText(formData, "originalAssignedToId");
  const blueprintId = requiredText(formData, "blueprintId");
  const assignedToId = requiredText(formData, "assignedToId");
  const status = String(formData.get("status") || "ASSIGNED") as "ASSIGNED" | "IN_REVIEW" | "DONE" | "CANCELLED";
  const noteHtml = getHtml(formData, "note");

  await db.$transaction(async (tx) => {
    const duplicateValidation = await tx.questionValidationAssignment.findFirst({
      where: {
        question: { blueprintId },
        ...(blueprintId === oldBlueprintId ? { assignedToId: { not: oldAssignedToId } } : {})
      },
      select: { question: { select: { blueprint: { select: { code: true } } } } }
    });
    if (duplicateValidation) throw new Error(`Kisi-kisi ${duplicateValidation.question.blueprint.code} sudah diplot ke validator lain.`);

    await tx.questionValidationAssignment.deleteMany({
      where: { assignedToId: oldAssignedToId, question: { blueprintId: oldBlueprintId } }
    });

    const blueprint = await tx.blueprint.findUnique({ where: { id: blueprintId }, include: { currentVersion: true } });
    if (!blueprint?.currentVersion) throw new Error("Kisi-kisi belum memiliki versi aktif.");
    await syncQuestionSlots(blueprintId, blueprint.currentVersion.expectedQuestionCount, tx);
    const questions = await tx.question.findMany({ where: { blueprintId }, select: { id: true } });
    await tx.questionValidationAssignment.createMany({
      data: questions.map((question) => ({
        questionId: question.id,
        assignedToId,
        assignedById: user.id,
        noteHtml,
        status
      })),
      skipDuplicates: true
    });
  });
  revalidatePath("/assignments");
  revalidatePath("/questions");
  revalidatePath("/reviews");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

async function deleteValidationAssignment(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const blueprintId = requiredText(formData, "blueprintId");
  const assignedToId = requiredText(formData, "assignedToId");
  await db.questionValidationAssignment.deleteMany({
    where: { assignedToId, question: { blueprintId } }
  });
  revalidatePath("/assignments");
  revalidatePath("/questions");
  revalidatePath("/reviews");
  revalidatePath("/blueprints");
  revalidatePath("/");
}

type PageProps = {
  searchParams?: Promise<{ tab?: string; page?: string; size?: string }>;
};

export default async function AssignmentsPage({ searchParams }: PageProps) {
  await requirePageUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  await ensureAllQuestionSlots();
  const params = await searchParams;
  const activeTab = params?.tab === "validator" ? "validator" : "writer";

  const requestedPage = parsePage(params?.page);
  const requestedSize = parsePageSize(params?.size);
  const totalWritingAssignments = await db.questionWritingAssignment.count();
  const writingPagination = paginationWindow(totalWritingAssignments, requestedPage, requestedSize);

  const [blueprints, authors, validators, assignedWritingBlueprints, writingAssignments, validationAssignments] = await Promise.all([
    db.blueprint.findMany({ orderBy: { code: "asc" }, include: { currentVersion: true, questions: true } }),
    db.user.findMany({ where: { isActive: true, roles: { some: { role: { code: { in: ["QUESTION_AUTHOR", "SUPER_ADMIN"] } } } } }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { isActive: true, roles: { some: { role: { code: { in: ["QUESTION_VALIDATOR", "SUPER_ADMIN"] } } } } }, orderBy: { name: "asc" } }),
    db.questionWritingAssignment.findMany({ select: { blueprintId: true } }),
    db.questionWritingAssignment.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: activeTab === "writer" ? writingPagination.skip : 0,
      ...(activeTab === "writer" && writingPagination.take ? { take: writingPagination.take } : {}),
      include: { blueprint: { include: { currentVersion: true, questions: true } }, assignedTo: true, assignedBy: true }
    }),
    db.questionValidationAssignment.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        question: { include: { blueprint: { include: { currentVersion: true } }, currentVersion: true } },
        assignedTo: true,
        assignedBy: true
      }
    })
  ]);

  const blueprintOptions = blueprints.map((bp) => ({
    id: bp.id,
    label: `${bp.code} — ${(bp.currentVersion?.testGroupHtml ?? bp.currentVersion?.titleHtml ?? "Kisi-kisi").replace(/<[^>]+>/g, "")}`,
    targetCount: bp.currentVersion?.expectedQuestionCount ?? bp.questions.length ?? 1
  }));
  const authorOptions = authors.map((user) => ({ id: user.id, label: `${user.name} (${user.email})` }));
  const validatorOptions = validators.map((user) => ({ id: user.id, label: `${user.name} (${user.email})` }));
  const unavailableWritingBlueprintIds = Array.from(new Set(assignedWritingBlueprints.map((item) => item.blueprintId))) as string[];

  const validationGroupMap = validationAssignments.reduce((groups, item) => {
    const blueprint = item.question.blueprint;
    const key = `${blueprint.id}:${item.assignedToId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.total += 1;
      if (item.question.currentVersion) existing.filled += 1;
      if (["SUBMITTED", "IN_REVIEW", "REVISION_REQUIRED"].includes(item.question.status)) existing.ready += 1;
      existing.statuses.add(item.status);
      if (item.createdAt > existing.createdAt) existing.createdAt = item.createdAt;
      return groups;
    }
    groups.set(key, {
      key,
      blueprintId: blueprint.id,
      blueprintCode: blueprint.code,
      blueprintTitle: (blueprint.currentVersion?.testGroupHtml ?? blueprint.currentVersion?.titleHtml ?? "Kisi-kisi").replace(/<[^>]+>/g, ""),
      assignedToId: item.assignedToId,
      assignedToName: item.assignedTo.name,
      noteHtml: item.noteHtml,
      total: 1,
      filled: item.question.currentVersion ? 1 : 0,
      ready: ["SUBMITTED", "IN_REVIEW", "REVISION_REQUIRED"].includes(item.question.status) ? 1 : 0,
      statuses: new Set([item.status]),
      createdAt: item.createdAt
    });
    return groups;
  }, new Map<string, any>());
  const allValidationGroups: any[] = (Array.from(validationGroupMap.values()) as any[]).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const unavailableValidationBlueprintIds = Array.from(new Set(allValidationGroups.map((item) => item.blueprintId))) as string[];
  const totalValidationGroups = allValidationGroups.length;
  const validationPagination = paginationWindow(totalValidationGroups, requestedPage, requestedSize);
  const validationGroups = validationPagination.take
    ? allValidationGroups.slice(validationPagination.skip, validationPagination.skip + validationPagination.take)
    : allValidationGroups;
  const pagination = activeTab === "writer" ? writingPagination : validationPagination;
  const totalActive = activeTab === "writer" ? totalWritingAssignments : totalValidationGroups;

  return (
    <AdminShell
      title="Plotting Tugas"
      subtitle="Penugasan penulis dan validator menggunakan kode kisi-kisi"
      allowedRoles={["EXAM_ADMIN", "SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <p className="eyebrow">Distribusi pekerjaan</p>
          <h2>Plotting berdasarkan kode kisi-kisi</h2>
          <p>Satu plotting mencakup seluruh slot soal dalam kisi-kisi, baik untuk penulis maupun validator.</p>
        </div>
        <span className="badge">Admin / Super Admin</span>
      </div>

      <nav className="assignment-subnav" aria-label="Submenu plotting tugas">
        <Link className={activeTab === "writer" ? "is-active" : ""} href="/assignments?tab=writer"><ClipboardCheck size={18} /><span>Plotting penulis soal</span><strong>{totalWritingAssignments}</strong></Link>
        <Link className={activeTab === "validator" ? "is-active" : ""} href="/assignments?tab=validator"><ShieldCheck size={18} /><span>Plotting validator soal</span><strong>{totalValidationGroups}</strong></Link>
      </nav>

      {activeTab === "writer" ? (
        <section className="assignment-tab-layout">
          <details className="create-panel-toggle card">
            <summary className="create-panel-summary">
              <span><Plus size={18} /> Tambah plotting penulis soal</span>
              <ChevronDown className="details-chevron" size={18} />
            </summary>
            <div className="create-panel-body">
              <WritingAssignmentForm action={createWritingAssignment} blueprints={blueprintOptions} authors={authorOptions} unavailableBlueprintIds={unavailableWritingBlueprintIds} />
            </div>
          </details>
          <section className="card panel data-table-wrap">
            <div className="panel-heading"><div><h3>Daftar plotting penulis</h3><p className="muted-text">Target mengikuti jumlah slot pada kisi-kisi.</p></div><span className="badge">{totalWritingAssignments} tugas</span></div>
            <table className="data-table">
              <thead><tr><th>Penulis</th><th>Kisi-kisi</th><th>Progress</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {writingAssignments.map((item) => {
                  const filled = item.blueprint.questions.filter((question) => question.currentVersionId).length;
                  return (
                    <tr key={item.id}>
                      <td>{item.assignedTo.name}<br /><span className="muted-text">Batas: {item.dueAt ? item.dueAt.toLocaleDateString("id-ID") : "-"}</span></td>
                      <td><strong>{item.blueprint.code}</strong><br /><span className="muted-text">{(item.blueprint.currentVersion?.testGroupHtml ?? "").replace(/<[^>]+>/g, "")}</span></td>
                      <td><div className="compact-progress"><span style={{ width: `${Math.min(100, (filled / Math.max(1, item.targetCount)) * 100)}%` }} /></div><strong>{filled}/{item.targetCount}</strong> soal terisi</td>
                      <td><span className="badge warning">{item.status.replaceAll("_", " ")}</span></td>
                      <td className="table-actions">
                        <details className="action-details"><summary className="secondary-button"><Pencil size={15} /> Edit</summary><WritingAssignmentForm action={updateWritingAssignment} compact blueprints={blueprintOptions} authors={authorOptions} unavailableBlueprintIds={unavailableWritingBlueprintIds.filter((blueprintId) => blueprintId !== item.blueprintId)} initial={{ id: item.id, blueprintId: item.blueprintId, assignedToId: item.assignedToId, targetCount: item.targetCount, noteHtml: item.noteHtml, status: item.status, dueAt: dateInput(item.dueAt) }} /></details>
                        <form action={deleteWritingAssignment}><input type="hidden" name="id" value={item.id} /><button className="danger-button" type="submit"><Trash2 size={15} /> Hapus</button></form>
                      </td>
                    </tr>
                  );
                })}
                {!writingAssignments.length ? <tr><td colSpan={5}><div className="empty-state"><p>Belum ada plotting penulis soal.</p><span>Klik tombol tambah, pilih penulis, lalu centang kisi-kisi yang akan ditugaskan.</span></div></td></tr> : null}
              </tbody>
            </table>
            <PaginationControls
              basePath="/assignments"
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={totalActive}
              totalPages={pagination.totalPages}
              from={pagination.from}
              to={pagination.to}
              itemLabel="plotting penulis"
              params={{ tab: "writer" }}
            />
          </section>
        </section>
      ) : (
        <section className="assignment-tab-layout">
          <details className="create-panel-toggle card">
            <summary className="create-panel-summary">
              <span><Plus size={18} /> Tambah plotting validator soal</span>
              <ChevronDown className="details-chevron" size={18} />
            </summary>
            <div className="create-panel-body">
              <ValidationAssignmentForm action={createValidationAssignment} blueprints={blueprintOptions} validators={validatorOptions} unavailableBlueprintIds={unavailableValidationBlueprintIds} />
            </div>
          </details>
          <section className="card panel data-table-wrap">
            <div className="panel-heading"><div><h3>Daftar plotting validator</h3><p className="muted-text">Setiap baris mewakili satu kode kisi-kisi, bukan satu soal.</p></div><span className="badge">{totalValidationGroups} tugas</span></div>
            <table className="data-table">
              <thead><tr><th>Validator</th><th>Kisi-kisi</th><th>Cakupan</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {validationGroups.map((group) => {
                  const status = group.statuses.size === 1 ? Array.from(group.statuses)[0] as string : "IN_REVIEW";
                  return (
                    <tr key={group.key}>
                      <td>{group.assignedToName}</td>
                      <td><strong>{group.blueprintCode}</strong><br /><span className="muted-text">{group.blueprintTitle}</span></td>
                      <td><strong>{group.total} slot</strong><br /><span className="muted-text">{group.filled} terisi • {group.ready} siap/divalidasi</span></td>
                      <td><span className="badge warning">{status.replaceAll("_", " ")}</span></td>
                      <td className="table-actions">
                        <details className="action-details"><summary className="secondary-button"><Pencil size={15} /> Edit</summary><ValidationAssignmentForm action={updateValidationAssignment} compact blueprints={blueprintOptions} validators={validatorOptions} unavailableBlueprintIds={unavailableValidationBlueprintIds.filter((blueprintId) => blueprintId !== group.blueprintId)} initial={{ blueprintId: group.blueprintId, originalBlueprintId: group.blueprintId, assignedToId: group.assignedToId, originalAssignedToId: group.assignedToId, noteHtml: group.noteHtml, status }} /></details>
                        <form action={deleteValidationAssignment}><input type="hidden" name="blueprintId" value={group.blueprintId} /><input type="hidden" name="assignedToId" value={group.assignedToId} /><button className="danger-button" type="submit"><Trash2 size={15} /> Hapus</button></form>
                      </td>
                    </tr>
                  );
                })}
                {!validationGroups.length ? <tr><td colSpan={5}><div className="empty-state"><p>Belum ada plotting validator soal.</p><span>Klik tombol tambah, pilih validator, lalu centang kisi-kisi yang akan divalidasi.</span></div></td></tr> : null}
              </tbody>
            </table>
            <PaginationControls
              basePath="/assignments"
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={totalActive}
              totalPages={pagination.totalPages}
              from={pagination.from}
              to={pagination.to}
              itemLabel="plotting validator"
              params={{ tab: "validator" }}
            />
          </section>
        </section>
      )}
    </AdminShell>
  );
}
