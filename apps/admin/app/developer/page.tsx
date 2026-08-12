import { AdminShell } from "@/components/admin-shell";
import { AppLogo } from "@/components/app-logo";
import { requirePageUser } from "@/lib/auth";
import { BadgeCheck, Bot, Code2, Cpu, Database, FileText, ShieldCheck, Sparkles } from "lucide-react";

const allowedRoles = ["BLUEPRINT_AUTHOR", "QUESTION_AUTHOR", "QUESTION_VALIDATOR", "EXAM_ADMIN", "SUPER_ADMIN"];

export default async function DeveloperPage() {
  await requirePageUser(allowedRoles);

  return (
    <AdminShell
      title="Pengembang"
      subtitle="Informasi pengembang, versi aplikasi, dan pemanfaatan AI dalam pengembangan sistem"
      allowedRoles={allowedRoles}
    >
      <section className="developer-hero card">
        <div className="developer-hero-mark"><AppLogo /></div>
        <div>
          <p className="eyebrow">Olimpiade Fisika V.1.0</p>
          <h2>Dikembangkan oleh Ari C Mawardi</h2>
          <p>
            Aplikasi Olimpiade Fisika V.1.0 dikembangkan sebagai sistem kerja terpadu untuk mendukung penyusunan kisi-kisi, penulisan soal, validasi soal, pengelolaan paket ujian, operasional peserta, dan monitoring pelaksanaan ujian. Sistem ini dirancang agar alur kerja panitia lebih tertib, terdokumentasi, dan mudah diaudit dari tahap perencanaan konten sampai tahap pelaksanaan ujian.
          </p>
        </div>
      </section>

      <div className="developer-grid">
        <section className="card panel developer-section">
          <div className="panel-heading"><div><p className="eyebrow">Profil pengembangan</p><h3>Deskripsi aplikasi</h3></div><Code2 size={24} /></div>
          <p>
            Olimpiade Fisika V.1.0 merupakan aplikasi manajemen soal dan ujian berbasis web yang dibangun untuk kebutuhan penyelenggaraan olimpiade atau seleksi akademik bidang fisika. Aplikasi ini menyediakan ruang kerja bagi admin, penulis, dan validator agar setiap butir soal dapat ditelusuri berdasarkan kisi-kisi, status pengerjaan, proses validasi, dan kesiapan masuk ke paket ujian.
          </p>
          <p>
            Pada sisi operasional, sistem mendukung pengaturan peserta, pengawas, sesi ujian, ruang ujian, paket ujian, serta pemantauan aktivitas pengerjaan. Dengan struktur peran yang terpisah, aplikasi membantu menjaga akuntabilitas: penulis fokus pada produksi soal, validator fokus pada mutu dan keselarasan soal, sedangkan admin mengatur distribusi tugas, paket, dan konfigurasi pelaksanaan.
          </p>
        </section>

        <section className="card panel developer-section">
          <div className="panel-heading"><div><p className="eyebrow">AI-assisted development</p><h3>Dikembangkan dengan dukungan AI</h3></div><Bot size={24} /></div>
          <p>
            Aplikasi ini dikembangkan dengan bantuan teknologi kecerdasan buatan atau artificial intelligence sebagai pendamping proses rekayasa perangkat lunak. AI digunakan untuk mempercepat penyusunan struktur kode, merapikan antarmuka, meninjau konsistensi komponen, menyusun dokumentasi teknis, dan membantu menemukan potensi perbaikan pada alur pengguna.
          </p>
          <p>
            Pemanfaatan AI dalam pengembangan tidak menggantikan tanggung jawab pengembang. Keputusan desain, penyesuaian kebutuhan pengguna, pengendalian akses, validasi fungsi, dan pemeriksaan akhir tetap berada pada pengembang. Dengan demikian, AI berperan sebagai alat bantu produktivitas, bukan sebagai pihak yang mengambil keputusan substantif atas kebijakan sistem atau isi soal.
          </p>
          <p>
            Pendekatan ini memungkinkan proses pengembangan berlangsung lebih cepat, namun tetap menempatkan akurasi, keamanan data, keterlacakan revisi, dan kemudahan penggunaan sebagai prioritas utama. Setiap fitur perlu diuji sesuai konteks penggunaan nyata sebelum dipakai dalam pelaksanaan ujian resmi.
          </p>
        </section>

        <section className="card panel developer-section">
          <div className="panel-heading"><div><p className="eyebrow">Ruang lingkup fitur</p><h3>Modul utama</h3></div><Sparkles size={24} /></div>
          <div className="developer-feature-list">
            <div><FileText size={18} /><span><strong>Kisi-kisi dan bank soal</strong><small>Pengelolaan identitas kisi-kisi, indikator, materi, stimulus, soal, opsi jawaban, kunci, dan pembahasan.</small></span></div>
            <div><BadgeCheck size={18} /><span><strong>Validasi soal</strong><small>Alur pemeriksaan soal oleh validator, termasuk keputusan setuju, revisi, atau penolakan.</small></span></div>
            <div><Database size={18} /><span><strong>Paket dan sesi ujian</strong><small>Pengaturan paket, peserta, ruang, pengawas, durasi, serta sesi pelaksanaan ujian.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Monitoring dan keamanan</strong><small>Pencatatan aktivitas ujian, status pengerjaan, dan dukungan pengawasan pelaksanaan.</small></span></div>
            <div><Cpu size={18} /><span><strong>Konfigurasi sistem</strong><small>Pengaturan peran pengguna, tampilan tema, serta identitas aplikasi Olimpiade Fisika.</small></span></div>
          </div>
        </section>

        <aside className="card panel developer-section developer-version-card">
          <p className="eyebrow">Versi aplikasi</p>
          <h3>Olimpiade Fisika V.1.0</h3>
          <div className="summary-list">
            <div className="summary-row"><span>Nama aplikasi</span><strong>Olimpiade Fisika</strong></div>
            <div className="summary-row"><span>Versi</span><strong>V.1.0</strong></div>
            <div className="summary-row"><span>Pengembang</span><strong>Ari C Mawardi</strong></div>
            <div className="summary-row"><span>Hak cipta tampilan</span><strong>© ACM</strong></div>
            <div className="summary-row"><span>Pendekatan</span><strong>AI-assisted</strong></div>
          </div>
          <p className="muted-text">
            Informasi ini ditampilkan agar pengguna mengetahui identitas pengembang, status versi, dan transparansi penggunaan AI dalam proses pengembangan aplikasi.
          </p>
        </aside>
      </div>
    </AdminShell>
  );
}
