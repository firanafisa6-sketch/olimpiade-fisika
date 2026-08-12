"use client";

import { ExternalLink, FlaskConical, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";

type SimulationEmbedBuilderProps = {
  targetLabel: string;
  onInsert: (html: string) => void;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeSimulationUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function isRecommendedHost(url: URL | null) {
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return (
    url.protocol === "https:" &&
    (host.endsWith(".github.io") || host === "github.io")
  ) || host === "localhost" || host === "127.0.0.1";
}

function buildSimulationHtml({
  title,
  url,
  instruction,
  height,
}: {
  title: string;
  url: string;
  instruction: string;
  height: number;
}) {
  const safeTitle = escapeHtml(title || "Simulasi Fisika");
  const safeUrl = escapeHtml(url);
  const safeInstruction = escapeHtml(
    instruction || "Amati simulasi berikut, kemudian jawab pertanyaan berdasarkan hasil pengamatan.",
  );
  return `<section class="physics-simulation-embed" data-simulation-source="github-pages">
  <div class="simulation-embed-header">
    <strong>${safeTitle}</strong>
    <span>Simulasi interaktif GitHub Pages</span>
  </div>
  <p class="simulation-embed-instruction">${safeInstruction}</p>
  <iframe
    class="simulation-frame github-pages-simulation"
    src="${safeUrl}"
    title="${safeTitle}"
    width="100%"
    height="${height}"
    loading="lazy"
    referrerpolicy="no-referrer"
    allow="fullscreen; autoplay; clipboard-read; clipboard-write"
    sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
  ></iframe>
  <p class="simulation-embed-note">Jika simulasi tidak tampil, tekan tombol Refresh pada halaman ujian atau hubungi pengawas.</p>
</section>`;
}

export function SimulationEmbedBuilder({ targetLabel, onInsert }: SimulationEmbedBuilderProps) {
  const [title, setTitle] = useState("Simulasi Gerak Parabola");
  const [url, setUrl] = useState("https://username.github.io/olimpiade-fisika-simulasi/simulations/gerak-parabola/");
  const [instruction, setInstruction] = useState("Atur parameter simulasi sesuai instruksi soal, amati hasilnya, lalu pilih jawaban yang paling tepat.");
  const [height, setHeight] = useState(560);
  const normalizedUrl = useMemo(() => normalizeSimulationUrl(url), [url]);
  const recommended = isRecommendedHost(normalizedUrl);
  const canInsert = Boolean(normalizedUrl);

  function insertSimulation() {
    if (!normalizedUrl) {
      window.alert("URL simulasi belum valid. Gunakan URL GitHub Pages, misalnya https://username.github.io/repo/simulations/nama-simulasi/.");
      return;
    }
    const html = buildSimulationHtml({
      title,
      url: normalizedUrl.toString(),
      instruction,
      height: Math.min(900, Math.max(320, Number(height) || 560)),
    });
    onInsert(html);
  }

  return (
    <section className="simulation-builder-panel">
      <div className="simulation-builder-heading">
        <div>
          <h3><FlaskConical size={18} /> Simulasi GitHub Pages</h3>
          <p className="muted-text">
            Masukkan URL GitHub Pages. Sistem akan membuat iframe aman dan menyisipkannya ke {targetLabel}.
          </p>
        </div>
        {normalizedUrl ? (
          <a className="secondary-button compact-button" href={normalizedUrl.toString()} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Preview
          </a>
        ) : null}
      </div>
      <div className="two-columns">
        <label className="field-block">
          <span className="field-label">Judul simulasi</span>
          <input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field-block">
          <span className="field-label">Tinggi tampilan</span>
          <input className="text-input" type="number" min={320} max={900} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
        </label>
      </div>
      <label className="field-block">
        <span className="field-label">URL GitHub Pages</span>
        <input
          className="text-input"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://username.github.io/nama-repo/simulations/gerak-parabola/"
        />
      </label>
      <label className="field-block">
        <span className="field-label">Instruksi penggunaan simulasi</span>
        <textarea
          className="text-area"
          rows={3}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
        />
      </label>
      <div className={`simulation-url-status ${recommended ? "ok" : "warning"}`}>
        {recommended
          ? "URL sudah sesuai rekomendasi GitHub Pages/localhost."
          : "Disarankan memakai URL https://*.github.io agar simulasi stabil saat ujian."}
      </div>
      <button className="primary-button" type="button" onClick={insertSimulation} disabled={!canInsert}>
        <PlusCircle size={16} /> Sisipkan simulasi ke {targetLabel}
      </button>
    </section>
  );
}
