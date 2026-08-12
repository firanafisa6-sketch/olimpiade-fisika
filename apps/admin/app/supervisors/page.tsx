import { AdminShell } from "@/components/admin-shell";
import { hashPassword } from "@/lib/auth";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Download, FileSpreadsheet, KeyRound, Phone, Power, ShieldCheck, UserCog, UserPlus } from "lucide-react";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
type SheetRow = Record<string, unknown>;

function supervisorUsername(email: string) {
  return email.endsWith("@pengawas.local") ? email.replace("@pengawas.local", "") : email;
}

function cell(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedRow(row: SheetRow) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim().replace(/\s+/g, "_"), value])) as SheetRow;
}

function normalizeUsername(value: FormDataEntryValue | unknown, rowLabel = "") {
  const text = cell(value).toLowerCase().replace(/\s+/g, "_");
  if (!text) throw new Error(`${rowLabel}Username pengawas wajib diisi.`);
  if (!/^[a-z0-9._-]{3,40}$/.test(text)) throw new Error(`${rowLabel}Username hanya boleh huruf kecil, angka, titik, underscore, atau strip; minimal 3 karakter.`);
  return text;
}

function validatePassword(value: FormDataEntryValue | unknown, rowLabel = "") {
  const text = cell(value);
  if (text.length < 6) throw new Error(`${rowLabel}Password pengawas minimal 6 karakter.`);
  return text;
}

function normalizePhone(value: FormDataEntryValue | unknown) {
  const text = cell(value);
  if (!text) return null;
  return text.replace(/[^0-9+]/g, "").slice(0, 20) || null;
}

function normalizeName(value: FormDataEntryValue | unknown, fallbackUsername: string, rowLabel = "") {
  const text = cell(value);
  if (text) return text;
  // Nama dibuat otomatis jika kolom nama kosong agar akun tetap punya identitas tampilan.
  return `Pengawas ${fallbackUsername.toUpperCase()}`;
}

async function ensureSupervisorRole() {
  return db.role.upsert({
    where: { code: "EXAM_SUPERVISOR" },
    update: { name: "Pengawas Ujian" },
    create: { code: "EXAM_SUPERVISOR", name: "Pengawas Ujian" },
  });
}

async function parseWorkbook(file: File) {
  if (!file || !file.name) throw new Error("Pilih file Excel pengawas terlebih dahulu.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran file maksimum 8 MB.");
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Format file harus .xlsx atau .xls.");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Workbook tidak memiliki sheet.");
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils
    .sheet_to_json<SheetRow>(sheet, { defval: "", raw: false })
    .map(normalizedRow)
    .filter((row) => Object.values(row).some((value) => cell(value)));
}

async function createSupervisor(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const role = await ensureSupervisorRole();
  const username = normalizeUsername(formData.get("username"));
  const password = validatePassword(formData.get("password"));
  const name = normalizeName(formData.get("name"), username);
  const phone = normalizePhone(formData.get("phone"));
  const email = `${username}@pengawas.local`;

  await db.user.upsert({
    where: { email },
    update: {
      name,
      phone,
      passwordHash: hashPassword(password),
      isActive: true,
    },
    create: {
      email,
      name,
      phone,
      passwordHash: hashPassword(password),
      isActive: true,
      roles: { create: { roleId: role.id } },
    },
  });

  // Pastikan role tetap tersambung untuk user lama yang mungkin sudah ada tanpa role.
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  revalidatePath("/supervisors");
  revalidatePath("/exam-sessions");
  redirect(`/supervisors?createdUsername=${username}`);
}

