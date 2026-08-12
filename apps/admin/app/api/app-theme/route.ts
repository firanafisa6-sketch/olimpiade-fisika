import { NextResponse } from "next/server";
import { db } from "@seleksi/database";
import {
  COLOR_PALETTE_SETTING_KEY,
  DEFAULT_COLOR_PALETTE_ID,
  getColorPaletteName,
  isColorPaletteId,
  normalizeColorPaletteId,
} from "@seleksi/ui";
import { requireActionUser } from "@/lib/auth";

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

export async function POST(request: Request) {
  const user = await requireActionUser(["SUPER_ADMIN"]);
  const payload = await request.json().catch(() => ({}));
  const requestedThemeId = payload?.themeId;

  if (!isColorPaletteId(requestedThemeId)) {
    return NextResponse.json({ error: "Tema tidak valid." }, { status: 400 });
  }

  const themeName = getColorPaletteName(requestedThemeId);
  await db.$transaction(async (tx: any) => {
    await tx.appSetting.upsert({
      where: { key: COLOR_PALETTE_SETTING_KEY },
      update: {
        value: {
          themeId: requestedThemeId,
          themeName,
          appliedTo: ["admin", "exam", "pengawas"],
          updatedById: user.id,
          updatedByName: user.name,
          updatedAt: new Date().toISOString(),
        },
      },
      create: {
        key: COLOR_PALETTE_SETTING_KEY,
        value: {
          themeId: requestedThemeId,
          themeName,
          appliedTo: ["admin", "exam", "pengawas"],
          updatedById: user.id,
          updatedByName: user.name,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "GLOBAL_THEME_UPDATED",
        entityType: "AppSetting",
        entityId: COLOR_PALETTE_SETTING_KEY,
        metadata: { themeId: requestedThemeId, themeName, appliedTo: ["admin", "exam", "pengawas"] },
      },
    });
  });

  return NextResponse.json({ themeId: requestedThemeId, themeName, saved: true });
}
