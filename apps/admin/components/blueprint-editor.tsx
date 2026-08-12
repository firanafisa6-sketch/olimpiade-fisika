"use client";

import { RichTextEditor } from "@seleksi/ui";
import { useState } from "react";

export function BlueprintEditor() {
  const [title, setTitle] = useState("<p>Kisi-kisi Reading Comprehension</p>");
  const [competency, setCompetency] = useState("<p>Peserta mampu memahami informasi tersurat dan tersirat dalam teks bahasa Inggris.</p>");
  const [indicator, setIndicator] = useState("<p>Disajikan teks informatif, peserta dapat menentukan gagasan utama dengan tepat.</p>");
  const [material, setMaterial] = useState("<p>Main idea, detail information, reference, inference, dan author’s purpose.</p>");
  const [revision, setRevision] = useState("<p>Versi awal untuk periode Olimpiade Fisika 2026.</p>");

  return (
    <div className="editor-layout">
      <section className="card panel form-grid">
        <div className="two-columns">
          <label className="field-block"><span className="field-label">Kode</span><input className="text-input" defaultValue="ENG-BP-001" /></label>
          <label className="field-block"><span className="field-label">Jumlah soal</span><input className="text-input" type="number" defaultValue={5} min={1} /></label>
        </div>
        <RichTextEditor label="Nama kisi-kisi" value={title} onChange={setTitle} required />
        <RichTextEditor label="Kompetensi" value={competency} onChange={setCompetency} required />
        <RichTextEditor label="Indikator" value={indicator} onChange={setIndicator} required />
        <RichTextEditor label="Materi" value={material} onChange={setMaterial} />
        <div className="two-columns">
          <label className="field-block"><span className="field-label">Level kognitif</span><select className="select-input" defaultValue="C3"><option>C1</option><option>C2</option><option>C3</option><option>C4</option><option>C5</option></select></label>
          <label className="field-block"><span className="field-label">Tingkat kesulitan</span><select className="select-input" defaultValue="MEDIUM"><option value="EASY">Mudah</option><option value="MEDIUM">Sedang</option><option value="HARD">Sulit</option></select></label>
        </div>
        <RichTextEditor label="Ringkasan perubahan" value={revision} onChange={setRevision} />
        <div className="editor-actions"><button className="primary-button" type="button">Simpan draft</button></div>
      </section>
      <aside className="card side-summary">
        <span className="badge warning">Draft versi 1</span>
        <h3>Ringkasan</h3>
        <div className="summary-list">
          <div className="summary-row"><span>Periode</span><strong>Olimpiade Fisika 2026</strong></div>
          <div className="summary-row"><span>Penulis</span><strong>Rina Pratiwi</strong></div>
          <div className="summary-row"><span>Workflow</span><strong>3 tingkat</strong></div>
          <div className="summary-row"><span>Target soal</span><strong>5</strong></div>
        </div>
        <p className="muted-text">Semua kolom naratif menggunakan WYSIWYG. Versi lama tetap disimpan setelah revisi.</p>
      </aside>
    </div>
  );
}
