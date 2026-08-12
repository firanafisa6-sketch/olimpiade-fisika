import { ThemePaletteSettings } from "@/components/theme-palette-settings";
import { AdminShell } from "@/components/admin-shell";
import { ROLE_META } from "@/lib/access";
import { requirePageUser } from "@/lib/auth";
import { db } from "@seleksi/database";
import { COLOR_PALETTE_SETTING_KEY, DEFAULT_COLOR_PALETTE_ID, getColorPaletteName, normalizeColorPaletteId } from "@seleksi/ui";

export const dynamic = "force-dynamic";

async function getGlobalThemeId() {
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

export default async function SettingsPage() {
  await requirePageUser(["SUPER_ADMIN"]);
  const globalThemeId = await getGlobalThemeId();

  return (
    <AdminShell
      title="Pengaturan"
      subtitle="Konfigurasi aplikasi Olimpiade Fisika V.1.0 dan tema global lintas portal"
      allowedRoles={["SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <h2>Konfigurasi sistem</h2>
          <p>Halaman ini disiapkan untuk pengaturan organisasi, format kisi-kisi, plotting tugas, mode validasi, parameter paket ujian, dan tema tampilan aplikasi.</p>
        </div>
        <span className="badge">Olimpiade Fisika V.1.0</span>
      </div>
      <div className="content-grid">
        <section className="card panel form-grid">
          <label className="field-block"><span className="field-label">Nama organisasi</span><input className="text-input" defaultValue="Panitia Olimpiade Fisika" readOnly /></label>
          <label className="field-block"><span className="field-label">Validasi kisi-kisi</span><input className="text-input" value="Tidak diperlukan" readOnly /></label>
          <label className="field-block"><span className="field-label">Validasi soal</span><input className="text-input" value="Validator diplot per kode kisi-kisi dan dapat mengedit soal/kunci" readOnly /></label>
          <label className="field-block"><span className="field-label">Format kisi-kisi</span><input className="text-input" value="Identitas + tabel Soal-Kunci-Jawaban A-E" readOnly /></label>
          <label className="field-block"><span className="field-label">Kode</span><input className="text-input" value="Kisi-kisi dan soal digenerate sistem" readOnly /></label>
          <label className="field-block"><span className="field-label">Sumber soal paket ujian</span><input className="text-input" value="Hanya soal APPROVED" readOnly /></label>
          <label className="field-block"><span className="field-label">Tema global aktif</span><input className="text-input" value={`${getColorPaletteName(globalThemeId)} (${globalThemeId})`} readOnly /></label>
          <div className="settings-save-row">
            <button className="secondary-button" type="button" disabled>Tersimpan otomatis</button>
            <span className="muted-text">Tanda simpan aktif tersedia pada pengaturan tema global di bawah.</span>
          </div>
        </section>
        <aside className="card panel">
          <h3>Role aktif</h3>
          <div className="summary-list">
            {ROLE_META.map((role) => <div className="summary-row" key={role.code}><span>{role.name}</span><strong>{role.code}</strong></div>)}
          </div>
        </aside>
        <ThemePaletteSettings initialThemeId={globalThemeId} />
      </div>
    </AdminShell>
  );
}
