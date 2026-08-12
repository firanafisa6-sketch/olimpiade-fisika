import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/access";
import { buildPackageAnalysis } from "@/lib/item-analysis";

export const dynamic = "force-dynamic";

function decimal(value: number | null, digits = 4) {
  return value === null || !Number.isFinite(value) ? "" : Number(value.toFixed(digits));
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function dateTime(value: Date | null) {
  return value?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "";
}

function setWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!canAccess(user.roles, ["EXAM_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const packageId = new URL(request.url).searchParams.get("packageId")?.trim();
  if (!packageId) return NextResponse.json({ error: "PACKAGE_REQUIRED" }, { status: 400 });
  const analysis = await buildPackageAnalysis(packageId);
  if (!analysis) return NextResponse.json({ error: "PACKAGE_NOT_FOUND" }, { status: 404 });

  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ["SOALFLOW — NILAI & PARAMETER SOAL"],
    [],
    ["Kode paket", analysis.packageInfo.code],
    ["Nama paket", analysis.packageInfo.name],
    ["Bidang", analysis.packageInfo.fields.join("; ")],
    ["Peserta dianalisis", analysis.summary.participantCount],
    ["Butir teranalisis", analysis.summary.itemCount],
    ["Rata-rata nilai", decimal(analysis.summary.averageScore, 2)],
    ["Median nilai", decimal(analysis.summary.medianScore, 2)],
    ["Nilai minimum", decimal(analysis.summary.minimumScore, 2)],
    ["Nilai maksimum", decimal(analysis.summary.maximumScore, 2)],
    [],
    ["Catatan", "Analisis menggunakan attempt final berstatus SUBMITTED atau EXPIRED."],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  setWidths(summarySheet, [26, 70]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

  const scoreSheet = XLSX.utils.json_to_sheet(
    analysis.scores.map((row) => ({
      Username: row.username,
      "Nama peserta": row.participantName,
      Status: row.status,
      "Mulai ujian": dateTime(row.startedAt),
      "Waktu kirim": dateTime(row.submittedAt),
      "Jumlah soal": row.totalQuestions,
      Benar: row.correctCount,
      Salah: row.wrongCount,
      Kosong: row.unansweredCount,
      Nilai: decimal(row.score, 2),
    })),
  );
  setWidths(scoreSheet, [18, 30, 14, 22, 22, 14, 10, 10, 10, 12]);
  XLSX.utils.book_append_sheet(workbook, scoreSheet, "Nilai Peserta");

  const itemSheet = XLSX.utils.json_to_sheet(
    analysis.items.map((item) => ({
      Bidang: item.fieldName,
      "Kode kisi-kisi": item.blueprintCode,
      "Kode soal": item.questionCode,
      "ID versi soal": item.sourceQuestionVersionId,
      "Isi soal": item.stemText,
      N: item.participantCount,
      Benar: item.correctCount,
      Kosong: item.unansweredCount,
      "Tingkat kesukaran (P)": decimal(item.difficultyIndex),
      "Kategori kesukaran": item.difficultyCategory,
      "Daya beda (D)": decimal(item.discriminationIndex),
      "Kategori daya beda": item.discriminationCategory,
      "Point-biserial": decimal(item.pointBiserial),
      "Kategori validitas": item.validityCategory,
      "Ringkasan pengecoh": item.distractors
        .map((option) => `${option.label}${option.isKey ? "*" : ""}: ${option.selectedCount} (${(option.percentage * 100).toFixed(1)}%) ${option.functionStatus}`)
        .join(" | "),
    })),
  );
  setWidths(itemSheet, [22, 18, 20, 28, 70, 8, 10, 10, 20, 22, 18, 24, 18, 22, 80]);
  XLSX.utils.book_append_sheet(workbook, itemSheet, "Parameter Soal");

  const distractorSheet = XLSX.utils.json_to_sheet(
    analysis.items.flatMap((item) =>
      item.distractors.map((option) => ({
        Bidang: item.fieldName,
        "Kode kisi-kisi": item.blueprintCode,
        "Kode soal": item.questionCode,
        Opsi: option.label,
        Kunci: option.isKey ? "YA" : "TIDAK",
        "Jumlah memilih": option.selectedCount,
        "Persentase memilih": decimal(option.percentage * 100, 2),
        "Status fungsi": option.functionStatus,
      })),
    ),
  );
  setWidths(distractorSheet, [22, 18, 20, 10, 10, 16, 20, 22]);
  XLSX.utils.book_append_sheet(workbook, distractorSheet, "Fungsi Pengecoh");

  const reliabilitySheet = XLSX.utils.json_to_sheet(
    analysis.reliability.map((row) => ({
      Cakupan: row.scope,
      Metode: row.method,
      "Jumlah unit kisi-kisi": row.unitCount,
      "Jumlah peserta": row.participantCount,
      Koefisien: decimal(row.coefficient),
      Interpretasi: row.category,
    })),
  );
  setWidths(reliabilitySheet, [28, 55, 24, 18, 15, 34]);
  XLSX.utils.book_append_sheet(workbook, reliabilitySheet, "Reliabilitas");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `nilai-parameter-${safeFilename(analysis.packageInfo.code || "paket")}.xlsx`;
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
