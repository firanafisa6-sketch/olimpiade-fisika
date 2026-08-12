export const DEFAULT_COLOR_PALETTE_ID = "physics-blue";

export const COLOR_PALETTE_SETTING_KEY = "global_color_palette";

export const colorPalettes = [
  { id: "physics-blue", name: "Fisika Biru", colors: ["#2563EB", "#1D4ED8", "#F59E0B"], description: "Biru akademik yang bersih untuk tampilan utama olimpiade." },
  { id: "olympiad-gold", name: "Olimpiade Emas", colors: ["#B45309", "#92400E", "#F59E0B"], description: "Nuansa emas untuk kesan kompetisi dan penghargaan." },
  { id: "quantum-purple", name: "Quantum Ungu", colors: ["#7C3AED", "#5B21B6", "#F97316"], description: "Ungu modern untuk kesan teknologi dan inovasi." },
  { id: "laboratory-teal", name: "Laboratorium Teal", colors: ["#0D9488", "#0F766E", "#F59E0B"], description: "Teal tenang untuk nuansa laboratorium dan eksperimen." },
  { id: "cosmos-navy", name: "Kosmos Navy", colors: ["#1E40AF", "#111827", "#38BDF8"], description: "Navy gelap yang tegas untuk kesan sains dan ruang angkasa." },
  { id: "energy-red", name: "Energi Merah", colors: ["#DC2626", "#991B1B", "#FACC15"], description: "Merah energik untuk identitas kompetisi yang kuat." },
  { id: "vector-green", name: "Vektor Hijau", colors: ["#16A34A", "#166534", "#F59E0B"], description: "Hijau segar untuk kesan progres dan pembelajaran." },
  { id: "plasma-pink", name: "Plasma Pink", colors: ["#DB2777", "#9D174D", "#F59E0B"], description: "Pink plasma untuk tampilan muda dan dinamis." },
  { id: "graphite-gray", name: "Grafit Abu", colors: ["#475569", "#1E293B", "#F59E0B"], description: "Abu grafit yang netral dan profesional." },
  { id: "sky-cyan", name: "Langit Sian", colors: ["#0891B2", "#155E75", "#F97316"], description: "Sian cerah untuk tampilan ringan dan bersih." },
] as const;

export type ColorPaletteId = typeof colorPalettes[number]["id"];

export function isColorPaletteId(value: unknown): value is ColorPaletteId {
  return typeof value === "string" && colorPalettes.some((palette) => palette.id === value);
}

export function normalizeColorPaletteId(value: unknown) {
  return isColorPaletteId(value) ? value : DEFAULT_COLOR_PALETTE_ID;
}

export function getColorPaletteName(id: string) {
  return colorPalettes.find((palette) => palette.id === id)?.name ?? "Fisika Biru";
}
