"use client";

import { RichTextEditor } from "@seleksi/ui";
import { SimulationEmbedBuilder } from "@/components/simulation-embed-builder";
import { BookOpenText, ClipboardList, Save } from "lucide-react";
import { useState } from "react";

type BlueprintInitial = {
  id?: string;
  code?: string;
  testGroupHtml?: string | null;
  testTopicHtml?: string | null;
  titleHtml?: string | null;
  competencyHtml?: string | null;
  indicatorHtml?: string | null;
  materialHtml?: string | null;
  gridHtml?: string | null;
  confidentialLabel?: string | null;
  cognitiveLevel?: string | null;
  expectedQuestionCount?: number | null;
  questionMode?: "INDEPENDENT" | "STIMULUS_GROUP" | null;
  stimulusCode?: string | null;
  stimulusLanguage?: string | null;
  stimulusType?: string | null;
  stimulusTitleHtml?: string | null;
  stimulusInstructionsHtml?: string | null;
  stimulusContentHtml?: string | null;
  stimulusSource?: string | null;
  stimulusCopyrightNote?: string | null;
};

export function BlueprintForm({
  action,
  initial,
  submitLabel = "Simpan kisi-kisi",
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  initial?: BlueprintInitial;
  submitLabel?: string;
  compact?: boolean;
}) {
  const [testGroup, setTestGroup] = useState(
    initial?.testGroupHtml ?? initial?.titleHtml ?? "<p>Bahasa Inggris</p>",
  );
  const [testTopic, setTestTopic] = useState(
    initial?.testTopicHtml ??
      initial?.competencyHtml ??
      "<p>Reading Comprehension</p>",
  );
  const [indicator, setIndicator] = useState(
    initial?.indicatorHtml ??
      "<p>Peserta mampu menemukan gagasan utama, informasi rinci, rujukan kata, dan simpulan teks.</p>",
  );
  const [material, setMaterial] = useState(
    initial?.materialHtml ?? "<p>Reading text</p>",
  );
  const [grid, setGrid] = useState(
    initial?.gridHtml ??
      "<p>Disajikan sebuah teks berbahasa Inggris, peserta dapat menjawab pertanyaan berdasarkan informasi tersurat dan tersirat.</p>",
  );
  const [changeSummary, setChangeSummary] = useState(
    "<p>Penyesuaian kisi-kisi dan stimulus.</p>",
  );
  const [questionMode, setQuestionMode] = useState<
    "INDEPENDENT" | "STIMULUS_GROUP"
  >(initial?.questionMode ?? "INDEPENDENT");
  const [stimulusTitle, setStimulusTitle] = useState(
    initial?.stimulusTitleHtml ?? "<p>Reading Text</p>",
  );
  const [stimulusInstructions, setStimulusInstructions] = useState(
    initial?.stimulusInstructionsHtml ??
      "<p>Read the following text and answer the questions.</p>",
  );
  const [stimulusContent, setStimulusContent] = useState(
    initial?.stimulusContentHtml ??
      "<p>Write or paste the English reading text here.</p>",
  );

  return (
    <form
      action={action}
      className={
        compact ? "inline-edit-form form-grid" : "card panel form-grid"
      }
    >
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}
      <input type="hidden" name="testGroup" value={testGroup} />
      <input type="hidden" name="testTopic" value={testTopic} />
      <input type="hidden" name="indicator" value={indicator} />
      <input type="hidden" name="material" value={material} />
      <input type="hidden" name="grid" value={grid} />
      <input type="hidden" name="questionMode" value={questionMode} />
      <input type="hidden" name="stimulusTitle" value={stimulusTitle} />
      <input
        type="hidden"
        name="stimulusInstructions"
        value={stimulusInstructions}
      />
      <input type="hidden" name="stimulusContent" value={stimulusContent} />
      {initial?.id ? (
        <input type="hidden" name="changeSummary" value={changeSummary} />
      ) : null}

      {!compact ? (
        <div className="panel-heading">
          <h3>
            <ClipboardList size={18} /> Tambah kisi-kisi
          </h3>
        </div>
      ) : null}
      <div className="two-columns">
        <label className="field-block">
          <span className="field-label">Kode kisi-kisi</span>
          <input
            className="text-input"
            value={initial?.code ?? "Digenerate otomatis oleh sistem"}
            disabled
            readOnly
          />
        </label>
        <label className="field-block">
          <span className="field-label">Target jumlah soal</span>
          <input
            className="text-input"
            name="expectedQuestionCount"
            type="number"
            min={1}
            defaultValue={initial?.expectedQuestionCount ?? 5}
            required
          />
        </label>
      </div>
      <div className="two-columns">
        <label className="field-block">
          <span className="field-label">Label kerahasiaan</span>
          <input
            className="text-input"
            name="confidentialLabel"
            defaultValue={initial?.confidentialLabel ?? "SANGAT RAHASIA"}
          />
        </label>
        <label className="field-block">
          <span className="field-label">Level kognitif</span>
          <select
            className="select-input"
            name="cognitiveLevel"
            defaultValue={initial?.cognitiveLevel ?? "C3"}
          >
            <option>C1</option>
            <option>C2</option>
            <option>C3</option>
            <option>C4</option>
            <option>C5</option>
            <option>C6</option>
          </select>
        </label>
      </div>

      <label className="field-block">
        <span className="field-label">Bentuk soal</span>
        <select
          className="select-input"
          value={questionMode}
          onChange={(event) =>
            setQuestionMode(
              event.target.value as "INDEPENDENT" | "STIMULUS_GROUP",
            )
          }
        >
          <option value="INDEPENDENT">
            Soal mandiri — setiap soal berdiri sendiri
          </option>
          <option value="STIMULUS_GROUP">
            Kelompok stimulus — satu reading text untuk beberapa soal
          </option>
        </select>
      </label>

      <RichTextEditor
        label="Kelompok Uji"
        value={testGroup}
        onChange={setTestGroup}
        required
      />
      <RichTextEditor
        label="Topik Uji"
        value={testTopic}
        onChange={setTestTopic}
        required
      />
      <RichTextEditor
        label="Indikator"
        value={indicator}
        onChange={setIndicator}
        required
      />
      <RichTextEditor
        label="Materi Uji"
        value={material}
        onChange={setMaterial}
      />
      <RichTextEditor
        label="Kisi-Kisi"
        value={grid}
        onChange={setGrid}
        minHeight={170}
        required
      />

      {questionMode === "STIMULUS_GROUP" ? (
        <section className="stimulus-editor-panel">
          <div className="panel-heading">
            <div>
              <h3>
                <BookOpenText size={18} /> Stimulus / Reading Text
              </h3>
              <p className="muted-text">
                Teks ini dipakai bersama oleh seluruh soal dalam kode kisi-kisi.
              </p>
            </div>
            <span className="badge">
              {initial?.stimulusCode ?? "Kode otomatis"}
            </span>
          </div>
          <div className="two-columns">
            <label className="field-block">
              <span className="field-label">Bahasa stimulus</span>
              <select
                className="select-input"
                name="stimulusLanguage"
                defaultValue={initial?.stimulusLanguage ?? "en"}
              >
                <option value="en">English</option>
                <option value="id">Indonesia</option>
                <option value="other">Lainnya</option>
              </select>
            </label>
            <label className="field-block">
              <span className="field-label">Jenis stimulus</span>
              <select
                className="select-input"
                name="stimulusType"
                defaultValue={initial?.stimulusType ?? "TEXT"}
              >
                <option value="TEXT">Teks / Reading</option>
                <option value="TEXT_IMAGE">Teks + gambar</option>
                <option value="TEXT_TABLE">Teks + tabel</option>
                <option value="AUDIO">Audio / Listening</option>
                <option value="MIXED">Campuran / Simulasi GitHub Pages</option>
              </select>
            </label>
          </div>
          <RichTextEditor
            label="Judul stimulus"
            value={stimulusTitle}
            onChange={setStimulusTitle}
            required
          />
          <RichTextEditor
            label="Petunjuk stimulus"
            value={stimulusInstructions}
            onChange={setStimulusInstructions}
            required
          />
          <SimulationEmbedBuilder
            targetLabel="isi stimulus"
            onInsert={(html) => setStimulusContent((current) => `${current}\n${html}`)}
          />

          <RichTextEditor
            label="Isi reading text / stimulus"
            value={stimulusContent}
            onChange={setStimulusContent}
            minHeight={300}
            required
          />
          <div className="two-columns">
            <label className="field-block">
              <span className="field-label">Sumber teks</span>
              <input
                className="text-input"
                name="stimulusSource"
                defaultValue={initial?.stimulusSource ?? ""}
                placeholder="Contoh: Adapted from ..."
              />
            </label>
            <label className="field-block">
              <span className="field-label">Catatan hak cipta</span>
              <input
                className="text-input"
                name="stimulusCopyrightNote"
                defaultValue={initial?.stimulusCopyrightNote ?? ""}
              />
            </label>
          </div>
        </section>
      ) : null}

      {initial?.id ? (
        <RichTextEditor
          label="Ringkasan perubahan"
          value={changeSummary}
          onChange={setChangeSummary}
        />
      ) : null}
      <button className="primary-button" type="submit">
        <Save size={16} /> {submitLabel}
      </button>
    </form>
  );
}
