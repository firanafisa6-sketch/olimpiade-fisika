"use client";

import { ImageUploadField, RichTextEditor } from "@seleksi/ui";
import { useState } from "react";

const initialOptions = {
  A: "<p>Renewable energy is becoming increasingly important.</p>",
  B: "<p>Fossil fuels are the only reliable source of energy.</p>",
  C: "<p>Wind energy is no longer used by modern countries.</p>",
  D: "<p>Energy consumption has stopped growing.</p>",
  E: "<p>Solar energy can only be used in winter.</p>"
};

export function QuestionEditor() {
  const [stimulus, setStimulus] = useState("<p>Renewable energy has become increasingly important as countries seek cleaner ways to meet growing energy demands.</p><p>Solar and wind power are now among the most widely adopted renewable sources.</p>");
  const [instruction, setInstruction] = useState("<p>Read the following text to answer questions 1–5.</p>");
  const [question, setQuestion] = useState("<p>What is the main idea of the text?</p>");
  const [options, setOptions] = useState(initialOptions);
  const [explanation, setExplanation] = useState("<p>The first paragraph directly states that renewable energy is increasingly important.</p>");
  const [notes, setNotes] = useState("<p>Pastikan pilihan pengecoh tetap masuk akal tetapi tidak didukung oleh teks.</p>");

  return (
    <div className="editor-layout">
      <section className="card panel form-grid">
        <div className="two-columns">
          <label className="field-block"><span className="field-label">Kode stimulus</span><input className="text-input" defaultValue="ENG-READ-001" /></label>
          <label className="field-block"><span className="field-label">Bahasa</span><select className="select-input" defaultValue="en"><option value="en">English</option><option value="id">Indonesia</option></select></label>
        </div>
        <RichTextEditor label="Instruksi stimulus" value={instruction} onChange={setInstruction} />
        <RichTextEditor label="Teks stimulus" value={stimulus} onChange={setStimulus} minHeight={220} required />
        <ImageUploadField label="Gambar stimulus (opsional)" />
        <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "6px 0" }} />
        <div className="two-columns">
          <label className="field-block"><span className="field-label">Kode soal</span><input className="text-input" defaultValue="ENG-001" /></label>
          <label className="field-block"><span className="field-label">Urutan dalam stimulus</span><input className="text-input" type="number" defaultValue={1} min={1} max={5} /></label>
        </div>
        <RichTextEditor label="Pertanyaan" value={question} onChange={setQuestion} required />
        {(Object.keys(options) as Array<keyof typeof options>).map((key) => (
          <RichTextEditor key={key} label={`Pilihan ${key}`} value={options[key]} onChange={(html) => setOptions((current) => ({ ...current, [key]: html }))} minHeight={70} required />
        ))}
        <div className="two-columns">
          <label className="field-block"><span className="field-label">Kunci jawaban</span><select className="select-input" defaultValue="A"><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select></label>
          <label className="field-block"><span className="field-label">Kesulitan</span><select className="select-input" defaultValue="MEDIUM"><option value="EASY">Mudah</option><option value="MEDIUM">Sedang</option><option value="HARD">Sulit</option></select></label>
        </div>
        <RichTextEditor label="Pembahasan" value={explanation} onChange={setExplanation} />
        <RichTextEditor label="Catatan penulis" value={notes} onChange={setNotes} />
        <div className="editor-actions"><button className="secondary-button" type="button">Simpan draft</button><button className="primary-button" type="button">Kirim validasi</button></div>
      </section>
      <aside className="card side-summary">
        <span className="badge">Stimulus 1 dari 5 soal</span>
        <h3>Status konten</h3>
        <div className="summary-list">
          <div className="summary-row"><span>Stimulus</span><strong>Draft v2</strong></div>
          <div className="summary-row"><span>Soal</span><strong>Draft v3</strong></div>
          <div className="summary-row"><span>Kisi-kisi</span><strong>ENG-BP-001</strong></div>
          <div className="summary-row"><span>Gambar</span><strong>≤ 100 KB</strong></div>
        </div>
        <p className="muted-text">Perubahan stimulus akan menandai lima soal terkait untuk pemeriksaan keselarasan ulang.</p>
      </aside>
    </div>
  );
}
