import Link from "next/link";
import { db } from "@seleksi/database";
import { ClipboardList, MonitorCheck, Printer, ShieldAlert, UsersRound } from "lucide-react";
import { PengawasShell } from "@/components/pengawas-shell";
import { SetupErrorPanel } from "@/components/setup-error-panel";
import { canAccess } from "@/lib/access";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    for (const assignment of session.supervisorAssignments ?? []) existing.supervisors.set(assignment.supervisor.id, assignment.supervisor);
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

export default async function DashboardPage() {
  const user = await requirePageUser(["EXAM_ADMIN", "EXAM_SUPERVISOR", "SUPER_ADMIN"]);
  const isOperationalAdmin = canAccess(user.roles, ["EXAM_ADMIN", "SUPER_ADMIN"]);

  const { sessions, error } = await safeLoadSessions({
    where: isOperationalAdmin ? {} : { supervisorAssignments: { some: { supervisorId: user.id } } },
    orderBy: [{ startsAt: "desc" }],
    include: {
      examPackage: true,
      room: true,
      participant: true,
      supervisorAssignments: { include: { supervisor: true } },
      attempt: { include: { securityEvents: true } },
      incidents: true,
    },
  });

  if (error) {
    return (
      <PengawasShell title="Dashboard Pengawas" subtitle="Sinkronisasi database diperlukan">
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
  const waitingSessions = sessions.filter((session) => (session.attempt?.status ?? session.status) === "WAITING").length;
  const submittedSessions = sessions.filter((session) => session.attempt?.status === "SUBMITTED").length;
  const incidentCount = sessions.reduce((sum, session) => sum + session.incidents.length + (session.attempt?.securityEvents.length ?? 0), 0);

  return (
    <PengawasShell title="Dashboard Pengawas" subtitle="Ringkasan sesi dan ruang ujian yang ditugaskan kepada pengawas">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="hero-kicker"><MonitorCheck size={16} /> Portal Pengawas</span>
          <h2>Selamat datang, {user.name}</h2>
          <p>Gunakan aplikasi ini untuk memulai/menjeda sesi, memantau peserta, reset login ketika peserta pindah perangkat, mencatat pelanggaran, serta mencetak berita acara dan laporan.</p>
          <div className="dashboard-hero-actions">
            <Link className="primary-button" href="/monitoring">Buka Monitoring <MonitorCheck size={16} /></Link>
            <Link className="hero-secondary-link" href="/print-reports">Cetak BA & Laporan</Link>
          </div>
        </div>
        <div className="dashboard-hero-visual" aria-hidden="true">
          <div className="hero-logo-orbit"><ShieldAlert size={48} /></div>
          <div className="hero-floating-card hero-card-one"><UsersRound size={18} /><span>{sessions.length} peserta</span></div>
          <div className="hero-floating-card hero-card-two"><ClipboardList size={18} /><span>{incidentCount} catatan</span></div>
        </div>
      </section>

      <section className="metrics-grid five dashboard-metrics">
        <div className="card metric-card"><div className="metric-value">{groups.length}</div><div className="metric-label">Sesi/ruang ditugaskan</div></div>
        <div className="card metric-card"><div className="metric-value">{sessions.length}</div><div className="metric-label">Peserta terjadwal</div></div>
        <div className="card metric-card warning"><div className="metric-value">{waitingSessions}</div><div className="metric-label">Menunggu mulai</div></div>
        <div className="card metric-card"><div className="metric-value">{activeAttempts}</div><div className="metric-label">Sedang mengerjakan</div></div>
        <div className="card metric-card"><div className="metric-value">{submittedSessions}</div><div className="metric-label">Sudah submit</div></div>
      </section>

      <section className="card panel data-table-wrap">
        <div className="panel-heading">
          <div><p className="eyebrow">Sesi Saya</p><h3>Daftar sesi/ruang yang dapat dimonitor</h3></div>
          <Link className="secondary-button" href="/monitoring"><MonitorCheck size={15} /> Monitoring</Link>
        </div>
        <table className="data-table">
          <thead><tr><th>Ruang</th><th>Paket</th><th>Waktu</th><th>Peserta</th><th>Pengawas</th><th>Aksi</th></tr></thead>
          <tbody>
            {groups.map((group) => {
              const supervisors = Array.from(group.supervisors.values());
              return (
                <tr key={group.key}>
                  <td><strong>{group.room?.code ?? "Tanpa ruang"}</strong><br/><span className="muted-text">{group.room?.name ?? "Belum ditetapkan"}</span></td>
                  <td><strong>{group.examPackage.code}</strong><br/><span className="muted-text">{group.examPackage.name}</span></td>
                  <td>{displayWib(group.startsAt)}<br/><span className="muted-text">s.d. {displayWib(group.endsAt)} WIB</span></td>
                  <td>{group.sessions.length} peserta</td>
                  <td>{supervisors.map((item: any) => item.name).join(", ") || "-"}</td>
                  <td className="monitoring-actions-cell"><Link className="primary-button compact-button" href="/monitoring"><MonitorCheck size={14} /> Pantau</Link><Link className="secondary-button compact-button" href="/print-reports"><Printer size={14} /> Cetak</Link></td>
                </tr>
              );
            })}
            {!groups.length ? <tr><td colSpan={6}><p className="muted-text">Belum ada sesi/ruang yang ditugaskan.</p></td></tr> : null}
          </tbody>
        </table>
      </section>
    </PengawasShell>
  );
}
