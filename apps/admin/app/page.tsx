import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { DashboardCard } from "@/components/dashboard-card";
import { AppLogo } from "@/components/app-logo";
import { ensureAllQuestionSlots } from "@/lib/db-helpers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@seleksi/database";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  PackageCheck,
  ShieldCheck,
  Sparkles
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureAllQuestionSlots();
  const user = await getCurrentUser();

  const [blueprints, questionSlots, filledQuestions, waitingReview, approvedQuestions, packages, writingAssignments] = await Promise.all([
    db.blueprint.count(),
    db.question.count(),
    db.question.count({ where: { currentVersionId: { not: null } } }),
    db.question.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW", "REVISION_REQUIRED"] } } }),
    db.question.count({ where: { status: "APPROVED" } }),
    db.examPackage.count(),
    db.questionWritingAssignment.count({ where: { status: { not: "CANCELLED" } } })
  ]);

  const latestQuestions = await db.question.findMany({
    where: { currentVersionId: { not: null } },
    take: 6,
    orderBy: { updatedAt: "desc" },
    include: {
      currentVersion: true,
      blueprint: { include: { currentVersion: true } },
      validationAssignments: { include: { assignedTo: true } }
    }
  });

  const completionPercent = questionSlots ? Math.round((filledQuestions / questionSlots) * 100) : 0;
  const approvalPercent = filledQuestions ? Math.round((approvedQuestions / filledQuestions) * 100) : 0;
  const dashboardAction = user?.roles.includes("SUPER_ADMIN") || user?.roles.includes("EXAM_ADMIN")
    ? { href: "/packages", label: "Kelola paket ujian" }
    : user?.roles.includes("BLUEPRINT_AUTHOR")
      ? { href: "/blueprints", label: "Kelola kisi-kisi" }
      : user?.roles.includes("QUESTION_VALIDATOR")
        ? { href: "/reviews", label: "Buka validasi soal" }
        : { href: "/questions", label: "Buka penulisan soal" };

  return (
    <AdminShell title="Dashboard" subtitle="Ringkasan pekerjaan kisi-kisi, penulisan, validasi, dan paket ujian">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="hero-kicker"><Sparkles size={16} /> Ruang kerja terintegrasi</span>
          <h2>Selamat datang, {user?.name ?? "Pengguna"}</h2>
          <p>Kelola alur pembuatan soal dari kisi-kisi hingga validasi melalui satu dashboard yang ringkas dan mudah dipantau.</p>
          <div className="dashboard-hero-actions">
            <Link className="primary-button" href={dashboardAction.href}>{dashboardAction.label} <ArrowRight size={16} /></Link>
            <Link className="hero-secondary-link" href="/workflow">Lihat alur kerja</Link>
          </div>
        </div>
        <div className="dashboard-hero-visual" aria-hidden="true">
          <div className="hero-logo-orbit"><AppLogo /></div>
          <div className="hero-floating-card hero-card-one"><ClipboardList size={18} /><span>{blueprints} kisi-kisi</span></div>
          <div className="hero-floating-card hero-card-two"><CheckCircle2 size={18} /><span>{approvedQuestions} disetujui</span></div>
        </div>
      </section>

      <section className="metrics-grid five dashboard-metrics">
        <DashboardCard icon={ClipboardList} value={String(blueprints)} label="Kisi-kisi aktif" />
        <DashboardCard icon={ClipboardCheck} value={String(writingAssignments)} label="Plotting penulis" tone="accent" />
        <DashboardCard icon={FileQuestion} value={`${filledQuestions}/${questionSlots}`} label="Slot soal terisi" />
        <DashboardCard icon={ShieldCheck} value={String(waitingReview)} label="Menunggu validasi" tone="warning" />
        <DashboardCard icon={PackageCheck} value={String(packages)} label="Paket ujian" tone="accent" />
      </section>

      <section className="dashboard-main-grid">
        <article className="card panel dashboard-activity-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Aktivitas terbaru</p><h3>Soal yang baru dikerjakan</h3></div>
            <Link className="text-link" href="/questions">Lihat semua <ArrowRight size={15} /></Link>
          </div>
          <div className="activity-list dashboard-activity-list">
            {latestQuestions.length ? latestQuestions.map((item) => (
              <div className="activity-row dashboard-activity-row" key={item.id}>
                <span className={`activity-status-icon ${item.status === "APPROVED" ? "is-approved" : ""}`}><FileQuestion size={16} /></span>
                <div>
                  <div className="activity-title-line"><strong>{item.code}</strong><span className={`badge ${item.status === "APPROVED" ? "" : "warning"}`}>{item.status.replaceAll("_", " ")}</span></div>
                  <div className="activity-question-preview" dangerouslySetInnerHTML={{ __html: item.currentVersion?.stemHtml ?? "<em>Belum ada isi</em>" }} />
                  <div className="muted-text">Kisi-kisi {item.blueprint.code} • Validator {item.validationAssignments.length ? item.validationAssignments.map((task) => task.assignedTo.name).join(", ") : "belum diplot"}</div>
                </div>
                <span className="activity-time">{item.updatedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
              </div>
            )) : <div className="empty-state"><p>Belum ada soal yang dikerjakan.</p><span>Mulai dengan membuat kisi-kisi dan plotting penulis.</span></div>}
          </div>
        </article>

        <aside className="dashboard-side-stack">
          <article className="card panel progress-card">
            <div className="panel-heading"><div><p className="eyebrow">Kemajuan konten</p><h3>Progres penulisan</h3></div><span className="progress-value">{completionPercent}%</span></div>
            <div className="large-progress"><span style={{ width: `${completionPercent}%` }} /></div>
            <div className="progress-breakdown"><span><strong>{filledQuestions}</strong> soal terisi</span><span><strong>{Math.max(0, questionSlots - filledQuestions)}</strong> slot kosong</span></div>
          </article>

          <article className="card panel progress-card">
            <div className="panel-heading"><div><p className="eyebrow">Kualitas soal</p><h3>Tingkat persetujuan</h3></div><span className="progress-value">{approvalPercent}%</span></div>
            <div className="large-progress approval"><span style={{ width: `${approvalPercent}%` }} /></div>
            <div className="progress-breakdown"><span><strong>{approvedQuestions}</strong> disetujui</span><span><strong>{waitingReview}</strong> perlu ditinjau</span></div>
          </article>

        </aside>
      </section>
    </AdminShell>
  );
}
