"use client";

import { Trash2 } from "lucide-react";

type ConfirmDeleteFormProps = {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label?: string;
  message?: string;
  className?: string;
};

export function ConfirmDeleteForm({
  action,
  id,
  label = "Hapus",
  message = "Yakin ingin menghapus data ini? Data yang sudah dihapus tidak dapat dikembalikan.",
  className = "danger-button",
}: ConfirmDeleteFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className={className} type="submit">
        <Trash2 size={15} /> {label}
      </button>
    </form>
  );
}
