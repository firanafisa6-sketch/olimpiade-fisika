"use client";

import { RichTextEditor } from "@seleksi/ui";
import { AlertCircle, CheckCircle2, Save, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const optionLabels = ["A", "B", "C", "D", "E"] as const;

export type ReviewActionState = {
  ok: boolean;
  message: string;
  timestamp: number;
};

const initialActionState: ReviewActionState = {
  ok: true,
  message: "",
  timestamp: 0,
};

type ReviewInitial = {
  id: string;
  stemHtml?: string | null;
  explanationHtml?: string | null;
  validatorNotesHtml?: string | null;
  answerKey?: string | null;
  difficulty?: string | null;
  options?: Record<string, string>;
};

export function ReviewQuestionForm({
  action,
  formId,
  initial
}: {
  action: (state: ReviewActionState, formData: FormData) => Promise<ReviewActionState>;
  formId?: string;
  initial: ReviewInitial;
}) {
  const [stem, setStem] = useState(initial.stemHtml ?? "<p></p>");
  const [explanation, setExplanation] = useState(initial.explanationHtml ?? "<p></p>");
  const [validatorNotes, setValidatorNotes] = useState(initial.validatorNotesHtml ?? "<p></p>");
  const [options, setOptions] = useState<Record<string, string>>({
    A: initial.options?.A ?? "<p></p>",
    B: initial.options?.B ?? "<p></p>",
    C: initial.options?.C ?? "<p></p>",
    D: initial.options?.D ?? "<p></p>",
    E: initial.options?.E ?? "<p></p>"
  });
  const [actionState, formAction, pending] = useActionState(action, initialActionState);
  const [toastVisible, setToastVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!actionState.timestamp || !actionState.message) return;
    setToastVisible(true);
    const timer = window.setTimeout(() => setToastVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [actionState.timestamp, actionState.message]);

  return (
    <>
      <form id={formId} action={formAction} className="inline-edit-form form-grid review-form-wide">
        <input type="hidden" name="id" value={initial.id} />
        <input type="hidden" name="stem" value={stem} />
        <input type="hidden" name="explanation" value={explanation} />
        <input type="hidden" name="validatorNotes" value={validatorNotes} />
        {optionLabels.map((label) => <input key={label} type="hidden" name={`option${label}`} value={options[label]} />)}

        <RichTextEditor label="Perbaikan soal" value={stem} onChange={setStem} minHeight={170} required />
        <div className="option-form-grid">
          {optionLabels.map((label) => (
            <RichTextEditor key={label} label={`Jawaban ${label}`} value={options[label]} onChange={(html) => setOptions((current) => ({ ...current, [label]: html }))} minHeight={80} required />
          ))}
        </div>
        <div className="two-columns">
          <label className="field-block"><span className="field-label">Kunci jawaban</span><select className="select-input" name="answerKey" defaultValue={initial.answerKey ?? "A"}>{optionLabels.map((label) => <option key={label}>{label}</option>)}</select></label>
          <label className="field-block"><span className="field-label">Kesulitan</span><select className="select-input" name="difficulty" defaultValue={initial.difficulty ?? "MEDIUM"}><option value="EASY">Mudah</option><option value="MEDIUM">Sedang</option><option value="HARD">Sulit</option></select></label>
        </div>
        <RichTextEditor label="Pembahasan / jawaban" value={explanation} onChange={setExplanation} />
        <RichTextEditor label="Catatan validator" value={validatorNotes} onChange={setValidatorNotes} minHeight={120} />
        <div className="review-form-actions">
          <button className="primary-button" type="submit" name="decision" value="EDIT_AND_FORWARD" disabled={pending}>
            <Save size={16} /> {pending ? "Menyimpan..." : "Simpan perbaikan"}
          </button>
        </div>
      </form>

      {mounted && toastVisible && actionState.message
        ? createPortal(
            <div
              className={`review-save-toast ${actionState.ok ? "success" : "error"}`}
              role={actionState.ok ? "status" : "alert"}
              aria-live="polite"
            >
              {actionState.ok ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
              <div>
                <strong>{actionState.ok ? "Berhasil disimpan" : "Penyimpanan gagal"}</strong>
                <span>{actionState.message}</span>
              </div>
              <button type="button" onClick={() => setToastVisible(false)} aria-label="Tutup notifikasi">
                <X size={18} />
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