async function importSupervisorsFromExcel(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("File Excel pengawas tidak ditemukan.");
  const rows = await parseWorkbook(file);
  if (!rows.length) throw new Error("File tidak berisi data pengawas.");
  const role = await ensureSupervisorRole();
  const parsed = rows.map((row, index) => {
    const rowLabel = `Baris ${index + 2}: `;
    const username = normalizeUsername(row.username || row.user || row.kode_pengawas, rowLabel);
    return {
      username,
      email: `${username}@pengawas.local`,
      password: validatePassword(row.password || row.pass, rowLabel),
      name: normalizeName(row.nama || row.name, username, rowLabel),
      phone: normalizePhone(row.no_hp || row.nomor_hp || row.hp || row.phone),
    };
  });

  await db.$transaction(async (tx: any) => {
    for (const item of parsed) {
      const user = await tx.user.upsert({
        where: { email: item.email },
        update: {
          name: item.name,
          phone: item.phone,
          passwordHash: hashPassword(item.password),
          isActive: true,
        },
        create: {
          email: item.email,
          name: item.name,
          phone: item.phone,
          passwordHash: hashPassword(item.password),
          isActive: true,
        },
      });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }
  });
  revalidatePath("/supervisors");
  revalidatePath("/exam-sessions");
  redirect(`/supervisors?imported=${parsed.length}`);
}

async function resetSupervisorPassword(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const password = validatePassword(formData.get("password"));
  const user = await db.user.update({
    where: { id },
    data: {
      passwordHash: hashPassword(password),
      sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } },
    },
  });
  revalidatePath("/supervisors");
  redirect(`/supervisors?resetUsername=${supervisorUsername(user.email)}`);
}

async function toggleSupervisorStatus(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  await db.user.update({
    where: { id },
    data: isActive
      ? { isActive }
      : { isActive, sessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } } },
  });
  revalidatePath("/supervisors");
  revalidatePath("/monitoring");
}

type PageProps = { searchParams?: Promise<{ createdUsername?: string; imported?: string; resetUsername?: string }> };

