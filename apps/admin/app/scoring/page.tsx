import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AdminShell } from "@/components/admin-shell";
import { requireActionUser, requirePageUser } from "@/lib/auth";
import { db } from "@seleksi/database";
import {
  BadgeCheck,
  Calculator,
  CheckCircle2,
  Eye,
  EyeOff,
  FileLock2,
  History,
  LockKeyhole,
  Save,
  ShieldCheck,
  Sigma,
  UsersRound,
} from "lucide-react";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ packageId?: string }>;
};

type ScoreDisplayMode =
  | "HIDDEN_UNTIL_PUBLISHED"
  | "SHOW_AFTER_SUBMIT_FINAL"
  | "STATUS_ONLY";

const DEFAULT_POLICY = {
  correctScore: 4,
  wrongScore: -1,
  unansweredScore: 0,
  displayMode: "HIDDEN_UNTIL_PUBLISHED" as ScoreDisplayMode,
  isPublished: false,
  publishedAt: null as Date | null,
  lockedAt: null as Date | null,
};

const FINAL_STATUSES = ["SUBMITTED", "EXPIRED"] as const;

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readNumber(formData: FormData, name: string, label: string) {
  const raw = String(formData.get(name) ?? "").trim().replace(",", ".");
  if (!raw) throw new Error(`${label} wajib diisi.`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${label} harus berupa angka.`);
  return value;
}

function displayNumber(value: unknown, digits = 2) {
  return toNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function displayDate(value: Date | null | undefined) {
  return value?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "Belum ada";
}

function displayModeLabel(mode: string) {
  if (mode === "SHOW_AFTER_SUBMIT_FINAL") return "Skor langsung tampil sebagai nilai final otomatis";
  if (mode === "STATUS_ONLY") return "Peserta hanya melihat status selesai";
  return "Skor disembunyikan sampai hasil final dipublikasikan";
}

function canParticipantSeeScore(policy: typeof DEFAULT_POLICY | any) {
  if (policy.displayMode === "SHOW_AFTER_SUBMIT_FINAL") return true;
  if (policy.displayMode === "HIDDEN_UNTIL_PUBLISHED" && policy.isPublished) return true;
  return false;
}

async function recalculateScores(tx: any, examPackageId: string) {
  const policy = await tx.examScoringPolicy.findUnique({ where: { examPackageId } });
  const correctScore = toNumber(policy?.correctScore, DEFAULT_POLICY.correctScore);
  const wrongScore = toNumber(policy?.wrongScore, DEFAULT_POLICY.wrongScore);
  const unansweredScore = toNumber(policy?.unansweredScore, DEFAULT_POLICY.unansweredScore);

  const attempts = await tx.attempt.findMany({
    where: {
      status: { in: [...FINAL_STATUSES] },
      examSession: { examPackageId },
    },
    include: { questionSnapshots: true },
  });

  for (const attempt of attempts) {
    const correctCount = attempt.questionSnapshots.filter((item: any) => item.selectedLabel === item.answerKey).length;
    const unansweredCount = attempt.questionSnapshots.filter((item: any) => item.selectedLabel === null).length;
    const wrongCount = Math.max(0, attempt.questionSnapshots.length - correctCount - unansweredCount);
    const finalScore =
      correctCount * correctScore + wrongCount * wrongScore + unansweredCount * unansweredScore;

    await tx.score.upsert({
      where: { attemptId: attempt.id },
      update: { correctCount, wrongCount, unansweredCount, rawScore: finalScore, finalScore, calculatedAt: new Date() },
      create: { attemptId: attempt.id, correctCount, wrongCount, unansweredCount, rawScore: finalScore, finalScore },
    });
  }

  return attempts.length;
}

async function saveScoringPolicy(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const examPackageId = String(formData.get("examPackageId") ?? "").trim();
  if (!examPackageId) throw new Error("Paket ujian wajib dipilih.");

  const displayModeRaw = String(formData.get("displayMode") ?? DEFAULT_POLICY.displayMode);
  const displayMode: ScoreDisplayMode =
    displayModeRaw === "SHOW_AFTER_SUBMIT_FINAL" || displayModeRaw === "STATUS_ONLY"
      ? displayModeRaw
      : "HIDDEN_UNTIL_PUBLISHED";

  const correctScore = readNumber(formData, "correctScore", "Skor benar");
  const wrongScore = readNumber(formData, "wrongScore", "Skor salah");
  const unansweredScore = readNumber(formData, "unansweredScore", "Skor kosong");

  const existing = await db.examScoringPolicy.findUnique({ where: { examPackageId } });
  if (existing?.lockedAt) {
    throw new Error("Hasil sudah dikunci. Pengaturan skor tidak dapat diubah lagi.");
  }

  const submittedCount = await db.attempt.count({
    where: { status: { in: [...FINAL_STATUSES] }, examSession: { examPackageId } },
  });

  if (
    submittedCount > 0 &&
    ((existing?.displayMode ?? DEFAULT_POLICY.displayMode) === "SHOW_AFTER_SUBMIT_FINAL" ||
      displayMode === "SHOW_AFTER_SUBMIT_FINAL")
  ) {
    throw new Error(
      "Mode skor langsung tidak boleh diubah setelah ada peserta selesai, agar tidak menimbulkan kesan perubahan nilai sepihak.",
    );
  }

  await db.$transaction(async (tx: any) => {
    await tx.examScoringPolicy.upsert({
      where: { examPackageId },
      update: {
        correctScore,
        wrongScore,
        unansweredScore,
        displayMode,
        isPublished: displayMode === "SHOW_AFTER_SUBMIT_FINAL" ? true : false,
        publishedAt: displayMode === "SHOW_AFTER_SUBMIT_FINAL" ? new Date() : null,
      },
      create: {
        examPackageId,
        correctScore,
        wrongScore,
        unansweredScore,
        displayMode,
        isPublished: displayMode === "SHOW_AFTER_SUBMIT_FINAL",
        publishedAt: displayMode === "SHOW_AFTER_SUBMIT_FINAL" ? new Date() : null,
      },
    });

    await recalculateScores(tx, examPackageId);

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "SCORING_POLICY_UPDATED",
        entityType: "ExamPackage",
        entityId: examPackageId,
        metadata: {
          correctScore,
          wrongScore,
          unansweredScore,
          displayMode,
          submittedCount,
        },
      },
    });
  });

  revalidatePath("/scoring");
  revalidatePath("/analytics");
}

async function publishAndLockScores(formData: FormData) {
  "use server";
  const user = await requireActionUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const examPackageId = String(formData.get("examPackageId") ?? "").trim();
  if (!examPackageId) throw new Error("Paket ujian wajib dipilih.");

  const existing = await db.examScoringPolicy.findUnique({ where: { examPackageId } });
  if (existing?.lockedAt) throw new Error("Hasil paket ini sudah dikunci.");

  await db.$transaction(async (tx: any) => {
    await tx.examScoringPolicy.upsert({
      where: { examPackageId },
      update: {
        isPublished: true,
        publishedAt: new Date(),
        lockedAt: new Date(),
      },
      create: {
        examPackageId,
        correctScore: DEFAULT_POLICY.correctScore,
        wrongScore: DEFAULT_POLICY.wrongScore,
        unansweredScore: DEFAULT_POLICY.unansweredScore,
        displayMode: DEFAULT_POLICY.displayMode,
        isPublished: true,
        publishedAt: new Date(),
        lockedAt: new Date(),
      },
    });

    const recalculatedCount = await recalculateScores(tx, examPackageId);

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "SCORING_RESULTS_PUBLISHED_AND_LOCKED",
        entityType: "ExamPackage",
        entityId: examPackageId,
        metadata: { recalculatedCount },
      },
    });
  });

  revalidatePath("/scoring");
  revalidatePath("/analytics");
}

export default async function ScoringPage({ searchParams }: PageProps) {
  await requirePageUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const params = await searchParams;

  const packages = await db.examPackage.findMany({
    orderBy: [{ createdAt: "desc" }, { code: "desc" }],
    include: {
      scoringPolicy: true,
      sessions: {
        orderBy: { createdAt: "asc" },
        include: {
          participant: true,
          room: true,
          attempt: { include: { score: true, questionSnapshots: true } },
        },
      },
    },
  });

  const selectedPackage =
    packages.find((pack) => pack.id === params?.packageId) ?? packages[0] ?? null;
  const policy = selectedPackage?.scoringPolicy ?? DEFAULT_POLICY;
  const completedSessions = selectedPackage?.sessions.filter((session: any) =>
    FINAL_STATUSES.includes(session.attempt?.status),
  ) ?? [];
  const visibleToParticipant = canParticipantSeeScore(policy);
  const totalScores = completedSessions.reduce((sum: number, session: any) =>
    sum + toNumber(session.attempt?.score?.finalScore, 0),
  0);
  const averageScore = completedSessions.length ? totalScores / completedSessions.length : 0;

  return (
    <AdminShell
      title="Penskoran & Publikasi Nilai"
      subtitle="Atur bobot skor, tampilan hasil peserta, publikasi nilai, dan penguncian hasil final."
      allowedRoles={["EXAM_ADMIN", "SUPER_ADMIN"]}
    >
      <section className="card panel scoring-hero-panel">
        <div>
          <span className="eyebrow">Operasional Ujian</span>
          <h2><Calculator size={22} /> Penskoran resmi paket ujian</h2>
          <p className="muted-text">
            Mode aman untuk olimpiade adalah menyembunyikan skor sampai panitia menekan tombol publikasi dan mengunci hasil final. Jika skor ditampilkan langsung setelah submit, sistem memperlakukannya sebagai nilai final otomatis agar tidak ada perubahan sepihak setelah peserta melihat hasil.
          </p>
        </div>
        <ShieldCheck size={52} />
      </section>

      <section className="card panel analysis-filter-panel">
        <div className="panel-heading">
          <div>
            <h3><Sigma size={19} /> Pilih paket ujian</h3>
            <p className="muted-text">Setiap paket dapat memiliki kebijakan penskoran dan publikasi nilai sendiri.</p>
          </div>
          <Link className="secondary-button" href="/analytics">Lihat Nilai & Parameter Soal</Link>
        </div>
        <form method="get" action="/scoring" className="analysis-package-form">
          <label className="field-block">
            <span className="field-label">Paket ujian</span>
            <select className="select-input" name="packageId" defaultValue={selectedPackage?.id ?? ""}>
              {!packages.length ? <option value="">Belum ada paket</option> : null}
              {packages.map((pack) => (
                <option value={pack.id} key={pack.id}>{pack.code} — {pack.name}</option>
              ))}
            </select>
          </label>
          <button className="secondary-button" type="submit">Tampilkan paket</button>
        </form>
      </section>

      {!selectedPackage ? (
        <section className="card panel empty-analysis-state">
          <Calculator size={34} />
          <h2>Belum ada paket ujian</h2>
          <p>Buat paket ujian terlebih dahulu sebelum mengatur penskoran.</p>
        </section>
      ) : (
        <>
          <section className="scoring-summary-grid">
            <article className="card analysis-summary-card">
              <UsersRound size={22} />
              <div><span>Peserta selesai</span><strong>{completedSessions.length}</strong></div>
            </article>
            <article className="card analysis-summary-card">
              <Sigma size={22} />
              <div><span>Rata-rata skor</span><strong>{displayNumber(averageScore)}</strong></div>
            </article>
            <article className="card analysis-summary-card">
              {visibleToParticipant ? <Eye size={22} /> : <EyeOff size={22} />}
              <div><span>Status tampil peserta</span><strong>{visibleToParticipant ? "Terbuka" : "Tertutup"}</strong></div>
            </article>
            <article className="card analysis-summary-card">
              <LockKeyhole size={22} />
              <div><span>Status hasil</span><strong>{policy.lockedAt ? "Terkunci" : "Belum dikunci"}</strong></div>
            </article>
          </section>

          <section className="scoring-admin-grid">
            <form action={saveScoringPolicy} className="card panel scoring-policy-form">
              <div className="panel-heading">
                <div>
                  <h3><Save size={18} /> Pengaturan penskoran</h3>
                  <p className="muted-text">Default olimpiade: benar +4, salah -1, kosong 0.</p>
                </div>
                <span className="badge">{selectedPackage.code}</span>
              </div>
              <input type="hidden" name="examPackageId" value={selectedPackage.id} />

              <div className="scoring-score-grid">
                <label className="field-block">
                  <span className="field-label">Skor benar</span>
                  <input className="text-input" name="correctScore" type="number" step="0.01" defaultValue={String(policy.correctScore)} disabled={Boolean(policy.lockedAt)} />
                </label>
                <label className="field-block">
                  <span className="field-label">Skor salah</span>
                  <input className="text-input" name="wrongScore" type="number" step="0.01" defaultValue={String(policy.wrongScore)} disabled={Boolean(policy.lockedAt)} />
                </label>
                <label className="field-block">
                  <span className="field-label">Skor kosong</span>
                  <input className="text-input" name="unansweredScore" type="number" step="0.01" defaultValue={String(policy.unansweredScore)} disabled={Boolean(policy.lockedAt)} />
                </label>
              </div>

              <div className="scoring-mode-list">
                <label className="scoring-mode-card">
                  <input type="radio" name="displayMode" value="HIDDEN_UNTIL_PUBLISHED" defaultChecked={policy.displayMode === "HIDDEN_UNTIL_PUBLISHED"} disabled={Boolean(policy.lockedAt)} />
                  <span><strong>Sembunyikan skor sampai hasil final dipublikasikan</strong><small>Direkomendasikan untuk olimpiade resmi karena skor baru terlihat setelah panitia mengunci hasil.</small></span>
                </label>
                <label className="scoring-mode-card">
                  <input type="radio" name="displayMode" value="SHOW_AFTER_SUBMIT_FINAL" defaultChecked={policy.displayMode === "SHOW_AFTER_SUBMIT_FINAL"} disabled={Boolean(policy.lockedAt)} />
                  <span><strong>Tampilkan skor langsung setelah peserta selesai</strong><small>Skor dianggap final otomatis. Jangan gunakan jika panitia masih mungkin meninjau kunci atau bobot soal.</small></span>
                </label>
                <label className="scoring-mode-card">
                  <input type="radio" name="displayMode" value="STATUS_ONLY" defaultChecked={policy.displayMode === "STATUS_ONLY"} disabled={Boolean(policy.lockedAt)} />
                  <span><strong>Tampilkan status selesai saja</strong><small>Peserta hanya mendapat konfirmasi jawaban terkirim tanpa angka nilai.</small></span>
                </label>
              </div>

              <div className="scoring-warning-box">
                <FileLock2 size={18} />
                <p>
                  Perubahan skor setelah peserta melihat nilai akan menimbulkan risiko persepsi kecurangan. Karena itu, sistem akan menolak perubahan mode skor langsung jika sudah ada peserta selesai.
                </p>
              </div>

              <div className="settings-save-row">
                <button className="primary-button" type="submit" disabled={Boolean(policy.lockedAt)}>
                  <Save size={16} /> Simpan Pengaturan Penskoran
                </button>
                {policy.lockedAt ? <span className="settings-save-note">Hasil final sudah terkunci.</span> : null}
              </div>
            </form>

            <section className="card panel scoring-publication-card">
              <div className="panel-heading">
                <div>
                  <h3><BadgeCheck size={18} /> Publikasi hasil</h3>
                  <p className="muted-text">Kunci hasil final sebelum skor dibuka ke peserta.</p>
                </div>
              </div>
              <div className="scoring-status-list">
                <div><span>Mode tampilan</span><strong>{displayModeLabel(policy.displayMode)}</strong></div>
                <div><span>Skor benar/salah/kosong</span><strong>{displayNumber(policy.correctScore)} / {displayNumber(policy.wrongScore)} / {displayNumber(policy.unansweredScore)}</strong></div>
                <div><span>Dipublikasikan</span><strong>{policy.isPublished ? "Ya" : "Belum"}</strong><small>{displayDate(policy.publishedAt)}</small></div>
                <div><span>Dikunci final</span><strong>{policy.lockedAt ? "Ya" : "Belum"}</strong><small>{displayDate(policy.lockedAt)}</small></div>
              </div>

              {policy.displayMode === "HIDDEN_UNTIL_PUBLISHED" ? (
                <form action={publishAndLockScores} className="scoring-lock-form">
                  <input type="hidden" name="examPackageId" value={selectedPackage.id} />
                  <button className="primary-button" type="submit" disabled={Boolean(policy.lockedAt) || !completedSessions.length}>
                    <LockKeyhole size={16} /> Publikasikan & Kunci Hasil Final
                  </button>
                  {!completedSessions.length ? <p className="muted-text">Belum ada peserta selesai, sehingga hasil belum dapat dipublikasikan.</p> : null}
                </form>
              ) : (
                <div className="scoring-warning-box is-info">
                  <CheckCircle2 size={18} />
                  <p>{policy.displayMode === "SHOW_AFTER_SUBMIT_FINAL" ? "Pada mode ini, skor peserta tampil langsung sebagai nilai final otomatis." : "Pada mode ini, peserta hanya melihat status selesai tanpa angka skor."}</p>
                </div>
              )}
            </section>
          </section>

          <section className="card panel data-table-wrap">
            <div className="panel-heading">
              <div>
                <h3><UsersRound size={18} /> Daftar skor peserta</h3>
                <p className="muted-text">Tabel ini untuk panitia. Peserta hanya melihat skor jika mode tampilan mengizinkan.</p>
              </div>
              <span className="badge">{completedSessions.length} hasil</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Peserta</th>
                  <th>Benar</th>
                  <th>Salah</th>
                  <th>Kosong</th>
                  <th>Skor</th>
                  <th>Waktu kirim</th>
                  <th>Status untuk peserta</th>
                </tr>
              </thead>
              <tbody>
                {completedSessions.map((session: any) => (
                  <tr key={session.id}>
                    <td><strong>{session.participant.name}</strong><br/><span className="muted-text">@{session.participant.username ?? session.participant.externalId}</span></td>
                    <td>{session.attempt?.score?.correctCount ?? "–"}</td>
                    <td>{session.attempt?.score?.wrongCount ?? "–"}</td>
                    <td>{session.attempt?.score?.unansweredCount ?? "–"}</td>
                    <td><strong>{session.attempt?.score ? displayNumber(session.attempt.score.finalScore) : "–"}</strong></td>
                    <td>{displayDate(session.attempt?.submittedAt ?? null)}</td>
                    <td><span className={`analysis-status ${visibleToParticipant ? "analysis-good" : "analysis-neutral"}`}>{visibleToParticipant ? "Skor terlihat" : "Skor tertutup"}</span></td>
                  </tr>
                ))}
                {!completedSessions.length ? (
                  <tr><td colSpan={7}><p className="muted-text">Belum ada peserta yang menyelesaikan ujian.</p></td></tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="card panel data-table-wrap">
            <div className="panel-heading">
              <div>
                <h3><History size={18} /> Audit perubahan penskoran</h3>
                <p className="muted-text">Jejak perubahan tersimpan untuk menjaga transparansi panitia.</p>
              </div>
            </div>
            <AuditLogTable examPackageId={selectedPackage.id} />
          </section>
        </>
      )}
    </AdminShell>
  );
}

async function AuditLogTable({ examPackageId }: { examPackageId: string }) {
  const logs = await db.auditLog.findMany({
    where: { entityType: "ExamPackage", entityId: examPackageId, action: { in: ["SCORING_POLICY_UPDATED", "SCORING_RESULTS_PUBLISHED_AND_LOCKED"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <table className="data-table">
      <thead><tr><th>Waktu</th><th>Aksi</th><th>Petugas</th><th>Catatan sistem</th></tr></thead>
      <tbody>
        {logs.map((log: any) => (
          <tr key={log.id}>
            <td>{displayDate(log.createdAt)}</td>
            <td><strong>{log.action === "SCORING_POLICY_UPDATED" ? "Pengaturan diubah" : "Hasil dipublikasi & dikunci"}</strong></td>
            <td>{log.actor?.name ?? "Sistem"}<br/><span className="muted-text">{log.actor?.email ?? "-"}</span></td>
            <td><code className="inline-code">{JSON.stringify(log.metadata ?? {})}</code></td>
          </tr>
        ))}
        {!logs.length ? <tr><td colSpan={4}><p className="muted-text">Belum ada audit perubahan penskoran.</p></td></tr> : null}
      </tbody>
    </table>
  );
}
