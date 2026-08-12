"use client";

import { startExam } from "@/app/actions";
import { Maximize, PlayCircle } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

export function StartExamForm({
  examSessionId,
  label,
  disabled,
}: {
  examSessionId: string;
  label: string;
  disabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submittingRef.current) return;
    event.preventDefault();
    setFullscreenFailed(false);
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      window.sessionStorage.setItem("of-fullscreen-requested", "1");
    } catch {
      setFullscreenFailed(true);
      window.sessionStorage.setItem("of-fullscreen-requested", "failed");
    }
    submittingRef.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={startExam} onSubmit={handleSubmit} className="participant-start-form">
      <input type="hidden" name="examSessionId" value={examSessionId} />
      <button className="primary-button participant-start-button" type="submit" disabled={disabled}>
        <PlayCircle size={18} /> {label}
      </button>
      {!disabled ? (
        <small className={`fullscreen-start-note ${fullscreenFailed ? "warning" : ""}`}>
          <Maximize size={14} /> {fullscreenFailed ? "Browser menolak fullscreen otomatis. Aktifkan dari halaman ujian." : "Tombol ini akan mencoba membuka mode fullscreen sebelum ujian dimulai."}
        </small>
      ) : null}
    </form>
  );
}
