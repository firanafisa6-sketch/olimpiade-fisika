"use client";

import { BookOpenText, CheckCircle2, Search, Shuffle, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";

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

export function PackageBlueprintSelector({
  blueprints,
  defaultSubject = "",
  defaultModes = {},
}: {
  blueprints: BlueprintChoice[];
  defaultSubject?: string;
  defaultModes?: Record<string, "ALL" | "RANDOM_ONE">;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(defaultModes).map((id) => [id, true])),
  );

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return blueprints;
    return blueprints.filter((item) =>
      [item.code, item.title, item.testGroup, item.testTopic]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [blueprints, query]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="package-builder-fields">
      <label className="field-block subject-field">
        <span className="field-label">Bidang yang diuji</span>
        <input
          className="text-input"
          name="subjectName"
          defaultValue={defaultSubject}
          placeholder="Contoh: Literasi Bahasa"
          required
        />
        <small className="muted-text">
          Isi bidang terlebih dahulu, lalu pilih kode kisi-kisi yang membentuk paket.
        </small>
      </label>

      <div className="package-selector-toolbar">
        <label className="package-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari kode, kelompok tes, atau topik..."
          />
        </label>
        <span className="badge">{selectedCount} kisi-kisi dipilih</span>
      </div>

      <div className="blueprint-choice-list">
        {visible.map((item) => {
          const checked = Boolean(selected[item.id]);
          return (
            <article
              className={`blueprint-choice-card ${checked ? "is-selected" : ""} ${!item.ready ? "is-disabled" : ""}`}
              key={item.id}
            >
              <label className="blueprint-choice-main">
                <input
                  type="checkbox"
                  name="blueprintIds"
                  value={item.id}
                  checked={checked}
                  disabled={!item.ready}
                  onChange={(event) =>
                    setSelected((current) => ({
                      ...current,
                      [item.id]: event.target.checked,
                    }))
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
                  <small>
                    {item.testGroup || "Tanpa kelompok"} · {item.testTopic || "Tanpa topik"}
                  </small>
                  <small>
                    {item.approvedCount}/{item.expectedCount} soal APPROVED
                    {item.questionMode === "STIMULUS_GROUP"
                      ? ` · stimulus ${item.stimulusApproved ? "APPROVED" : "belum APPROVED"}`
                      : ""}
                  </small>
                </span>
                {item.ready ? (
                  <CheckCircle2 className="choice-ready-icon" size={19} />
                ) : (
                  <span className="badge warning">Belum siap</span>
                )}
              </label>

              {checked ? (
                <label className="selection-mode-field">
                  <span>
                    <Shuffle size={16} /> Cara mengambil soal
                  </span>
                  <select
                    className="select-input"
                    name={`selectionMode:${item.id}`}
                    defaultValue={defaultModes[item.id] ?? "RANDOM_ONE"}
                  >
                    <option value="RANDOM_ONE">Random pilih 1 soal</option>
                    <option value="ALL">Ujikan semua soal</option>
                  </select>
                  <small className="muted-text">
                    Random dilakukan satu kali ketika peserta memulai ujian dan tidak berubah setelah refresh.
                  </small>
                </label>
              ) : null}
            </article>
          );
        })}
        {!visible.length ? (
          <p className="muted-text empty-selector-state">Tidak ada kisi-kisi yang cocok.</p>
        ) : null}
      </div>
    </div>
  );
}
