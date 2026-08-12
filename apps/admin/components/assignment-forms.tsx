"use client";

import { RichTextEditor } from "@seleksi/ui";
import { ClipboardCheck, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

type Option = { id: string; label: string; targetCount?: number };

type AssignmentInitial = {
  id?: string;
  blueprintId?: string;
  originalBlueprintId?: string;
  assignedToId?: string;
  originalAssignedToId?: string;
  targetCount?: number | null;
  noteHtml?: string | null;
  status?: string | null;
  dueAt?: string | null;
};

function BlueprintCheckboxPicker({
  blueprints,
  selectedIds,
  unavailableBlueprintIds = [],
  onToggle,
  disabled,
  inputPrefix
}: {
  blueprints: Option[];
  selectedIds: string[];
  unavailableBlueprintIds?: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  inputPrefix: string;
}) {
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const unavailableSet = useMemo(() => new Set(unavailableBlueprintIds), [unavailableBlueprintIds]);
  const filteredBlueprints = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return blueprints;
    return blueprints.filter((item) => item.label.toLowerCase().includes(keyword));
  }, [blueprints, searchTerm]);
  const availableCount = blueprints.filter((item) => !unavailableSet.has(item.id)).length;

  return (
    <div className="assignment-picker">
      <div className="assignment-search-row">
        <input
          className="text-input"
          type="search"
          placeholder="Cari kode atau judul kisi-kisi..."
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setSearchTerm(searchDraft);
            }
          }}
          disabled={disabled}
        />
        <button className="secondary-button" type="button" onClick={() => setSearchTerm(searchDraft)} disabled={disabled}>
          <Search size={15} /> Cari
        </button>
      </div>
      <div className="assignment-selection-summary">
        <span>{selectedIds.length} kisi-kisi dipilih</span>
        <span>{availableCount} kisi-kisi tersedia</span>
      </div>
      <div className="assignment-checkbox-list">
        {filteredBlueprints.map((item) => {
          const isUnavailable = unavailableSet.has(item.id);
          const checkboxId = `${inputPrefix}-${item.id}`;
          return (
            <label key={item.id} className={`assignment-checkbox-item${isUnavailable ? " is-disabled" : ""}`} htmlFor={checkboxId}>
              <input
                id={checkboxId}
                type="checkbox"
                name="blueprintIds"
                value={item.id}
                checked={selectedIds.includes(item.id)}
                disabled={disabled || isUnavailable}
                onChange={() => onToggle(item.id)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{isUnavailable ? "Sudah diplot, tidak bisa dipilih lagi" : `${item.targetCount ?? 1} slot soal`}</small>
              </span>
            </label>
          );
        })}
        {!filteredBlueprints.length ? <div className="assignment-picker-empty">Kisi-kisi tidak ditemukan.</div> : null}
      </div>
    </div>
  );
}

