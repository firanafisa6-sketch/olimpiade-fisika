"use client";

import { RichTextEditor } from "@seleksi/ui";
import { CheckCircle2, RotateCcw, Save } from "lucide-react";
import { useState } from "react";

type Initial = {
  id: string;
  titleHtml: string;
  instructionsHtml: string;
  contentHtml: string;
  source?: string | null;
  copyrightNote?: string | null;
};

export function StimulusReviewForm({
  action,
  initial,
}: {
  action: (formData: FormData) => Promise<void>;
  initial: Initial;
}) {
  const [title, setTitle] = useState(initial.titleHtml);
  const [instructions, setInstructions] = useState(initial.instructionsHtml);
  const [content, setContent] = useState(initial.contentHtml);
  const [notes, setNotes] = useState("<p>Catatan validasi reading text.</p>");

  return (
    <form
      action={action}
      className="inline-edit-form form-grid review-form-wide"
    >
      <input type="hidden" name="id" value={initial.id} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="instructions" value={instructions} />
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="validatorNotes" value={notes} />
      <RichTextEditor
        label="Judul stimulus"
        value={title}
        onChange={setTitle}
        required
      />
      <RichTextEditor
        label="Petunjuk"
        value={instructions}
        onChange={setInstructions}
        required
      />
      <RichTextEditor
        label="Reading text / stimulus hasil validasi"
        value={content}
        onChange={setContent}
        minHeight={320}
        required
      />
      <div className="two-columns">
        <label className="field-block">
          <span className="field-label">Sumber</span>
          <input
            className="text-input"
            name="source"
            defaultValue={initial.source ?? ""}
          />
        </label>
        <label className="field-block">
          <span className="field-label">Catatan hak cipta</span>
          <input
            className="text-input"
            name="copyrightNote"
            defaultValue={initial.copyrightNote ?? ""}
          />
        </label>
      </div>
      <RichTextEditor
        label="Catatan validator untuk stimulus"
        value={notes}
        onChange={setNotes}
        minHeight={110}
      />
      <div className="button-row-wrap">
        <button
          className="primary-button"
          type="submit"
          name="decision"
          value="APPROVE"
        >
          <CheckCircle2 size={16} /> Setujui stimulus
        </button>
        <button
          className="secondary-button"
          type="submit"
          name="decision"
          value="EDIT_AND_FORWARD"
        >
          <Save size={16} /> Simpan hasil edit
        </button>
        <button
          className="secondary-button"
          type="submit"
          name="decision"
          value="REQUEST_REVISION"
        >
          <RotateCcw size={16} /> Minta revisi stimulus
        </button>
      </div>
    </form>
  );
}
