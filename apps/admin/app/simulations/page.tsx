import { AdminShell } from "@/components/admin-shell";
import { Code2, ExternalLink, FlaskConical, GitBranch, LockKeyhole, MonitorPlay, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const sampleIframe = `<iframe
  class="simulation-frame github-pages-simulation"
  src="https://username.github.io/olimpiade-fisika-simulasi/simulations/gerak-parabola/"
  title="Simulasi Gerak Parabola"
  width="100%"
  height="560"
  loading="lazy"
  referrerpolicy="no-referrer"
  allow="fullscreen; autoplay; clipboard-read; clipboard-write"
  sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
></iframe>`;

export default async function SimulationsPage() {
  return (
    <AdminShell
      title="Simulasi Soal"
      subtitle="Panduan penggunaan simulasi fisika interaktif berbasis GitHub Pages"
      allowedRoles={["BLUEPRINT_AUTHOR", "QUESTION_AUTHOR", "QUESTION_VALIDATOR", "EXAM_ADMIN", "SUPER_ADMIN"]}
    >
      <section className="card panel simulation-hero-panel">
        <div>
          <span className="eyebrow">Stimulus Interaktif</span>
          <h2><FlaskConical size={24} /> Simulasi GitHub Pages</h2>
          <p>
            Simulasi fisika disarankan disimpan sebagai halaman statis di GitHub Pages, lalu dimasukkan ke kisi-kisi atau stem soal melalui fitur
            <strong> Simulasi GitHub Pages</strong> pada form penulisan. Peserta tetap menjawab pilihan ganda sehingga penskoran tetap stabil.
          </p>
        </div>
        <MonitorPlay size={52} />
      </section>

      <section className="simulation-guide-grid">
        <article className="card panel simulation-guide-card">
          <h3><GitBranch size={18} /> Struktur repository yang disarankan</h3>
          <pre className="code-block"><code>{`olimpiade-fisika-simulasi/
├── index.html
├── simulations/
│   ├── gerak-parabola/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── hukum-ohm/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── getaran-harmonik/
│       ├── index.html
│       ├── style.css
│       └── script.js
└── assets/`}</code></pre>
          <p className="muted-text">
            URL yang dipakai di soal sebaiknya berbentuk https://username.github.io/nama-repository/simulations/nama-simulasi/.
          </p>
        </article>

        <article className="card panel simulation-guide-card">
          <h3><LockKeyhole size={18} /> Aturan keamanan ujian</h3>
          <div className="developer-feature-list">
            <div><ShieldCheck size={18} /><span><strong>Gunakan GitHub Pages, bukan link raw GitHub.</strong><small>Link raw lebih mudah bermasalah saat dirender sebagai simulasi interaktif.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Kunci versi sebelum ujian.</strong><small>Jangan mengubah file simulasi setelah soal dipakai dalam paket resmi.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Validasi oleh validator.</strong><small>Validator perlu membuka preview simulasi dan memastikan parameter awal sesuai instruksi soal.</small></span></div>
          </div>
        </article>
      </section>

      <section className="card panel simulation-guide-card">
        <h3><Code2 size={18} /> Contoh kode iframe</h3>
        <p className="muted-text">
          Form penulisan soal sudah menyediakan pembuat iframe otomatis. Contoh berikut hanya untuk referensi teknis.
        </p>
        <pre className="code-block"><code>{sampleIframe}</code></pre>
        <a className="secondary-button" href="https://pages.github.com/" target="_blank" rel="noreferrer">
          <ExternalLink size={15} /> Buka dokumentasi GitHub Pages
        </a>
      </section>
    </AdminShell>
  );
}
