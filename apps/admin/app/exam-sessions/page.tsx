import { AdminShell } from "@/components/admin-shell";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import { Building2, CalendarPlus, DoorOpen, Power, Trash2, UserRoundCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function requiredText(formData: FormData, key: string, label = key) {
  const text = String(formData.get(key) ?? "").trim();
  if (!text) throw new Error(`${label} wajib diisi.`);
  return text;
}

function optionalText(formData: FormData, key: string) {
  const text = String(formData.get(key) ?? "").trim();
  return text || null;
}

function parseDate(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} wajib diisi.`);
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}:00+07:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} tidak valid.`);
  return date;
}

function parseCapacity(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number < 1) throw new Error("Kapasitas ruang harus angka positif.");
  return number;
}

function roomCode(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  if (!text) throw new Error("Kode ruang wajib diisi.");
  if (!/^[A-Z0-9._-]{2,30}$/.test(text)) throw new Error("Kode ruang hanya boleh huruf, angka, titik, underscore, atau strip.");
  return text;
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

function supervisorUsername(email: string) {
  return email.endsWith("@pengawas.local") ? email.replace("@pengawas.local", "") : email;
}

async function createRoom(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const code = roomCode(formData.get("code"));
  const name = requiredText(formData, "name", "Nama ruang");
  const location = optionalText(formData, "location");
  const capacity = parseCapacity(formData.get("capacity"));
  await db.examRoom.upsert({
    where: { code },
    update: { name, location, capacity, isActive: true },
    create: { code, name, location, capacity, isActive: true },
  });
  revalidatePath("/exam-sessions");
}

async function toggleRoomStatus(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id", "Ruang");
  const isActive = formData.get("isActive") === "true";
  await db.examRoom.update({ where: { id }, data: { isActive } });
  revalidatePath("/exam-sessions");
}

async function deleteRoom(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id", "Ruang");
  const count = await db.examSession.count({ where: { roomId: id } });
  if (count) throw new Error("Ruang yang sudah memiliki peserta terjadwal tidak dapat dihapus. Nonaktifkan saja jika tidak dipakai lagi.");
  await db.examRoom.delete({ where: { id } });
  revalidatePath("/exam-sessions");
}

async function scheduleSessions(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const examPackageId = requiredText(formData, "examPackageId", "Paket ujian");
  const roomId = requiredText(formData, "roomId", "Ruang ujian");
  const participantIds = Array.from(new Set(formData.getAll("participantIds").map(String).filter(Boolean)));
  if (!participantIds.length) throw new Error("Pilih minimal satu peserta.");
  const startsAt = parseDate(formData.get("startsAt"), "Waktu mulai");
  const endsAt = parseDate(formData.get("endsAt"), "Waktu selesai");
  if (endsAt <= startsAt) throw new Error("Waktu selesai harus setelah waktu mulai.");
  const supervisorIds = Array.from(new Set(formData.getAll("supervisorIds").map(String).filter(Boolean)));

  await db.$transaction(async (tx: any) => {
    for (const participantId of participantIds) {
      const session = await tx.examSession.upsert({
        where: { examPackageId_participantId: { examPackageId, participantId } },
        update: { roomId, startsAt, endsAt },
        create: { examPackageId, participantId, roomId, startsAt, endsAt, status: "WAITING" },
      });
      await tx.supervisorAssignment.deleteMany({
        where: {
          examSessionId: session.id,
          supervisorId: { notIn: supervisorIds.length ? supervisorIds : ["__none__"] },
        },
      });
      for (const supervisorId of supervisorIds) {
        await tx.supervisorAssignment.upsert({
          where: { supervisorId_examSessionId: { supervisorId, examSessionId: session.id } },
          update: { roomId, examPackageId: null, roomName: null },
          create: { supervisorId, examSessionId: session.id, roomId },
        });
      }
    }
  });
  revalidatePath("/exam-sessions");
  revalidatePath("/monitoring");
  revalidatePath("/print-reports");
}

async function deleteSession(formData: FormData) {
  "use server";
  await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const id = requiredText(formData, "id", "Sesi");
  const existing = await db.examSession.findUnique({ where: { id }, include: { attempt: true } });
  if (existing?.attempt) throw new Error("Sesi yang sudah memiliki attempt tidak dapat dihapus.");
  await db.examSession.delete({ where: { id } });
  revalidatePath("/exam-sessions");
  revalidatePath("/monitoring");
}

export default async function ExamSessionsPage() {
  await requirePageUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const [packages, participants, supervisors, rooms, sessions] = await Promise.all([
    db.examPackage.findMany({ orderBy: { createdAt: "desc" } }),
    db.participant.findMany({ where: { isActive: true, username: { not: null } }, orderBy: [{ name: "asc" }, { username: "asc" }] }),
    db.user.findMany({ where: { isActive: true, roles: { some: { role: { code: "EXAM_SUPERVISOR" } } } }, orderBy: { name: "asc" } }),
    db.examRoom.findMany({ orderBy: [{ isActive: "desc" }, { code: "asc" }] }),
    db.examSession.findMany({
      orderBy: [{ startsAt: "desc" }, { room: { code: "asc" } }, { participant: { name: "asc" } }],
      include: {
        examPackage: true,
        room: true,
        participant: true,
        attempt: true,
        supervisorAssignments: { include: { supervisor: true, room: true } },
      },
      take: 200,
    }),
  ]);

  const activeRooms = rooms.filter((room) => room.isActive);
  const now = new Date();
  const defaultStart = datetimeLocal(new Date(now.getTime() + 60 * 60 * 1000));
  const defaultEnd = datetimeLocal(new Date(now.getTime() + 3 * 60 * 60 * 1000));

  return (
    <AdminShell title="Sesi Ujian & Ruang" subtitle="Plot peserta ke sesi ujian, ruang, dan pengawas" allowedRoles={["EXAM_ADMIN", "SUPER_ADMIN"]}>
      <div className="page-header">
        <div>
          <p className="eyebrow">Operasional Ujian</p>
          <h2>Penjadwalan sesi dan ruang ujian</h2>
          <p>Paket tetap berfungsi sebagai sumber soal. Plotting peserta dilakukan pada sesi peserta, ruang ujian, waktu pelaksanaan, dan pengawas yang bertugas.</p>
        </div>
        <span className="badge">{sessions.length} sesi terbaru</span>
      </div>

      <section className="session-admin-grid">
        <form action={scheduleSessions} className="card panel form-grid">
          <div className="panel-heading"><h3><CalendarPlus size={18} /> Plot peserta ke sesi & ruang</h3></div>
          <label className="field-block"><span className="field-label">Paket ujian / sumber soal</span><select className="select-input" name="examPackageId" required>{packages.map((pack) => <option key={pack.id} value={pack.id}>{pack.code} — {pack.name}</option>)}</select></label>
          <label className="field-block"><span className="field-label">Ruang ujian</span><select className="select-input" name="roomId" required>{activeRooms.map((room) => <option key={room.id} value={room.id}>{room.code} — {room.name}{room.capacity ? ` · ${room.capacity} kursi` : ""}</option>)}</select></label>
          {!activeRooms.length ? <p className="form-alert warning">Belum ada ruang aktif. Tambahkan ruang ujian terlebih dahulu.</p> : null}
          <div className="two-columns">
            <label className="field-block"><span className="field-label">Mulai</span><input className="text-input" type="datetime-local" name="startsAt" defaultValue={defaultStart} required /></label>
            <label className="field-block"><span className="field-label">Selesai</span><input className="text-input" type="datetime-local" name="endsAt" defaultValue={defaultEnd} required /></label>
          </div>
          <div className="field-block">
            <span className="field-label">Peserta</span>
            <div className="participant-check-grid compact-check-grid">
              {participants.map((participant) => <label className="participant-check-card" key={participant.id}><input type="checkbox" name="participantIds" value={participant.id} /><span><strong>{participant.name}</strong><small>@{participant.username} · NIK {participant.nik ?? "-"}</small></span></label>)}
              {!participants.length ? <p className="muted-text">Belum ada peserta aktif.</p> : null}
            </div>
          </div>
          <div className="field-block">
            <span className="field-label">Pengawas sesi/ruang</span>
            <div className="checkbox-card-grid">
              {supervisors.map((supervisor) => <label className="check-row card-check" key={supervisor.id}><input type="checkbox" name="supervisorIds" value={supervisor.id} /> {supervisor.name} · {supervisorUsername(supervisor.email)}</label>)}
              {!supervisors.length ? <p className="muted-text">Belum ada pengawas aktif. Tambahkan dari menu Pengawas.</p> : null}
            </div>
          </div>
          <button className="primary-button" type="submit" disabled={!activeRooms.length}><UserRoundCheck size={16} /> Simpan plotting sesi</button>
        </form>

        <section className="card panel form-grid">
          <div className="panel-heading"><h3><DoorOpen size={18} /> Ruang ujian</h3></div>
          <form action={createRoom} className="inline-edit-form form-grid">
            <div className="two-columns"><label className="field-block"><span className="field-label">Kode ruang</span><input className="text-input" name="code" placeholder="R-01" required /></label><label className="field-block"><span className="field-label">Nama ruang</span><input className="text-input" name="name" placeholder="Lab Komputer 1" required /></label></div>
            <div className="two-columns"><label className="field-block"><span className="field-label">Lokasi</span><input className="text-input" name="location" placeholder="Gedung A lantai 2" /></label><label className="field-block"><span className="field-label">Kapasitas</span><input className="text-input" name="capacity" inputMode="numeric" placeholder="30" /></label></div>
            <button className="primary-button" type="submit"><Building2 size={16} /> Simpan ruang</button>
          </form>
          <div className="room-list-mini">
            {rooms.map((room) => (
              <div className="room-mini-card" key={room.id}>
                <div><strong>{room.code} — {room.name}</strong><br/><span className="muted-text">{room.location ?? "Tanpa lokasi"}{room.capacity ? ` · ${room.capacity} kursi` : ""}</span></div>
                <div className="monitoring-actions-cell">
                  <form action={toggleRoomStatus}><input type="hidden" name="id" value={room.id} /><input type="hidden" name="isActive" value={room.isActive ? "false" : "true"} /><button className="secondary-button compact-button" type="submit"><Power size={14} /> {room.isActive ? "Nonaktif" : "Aktif"}</button></form>
                  <form action={deleteRoom}><input type="hidden" name="id" value={room.id} /><button className="danger-button compact-button" type="submit"><Trash2 size={14} /> Hapus</button></form>
                </div>
              </div>
            ))}
            {!rooms.length ? <p className="muted-text">Belum ada ruang ujian.</p> : null}
          </div>
        </section>
      </section>

      <section className="card panel data-table-wrap participant-table-section">
        <div className="panel-heading"><h3>Daftar sesi ujian</h3><span className="badge">200 terbaru</span></div>
        <table className="data-table">
          <thead><tr><th>Paket</th><th>Ruang</th><th>Peserta</th><th>Waktu</th><th>Pengawas</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td><strong>{session.examPackage.code}</strong><br/><span className="muted-text">{session.examPackage.name}</span></td>
                <td><strong>{session.room?.code ?? "Tanpa ruang"}</strong><br/><span className="muted-text">{session.room?.name ?? "Belum ditetapkan"}</span></td>
                <td><strong>{session.participant.name}</strong><br/><span className="muted-text">@{session.participant.username} · NIK {session.participant.nik ?? "-"}</span></td>
                <td>{displayWib(session.startsAt)}<br/><span className="muted-text">s.d. {displayWib(session.endsAt)} WIB</span></td>
                <td><div className="participant-package-chips">{session.supervisorAssignments.map((assignment) => <span className="role-pill" key={assignment.id}>{assignment.supervisor.name}</span>)}{!session.supervisorAssignments.length ? <span className="muted-text">Belum ada</span> : null}</div></td>
                <td><span className={`badge ${session.status === "PAUSED" || session.status === "WAITING" ? "warning" : ""}`}>{session.status}</span><br/><span className="muted-text">Attempt: {session.attempt?.status ?? "belum"}</span></td>
                <td><form action={deleteSession}><input type="hidden" name="id" value={session.id} /><button className="danger-button" type="submit" disabled={Boolean(session.attempt)}><Trash2 size={15} /> Hapus</button></form></td>
              </tr>
            ))}
            {!sessions.length ? <tr><td colSpan={7}><p className="muted-text">Belum ada sesi ujian.</p></td></tr> : null}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
