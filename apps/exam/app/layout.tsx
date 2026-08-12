import type { Metadata } from "next";
import { db } from "@seleksi/database";
import { COLOR_PALETTE_SETTING_KEY, DEFAULT_COLOR_PALETTE_ID, ImageCacheBuster, ThemeProvider, normalizeColorPaletteId } from "@seleksi/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Olimpiade Fisika",
  description: "Aplikasi ujian peserta Olimpiade Fisika",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
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
        <ThemeProvider initialColorPalette={colorPalette}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
