import { AdminShell } from "@/components/admin-shell";
import { ArrowRight } from "lucide-react";

const steps = [
  { title: "Penulis Kisi-kisi", body: "Menyusun A. Identitas: Kode otomatis, Kelompok Uji, Topik Uji, Indikator, Materi Uji, dan Kisi-Kisi." },
  { title: "Plotting Penulis", body: "Admin/super admin menentukan penulis soal untuk kode kisi-kisi tertentu dan seluruh slot soal dalam kisi-kisi tersebut." },
  { title: "Penulis Soal", body: "Menulis soal berdasarkan tugas kode kisi-kisi. Kode soal otomatis, teks WYSIWYG, LaTeX, link, dan gambar." },
  { title: "Plotting Validator", body: "Admin/super admin menugaskan validator berdasarkan kode kisi-kisi; seluruh slot soal di dalamnya ikut terplot." },
  { title: "Validasi dan Paket", body: "Validator dapat mengedit soal/kunci, lalu admin memilih soal APPROVED untuk paket ujian peserta." }
];

export default function WorkflowPage() {
  return (
    <AdminShell title="Alur Kerja" subtitle="Peta proses pengelolaan penulisan soal versi V.1.0">
      <div className="page-header">
        <div>
          <h2>Workflow Olimpiade Fisika V.1.0</h2>
          <p>Kisi-kisi membuat slot dan kode soal otomatis. Penulis serta validator menerima tugas berdasarkan kode kisi-kisi yang sama.</p>
        </div>
        <span className="badge">V.1.0</span>
      </div>
      <section className="workflow-strip">
        {steps.map((step, index) => (
          <article className="workflow-step" key={step.title}>
            <div className="workflow-number">{index + 1}</div>
            {index < steps.length - 1 ? <ArrowRight className="workflow-arrow" size={18} /> : null}
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </section>
      <section className="card panel" style={{ marginTop: 18 }}>
        <div className="panel-heading"><h3>Aturan penting V.1.0</h3></div>
        <div className="summary-list">
          <div className="summary-row"><span>Kode kisi-kisi</span><strong>KK-0001, KK-0002, dst.</strong></div>
          <div className="summary-row"><span>Kode soal</span><strong>KK-0001-S01, dst.</strong></div>
          <div className="summary-row"><span>Penulis soal</span><strong>Hanya mengerjakan kisi-kisi yang diplot</strong></div>
          <div className="summary-row"><span>Validator</span><strong>Menerima seluruh soal dari kisi-kisi yang diplot</strong></div>
          <div className="summary-row"><span>Paket ujian</span><strong>Hanya soal APPROVED</strong></div>
        </div>
      </section>
    </AdminShell>
  );
}
