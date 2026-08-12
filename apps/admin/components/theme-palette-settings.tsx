"use client";

import { Check, Globe2, Palette, Save } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { colorPalettes, getColorPaletteName, normalizeColorPaletteId } from "@seleksi/ui";

function applyPalette(id: string) {
  document.documentElement.setAttribute("data-color-palette", normalizeColorPaletteId(id));
}

export function ThemePaletteSettings({ initialThemeId = "physics-blue" }: { initialThemeId?: string }) {
  const normalizedInitial = normalizeColorPaletteId(initialThemeId);
  const [selected, setSelected] = useState(normalizedInitial);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelected(normalizedInitial);
    applyPalette(normalizedInitial);
  }, [normalizedInitial]);

  function selectTheme(id: string) {
    const next = normalizeColorPaletteId(id);
    setSelected(next);
    applyPalette(next);
    setSavedMessage(null);
    setErrorMessage(null);
  }

  function saveTheme() {
    startTransition(async () => {
      setSavedMessage(null);
      setErrorMessage(null);
      try {
        const response = await fetch("/api/app-theme", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ themeId: selected }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error ?? "Tema gagal disimpan.");
        const themeName = payload?.themeName ?? getColorPaletteName(selected);
        setSavedMessage(`Tema ${themeName} tersimpan global untuk admin, peserta, dan pengawas.`);
        applyPalette(selected);
        window.setTimeout(() => setSavedMessage(null), 4000);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Tema gagal disimpan.");
      }
    });
  }

  return (
    <section className="card panel theme-settings-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Tema tampilan global</p>
          <h3>Colour palette aplikasi</h3>
          <p className="muted-text">
            Pilih salah satu dari 10 tema warna. Setelah disimpan, tema masuk ke PostgreSQL dan otomatis dibaca oleh aplikasi admin, peserta, dan pengawas.
          </p>
        </div>
        <Palette size={28} />
      </div>

      <div className="theme-global-info">
        <Globe2 size={18} />
        <span>
          Tema aktif global saat halaman dibuka: <strong>{getColorPaletteName(normalizedInitial)}</strong>. Perubahan yang sudah disimpan akan muncul di portal lain saat halaman dibuka/refresh, dan akan disinkronkan berkala oleh sistem.
        </span>
      </div>

      <div className="theme-palette-grid">
        {colorPalettes.map((theme) => {
          const active = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              className={`theme-palette-card ${active ? "is-active" : ""}`}
              onClick={() => selectTheme(theme.id)}
              aria-pressed={active}
            >
              <span className="theme-palette-swatch" aria-hidden="true">
                {theme.colors.map((color) => <i key={color} style={{ background: color }} />)}
              </span>
              <span>
                <strong>{theme.name}</strong>
                <small>{theme.description}</small>
              </span>
              {active ? <Check size={18} /> : null}
            </button>
          );
        })}
      </div>

      <div className="settings-save-row">
        <button type="button" className="primary-button" onClick={saveTheme} disabled={isPending}>
          <Save size={17} /> {isPending ? "Menyimpan..." : "Simpan tema global"}
        </button>
        {savedMessage ? <span className="settings-save-note">{savedMessage}</span> : null}
        {errorMessage ? <span className="settings-error-note">{errorMessage}</span> : null}
        {!savedMessage && !errorMessage ? <span className="muted-text">Tombol simpan akan menerapkan tema ke seluruh portal.</span> : null}
      </div>
    </section>
  );
}
