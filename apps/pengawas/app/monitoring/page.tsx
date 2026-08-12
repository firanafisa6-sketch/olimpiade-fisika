import { PengawasShell } from "@/components/pengawas-shell";
import { SetupErrorPanel } from "@/components/setup-error-panel";
import { canAccess } from "@/lib/access";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { db } from "@seleksi/database";
import { revalidatePath } from "next/cache";
import { AlertTriangle, ImageOff, LogOut, Pause, Play, RotateCcw, ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

function requiredText(formData: FormData, key: string, label = key) {
  const text = String(formData.get(key) ?? "").trim();
  if (!text) throw new Error(`${label} wajib diisi.`);
  return text;
}

function statusBadgeClass(status: string) {
  return ["PAUSED", "WAITING", "EXPIRED", "TERMINATED"].includes(status) ? "warning" : "";
}

function displayWib(value: Date | null | undefined) {
  return value?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "-";
}

function toIsoKey(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function groupKey(session: any) {
  return `${session.roomId ?? "tanpa-ruang"}:${session.examPackageId}:${toIsoKey(session.startsAt)}:${toIsoKey(session.endsAt)}`;
}

function groupSessions(sessions: any[]) {
  const map = new Map<string, any>();
  for (const session of sessions) {
    const key = groupKey(session);
    const existing = map.get(key) ?? {
      key,
      room: session.room,
      examPackage: session.examPackage,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      sessions: [],
      supervisors: new Map<string, any>(),
    };
    existing.sessions.push(session);
    for (const assignment of session.supervisorAssignments ?? []) {
      existing.supervisors.set(assignment.supervisor.id, assignment.supervisor);
    }
    map.set(key, existing);
  }
  return Array.from(map.values());
}

async function assertSupervisorAllowed(user: any, examSessionId: string) {
  if (canAccess(user.roles, ["EXAM_ADMIN", "SUPER_ADMIN"])) return;
  const allowed = await db.supervisorAssignment.findFirst({ where: { examSessionId, supervisorId: user.id } });
  if (!allowed) throw new Error("Pengawas tidak ditugaskan pada sesi/ruang ini.");
}

async function setGroupSessionStatus(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]);
  const sessionIds = Array.from(new Set(formData.getAll("examSessionIds").map(String).filter(Boolean)));
  if (!sessionIds.length) throw new Error("Tidak ada sesi peserta yang dipilih.");
  const action = requiredText(formData, "action", "Aksi");
  const status = action === "PAUSE" ? "PAUSED" : "ACTIVE";

  if (!canAccess(user.roles, ["EXAM_ADMIN", "SUPER_ADMIN"])) {
    const allowedCount = await db.examSession.count({ where: { id: { in: sessionIds }, supervisorAssignments: { some: { supervisorId: user.id } } } });
    if (allowedCount !== sessionIds.length) throw new Error("Pengawas tidak ditugaskan pada seluruh sesi/ruang ini.");
  }

  await db.$transaction(async (tx: any) => {
    await tx.examSession.updateMany({ where: { id: { in: sessionIds } }, data: { status } });
    if (status === "PAUSED") {
      await tx.attempt.updateMany({ where: { examSessionId: { in: sessionIds }, status: "ACTIVE" }, data: { status: "PAUSED" } });
    } else {
      await tx.attempt.updateMany({ where: { examSessionId: { in: sessionIds }, status: "PAUSED" }, data: { status: "ACTIVE" } });
    }
  });
  revalidatePath("/monitoring");
  revalidatePath("/print-reports");
}

async function setParticipantSessionStatus(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]);
  const examSessionId = requiredText(formData, "examSessionId", "Sesi peserta");
  const action = requiredText(formData, "action", "Aksi");
  const status = action === "PAUSE" ? "PAUSED" : "ACTIVE";
  await assertSupervisorAllowed(user, examSessionId);
  await db.$transaction(async (tx: any) => {
    await tx.examSession.update({ where: { id: examSessionId }, data: { status } });
    await tx.attempt.updateMany({ where: { examSessionId, status: status === "PAUSED" ? "ACTIVE" : "PAUSED" }, data: { status } });
  });
  revalidatePath("/monitoring");
}