export default async function SupervisorsPage({ searchParams }: PageProps) {
  await requirePageUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const params = await searchParams;
  const supervisors = await db.user.findMany({
    where: { roles: { some: { role: { code: "EXAM_SUPERVISOR" } } } },
    orderBy: { createdAt: "desc" },
    include: {
      supervisorAssignments: {
        include: { examPackage: true, examSession: { include: { room: true, participant: true, examPackage: true } }, room: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <AdminShell title="Pengawas" subtitle="Kelola akun pengawas manual atau upload Excel" allowedRoles={["EXAM_ADMIN", "SUPER_ADMIN"]}>
      <div className="page-header">
        <div>
          <p className="eyebrow">Operasional Ujian</p>
          <h2>Pengelolaan pengawas</h2>
          <p>Pengawas dibuat manual melalui form atau Excel. Nama bisa diisi sebagai identitas tampilan, sedangkan nomor HP bersifat opsional.</p>
        </div>
        <span className="badge">{supervisors.length} pengawas</span>
      </div>

      {params?.createdUsername ? (
        <section className="card panel credential-alert"><ShieldCheck size={24} /><div><strong>Akun pengawas berhasil disimpan</strong><p>Username: <b>{params.createdUsername}</b></p><span className="muted-text">Password mengikuti input yang Anda masukkan pada form.</span></div></section>
      ) : null}
      {params?.imported ? (
        <section className="card panel credential-alert"><FileSpreadsheet size={24} /><div><strong>Import pengawas berhasil</strong><p>{params.imported} akun pengawas berhasil dibuat/diperbarui.</p></div></section>
      ) : null}
      {params?.resetUsername ? (
        <section className="card panel credential-alert warning"><KeyRound size={24} /><div><strong>Password pengawas berhasil diubah</strong><p>Username: <b>{params.resetUsername}</b></p></div></section>
      ) : null}

      <section className="participant-admin-grid">
        <form action={createSupervisor} className="card panel form-grid">
          <div className="panel-heading"><h3><UserPlus size={18} /> Tambah pengawas manual</h3></div>
          <label className="field-block"><span className="field-label">Username</span><input className="text-input" name="username" placeholder="pengawas_ruang_1" autoComplete="off" required /></label>
          <label className="field-block"><span className="field-label">Password</span><input className="text-input" name="password" type="text" placeholder="Minimal 6 karakter" required /></label>
          <label className="field-block"><span className="field-label">Nama pengawas</span><input className="text-input" name="name" placeholder="Opsional, jika kosong akan dibuat dari username" /></label>
          <label className="field-block"><span className="field-label">No HP</span><input className="text-input" name="phone" inputMode="tel" placeholder="Opsional" /></label>
          <button className="primary-button" type="submit"><UserCog size={16} /> Simpan pengawas</button>
        </form>

        <form action={importSupervisorsFromExcel} className="card panel form-grid">
          <div className="panel-heading"><h3><FileSpreadsheet size={18} /> Upload pengawas via Excel</h3></div>
          <p className="muted-text">Kolom template: <strong>username, password, nama, no_hp</strong>. Kolom <strong>nama</strong> dan <strong>no_hp</strong> boleh kosong.</p>
          <a className="secondary-button download-template-link" href="/templates/template-pengawas.xlsx" download><Download size={16} /> Download template Excel</a>
          <label className="import-dropzone compact-dropzone"><FileSpreadsheet size={34} /><strong>Pilih file pengawas</strong><span>.xlsx atau .xls, maksimum 8 MB</span><input type="file" name="file" accept=".xlsx,.xls" required /></label>
          <button className="primary-button" type="submit">Upload dan proses pengawas</button>
        </form>
      </section>

      <section className="card panel data-table-wrap">
        <div className="panel-heading"><h3>Daftar pengawas aktif/nonaktif</h3><span className="badge">Role Pengawas Ujian</span></div>
        <table className="data-table">
          <thead><tr><th>Nama</th><th>Username Login</th><th>No HP</th><th>Sesi/Ruang ditugaskan</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {supervisors.map((supervisor) => (
              <tr key={supervisor.id}>
                <td><strong>{supervisor.name}</strong><br/><span className="muted-text">Login terakhir: {supervisor.lastLoginAt?.toLocaleString("id-ID") ?? "belum pernah"}</span></td>
                <td><span className="role-pill">{supervisorUsername(supervisor.email)}</span></td>
                <td>{supervisor.phone ? <span><Phone size={13} /> {supervisor.phone}</span> : <span className="muted-text">-</span>}</td>
                <td>
                  <div className="participant-package-chips">
                    {supervisor.supervisorAssignments.slice(0, 5).map((assignment: any) => (
                      <span className="role-pill" key={assignment.id}>{assignment.examSession ? `${assignment.examSession.room?.code ?? "Tanpa ruang"} · ${assignment.examSession.participant.name}` : assignment.room ? assignment.room.code : assignment.examPackage?.code ?? "-"}</span>
                    ))}
                    {!supervisor.supervisorAssignments.length ? <span className="muted-text">Belum ditugaskan</span> : null}
                  </div>
                </td>
                <td><span className={`badge ${supervisor.isActive ? "" : "warning"}`}>{supervisor.isActive ? "AKTIF" : "NONAKTIF"}</span></td>
                <td className="participant-settings-cell">
                  <form action={toggleSupervisorStatus}><input type="hidden" name="id" value={supervisor.id} /><input type="hidden" name="isActive" value={supervisor.isActive ? "false" : "true"} /><button className="secondary-button" type="submit"><Power size={15} /> {supervisor.isActive ? "Nonaktifkan" : "Aktifkan"}</button></form>
                  <details className="action-details"><summary className="secondary-button"><KeyRound size={15} /> Ubah password</summary><form action={resetSupervisorPassword} className="inline-edit-form form-grid"><input type="hidden" name="id" value={supervisor.id} /><label className="field-block"><span className="field-label">Password baru</span><input className="text-input" name="password" type="text" minLength={6} required /></label><button className="primary-button" type="submit">Simpan password</button></form></details>
                </td>
              </tr>
            ))}
            {!supervisors.length ? <tr><td colSpan={6}><p className="muted-text">Belum ada akun pengawas.</p></td></tr> : null}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
