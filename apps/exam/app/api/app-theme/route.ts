import { NextResponse } from "next/server";
import { db } from "@seleksi/database";
import { COLOR_PALETTE_SETTING_KEY, DEFAULT_COLOR_PALETTE_ID, getColorPaletteName, normalizeColorPaletteId } from "@seleksi/ui";

export const dynamic = "force-dynamic";

function readThemeId(value: unknown) {
  if (value && typeof value === "object" && "themeId" in value) {
    return normalizeColorPaletteId((value as { themeId?: unknown }).themeId);
  }
  return normalizeColorPaletteId(value);
}

export async function GET() {
  try {
    const setting = await db.appSetting.findUnique({ where: { key: COLOR_PALETTE_SETTING_KEY } });
    const themeId = readThemeId(setting?.value);
    return NextResponse.json({ themeId, themeName: getColorPaletteName(themeId), source: "database" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ themeId: DEFAULT_COLOR_PALETTE_ID, themeName: getColorPaletteName(DEFAULT_COLOR_PALETTE_ID), source: "fallback" }, { headers: { "cache-control": "no-store" } });
  }
}