async function resetParticipantLogin(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]);
  const participantId = requiredText(formData, "participantId", "Peserta");
  const examSessionId = requiredText(formData, "examSessionId", "Sesi peserta");
  await assertSupervisorAllowed(user, examSessionId);
  await db.participantSession.updateMany({ where: { participantId, revokedAt: null }, data: { revokedAt: new Date() } });
  await db.supervisorIncident.create({ data: { examSessionId, supervisorId: user.id, category: "RESET_LOGIN", note: "Reset login/perangkat peserta oleh pengawas." } });
  revalidatePath("/monitoring");
}

async function forceLogoutParticipant(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]);
  const participantId = requiredText(formData, "participantId", "Peserta");
  const examSessionId = requiredText(formData, "examSessionId", "Sesi peserta");
  await assertSupervisorAllowed(user, examSessionId);
  await db.participantSession.updateMany({ where: { participantId, revokedAt: null }, data: { revokedAt: new Date() } });
  await db.supervisorIncident.create({ data: { examSessionId, supervisorId: user.id, category: "FORCE_LOGOUT", note: "Force logout peserta dari perangkat aktif." } });
  revalidatePath("/monitoring");
}

async function addViolationNote(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]);
  const examSessionId = requiredText(formData, "examSessionId", "Sesi peserta");
  const note = requiredText(formData, "note", "Catatan pelanggaran");
  await assertSupervisorAllowed(user, examSessionId);
  const session = await db.examSession.findUnique({ where: { id: examSessionId }, include: { attempt: true } });
  if (!session) throw new Error("Sesi tidak ditemukan.");
  await db.$transaction(async (tx: any) => {
    await tx.supervisorIncident.create({ data: { examSessionId, supervisorId: user.id, category: "PELANGGARAN", note } });
    if (session.attempt) {
      await tx.examSecurityEvent.create({
        data: {
          attemptId: session.attempt.id,
          eventType: "PENGAWAS_NOTE",
          detail: { note, supervisor: user.name },
        },
      });
    }
  });
  revalidatePath("/monitoring");
  revalidatePath("/print-reports");
}


function readableDatabaseError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function safeLoadSessions(args: Parameters<typeof db.examSession.findMany>[0]) {
  try {
    const sessions = await db.examSession.findMany(args);
    return { sessions, error: null as unknown };
  } catch (error) {
    return { sessions: [] as any[], error };
  }
}