export function WritingAssignmentForm({
  action,
  blueprints,
  authors,
  initial,
  compact = false,
  unavailableBlueprintIds = []
}: {
  action: (formData: FormData) => Promise<void>;
  blueprints: Option[];
  authors: Option[];
  initial?: AssignmentInitial;
  compact?: boolean;
  unavailableBlueprintIds?: string[];
}) {
  const [note, setNote] = useState(initial?.noteHtml ?? "<p>Tulis seluruh slot soal sesuai kode kisi-kisi yang ditugaskan.</p>");
  const [blueprintId, setBlueprintId] = useState(initial?.blueprintId ?? blueprints[0]?.id ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId ?? "");
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState<string[]>(initial?.blueprintId ? [initial.blueprintId] : []);
  const selected = useMemo(() => blueprints.find((item) => item.id === blueprintId), [blueprints, blueprintId]);
  const selectedBlueprints = useMemo(
    () => blueprints.filter((item) => selectedBlueprintIds.includes(item.id)),
    [blueprints, selectedBlueprintIds]
  );
  const selectedTargetCount = selectedBlueprints.reduce((total, item) => total + (item.targetCount ?? 1), 0);

  const toggleBlueprint = (id: string) => {
    setSelectedBlueprintIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  if (compact) {
    return (
      <form action={action} className="inline-edit-form form-grid">
        {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
        {initial?.originalBlueprintId ? <input type="hidden" name="originalBlueprintId" value={initial.originalBlueprintId} /> : null}
        {initial?.originalAssignedToId ? <input type="hidden" name="originalAssignedToId" value={initial.originalAssignedToId} /> : null}
        <input type="hidden" name="note" value={note} />
        <label className="field-block"><span className="field-label">Kode kisi-kisi</span><select className="select-input" name="blueprintId" value={blueprintId} onChange={(event) => setBlueprintId(event.target.value)} required>{blueprints.map((item) => <option key={item.id} value={item.id} disabled={unavailableBlueprintIds.includes(item.id)}>{item.label}{unavailableBlueprintIds.includes(item.id) ? " — sudah diplot" : ""}</option>)}</select></label>
        <label className="field-block"><span className="field-label">Penulis soal</span><select className="select-input" name="assignedToId" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} required>{authors.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className="two-columns">
          <label className="field-block"><span className="field-label">Target slot soal</span><input className="text-input" value={selected?.targetCount ?? initial?.targetCount ?? 1} disabled readOnly /><span className="field-help">Mengikuti jumlah soal pada kisi-kisi.</span></label>
          <label className="field-block"><span className="field-label">Batas waktu</span><input className="text-input" name="dueAt" type="date" defaultValue={initial?.dueAt ?? undefined} /></label>
        </div>
        <label className="field-block"><span className="field-label">Status</span><select className="select-input" name="status" defaultValue={initial?.status ?? "ASSIGNED"}><option value="ASSIGNED">Ditugaskan</option><option value="IN_PROGRESS">Dikerjakan</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Dibatalkan</option></select></label>
        <RichTextEditor label="Catatan tugas" value={note} onChange={setNote} />
        <button className="primary-button" type="submit">Simpan plotting penulis</button>
      </form>
    );
  }

  return (
    <form action={action} className="card panel form-grid">
      <input type="hidden" name="note" value={note} />
      <div className="panel-heading"><h3><ClipboardCheck size={18} /> Plotting penulis soal</h3></div>
      <label className="field-block">
        <span className="field-label">Penulis soal</span>
        <select className="select-input" name="assignedToId" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} required>
          <option value="" disabled>Pilih penulis terlebih dahulu</option>
          {authors.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {assignedToId ? (
        <div className="field-block">
          <span className="field-label">Kisi-kisi yang ditugaskan</span>
          <BlueprintCheckboxPicker
            blueprints={blueprints}
            selectedIds={selectedBlueprintIds}
            unavailableBlueprintIds={unavailableBlueprintIds}
            onToggle={toggleBlueprint}
            inputPrefix="writer-blueprint"
          />
        </div>
      ) : (
        <div className="assignment-hint">Pilih penulis terlebih dahulu, lalu daftar centang kisi-kisi akan muncul.</div>
      )}
      <div className="two-columns">
        <label className="field-block"><span className="field-label">Total target slot soal</span><input className="text-input" value={selectedTargetCount || "-"} disabled readOnly /><span className="field-help">Akumulasi dari seluruh kisi-kisi yang dicentang.</span></label>
        <label className="field-block"><span className="field-label">Batas waktu</span><input className="text-input" name="dueAt" type="date" defaultValue={initial?.dueAt ?? undefined} /></label>
      </div>
      <RichTextEditor label="Catatan tugas" value={note} onChange={setNote} />
      <button className="primary-button" type="submit" disabled={!assignedToId || selectedBlueprintIds.length === 0}>Simpan plotting penulis</button>
    </form>
  );
}

export function ValidationAssignmentForm({
  action,
  blueprints,
  validators,
  initial,
  compact = false,
  unavailableBlueprintIds = []
}: {
  action: (formData: FormData) => Promise<void>;
  blueprints: Option[];
  validators: Option[];
  initial?: AssignmentInitial;
  compact?: boolean;
  unavailableBlueprintIds?: string[];
}) {
  const [note, setNote] = useState(initial?.noteHtml ?? "<p>Validasi seluruh soal pada kode kisi-kisi ini: redaksi, opsi, kunci jawaban, dan pembahasan.</p>");
  const [blueprintId, setBlueprintId] = useState(initial?.blueprintId ?? blueprints[0]?.id ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId ?? "");
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState<string[]>(initial?.blueprintId ? [initial.blueprintId] : []);
  const selected = useMemo(() => blueprints.find((item) => item.id === blueprintId), [blueprints, blueprintId]);
  const selectedBlueprints = useMemo(
    () => blueprints.filter((item) => selectedBlueprintIds.includes(item.id)),
    [blueprints, selectedBlueprintIds]
  );
  const selectedTargetCount = selectedBlueprints.reduce((total, item) => total + (item.targetCount ?? 1), 0);

  const toggleBlueprint = (id: string) => {
    setSelectedBlueprintIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  if (compact) {
    return (
      <form action={action} className="inline-edit-form form-grid">
        {initial?.originalBlueprintId ? <input type="hidden" name="originalBlueprintId" value={initial.originalBlueprintId} /> : null}
        {initial?.originalAssignedToId ? <input type="hidden" name="originalAssignedToId" value={initial.originalAssignedToId} /> : null}
        <input type="hidden" name="note" value={note} />
        <label className="field-block"><span className="field-label">Kode kisi-kisi yang divalidasi</span><select className="select-input" name="blueprintId" value={blueprintId} onChange={(event) => setBlueprintId(event.target.value)} required>{blueprints.map((item) => <option key={item.id} value={item.id} disabled={unavailableBlueprintIds.includes(item.id)}>{item.label}{unavailableBlueprintIds.includes(item.id) ? " — sudah diplot" : ""}</option>)}</select></label>
        {selected ? <div className="assignment-hint">Validator akan menerima seluruh <strong>{selected.targetCount ?? 1} slot soal</strong> pada kisi-kisi ini. Soal akan muncul di antrian validasi setelah penulis mengirimkannya.</div> : null}
        <label className="field-block"><span className="field-label">Validator soal</span><select className="select-input" name="assignedToId" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} required>{validators.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="field-block"><span className="field-label">Status seluruh tugas</span><select className="select-input" name="status" defaultValue={initial?.status ?? "ASSIGNED"}><option value="ASSIGNED">Ditugaskan</option><option value="IN_REVIEW">Sedang direview</option><option value="DONE">Selesai</option><option value="CANCELLED">Dibatalkan</option></select></label>
        <RichTextEditor label="Catatan validasi" value={note} onChange={setNote} />
        <button className="primary-button" type="submit">Simpan plotting validator</button>
      </form>
    );
  }

  return (
    <form action={action} className="card panel form-grid">
      <input type="hidden" name="note" value={note} />
      <div className="panel-heading"><h3><ShieldCheck size={18} /> Plotting validator soal</h3></div>
      <label className="field-block">
        <span className="field-label">Validator soal</span>
        <select className="select-input" name="assignedToId" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} required>
          <option value="" disabled>Pilih validator terlebih dahulu</option>
          {validators.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {assignedToId ? (
        <div className="field-block">
          <span className="field-label">Kisi-kisi yang divalidasi</span>
          <BlueprintCheckboxPicker
            blueprints={blueprints}
            selectedIds={selectedBlueprintIds}
            unavailableBlueprintIds={unavailableBlueprintIds}
            onToggle={toggleBlueprint}
            inputPrefix="validator-blueprint"
          />
        </div>
      ) : (
        <div className="assignment-hint">Pilih validator terlebih dahulu, lalu daftar centang kisi-kisi akan muncul.</div>
      )}
      <div className="assignment-hint">Validator akan menerima seluruh slot soal pada kisi-kisi yang dicentang. Total saat ini: <strong>{selectedTargetCount || 0} slot soal</strong>.</div>
      <RichTextEditor label="Catatan validasi" value={note} onChange={setNote} />
      <button className="primary-button" type="submit" disabled={!assignedToId || selectedBlueprintIds.length === 0}>Simpan plotting validator</button>
    </form>
  );
}
