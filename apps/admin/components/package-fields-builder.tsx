"use client";

import {
  BookOpenText,
  CheckCircle2,
  GripVertical,
  Layers3,
  Plus,
  Search,
  Shuffle,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

type SelectionMode = "ALL" | "RANDOM_ONE";

type BlueprintChoice = {
  id: string;
  code: string;
  title: string;
  testGroup: string;
  testTopic: string;
  questionMode: "INDEPENDENT" | "STIMULUS_GROUP";
  approvedCount: number;
  expectedCount: number;
  stimulusApproved: boolean;
  ready: boolean;
};

export type PackageFieldDefault = {
  key: string;
  name: string;
  description?: string;
  durationMinutes: number;
  modes: Record<string, SelectionMode>;
};

type FieldState = PackageFieldDefault & { query: string };

function makeKey() {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyField(index: number): FieldState {
  return {
    key: makeKey(),
    name: index === 0 ? "Literasi Bahasa" : `Bidang ${index + 1}`,
    description: "",
    durationMinutes: 30,
    modes: {},
    query: "",
  };
}

export function PackageFieldsBuilder({
  blueprints,
  defaults,
}: {
  blueprints: BlueprintChoice[];
  defaults?: PackageFieldDefault[];
}) {
  const [fields, setFields] = useState<FieldState[]>(() =>
    defaults?.length
      ? defaults.map((field) => ({ ...field, query: "" }))
      : [emptyField(0)],
  );

  const blueprintOwner = useMemo(() => {
    const result: Record<string, string> = {};
    for (const field of fields) {
      for (const blueprintId of Object.keys(field.modes)) result[blueprintId] = field.key;
    }
    return result;
  }, [fields]);

  const totalDuration = fields.reduce(
    (total, field) => total + Math.max(1, Number(field.durationMinutes) || 0),
    0,
  );
  const totalBlueprints = fields.reduce(
    (total, field) => total + Object.keys(field.modes).length,
    0,
  );

  function updateField(key: string, patch: Partial<FieldState>) {
    setFields((current) =>
      current.map((field) => (field.key === key ? { ...field, ...patch } : field)),
    );
  }

  function addField() {
    setFields((current) => [...current, emptyField(current.length)]);
  }

  function removeField(key: string) {
    setFields((current) =>
      current.length <= 1 ? current : current.filter((field) => field.key !== key),
    );
  }

  function toggleBlueprint(fieldKey: string, blueprintId: string, checked: boolean) {
    setFields((current) =>
      current.map((field) => {
        if (field.key !== fieldKey) return field;
        const modes = { ...field.modes };
        if (checked) modes[blueprintId] = modes[blueprintId] ?? "RANDOM_ONE";
        else delete modes[blueprintId];
        return { ...field, modes };
      }),
    );
  }

  function setMode(fieldKey: string, blueprintId: string, mode: SelectionMode) {
    setFields((current) =>
      current.map((field) =>
        field.key === fieldKey
          ? { ...field, modes: { ...field.modes, [blueprintId]: mode } }
          : field,
      ),
    );
  }

  return (
    <div className="package-fields-builder">
      <div className="package-fields-overview">
        <div>
          <span className="eyebrow">Struktur paket</span>
          <h3>{fields.length} bidang ujian</h3>
          <p className="muted-text">
            Setiap bidang memiliki durasi dan daftar kisi-kisi sendiri. Peserta diplot setelah paket disimpan.
          </p>
        </div>
        <div className="package-fields-metrics">
          <span><strong>{totalBlueprints}</strong> kisi-kisi</span>
          <span><strong>{totalDuration}</strong> menit total</span>
        </div>
      </div>

      <div className="package-field-list">
        {fields.map((field, fieldIndex) => {
          const keyword = field.query.trim().toLowerCase();
          const visible = keyword
            ? blueprints.filter((item) =>
                [item.code, item.title, item.testGroup, item.testTopic]
                  .join(" ")
                  .toLowerCase()
                  .includes(keyword),
              )
            : blueprints;
          const selectedCount = Object.keys(field.modes).length;

          return (
            <section className="package-field-card" key={field.key}>
              <input type="hidden" name="fieldKeys" value={field.key} />
              <header className="package-field-header">
                <div className="package-field-index"><GripVertical size={17} /><span>{fieldIndex + 1}</span></div>
                <div>
                  <strong>Bidang {fieldIndex + 1}</strong>
                  <small>{selectedCount} kisi-kisi dipilih</small>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  title="Hapus bidang"
                  disabled={fields.length === 1}
                  onClick={() => removeField(field.key)}
                >
                  <Trash2 size={17} />
                </button>
              </header>

              <div className="package-field-meta-grid">
                <label className="field-block">
                  <span className="field-label">Nama bidang</span>
                  <input
                    className="text-input"
                    name={`fieldName:${field.key}`}
                    value={field.name}
                    onChange={(event) => updateField(field.key, { name: event.target.value })}
                    placeholder="Contoh: Literasi Bahasa"
                    required
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">Durasi bidang</span>
                  <input
                    className="text-input"
                    name={`fieldDuration:${field.key}`}
                    type="number"
                    min={1}
                    value={field.durationMinutes}
                    onChange={(event) =>
                      updateField(field.key, { durationMinutes: Number(event.target.value) })
                    }
                    required
                  />
                </label>
                <label className="field-block package-field-description">
                  <span className="field-label">Keterangan bidang</span>
                  <input
                    className="text-input"
                    name={`fieldDescription:${field.key}`}
                    value={field.description ?? ""}
                    onChange={(event) => updateField(field.key, { description: event.target.value })}
                    placeholder="Opsional, misalnya petunjuk singkat bidang"
                  />
                </label>
              </div>

              <div className="package-selector-toolbar">
                <label className="package-search">
                  <Search size={17} />
                  <input
                    value={field.query}
                    onChange={(event) => updateField(field.key, { query: event.target.value })}
                    placeholder="Cari kode atau topik kisi-kisi..."
                  />
                </label>
                <span className="badge">{selectedCount} dipilih</span>
              </div>

              <div className="blueprint-choice-list compact-blueprint-list">
                {visible.map((item) => {
                  const checked = Boolean(field.modes[item.id]);
                  const ownedByOther = Boolean(
                    blueprintOwner[item.id] && blueprintOwner[item.id] !== field.key,
                  );
                  const disabled = !item.ready || ownedByOther;
                  return (
                    <article
                      className={`blueprint-choice-card ${checked ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                      key={item.id}
                    >
                      <label className="blueprint-choice-main">
                        <input
                          type="checkbox"
                          name={`fieldBlueprintIds:${field.key}`}
                          value={item.id}
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) =>
                            toggleBlueprint(field.key, item.id, event.target.checked)
                          }
                        />
                        <span className="blueprint-choice-copy">
                          <strong>
                            {item.questionMode === "STIMULUS_GROUP" ? (
                              <BookOpenText size={16} />
                            ) : (
                              <Layers3 size={16} />
                            )}
                            {item.code} — {item.title}
                          </strong>
                          <small>{item.testGroup || "Tanpa kelompok"} · {item.testTopic || "Tanpa topik"}</small>
                          <small>
                            {item.approvedCount}/{item.expectedCount} soal APPROVED
                            {ownedByOther ? " · sudah dipakai bidang lain" : ""}
                          </small>
                        </span>
                        {item.ready && !ownedByOther ? (
                          <CheckCircle2 className="choice-ready-icon" size={19} />
                        ) : (
                          <span className="badge warning">{ownedByOther ? "Terpakai" : "Belum siap"}</span>
                        )}
                      </label>

                      {checked ? (
                        <label className="selection-mode-field">
                          <span><Shuffle size={16} /> Cara mengambil soal</span>
                          <select
                            className="select-input"
                            name={`selectionMode:${field.key}:${item.id}`}
                            value={field.modes[item.id]}
                            onChange={(event) =>
                              setMode(field.key, item.id, event.target.value as SelectionMode)
                            }
                          >
                            <option value="RANDOM_ONE">Random pilih 1 soal</option>
                            <option value="ALL">Ujikan semua soal</option>
                          </select>
                        </label>
                      ) : null}
                    </article>
                  );
                })}
                {!visible.length ? <p className="muted-text empty-selector-state">Tidak ada kisi-kisi yang cocok.</p> : null}
              </div>
            </section>
          );
        })}
      </div>

      <button className="secondary-button add-package-field-button" type="button" onClick={addField}>
        <Plus size={17} /> Tambah bidang
      </button>
    </div>
  );
}
