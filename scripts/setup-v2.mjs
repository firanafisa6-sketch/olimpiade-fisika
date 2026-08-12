import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function getEnvValue(text, key) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return "";
  return match[1].trim().replace(/^['\"]|['\"]$/g, "");
}

function setEnvValue(text, key, value) {
  const line = `${key}=\"${value}\"`;
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(text)) return text.replace(regex, line);
  return `${text.trimEnd()}\n${line}\n`;
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) {
  console.error("Node.js minimal versi 20. Cek dengan: node -v");
  process.exit(1);
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("File .env dibuat dari .env.example");
}

let envText = readFileSync(".env", "utf8");
if (!getEnvValue(envText, "AUTH_SECRET")) {
  const secret = randomBytes(32).toString("base64url");
  envText = setEnvValue(envText, "AUTH_SECRET", secret);
  writeFileSync(".env", envText);
  console.log("AUTH_SECRET otomatis dibuat dan disimpan ke .env");
}

run("npm", ["install", "--no-audit", "--no-fund"]);

envText = readFileSync(".env", "utf8");
const databaseUrl = getEnvValue(envText, "DATABASE_URL");
if (!databaseUrl) {
  console.log(`\nINSTALASI DEPENDENCY OLIMPIADE FISIKA SELESAI.\n\nSekarang isi DATABASE_URL di file .env:\n  nano .env\n\nSetelah DATABASE_URL terisi, jalankan:\n  npm run setup:db\n  npm run dev\n`);
  process.exit(0);
}

run("npm", ["run", "setup:db"]);

console.log(`\nOLIMPIADE FISIKA V.1.0 SIAP.\n\nJalankan aplikasi:\n  npm run dev\n\nAdmin:   http://localhost:3000\nPeserta: http://localhost:3001\nLogin admin memakai ADMIN_EMAIL dan ADMIN_PASSWORD di file .env.\n`);
