import { rmSync, existsSync } from "node:fs";

const targets = [
  "node_modules",
  ".turbo",
  "apps/admin/.next",
  "apps/exam/.next",
  "apps/admin/tsconfig.tsbuildinfo",
  "apps/exam/tsconfig.tsbuildinfo",
  "packages/ui/tsconfig.tsbuildinfo",
  "packages/question-renderer/tsconfig.tsbuildinfo",
  "packages/validation/tsconfig.tsbuildinfo",
  "packages/database/tsconfig.tsbuildinfo"
];

for (const target of targets) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`Dihapus: ${target}`);
  }
}
console.log("Bersih. Jalankan npm install lagi jika node_modules ikut dihapus.");
