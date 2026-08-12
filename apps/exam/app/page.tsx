import { redirect } from "next/navigation";
import { ParticipantLoginForm } from "@/components/participant-login-form";
import { AppLogo } from "@/components/app-logo";
import { getCurrentParticipant } from "@/lib/auth";
import { CheckCircle2, MonitorSmartphone, ShieldAlert } from "lucide-react";

export default async function LoginPage() {
  const participant = await getCurrentParticipant();
  if (participant) redirect("/dashboard");

  return (
    <main className="participant-login-page">
      <section className="participant-login-hero">
        <div className="exam-logo-mark"><AppLogo /></div>
        <span className="eyebrow">Olimpiade Fisika</span>
        <h1>Portal Ujian Peserta</h1>
        <p>Masuk menggunakan username peserta berupa angka atau teks yang diberikan panitia.</p>
        <div className="login-feature-list">
          <div><CheckCircle2 size={20} /><span>Soal dipilih sesuai aturan setiap kode kisi-kisi.</span></div>
          <div><MonitorSmartphone size={20} /><span>Jawaban tersimpan otomatis ke server.</span></div>
          <div><ShieldAlert size={20} /><span>Aktivitas keluar layar, salin, dan cetak dicatat.</span></div>
        </div>
      </section>
      <section className="card participant-login-card">
        <div>
          <span className="eyebrow">Login peserta</span>
          <h2>Masuk ke sesi ujian</h2>
          <p className="muted-text">Email tidak diperlukan.</p>
        </div>
        <ParticipantLoginForm />
      </section>
    </main>
  );
}
