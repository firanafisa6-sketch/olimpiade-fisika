"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

const MAX_IMAGE_BYTES = 100 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

interface ImageUploadFieldProps {
  label?: string;
  onValidFile?: (file: File | null) => void;
}

export function ImageUploadField({ label = "Gambar", onValidFile }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>();
  const [error, setError] = useState<string>();

  function validate(file?: File) {
    setError(undefined);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Gunakan PNG, JPEG, atau WebP.");
      onValidFile?.(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Ukuran ${Math.ceil(file.size / 1024)} KB melebihi batas 100 KB.`);
      onValidFile?.(null);
      return;
    }
    setFileName(file.name);
    onValidFile?.(file);
  }

  function clear() {
    setFileName(undefined);
    setError(undefined);
    if (inputRef.current) inputRef.current.value = "";
    onValidFile?.(null);
  }

  return (
    <div className="field-block">
      <span className="field-label">{label}</span>
      <div className="upload-box">
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => validate(event.target.files?.[0])}
        />
        <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={17} /> Pilih gambar
        </button>
        <span className="muted-text">Maksimum 100 KB · PNG/JPEG/WebP</span>
        {fileName && (
          <span className="file-chip">
            {fileName}
            <button type="button" onClick={clear} aria-label="Hapus gambar"><X size={14} /></button>
          </span>
        )}
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
