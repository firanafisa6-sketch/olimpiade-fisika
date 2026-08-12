import { db } from "@seleksi/database";
import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/auth";
import { AppLogo } from "@/components/app-logo";
import { logoutParticipant } from "@/app/actions";
import { StartExamForm } from "@/components/start-exam-form";
import { CalendarClock, CheckCircle2, Clock3, Layers3, LogOut, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";


function scoreValue(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return number.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function participantCanSeeScore(policy: any) {
  if (policy?.displayMode === "SHOW_AFTER_SUBMIT_FINAL") return true;
  if (policy?.displayMode === "HIDDEN_UNTIL_PUBLISHED" && policy?.isPublished) return true;
  return false;
}
function statusLabel(startsAt: Date, endsAt: Date, sessionStatus: string, attemptStatus?: string | null) {
  const now = new Date();
  if (attemptStatus === "SUBMITTED") return "SELESAI";
  if (attemptStatus === "ACTIVE") return "SEDANG DIKERJAKAN";
  if (attemptStatus === "PAUSED" || sessionStatus === "PAUSED") return "DIJEDA PENGAWAS";
  if (sessionStatus === "WAITING") return "MENUNGGU PENGAWAS";
  if (now < startsAt) return "BELUM DIMULAI";
  if (now >= endsAt) return "WAKTU BERAKHIR";
  return "SIAP DIMULAI";
}

export default async function ParticipantDashboard() {
  const participant = await getCurrentParticipant();
  if (!participant) redirect("/");

  const sessions = await db.examSession.findMany({
    where: { participantId: participant.id },
    orderBy: { startsAt: "asc" },
    include: {
      examPackage: {
        include: {
          fields: { orderBy: { sortOrder: "asc" }, include: { blueprintRules: true } },
          blueprintRules: true,
          scoringPolicy: true,
        },
      },
      room: true,
      attempt: { include: { score: true, questionSnapshots: true } },
    },
  });

  const now = new Date();

  return (
    <div className="participant-dashboard-root">
      <header className="participant-dashboard-header">
        <div className="exam-brand"><div className="exam-brand-mark"><AppLogo /></div><div><strong>Olimpiade Fisika</strong><span>Portal peserta</span></div></div>
        <div className="participant-header-user">
          <div><strong>{participant.name}</strong><span>@{participant.username ?? participant.externalId}</span></div>
          <form action={logoutParticipant}><button className="secondary-button" type="submit"><LogOut size={16} /> Keluar</button></form>
        </div>
      </header>

      <main className="participant-dashboard-main">
        <section className="participant-welcome-card card">
          <div>
            <span className="eyebrow">Selamat datang</span>
            <h1>Paket ujian Anda</h1>
            <p>Pilih paket yang sedang tersedia. Soal random ditetapkan saat ujian dimulai dan tidak berubah ketika halaman dimuat ulang.</p>
          </div>
          <ShieldCheck size={48} />
        </section>

        <section className="participant-package-grid">
          {sessions.map((session: any) => {
            const pack = session.examPackage;
            const status = statusLabel(session.startsAt, session.endsAt, session.status, session.attempt?.status);
            const fields = pack.fields.length
              ? pack.fields
              : [{ id: "legacy", name: pack.subjectName, blueprintRules: pack.blueprintRules }];
            const blueprintCount = fields.reduce(
              (total: number, field: any) => total + field.blueprintRules.length,
              0,
            );
            const canStart =
              pack.status === "PUBLISHED" &&
              now >= session.startsAt &&
              now < session.endsAt &&
              session.status === "ACTIVE" &&
              !["SUBMITTED", "PAUSED"].includes(session.attempt?.status ?? "");
            return (
              <article className="card participant-package-card" key={session.id}>
                <header>
                  <div><span className="eyebrow">{fields.length} bidang ujian</span><h2>{pack.name}</h2></div>
                  <span className={`badge ${canStart ? "" : "warning"}`}>{status}</span>
                </header>
                <div className="participant-package-meta">
                  <span><Clock3 size={16} /> {pack.durationMinutes} menit</span>
                  <span><CalendarClock size={16} /> {session.startsAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} – {session.endsAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</span>
                  <span><Layers3 size={16} /> Ruang: {session.room ? `${session.room.code} — ${session.room.name}` : "Belum ditetapkan"}</span>
                  <span><Layers3 size={16} /> {fields.map((field: any) => field.name).join(" · ")}</span>
                  <span><CheckCircle2 size={16} /> {blueprintCount} kode kisi-kisi</span>
                </div>
                {session.attempt?.status === "SUBMITTED" ? (
                  <div className="participant-finished-box">
                    <strong>Jawaban sudah dikirim.</strong>
                    <span>Waktu kirim: {session.attempt.submittedAt?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "-"}</span>
                    {participantCanSeeScore(pack.scoringPolicy) && session.attempt.score ? (
                      <div className="participant-score-box">
                        <small>Skor final Anda</small>
                        <strong>{scoreValue(session.attempt.score.finalScore)}</strong>
                        <span>Benar {session.attempt.score.correctCount} • Salah {session.attempt.score.wrongCount} • Kosong {session.attempt.score.unansweredCount}</span>
                      </div>
                    ) : (
                      <span>Skor belum ditampilkan oleh panitia.</span>
                    )}
                  </div>
                ) : (
                  <StartExamForm
                    examSessionId={session.id}
                    label={session.attempt?.status === "ACTIVE" ? "Lanjutkan ujian" : "Mulai ujian"}
                    disabled={!canStart}
                  />
                )}
              </article>
            );
          })}
          {!sessions.length ? (
            <section className="card participant-empty-state">
              <h2>Belum ada paket</h2>
              <p className="muted-text">Akun Anda belum diplot ke paket ujian mana pun.</p>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}
