import type { Metadata } from "next";
import Script from "next/script";
import { db } from "@seleksi/database";
import { COLOR_PALETTE_SETTING_KEY, DEFAULT_COLOR_PALETTE_ID, ImageCacheBuster, ThemeProvider, normalizeColorPaletteId } from "@seleksi/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Olimpiade Fisika", template: "%s | Olimpiade Fisika" },
  description: "Pengelolaan kisi-kisi, plotting penulis dan validator, penulisan soal, serta paket ujian",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" }
};

async function getGlobalColorPalette() {
  try {
    const setting = await db.appSetting.findUnique({ where: { key: COLOR_PALETTE_SETTING_KEY } });
    const value = setting?.value;
    if (value && typeof value === "object" && "themeId" in value) {
      return normalizeColorPaletteId((value as { themeId?: unknown }).themeId);
    }
    return normalizeColorPaletteId(value);
  } catch {
    return DEFAULT_COLOR_PALETTE_ID;
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const colorPalette = await getGlobalColorPalette();

  return (
    <html lang="id" data-color-palette={colorPalette} suppressHydrationWarning>
      <body>
        <ImageCacheBuster />
        <Script
          id="mathjax-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.MathJax = { tex: { inlineMath: [['\\\\(', '\\\\)']], displayMath: [['\\\\[', '\\\\]']] }, svg: { fontCache: 'global' } };`
          }}
        />
        <Script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" strategy="afterInteractive" />
        <ThemeProvider initialColorPalette={colorPalette}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
