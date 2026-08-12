import { AdminShell } from "@/components/admin-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { hashParticipantPassword } from "@/lib/participant-password";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import { Download, FileSpreadsheet, ImageOff, KeyRound, UserPlus } from "lucide-react";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
type SheetRow = Record<string, unknown>;

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizedRow(row: SheetRow) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim().toLowerCase().replace(/[\s-]+/g, "_"),
      value,
    ]),
  ) as SheetRow;
}

function normalizeUsername(value: FormDataEntryValue | unknown, rowLabel = "") {
  const username = String(value ?? "").trim().toLowerCase();
  if (!username) throw new Error(`${rowLabel}Nomor peserta/username wajib diisi.`);
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new Error(`${rowLabel}Nomor peserta hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.`);
  }
  return username;
}

function validateBirthPassword(value: unknown, rowLabel = "") {
  const raw = cell(value);
  const digitsOnly = raw.replace(/\D/g, "");
  const digits = digitsOnly.length === 7 ? digitsOnly.padStart(8, "0") : digitsOnly;
  if (!/^\d{8}$/.test(digits)) throw new Error(`${rowLabel}Tanggal lahir/password wajib format DDMMYYYY.`);
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
    throw new Error(`${rowLabel}Tanggal lahir/password tidak valid. Gunakan DDMMYYYY.`);
  }
  return digits;
}

function optionalText(value: FormDataEntryValue | unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNik(value: FormDataEntryValue | unknown, rowLabel = "") {
  const text = optionalText(value);
  if (!text) return null;
  if (!/^\d{16}$/.test(text)) throw new Error(`${rowLabel}NIK harus 16 digit angka.`);
  return text;
}

async function parseWorkbook(file: File) {
  if (!file || !file.name) throw new Error("Pilih file Excel peserta terlebih dahulu.");
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

async function createParticipant(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const username = normalizeUsername(formData.get("username"));
  const name = String(formData.get("name") ?? "").trim();
  const password = validateBirthPassword(formData.get("birthPassword"));
  const nik = normalizeNik(formData.get("nik"));
  const photoUrl = optionalText(formData.get("photoUrl"));
  if (!name) throw new Error("Nama peserta wajib diisi.");

  await db.participant.create({
    data: {
      username,
      externalId: username,
      name,
      nik,
      photoUrl,
      passwordHash: hashParticipantPassword(password),
      isActive: true,
    },
  });
  revalidatePath("/participants");
  revalidatePath("/packages");
  revalidatePath("/exam-sessions");
}

async function importParticipantsFromExcel(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("File Excel peserta tidak ditemukan.");
  const rows = await parseWorkbook(file);
  if (!rows.length) throw new Error("File tidak berisi data peserta.");

  const parsed = rows.map((row, index) => {
    const rowLabel = `Baris ${index + 2}: `;
    const username = normalizeUsername(row.username || row.nomor_peserta || row.no_peserta, rowLabel);
    const password = validateBirthPassword(row.tanggallahir || row.tanggal_lahir || row.password, rowLabel);
    const name = cell(row.nama || row.name);
    if (!name) throw new Error(`${rowLabel}nama wajib diisi.`);
    return {
      username,
      password,
      name,
      photoUrl: optionalText(row.link_foto || row.foto || row.photo_url),
      nik: normalizeNik(row.nik, rowLabel),
    };
  });

  await db.$transaction(
    parsed.map((item) =>
      db.participant.upsert({
        where: { username: item.username },
        update: {
          name: item.name,
          nik: item.nik,
          photoUrl: item.photoUrl,
          passwordHash: hashParticipantPassword(item.password),
          isActive: true,
        },
        create: {
          username: item.username,
          externalId: item.username,
          name: item.name,
          nik: item.nik,
          photoUrl: item.photoUrl,
          passwordHash: hashParticipantPassword(item.password),
          isActive: true,
        },
      }),
    ),
  );
  revalidatePath("/participants");
  revalidatePath("/packages");
  revalidatePath("/exam-sessions");
}

async function resetPassword(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const password = validateBirthPassword(formData.get("password"));
  await db.participant.update({
    where: { id },
    data: {
      passwordHash: hashParticipantPassword(password),
      authSessions: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } },
    },
  });
  revalidatePath("/participants");
}

async function updateParticipant(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const nik = normalizeNik(formData.get("nik"));
  const photoUrl = optionalText(formData.get("photoUrl"));
  const isActive = formData.get("isActive") === "on";
  if (!name) throw new Error("Nama peserta wajib diisi.");
  await db.participant.update({ where: { id }, data: { name, nik, photoUrl, isActive } });
  revalidatePath("/participants");
  revalidatePath("/packages");
  revalidatePath("/exam-sessions");
}

type PageProps = { searchParams?: Promise<{ page?: string; size?: string }> };

