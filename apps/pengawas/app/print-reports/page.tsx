import { PengawasShell } from "@/components/pengawas-shell";
import { SetupErrorPanel } from "@/components/setup-error-panel";
import { PrintButton } from "@/components/print-button";
import { canAccess } from "@/lib/access";
import { requirePageUser } from "@/lib/auth";
import { db } from "@seleksi/database";
import { FileText, ImageOff, ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

function displayWib(value: Date | null | undefined) {
  return value?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "-";
}

function todayWib() {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(new Date());
}

function supervisorUsername(email: string) {
  return email.endsWith("@pengawas.local") ? email.replace("@pengawas.local", "") : email;
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

export default async function PrintReportsPage() {
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
      attempt: { include: { questionSnapshots: { select: { selectedLabel: true } }, securityEvents: true, score: true } },
      incidents: { orderBy: { createdAt: "asc" }, include: { supervisor: true } },
    },
  });

  if (error) {
    return (
      <PengawasShell
        title="Cetak Berita Acara & Laporan"
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

  return (
    <PengawasShell
      title="Cetak Berita Acara & Laporan"
      subtitle="Cetak dokumen pelaksanaan ujian per sesi dan ruang dengan tanda tangan pengawas"
      allowedRoles={["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]}
    >
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">Operasional Ujian</p>
          <h2>Menu cetak</h2>
          <p>Pilih tombol cetak pada sesi/ruang yang ingin dibuatkan Berita Acara dan Laporan Monitoring.</p>
        </div>
        <PrintButton label="Cetak halaman ini" />
      </div>

      <section className="print-report-list">
        {groups.map((group) => {
          const supervisors = Array.from(group.supervisors.values());
          const total = group.sessions.length;
          const started = group.sessions.filter((session: any) => Boolean(session.attempt?.startedAt)).length;
          const submitted = group.sessions.filter((session: any) => session.attempt?.status === "SUBMITTED").length;
          const expired = group.sessions.filter((session: any) => ["EXPIRED", "TERMINATED"].includes(session.attempt?.status ?? "")).length;
          const incidentCount = group.sessions.reduce((sum: number, session: any) => sum + session.incidents.length + (session.attempt?.securityEvents.length ?? 0), 0);
          return (
            <article className="card panel printable-report" key={group.key}>
              <header className="report-toolbar no-print">
                <div>
                  <h3>{group.room?.code ?? "Tanpa Ruang"} — {group.examPackage.name}</h3>
                  <p className="muted-text">Cetak Berita Acara dan Laporan Monitoring untuk sesi/ruang ini.</p>
                </div>
                <PrintButton label="Cetak dokumen" />
              </header>

              <section className="report-document report-break-after">
                <div className="report-title-block">
                  <FileText size={28} />
                  <div>
                    <h1>BERITA ACARA PELAKSANAAN UJIAN</h1>
                    <p>Olimpiade Fisika · {todayWib()}</p>
                  </div>
                </div>
                <table className="report-meta-table">
                  <tbody>
                    <tr><th>Kode Paket</th><td>{group.examPackage.code}</td><th>Nama Paket</th><td>{group.examPackage.name}</td></tr>
                    <tr><th>Ruang</th><td>{group.room ? `${group.room.code} — ${group.room.name}` : "Tanpa ruang"}</td><th>Lokasi</th><td>{group.room?.location ?? "-"}</td></tr>
                    <tr><th>Waktu</th><td>{displayWib(group.startsAt)} s.d. {displayWib(group.endsAt)} WIB</td><th>Durasi Paket</th><td>{group.examPackage.durationMinutes} menit</td></tr>
                    <tr><th>Pengawas</th><td colSpan={3}>{supervisors.map((item: any) => `${item.name} (${supervisorUsername(item.email)})`).join(", ") || "-"}</td></tr>
                  </tbody>
                </table>
                <div className="report-summary-grid">
                  <span><strong>{total}</strong> Peserta terjadwal</span>
                  <span><strong>{started}</strong> Peserta login/mulai</span>
                  <span><strong>{submitted}</strong> Submit</span>
                  <span><strong>{expired}</strong> Expired/Terminate</span>
                  <span><strong>{incidentCount}</strong> Catatan/insiden</span>
                </div>
                <p className="report-paragraph">Berita acara ini dibuat sebagai dokumen pelaksanaan ujian berbasis sistem. Jawaban peserta disimpan otomatis oleh sistem setiap kali peserta memilih jawaban, sehingga pergantian perangkat tidak menghapus jawaban yang telah tersimpan.</p>
                <div className="signature-grid">
                  {supervisors.length ? supervisors.map((supervisor: any) => (
                    <div className="signature-box" key={supervisor.id}>
                      <span>Pengawas</span>
                      <div className="signature-space">TTD</div>
                      <strong>{supervisor.name}</strong>
                      <small>{supervisorUsername(supervisor.email)}</small>
                    </div>
                  )) : <div className="signature-box"><span>Pengawas</span><div className="signature-space">TTD</div><strong>................................</strong><small>Nama pengawas</small></div>}
                </div>
              </section>

              <section className="report-document">
                <div className="report-title-block">
                  <ScrollText size={28} />
                  <div>
                    <h1>LAPORAN MONITORING UJIAN</h1>
                    <p>{group.room?.code ?? "Tanpa ruang"} · {group.examPackage.code} — {group.examPackage.name}</p>
                  </div>
                </div>
                <table className="data-table report-table">
                  <thead><tr><th>No</th><th>Foto</th><th>Nama</th><th>NIK</th><th>Status</th><th>Jawaban</th><th>Catatan</th></tr></thead>
                  <tbody>
                    {group.sessions.map((session: any, index: number) => {
                      const snapshots = session.attempt?.questionSnapshots ?? [];
                      const answered = snapshots.filter((snapshot: any) => snapshot.selectedLabel).length;
                      const notes = session.incidents.map((incident: any) => `${displayWib(incident.createdAt)} — ${incident.note}`).join("; ");
                      return (
                        <tr key={session.id}>
                          <td>{index + 1}</td>
                          <td>{session.participant.photoUrl ? <img className="participant-photo" src={session.participant.photoUrl} alt={`Foto ${session.participant.name}`} /> : <span className="participant-avatar-placeholder"><ImageOff size={17} /></span>}</td>
                          <td>{session.participant.name}<br/><span className="muted-text">@{session.participant.username}</span></td>
                          <td>{session.participant.nik ?? "-"}</td>
                          <td>{session.attempt?.status ?? session.status}</td>
                          <td>{answered}/{snapshots.length || "-"}</td>
                          <td>{notes || "-"}</td>
                        </tr>
                      );
                    })}
                    {!group.sessions.length ? <tr><td colSpan={7}>Belum ada peserta.</td></tr> : null}
                  </tbody>
                </table>
                <div className="signature-grid report-signature-bottom">
                  {supervisors.length ? supervisors.map((supervisor: any) => (
                    <div className="signature-box" key={supervisor.id}>
                      <span>TTD Pengawas</span>
                      <div className="signature-space">TTD</div>
                      <strong>{supervisor.name}</strong>
                    </div>
                  )) : <div className="signature-box"><span>TTD Pengawas</span><div className="signature-space">TTD</div><strong>................................</strong></div>}
                </div>
              </section>
            </article>
          );
        })}
        {!groups.length ? <section className="card panel"><p className="muted-text">Belum ada sesi/ruang yang dapat dicetak.</p></section> : null}
      </section>
    </PengawasShell>
  );
}
