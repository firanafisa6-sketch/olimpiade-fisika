"use client";

import { RichTextEditor } from "@seleksi/ui";
import { useState } from "react";

export function ReviewEditor() {
  const [question, setQuestion] = useState("<p>What is the main idea of the text?</p>");
  const [answer, setAnswer] = useState("<p>Renewable energy is becoming increasingly important.</p>");
  const [feedback, setFeedback] = useState("<p>Pertanyaan sudah sesuai indikator. Saya memperjelas opsi A agar tidak terlalu panjang dibandingkan opsi lain.</p>");

  return (
    <div className="editor-layout">
      <section className="card panel form-grid">
        <div className="review-note"><strong>Validator dapat merevisi konten.</strong><div className="muted-text">Setiap perubahan menghasilkan versi baru dan rekaman audit.</div></div>
        <RichTextEditor label="Pertanyaan hasil review" value={question} onChange={setQuestion} required />
        <RichTextEditor label="Jawaban benar hasil review" value={answer} onChange={setAnswer} required />
        <RichTextEditor label="Masukan validator" value={feedback} onChange={setFeedback} minHeight={160} required />
        <label className="field-block"><span className="field-label">Keputusan</span><select className="select-input" defaultValue="EDIT_AND_FORWARD"><option value="APPROVE">Setujui</option><option value="REQUEST_REVISION">Minta revisi</option><option value="REJECT">Tolak</option><option value="EDIT_AND_FORWARD">Edit dan teruskan</option></select></label>
        <div className="editor-actions"><button className="secondary-button" type="button">Simpan review</button><button className="primary-button" type="button">Teruskan ke tingkat 2</button></div>
      </section>
      <aside className="card side-summary">
        <span className="badge warning">Validasi tingkat 1</span>
        <h3>Jejak perubahan</h3>
        <div className="summary-list">
          <div className="summary-row"><span>Versi awal</span><strong>v3</strong></div>
          <div className="summary-row"><span>Versi review</span><strong>v4</strong></div>
          <div className="summary-row"><span>Kunci berubah</span><strong>Tidak</strong></div>
          <div className="summary-row"><span>Validator</span><strong>Dr. Sinta</strong></div>
        </div>
      </aside>
    </div>
  );
}