export default async function ParticipantsPage({ searchParams }: PageProps) {
  await requirePageUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const params = await searchParams;
  const totalParticipants = await db.participant.count();
  const pagination = paginationWindow(totalParticipants, parsePage(params?.page), parsePageSize(params?.size));
  const participants = await db.participant.findMany({
    orderBy: [{ createdAt: "desc" }, { username: "desc" }],
    skip: pagination.skip,
    ...(pagination.take ? { take: pagination.take } : {}),
    include: {
      sessions: {
        include: { examPackage: true, attempt: { include: { _count: { select: { securityEvents: true } } } }, room: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <AdminShell
      title="Peserta Ujian"
      subtitle="Kelola nomor peserta, password tanggal lahir, NIK, dan foto peserta"
      allowedRoles={["EXAM_ADMIN", "SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <p className="eyebrow">Operasional Ujian</p>
          <h2>Akun peserta ujian</h2>
          <p>Username memakai nomor peserta. Password awal memakai tanggal lahir format DDMMYYYY.</p>
        </div>
        <span className="badge">{totalParticipants} peserta</span>
      </div>

      <section className="participant-admin-grid">
        <form action={createParticipant} className="card panel form-grid">
          <div className="panel-heading"><h3><UserPlus size={18} /> Tambah satu peserta</h3></div>
          <label className="field-block"><span className="field-label">Username / Nomor peserta</span><input className="text-input" name="username" placeholder="202600123" autoComplete="off" required /></label>
          <label className="field-block"><span className="field-label">Password / Tanggal lahir</span><input className="text-input" name="birthPassword" placeholder="DDMMYYYY" inputMode="numeric" pattern="\d{8}" required /></label>
          <label className="field-block"><span className="field-label">Nama lengkap</span><input className="text-input" name="name" required /></label>
          <label className="field-block"><span className="field-label">NIK</span><input className="text-input" name="nik" inputMode="numeric" pattern="\d{16}" placeholder="16 digit" /></label>
          <label className="field-block"><span className="field-label">Link foto</span><input className="text-input" name="photoUrl" type="url" placeholder="https://..." /></label>
          <button className="primary-button" type="submit">Simpan peserta</button>
        </form>

        <form action={importParticipantsFromExcel} className="card panel form-grid">
          <div className="panel-heading"><h3><FileSpreadsheet size={18} /> Upload peserta via Excel</h3></div>
          <p className="muted-text">Kolom template: <strong>username, tanggallahir, nama, link_foto, nik</strong>. Username yang sudah ada akan diperbarui.</p>
          <a className="secondary-button download-template-link" href="/templates/template-peserta-ujian.xlsx" download><Download size={16} /> Download template Excel</a>
          <label className="import-dropzone compact-dropzone">
            <FileSpreadsheet size={34} />
            <strong>Pilih file peserta</strong>
            <span>.xlsx atau .xls, maksimum 8 MB</span>
            <input type="file" name="file" accept=".xlsx,.xls" required />
          </label>
          <button className="primary-button" type="submit">Upload dan proses peserta</button>
        </form>
      </section>

      <section className="card panel data-table-wrap participant-table-section">
        <div className="panel-heading"><h3>Daftar peserta</h3><span className="badge">Login di aplikasi :3001</span></div>
        <table className="data-table">
          <thead><tr><th>Foto</th><th>Username</th><th>Nama & NIK</th><th>Sesi/Ruang terplot</th><th>Status</th><th>Pengaturan</th></tr></thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant.id}>
                <td>
                  {participant.photoUrl ? <img className="participant-photo" src={participant.photoUrl} alt={`Foto ${participant.name}`} /> : <span className="participant-avatar-placeholder"><ImageOff size={17} /></span>}
                </td>
                <td><strong>@{participant.username ?? participant.externalId}</strong><br/><span className="muted-text">Login terakhir: {participant.lastLoginAt?.toLocaleString("id-ID") ?? "belum pernah"}</span></td>
                <td><strong>{participant.name}</strong><br/><span className="muted-text">NIK: {participant.nik ?? "-"}</span></td>
                <td>
                  <div className="participant-package-chips">
                    {participant.sessions.slice(0, 4).map((session) => <span className="role-pill" key={session.id}>{session.examPackage.code} · {session.room?.code ?? "Tanpa ruang"}{session.attempt ? ` · insiden ${session.attempt._count.securityEvents}` : ""}</span>)}
                    {!participant.sessions.length ? <span className="muted-text">Belum diplot</span> : null}
                  </div>
                </td>
                <td><span className={`badge ${participant.isActive ? "" : "warning"}`}>{participant.isActive ? "AKTIF" : "NONAKTIF"}</span></td>
                <td className="participant-settings-cell">
                  <details className="action-details">
                    <summary className="secondary-button">Edit</summary>
                    <form action={updateParticipant} className="inline-edit-form form-grid">
                      <input type="hidden" name="id" value={participant.id} />
                      <label className="field-block"><span className="field-label">Nama</span><input className="text-input" name="name" defaultValue={participant.name} required /></label>
                      <label className="field-block"><span className="field-label">NIK</span><input className="text-input" name="nik" defaultValue={participant.nik ?? ""} inputMode="numeric" pattern="\d{16}" /></label>
                      <label className="field-block"><span className="field-label">Link foto</span><input className="text-input" name="photoUrl" defaultValue={participant.photoUrl ?? ""} type="url" /></label>
                      <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={participant.isActive} /> Akun aktif</label>
                      <button className="primary-button" type="submit">Simpan</button>
                    </form>
                  </details>
                  <details className="action-details">
                    <summary className="secondary-button"><KeyRound size={15} /> Reset password</summary>
                    <form action={resetPassword} className="inline-edit-form form-grid">
                      <input type="hidden" name="id" value={participant.id} />
                      <label className="field-block"><span className="field-label">Password baru / DDMMYYYY</span><input className="text-input" name="password" inputMode="numeric" pattern="\d{8}" required /></label>
                      <button className="primary-button" type="submit">Reset dan keluarkan sesi login</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
            {!participants.length ? <tr><td colSpan={6}><p className="muted-text">Belum ada peserta.</p></td></tr> : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/participants"
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={totalParticipants}
          totalPages={pagination.totalPages}
          from={pagination.from}
          to={pagination.to}
          itemLabel="peserta"
        />
      </section>
    </AdminShell>
  );
}
