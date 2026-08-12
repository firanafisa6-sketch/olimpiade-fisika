"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { DEFAULT_COLOR_PALETTE_ID, normalizeColorPaletteId } from "./color-palettes";

const GLOBAL_THEME_REFRESH_INTERVAL_MS = 30_000;

type ThemeProviderProps = {
  children: ReactNode;
  initialColorPalette?: string;
  refreshGlobalPalette?: boolean;
};

function applyPalette(id: string) {
  document.documentElement.setAttribute("data-color-palette", normalizeColorPaletteId(id));
}

export function ThemeProvider({
  children,
  initialColorPalette = DEFAULT_COLOR_PALETTE_ID,
  refreshGlobalPalette = true,
}: ThemeProviderProps) {
  const lastAppliedRef = useRef(normalizeColorPaletteId(initialColorPalette));

  const refreshPalette = useCallback(async () => {
    try {
      const response = await fetch("/api/app-theme", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const nextPalette = normalizeColorPaletteId(payload?.themeId);
      if (lastAppliedRef.current !== nextPalette) {
        lastAppliedRef.current = nextPalette;
        applyPalette(nextPalette);
      }
    } catch {
      // Jika API tema belum tersedia atau koneksi terputus, aplikasi tetap memakai tema awal.
    }
  }, []);

  useEffect(() => {
    const initial = normalizeColorPaletteId(initialColorPalette);
    lastAppliedRef.current = initial;
    applyPalette(initial);

    if (!refreshGlobalPalette) return;
    void refreshPalette();
    const timer = window.setInterval(() => void refreshPalette(), GLOBAL_THEME_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [initialColorPalette, refreshGlobalPalette, refreshPalette]);

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <div className="acm-copyright-mark" aria-label="Hak cipta ACM">© ACM</div>
    </NextThemesProvider>
  );
}
