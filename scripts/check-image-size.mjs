import { stat } from "node:fs/promises";

const file = process.argv[2];
if (!file) {
  console.error("Gunakan: node scripts/check-image-size.mjs path/gambar.webp");
  process.exit(1);
}

const info = await stat(file);
const max = 100 * 1024;
console.log(`${file}: ${Math.ceil(info.size / 1024)} KB`);
if (info.size > max) {
  console.error("Gambar melebihi 100 KB.");
  process.exit(2);
}
console.log("Ukuran gambar valid.");
