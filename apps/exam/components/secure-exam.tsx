"use client";

import { QuestionRenderer, StimulusRenderer, type OptionLabel } from "@seleksi/question-renderer";
import { AppLogo } from "@/components/app-logo";
import { AlertTriangle, CheckCircle2, Clock3, Flag, LockKeyhole, LogOut, Maximize, RefreshCw, Send, ShieldAlert, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ExamSnapshot = {
  id: string;
  displayOrder: number;
  groupOrder: number;
  blueprintCode: string;
  questionCode: string;
  fieldName: string;
  fieldOrder: number;
  stimulusCode: string | null;
  stimulusTitleHtml: string | null;
  stimulusInstructionsHtml: string | null;
  stimulusContentHtml: string | null;
  stemHtml: string;
  options: Array<{ label: OptionLabel; contentHtml: string }>;
  selectedLabel: OptionLabel | null;
  isFlagged: boolean;
};

function plainText(html: string | null) {
  if (!html) return "Stimulus";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function SecureExam({
  attemptId,
  username,
  participantName,
  packageName,
  deadlineIso,
  snapshots,
}: {
  attemptId: string;
  username: string;
  participantName: string;
  packageName: string;
  deadlineIso: string;
  snapshots: ExamSnapshot[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionLabel | undefined>>(() =>
    Object.fromEntries(snapshots.map((item) => [item.id, item.selectedLabel ?? undefined])),
  );
  const [flagged, setFlagged] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(snapshots.map((item) => [item.id, item.isFlagged])),
  );
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000)));
  const [secureReady, setSecureReady] = useState(false);
  const [focusWarning, setFocusWarning] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [submitting, setSubmitting] = useState(false);
  const [sessionLost, setSessionLost] = useState(false);
  const submittedRef = useRef(false);
  const ignoreUnloadRef = useRef(false);

  const current = snapshots[currentIndex];
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const deadline = useMemo(() => new Date(deadlineIso).getTime(), [deadlineIso]);
  const fieldGroups = useMemo(() => {
    const groups = new Map<number, { name: string; items: Array<{ item: ExamSnapshot; index: number }> }>();
    snapshots.forEach((item, index) => {
      const existing = groups.get(item.fieldOrder) ?? { name: item.fieldName, items: [] };
      existing.items.push({ item, index });
      groups.set(item.fieldOrder, existing);
    });
    return Array.from(groups.entries())
      .sort(([left], [right]) => left - right)
      .map(([order, group]) => ({ order, ...group }));
  }, [snapshots]);
  const currentFieldAnswered = snapshots.filter(
    (item) => item.fieldOrder === current.fieldOrder && answers[item.id],
  ).length;
  const currentFieldTotal = snapshots.filter(
    (item) => item.fieldOrder === current.fieldOrder,
  ).length;
  const timeText = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const logSecurityEvent = useCallback(
    (eventType: string, detail?: Record<string, unknown>) => {
      void fetch(`/api/attempts/${attemptId}/security`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType, detail }),
        keepalive: true,
      });
    },
    [attemptId],
  );

  const saveAnswer = useCallback(
    async (snapshotId: string, label: OptionLabel | undefined, isFlagged: boolean) => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/attempts/${attemptId}/answer`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ snapshotId, label: label ?? null, isFlagged }),
        });
        if (response.status === 401) {
          setSessionLost(true);
          throw new Error("Sesi login tidak aktif");
        }
        if (!response.ok) throw new Error("Gagal menyimpan");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [attemptId],
  );

  const submitExam = useCallback(
    async (automatic = false) => {
      if (submittedRef.current) return;
      if (!automatic && !window.confirm(`Kirim jawaban sekarang? ${snapshots.length - answeredCount} soal belum dijawab.`)) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const response = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
        if (response.status === 401) {
          setSessionLost(true);
          submittedRef.current = false;
          setSubmitting(false);
          return;
        }
        if (!response.ok) throw new Error("Gagal mengirim jawaban");
        ignoreUnloadRef.current = true;
        window.location.replace("/dashboard");
      } catch {
        submittedRef.current = false;
        setSubmitting(false);
        window.alert("Jawaban belum berhasil dikirim. Periksa koneksi lalu coba lagi.");
      }
    },
    [answeredCount, attemptId, snapshots.length],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining <= 0) void submitExam(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, submitExam]);

  useEffect(() => {
    if (document.fullscreenElement) {
      setSecureReady(true);
      window.sessionStorage.removeItem("of-fullscreen-requested");
      logSecurityEvent("SECURE_MODE_STARTED_FROM_DASHBOARD");
    }
  }, [logSecurityEvent]);

  useEffect(() => {
    if (!secureReady) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/auth/status", { cache: "no-store" });
        if (response.status === 401) setSessionLost(true);
      } catch {
        // Koneksi terputus tidak langsung dianggap logout; indikator simpan akan menangani error jawaban.
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [secureReady]);

  useEffect(() => {
    if (!secureReady) return;

    const recordViolation = (eventType: string, detail?: Record<string, unknown>) => {
      setViolationCount((value) => value + 1);
      logSecurityEvent(eventType, detail);
    };
    const blockEvent = (event: Event, eventType: string) => {
      event.preventDefault();
      recordViolation(eventType);
    };
    const onContext = (event: MouseEvent) => blockEvent(event, "CONTEXT_MENU_BLOCKED");
    const onCopy = (event: ClipboardEvent) => blockEvent(event, "COPY_BLOCKED");
    const onCut = (event: ClipboardEvent) => blockEvent(event, "CUT_BLOCKED");
    const onDrag = (event: DragEvent) => blockEvent(event, "DRAG_BLOCKED");
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blockedShortcut =
        (event.ctrlKey || event.metaKey) &&
        ["c", "x", "p", "s", "u"].includes(key);
      const devtoolShortcut =
        event.key === "F12" ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && ["i", "j", "c"].includes(key));
      const screenshotKey = event.key === "PrintScreen";
      if (blockedShortcut || devtoolShortcut || screenshotKey) {
        event.preventDefault();
        recordViolation(screenshotKey ? "SCREENSHOT_KEY_DETECTED" : "KEYBOARD_SHORTCUT_BLOCKED", { key: event.key });
        if (screenshotKey && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText("Screenshot ujian tidak diizinkan.").catch(() => undefined);
        }
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        recordViolation("TAB_HIDDEN");
      } else {
        setFocusWarning(true);
      }
    };
    const onBlur = () => recordViolation("WINDOW_BLUR");
    const onFullscreen = () => {
      if (document.fullscreenEnabled && !document.fullscreenElement && !submittedRef.current) {
        recordViolation("FULLSCREEN_EXIT");
        setFocusWarning(true);
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (ignoreUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("contextmenu", onContext);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("dragstart", onDrag);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("dragstart", onDrag);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [logSecurityEvent, secureReady]);

  async function activateSecureMode() {
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      logSecurityEvent("FULLSCREEN_REQUEST_FAILED");
    }
    setSecureReady(true);
    logSecurityEvent("SECURE_MODE_STARTED");
  }

  async function resumeSecureMode() {
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      logSecurityEvent("FULLSCREEN_RESUME_FAILED");
    }
    setFocusWarning(false);
  }

  function refreshExam() {
    const proceed = window.confirm("Muat ulang halaman ujian? Jawaban yang sudah tersimpan akan tetap ada.");
    if (!proceed) return;
    ignoreUnloadRef.current = true;
    logSecurityEvent("PARTICIPANT_REFRESH_REQUESTED");
    window.location.reload();
  }

  async function logoutFromExam() {
    const proceed = window.confirm("Keluar dari halaman ujian? Jawaban yang sudah tersimpan tetap ada. Gunakan ini jika pengawas meminta reset login/perangkat.");
    if (!proceed) return;
    ignoreUnloadRef.current = true;
    logSecurityEvent("PARTICIPANT_LOGOUT_REQUESTED");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.replace("/");
    }
  }

  function chooseAnswer(label: OptionLabel) {
    setAnswers((value) => ({ ...value, [current.id]: label }));
    void saveAnswer(current.id, label, Boolean(flagged[current.id]));
  }

  function toggleFlag() {
    const next = !flagged[current.id];
    setFlagged((value) => ({ ...value, [current.id]: next }));
    void saveAnswer(current.id, answers[current.id], next);
  }

  const stimulus = current.stimulusCode
    ? {
        id: current.stimulusCode,
        title: plainText(current.stimulusTitleHtml),
        instructionsHtml: current.stimulusInstructionsHtml ?? "",
        contentHtml: current.stimulusContentHtml ?? "",
      }
    : null;
  const question = {
    id: current.id,
    number: current.displayOrder,
    contentHtml: current.stemHtml,
    options: current.options.map((option) => ({
      id: `${current.id}-${option.label}`,
      label: option.label,
      contentHtml: option.contentHtml,
    })),
  };

  return (
    <div className={`secure-exam-root ${secureReady ? "is-secure" : ""}`}>
      <div className="exam-watermark" aria-hidden="true">
        {Array.from({ length: 16 }, (_, index) => <span key={index}>{username} · {participantName}</span>)}
      </div>

      {!secureReady ? (
        <div className="secure-mode-gate">
          <section className="card secure-mode-card">
            <LockKeyhole size={48} />
            <span className="eyebrow">Mode ujian aman</span>
            <h1>{packageName}</h1>
            <p>
              Sistem akan meminta layar penuh, menonaktifkan salin/cetak/klik kanan, dan mencatat perpindahan tab. Tidak ada website yang dapat menjamin pemblokiran screenshot perangkat secara mutlak.
            </p>
            <div className="security-warning-actions">
              <button className="primary-button" type="button" onClick={activateSecureMode}><Maximize size={18} /> Aktifkan mode ujian</button>
              <button className="secondary-button" type="button" onClick={refreshExam}><RefreshCw size={17} /> Refresh</button>
              <button className="secondary-button" type="button" onClick={() => void logoutFromExam()}><LogOut size={17} /> Logout</button>
            </div>
          </section>
        </div>
      ) : null}

      {sessionLost ? (
        <div className="security-warning-overlay">
          <section className="card security-warning-card">
            <LogOut size={48} />
            <h2>Login peserta sudah direset</h2>
            <p>Sesi login perangkat ini sudah tidak aktif. Tekan Keluar untuk kembali ke halaman login, lalu masuk kembali setelah pengawas mengizinkan/reset login.</p>
            <div className="security-warning-actions">
              <button className="secondary-button" type="button" onClick={refreshExam}><RefreshCw size={17} /> Refresh</button>
              <button className="primary-button" type="button" onClick={() => void logoutFromExam()}><LogOut size={17} /> Keluar ke login</button>
            </div>
          </section>
        </div>
      ) : null}

      {focusWarning && !sessionLost ? (
        <div className="security-warning-overlay">
          <section className="card security-warning-card">
            <ShieldAlert size={48} />
            <h2>Ujian kehilangan fokus</h2>
            <p>Perpindahan tab, aplikasi, atau keluar dari layar penuh telah dicatat.</p>
            <button className="primary-button" type="button" onClick={resumeSecureMode}><Maximize size={18} /> Kembali ke mode ujian</button>
          </section>
        </div>
      ) : null}

      <header className="secure-exam-topbar">
        <div className="exam-brand"><div className="exam-brand-mark"><AppLogo /></div><div><strong>{current.fieldName}</strong><span>{packageName}</span></div></div>
        <div className="secure-topbar-stats">
          <span className={`save-indicator ${saveState}`}><Wifi size={15} /> {saveState === "saving" ? "Menyimpan..." : saveState === "error" ? "Gagal tersimpan" : "Tersimpan"}</span>
          <span className="violation-indicator"><AlertTriangle size={15} /> Catatan keamanan: {violationCount}</span>
          <span className={`secure-timer ${seconds < 300 ? "is-critical" : ""}`}><Clock3 size={18} /> {timeText}</span>
          <button className="secondary-button compact-button secure-tool-button" type="button" onClick={refreshExam}><RefreshCw size={15} /> Refresh</button>
          <button className="secondary-button compact-button secure-tool-button" type="button" onClick={() => void logoutFromExam()}><LogOut size={15} /> Logout</button>
        </div>
      </header>

      <main className="secure-exam-main">
        <section className="card secure-progress-bar">
          <div className="secure-progress-copy">
            <strong>{current.fieldName} · Soal {currentIndex + 1} dari {snapshots.length}</strong>
            <small>{currentFieldAnswered}/{currentFieldTotal} soal bidang ini terjawab</small>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${((currentIndex + 1) / snapshots.length) * 100}%` }} /></div>
          <span>{answeredCount} terjawab</span>
        </section>

        <div className={`secure-exam-layout ${stimulus ? "has-stimulus" : "no-stimulus"}`}>
          {stimulus ? <div className="secure-stimulus-column"><StimulusRenderer stimulus={stimulus} /></div> : null}
          <div className="secure-question-column">
            <div className="question-context-line"><span className="badge">{current.fieldName}</span><span className="badge subtle">{current.blueprintCode}</span><span className="muted-text">{current.questionCode}</span></div>
            <QuestionRenderer question={question} value={answers[current.id]} onChange={chooseAnswer} />
            <div className="exam-actions">
              <button className="secondary-button" type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}>Sebelumnya</button>
              <button className={`secondary-button ${flagged[current.id] ? "is-flagged" : ""}`} type="button" onClick={toggleFlag}><Flag size={17} /> {flagged[current.id] ? "Hapus tanda" : "Tandai ragu"}</button>
              {currentIndex < snapshots.length - 1 ? (
                <button className="primary-button" type="button" onClick={() => setCurrentIndex((value) => Math.min(snapshots.length - 1, value + 1))}>Berikutnya</button>
              ) : (
                <button className="danger-button" type="button" disabled={submitting} onClick={() => void submitExam(false)}><Send size={17} /> {submitting ? "Mengirim..." : "Kirim jawaban"}</button>
              )}
            </div>
          </div>

          <aside className="card secure-navigator">
            <strong>Navigasi per bidang</strong>
            <div className="field-navigation-list">
              {fieldGroups.map((group) => (
                <section className={`field-navigation-group ${group.order === current.fieldOrder ? "is-current-field" : ""}`} key={`${group.order}-${group.name}`}>
                  <header><span>{group.order}</span><strong>{group.name}</strong></header>
                  <div className="number-grid">
                    {group.items.map(({ item, index }) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`number-button ${index === currentIndex ? "is-current" : ""} ${answers[item.id] ? "is-answered" : ""} ${flagged[item.id] ? "is-flagged" : ""}`}
                        onClick={() => setCurrentIndex(index)}
                        title={`${item.fieldName} · ${item.questionCode}`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="navigator-legend">
              <span><i className="legend-current" /> Aktif</span>
              <span><i className="legend-answered" /> Terjawab</span>
              <span><i className="legend-flagged" /> Ragu</span>
            </div>
            <button className="danger-button navigator-submit" type="button" disabled={submitting} onClick={() => void submitExam(false)}><Send size={17} /> Selesaikan ujian</button>
            {answeredCount === snapshots.length ? <p className="all-answered"><CheckCircle2 size={16} /> Semua soal sudah dijawab.</p> : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