export default async function MonitoringPage() {
  const user = await requirePageUser(["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]);
  const isOperationalAdmin = canAccess(user.roles, ["EXAM_ADMIN", "SUPER_ADMIN"]);
  const { sessions, error } = await safeLoadSessions({
    where: isOperationalAdmin ? {} : { supervisorAssignments: { some: { supervisorId: user.id } } },
    orderBy: [{ startsAt: "desc" }],
    include: {
      examPackage: true,
      room: true,
      participant: true,
      supervisorAssignments: { include: { supervisor: true, room: true } },
      attempt: {
        include: {
          questionSnapshots: { select: { selectedLabel: true } },
          securityEvents: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      },
      incidents: { orderBy: { createdAt: "desc" }, take: 5, include: { supervisor: true } },
    },
  });

  if (error) {
    return (
      <PengawasShell
        title="Monitoring Ujian"
        subtitle="Sinkronisasi database diperlukan"
        allowedRoles={["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]}
      >
        <SetupErrorPanel errorMessage={readableDatabaseError(error)} />
      </PengawasShell>
    );
  }

  sessions.sort((a: any, b: any) => {
    const dateDiff = new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    if (dateDiff) return dateDiff;
    return String(a.room?.code ?? "").localeCompare(String(b.room?.code ?? "")) || String(a.participant?.name ?? "").localeCompare(String(b.participant?.name ?? ""));
  });

  const groups = groupSessions(sessions);
  const activeAttempts = sessions.filter((session) => session.attempt?.status === "ACTIVE").length;
  const totalIncidents = sessions.reduce((sum, session) => sum + session.incidents.length + (session.attempt?.securityEvents.length ?? 0), 0);

  return (
    <PengawasShell
      title="Monitoring Ujian"
      subtitle="Dashboard khusus pengawas untuk memantau sesi/ruang, login peserta, status pengerjaan, dan pelanggaran"
      allowedRoles={["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <p className="eyebrow">Operasional Ujian</p>
          <h2>Dashboard pengawas</h2>
          <p>Monitoring berbasis sesi dan ruang. Action tersedia: Play, Pause, Resume, Reset Login, Force Logout, dan Catatan Pelanggaran. Tidak ada Force Submit dan Tambah Waktu.</p>
        </div>
        <span className="badge">{sessions.length} peserta terjadwal</span>
      </div>

      <section className="metrics-grid monitoring-metrics">
        <div className="card metric-card"><div className="metric-value">{groups.length}</div><div className="metric-label">Sesi/ruang</div></div>
        <div className="card metric-card"><div className="metric-value">{sessions.length}</div><div className="metric-label">Peserta terjadwal</div></div>
        <div className="card metric-card"><div className="metric-value">{activeAttempts}</div><div className="metric-label">Sedang mengerjakan</div></div>
        <div className="card metric-card warning"><div className="metric-value">{totalIncidents}</div><div className="metric-label">Catatan/insiden</div></div>
      </section>

      <section className="monitoring-package-list">
        {groups.map((group) => {
          const statusCounts: Record<string, number> = group.sessions.reduce((acc: Record<string, number>, session: any) => {
            const status = session.attempt?.status ?? session.status;
            acc[status] = (acc[status] ?? 0) + 1;
            return acc;
          }, {});
          const supervisors = Array.from(group.supervisors.values());
          return (
            <article className="card panel monitoring-package-card" key={group.key}>
              <header className="monitoring-package-header">
                <div>
                  <span className="eyebrow">{group.room?.code ?? "TANPA-RUANG"} · {group.examPackage.code}</span>
                  <h3>{group.room?.name ?? "Belum ada ruang"}</h3>
                  <p className="muted-text">{group.examPackage.name} · {displayWib(group.startsAt)} — {displayWib(group.endsAt)} WIB · {group.sessions.length} peserta</p>
                  <p className="muted-text">Pengawas: {supervisors.map((item: any) => item.name).join(", ") || "Belum ditugaskan"}</p>
                </div>
                <div className="monitoring-session-actions">
                  <form action={setGroupSessionStatus}>{group.sessions.map((session: any) => <input key={session.id} type="hidden" name="examSessionIds" value={session.id} />)}<input type="hidden" name="action" value="PLAY" /><button className="primary-button" type="submit"><Play size={15} /> Play</button></form>
                  <form action={setGroupSessionStatus}>{group.sessions.map((session: any) => <input key={session.id} type="hidden" name="examSessionIds" value={session.id} />)}<input type="hidden" name="action" value="PAUSE" /><button className="secondary-button" type="submit"><Pause size={15} /> Pause</button></form>
                  <form action={setGroupSessionStatus}>{group.sessions.map((session: any) => <input key={session.id} type="hidden" name="examSessionIds" value={session.id} />)}<input type="hidden" name="action" value="RESUME" /><button className="secondary-button" type="submit"><Play size={15} /> Resume</button></form>
                </div>
              </header>
              <div className="monitoring-status-line">
                {Object.entries(statusCounts).map(([status, count]) => <span className={`badge ${statusBadgeClass(status)}`} key={status}>{status}: {count}</span>)}
                {!Object.keys(statusCounts).length ? <span className="muted-text">Belum ada peserta pada sesi/ruang ini.</span> : null}
              </div>
              <div className="data-table-wrap">
                <table className="data-table monitoring-table">
                  <thead><tr><th>No</th><th>Foto</th><th>Nama & NIK</th><th>Status</th><th>Jawaban</th><th>Pelanggaran</th><th>Action</th></tr></thead>
                  <tbody>
                    {group.sessions.map((session: any, index: number) => {
                      const snapshots = session.attempt?.questionSnapshots ?? [];
                      const answered = snapshots.filter((snapshot: any) => snapshot.selectedLabel).length;
                      const attemptStatus = session.attempt?.status ?? session.status;
                      const latestIncident = session.incidents[0];
                      return (
                        <tr key={session.id}>
                          <td>{index + 1}</td>
                          <td>{session.participant.photoUrl ? <img className="participant-photo" src={session.participant.photoUrl} alt={`Foto ${session.participant.name}`} /> : <span className="participant-avatar-placeholder"><ImageOff size={17} /></span>}</td>
                          <td><strong>{session.participant.name}</strong><br/><span className="muted-text">NIK: {session.participant.nik ?? "-"}</span><br/><span className="muted-text">@{session.participant.username}</span></td>
                          <td><span className={`badge ${statusBadgeClass(attemptStatus)}`}>{attemptStatus}</span><br/><span className="muted-text">Last save: {displayWib(session.attempt?.lastSavedAt)}</span></td>
                          <td><strong>{answered}/{snapshots.length || "-"}</strong><br/><span className="muted-text">Submit: {displayWib(session.attempt?.submittedAt)}</span></td>
                          <td><strong>{session.incidents.length + (session.attempt?.securityEvents.length ?? 0)}</strong><br/><span className="muted-text">{latestIncident ? latestIncident.note : "Belum ada catatan"}</span></td>
                          <td className="monitoring-actions-cell">
                            <form action={setParticipantSessionStatus}><input type="hidden" name="examSessionId" value={session.id} /><input type="hidden" name="action" value="PAUSE" /><button className="secondary-button compact-button" type="submit"><Pause size={14} /> Pause</button></form>
                            <form action={setParticipantSessionStatus}><input type="hidden" name="examSessionId" value={session.id} /><input type="hidden" name="action" value="RESUME" /><button className="secondary-button compact-button" type="submit"><Play size={14} /> Resume</button></form>
                            <form action={resetParticipantLogin}><input type="hidden" name="participantId" value={session.participantId} /><input type="hidden" name="examSessionId" value={session.id} /><button className="secondary-button compact-button" type="submit"><RotateCcw size={14} /> Reset Login</button></form>
                            <form action={forceLogoutParticipant}><input type="hidden" name="participantId" value={session.participantId} /><input type="hidden" name="examSessionId" value={session.id} /><button className="secondary-button compact-button" type="submit"><LogOut size={14} /> Force Logout</button></form>
                            <details className="action-details incident-details">
                              <summary className="secondary-button compact-button"><AlertTriangle size={14} /> Catatan</summary>
                              <form action={addViolationNote} className="inline-edit-form form-grid incident-form">
                                <input type="hidden" name="examSessionId" value={session.id} />
                                <label className="field-block"><span className="field-label">Catatan pelanggaran/kejadian</span><textarea className="text-area" name="note" rows={4} required placeholder="Contoh: peserta keluar fullscreen 2 kali" /></label>
                                <button className="primary-button" type="submit"><ScrollText size={15} /> Simpan catatan</button>
                              </form>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                    {!group.sessions.length ? <tr><td colSpan={7}><p className="muted-text">Belum ada peserta pada sesi/ruang ini.</p></td></tr> : null}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
        {!groups.length ? <section className="card panel"><p className="muted-text">Belum ada sesi/ruang yang dapat dimonitor.</p></section> : null}
      </section>
    </PengawasShell>
  );
}
