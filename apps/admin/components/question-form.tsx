"use client";

import { RichTextEditor } from "@seleksi/ui";
import { SimulationEmbedBuilder } from "@/components/simulation-embed-builder";
import { FileQuestion, Save } from "lucide-react";
import { useMemo, useState } from "react";

const optionLabels = ["A", "B", "C", "D", "E"] as const;

type BlueprintOption = {
  id: string;
  code: string;
  label: string;
  target?: number | null;
  assignedTarget?: number | null;
  currentCount?: number | null;
  questionMode?: "INDEPENDENT" | "STIMULUS_GROUP" | null;
  stimulusCode?: string | null;
  stimulusLanguage?: string | null;
  stimulusTitleHtml?: string | null;
  stimulusInstructionsHtml?: string | null;
  stimulusContentHtml?: string | null;
  stimulusSource?: string | null;
};

type QuestionInitial = {
  id?: string;
  code?: string;
  blueprintId?: string;
  stemHtml?: string | null;
  explanationHtml?: string | null;
  answerKey?: string | null;
  difficulty?: string | null;
  status?: string | null;
  orderInStimulus?: number | null;
  options?: Record<string, string>;
};

export function QuestionForm({
  action,
  blueprints,
  initial,
  submitLabel = "Simpan draft",
  compact = false,
  isNewSlot = false,
}: {
  action: (formData: FormData) => Promise<void>;
  blueprints: BlueprintOption[];
  initial?: QuestionInitial;
  submitLabel?: string;
  compact?: boolean;
  isNewSlot?: boolean;
}) {
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(
    initial?.blueprintId ?? blueprints[0]?.id ?? "",
  );
  const [stem, setStem] = useState(
    initial?.stemHtml ?? "<p>Tuliskan pokok soal di sini.</p>",
  );
  const [explanation, setExplanation] = useState(
    initial?.explanationHtml ??
      "<p>Tuliskan pembahasan atau alasan kunci jawaban.</p>",
  );
  const [changeSummary, setChangeSummary] = useState(
    "<p>Perubahan soal oleh penulis.</p>",
  );
  const [options, setOptions] = useState<Record<string, string>>({
    A: initial?.options?.A ?? "<p>Pilihan A</p>",
    B: initial?.options?.B ?? "<p>Pilihan B</p>",
    C: initial?.options?.C ?? "<p>Pilihan C</p>",
    D: initial?.options?.D ?? "<p>Pilihan D</p>",
    E: initial?.options?.E ?? "<p>Pilihan E</p>",
  });

  const selected = useMemo(
    () => blueprints.find((bp) => bp.id === selectedBlueprintId),
    [blueprints, selectedBlueprintId],
  );
  const fixedSlot = Boolean(
    initial?.id && initial?.code && initial?.blueprintId,
  );

  return (
    <form
      action={action}
      className={
        compact
          ? "inline-edit-form form-grid question-editor-form"
          : "card panel form-grid question-editor-form"
      }
    >
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}
      <input type="hidden" name="stem" value={stem} />
      <input type="hidden" name="explanation" value={explanation} />
      <input type="hidden" name="changeSummary" value={changeSummary} />
      {optionLabels.map((label) => (
        <input
          key={label}
          type="hidden"
          name={`option${label}`}
          value={options[label]}
        />
      ))}

      {!compact ? (
        <div className="panel-heading">
          <h3>
            <FileQuestion size={18} />{" "}
            {isNewSlot ? "Buat soal pada slot" : "Edit soal"}
          </h3>
        </div>
      ) : null}
      <div className="two-columns">
        <label className="field-block">
          <span className="field-label">Kode soal</span>
          <input
            className="text-input code-input"
            value={initial?.code ?? "Kode slot otomatis"}
            disabled
            readOnly
          />
        </label>
        <label className="field-block">
          <span className="field-label">Kode kisi-kisi</span>
          {fixedSlot ? (
            <>
              <input
                type="hidden"
                name="blueprintId"
                value={selectedBlueprintId}
              />
              <input
                className="text-input"
                value={
                  selected
                    ? `${selected.code} — ${selected.label}`
                    : selectedBlueprintId
                }
                disabled
                readOnly
              />
            </>
          ) : (
            <select
              className="select-input"
              name="blueprintId"
              required
              value={selectedBlueprintId}
              onChange={(event) => setSelectedBlueprintId(event.target.value)}
            >
              {blueprints.map((bp) => (
                <option key={bp.id} value={bp.id}>
                  {bp.code} — {bp.label}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>
      {selected ? (
        <div className="assignment-hint">
          Slot ini termasuk target{" "}
          <strong>
            {selected.assignedTarget ?? selected.target ?? 1} soal
          </strong>{" "}
          untuk kisi-kisi <strong>{selected.code}</strong>.
        </div>
      ) : null}
      {selected?.questionMode === "STIMULUS_GROUP" ? (
        <section className="question-stimulus-reference">
          <div className="question-stimulus-reference-head">
            <div>
              <span className="eyebrow">Gunakan stimulus yang sama</span>
              <strong>
                {selected.stimulusCode ?? "Stimulus belum tersedia"}
              </strong>
            </div>
            <span className="badge">
              Soal {initial?.orderInStimulus ?? "-"} ·{" "}
              {(selected.stimulusLanguage ?? "en").toUpperCase()}
            </span>
          </div>
          {selected.stimulusInstructionsHtml ? (
            <div
              className="stimulus-instructions"
              dangerouslySetInnerHTML={{
                __html: selected.stimulusInstructionsHtml,
              }}
            />
          ) : null}
          {selected.stimulusContentHtml ? (
            <details>
              <summary className="secondary-button">Lihat reading text</summary>
              <div className="stimulus-reading-card">
                <div
                  dangerouslySetInnerHTML={{
                    __html: selected.stimulusTitleHtml ?? "",
                  }}
                />
                <div
                  className="stimulus-content"
                  dangerouslySetInnerHTML={{
                    __html: selected.stimulusContentHtml,
                  }}
                />
                {selected.stimulusSource ? (
                  <p className="stimulus-source">
                    Sumber: {selected.stimulusSource}
                  </p>
                ) : null}
              </div>
            </details>
          ) : (
            <p className="danger-text">
              Reading text belum diisi pada menu Kisi-kisi.
            </p>
          )}
          <p className="muted-text">
            Isi field Soal / Stem hanya dengan pertanyaan. Jangan menyalin
            reading text ke setiap nomor.
          </p>
        </section>
      ) : null}
      <SimulationEmbedBuilder
        targetLabel={selected?.questionMode === "STIMULUS_GROUP" ? "pertanyaan" : "soal/stem"}
        onInsert={(html) => setStem((current) => `${current}\n${html}`)}
      />

      <RichTextEditor
        label={
          selected?.questionMode === "STIMULUS_GROUP"
            ? `Pertanyaan nomor ${initial?.orderInStimulus ?? ""}`
            : "Soal / Stem"
        }
        value={stem}
        onChange={setStem}
        minHeight={170}
        required
      />
      <div className="option-form-grid">
        {optionLabels.map((label) => (
          <RichTextEditor
            key={label}
            label={`Jawaban ${label}`}
            value={options[label]}
            onChange={(html) =>
              setOptions((current) => ({ ...current, [label]: html }))
            }
            minHeight={80}
            required
          />
        ))}
      </div>
      <div className="two-columns">
        <label className="field-block">
          <span className="field-label">Kunci jawaban</span>
          <select
            className="select-input"
            name="answerKey"
            defaultValue={initial?.answerKey ?? "A"}
          >
            {optionLabels.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field-block">
          <span className="field-label">Kesulitan</span>
          <select
            className="select-input"
            name="difficulty"
            defaultValue={initial?.difficulty ?? "MEDIUM"}
          >
            <option value="EASY">Mudah</option>
            <option value="MEDIUM">Sedang</option>
            <option value="HARD">Sulit</option>
          </select>
        </label>
      </div>
      <RichTextEditor
        label="Pembahasan"
        value={explanation}
        onChange={setExplanation}
      />
      {!isNewSlot ? (
        <RichTextEditor
          label="Ringkasan perubahan"
          value={changeSummary}
          onChange={setChangeSummary}
        />
      ) : null}
      <div className="editor-actions">
        <button className="primary-button" type="submit">
          <Save size={16} /> {submitLabel}
        </button>
      </div>
    </form>
  );
}
