export const ROLE_META = [
  { code: "BLUEPRINT_AUTHOR", name: "Penulis Kisi-kisi", description: "Menyusun, mengedit, dan menghapus kisi-kisi format PMB. Tidak melalui validator." },
  { code: "QUESTION_AUTHOR", name: "Penulis Soal", description: "Menulis soal berdasarkan kode kisi-kisi yang diplot oleh admin/super admin." },
  { code: "QUESTION_VALIDATOR", name: "Validator Soal", description: "Memvalidasi soal yang diplot serta dapat mengedit soal, opsi, pembahasan, dan kunci jawaban." },
  { code: "EXAM_ADMIN", name: "Admin Ujian", description: "Melakukan plotting penulis/validator dan mengatur soal yang masuk ke paket ujian peserta." },
  { code: "EXAM_SUPERVISOR", name: "Pengawas Ujian", description: "Mengawasi sesi ujian, memonitor peserta, reset login, dan mencatat pelanggaran." },
  { code: "SUPER_ADMIN", name: "Super Admin", description: "Mengelola semua menu, user, role, plotting tugas, dan konfigurasi sistem." }
] as const;

export type RoleCode = typeof ROLE_META[number]["code"];

export function roleName(code: string) {
  return ROLE_META.find((role) => role.code === code)?.name ?? code;
}

export function canAccess(userRoles: string[], allowedRoles: string[]) {
  return userRoles.includes("SUPER_ADMIN") || allowedRoles.some((role) => userRoles.includes(role));
}
