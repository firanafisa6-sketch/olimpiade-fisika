import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/access";
import { db } from "@seleksi/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportFormat = "xlsx" | "pdf";
type ValidationFilter = "ALL" | "APPROVED" | "UNVALIDATED";
type SelectionMode = "ALL" | "RANDOM_PER_BLUEPRINT";
type ExportParams = {
  format: ExportFormat;
  validation: ValidationFilter;
  selection: SelectionMode;
  blueprintCodes: string[];
  includeAnswer: boolean;
  includeBlueprint: boolean;
  includeStimulus: boolean;
  includeExplanation: boolean;
};

type ExportAssetLink = {
  placement?: string | null;
  sortOrder?: number | null;
  asset: {
    id: string;
    type: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    altText: string | null;
    caption: string | null;
  };
};

type ExportQuestion = {
  id: string;
  code: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  blueprint: {
    id: string;
    code: string;
    currentVersion: {
      versionNumber: number;
      titleHtml: string;
      testGroupHtml: string | null;
      testTopicHtml: string | null;
      competencyHtml: string;
      indicatorHtml: string;
      materialHtml: string | null;
      gridHtml: string | null;
      cognitiveLevel: string | null;
      expectedQuestionCount: number;
      questionMode: string;
    } | null;
  };
  stimulus: {
    code: string;
    type: string;
    language: string;
    status: string;
    currentVersion: {
      titleHtml: string;
      instructionsHtml: string;
      contentHtml: string;
      source: string | null;
      copyrightNote: string | null;
      assets: ExportAssetLink[];
    } | null;
  } | null;
  currentVersion: {
    versionNumber: number;
    orderInStimulus: number | null;
    stemHtml: string;
    explanationHtml: string | null;
    difficulty: string;
    answerKey: string;
    assets: ExportAssetLink[];
    options: Array<{
      label: string;
      contentHtml: string;
      sortOrder: number;
      assets: ExportAssetLink[];
    }>;
  } | null;
};

type ImageRef = {
  src: string;
  alt?: string | null;
  caption?: string | null;
  mimeType?: string | null;
  key?: string;
};

type PdfImageData = {
  cacheKey: string;
  width: number;
  height: number;
  data: Buffer;
  filter: "/DCTDecode" | "/FlateDecode";
  colorSpace: "/DeviceRGB" | "/DeviceGray" | "/DeviceCMYK";
  bitsPerComponent: number;
  decodeParms?: string;
};

const validationLabels: Record<ValidationFilter, string> = {
  ALL: "Semua status soal",
  APPROVED: "Tervalidasi / APPROVED",
  UNVALIDATED: "Belum tervalidasi / selain APPROVED",
};

const selectionLabels: Record<SelectionMode, string> = {
  ALL: "Seluruh soal sesuai filter",
  RANDOM_PER_BLUEPRINT: "Random 1 soal pada setiap kisi-kisi",
};

function readBlueprintCodes(url: URL) {
  return Array.from(new Set(url.searchParams.getAll("blueprintCode")
    .map((value) => value.trim())
    .filter(Boolean)));
}

function checked(url: URL, name: string, fallback = false) {
  const values = url.searchParams.getAll(name);
  if (!values.length) return fallback;
  return values.includes("1");
}

function readParams(request: Request): ExportParams {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const validationRaw = url.searchParams.get("validation") ?? "ALL";
  const selectionRaw = url.searchParams.get("selection") ?? "ALL";

  return {
    format,
    validation:
      validationRaw === "APPROVED" || validationRaw === "UNVALIDATED"
        ? validationRaw
        : "ALL",
    selection: selectionRaw === "RANDOM_PER_BLUEPRINT" ? "RANDOM_PER_BLUEPRINT" : "ALL",
    blueprintCodes: readBlueprintCodes(url),
    includeAnswer: checked(url, "includeAnswer", true),
    includeBlueprint: checked(url, "includeBlueprint", true),
    includeStimulus: checked(url, "includeStimulus", true),
    includeExplanation: checked(url, "includeExplanation"),
  };
}

function safeFilename(value: string) {
  return value
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function htmlToText(html: string | null | undefined) {
  return decodeEntities(html ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n")
    .replace(/<\s*\/div\s*>/gi, "\n")
    .replace(/<\s*\/li\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<\s*img\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function dateTime(value: Date | null | undefined) {
  return value?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "";
}

function optionMap(question: ExportQuestion) {
  return Object.fromEntries(
    (question.currentVersion?.options ?? [])
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => [option.label, option.contentHtml]),
  ) as Record<string, string | undefined>;
}

function buildWhere(params: ExportParams) {
  const where: any = { currentVersionId: { not: null } };

  if (params.validation === "APPROVED") {
    where.status = "APPROVED";
  } else if (params.validation === "UNVALIDATED") {
    where.status = { not: "APPROVED" };
  }

  if (params.blueprintCodes.length) {
    where.blueprint = { code: { in: params.blueprintCodes } };
  }


  return where;
}

function selectRandomPerBlueprint(questions: ExportQuestion[]) {
  const groups = new Map<string, ExportQuestion[]>();
  for (const question of questions) {
    const current = groups.get(question.blueprint.id) ?? [];
    current.push(question);
    groups.set(question.blueprint.id, current);
  }

  return Array.from(groups.values()).map((group) => {
    const index = Math.floor(Math.random() * group.length);
    return group[index];
  });
}

function sortQuestions(questions: ExportQuestion[]) {
  return questions.slice().sort((left, right) => {
    const blueprint = left.blueprint.code.localeCompare(right.blueprint.code, "id-ID");
    if (blueprint !== 0) return blueprint;
    const leftOrder = left.currentVersion?.orderInStimulus ?? 9999;
    const rightOrder = right.currentVersion?.orderInStimulus ?? 9999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.code.localeCompare(right.code, "id-ID");
  });
}

async function loadQuestions(params: ExportParams): Promise<ExportQuestion[]> {
  const questions = await db.question.findMany({
    where: buildWhere(params),
    orderBy: [{ blueprint: { code: "asc" } }, { code: "asc" }],
    include: {
      blueprint: { include: { currentVersion: true } },
      stimulus: {
        include: {
          currentVersion: {
            include: {
              assets: { include: { asset: true }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
      currentVersion: {
        include: {
          assets: { include: { asset: true }, orderBy: { sortOrder: "asc" } },
          options: {
            orderBy: { sortOrder: "asc" },
            include: { assets: { include: { asset: true }, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });

  const selected =
    params.selection === "RANDOM_PER_BLUEPRINT"
      ? selectRandomPerBlueprint(questions as ExportQuestion[])
      : (questions as ExportQuestion[]);

  return sortQuestions(selected);
}

function buildSummaryRows(params: ExportParams, questions: ExportQuestion[]) {
  return [
    ["SOALFLOW — EXPORT SOAL"],
    [],
    ["Tanggal export", dateTime(new Date())],
    ["Status validasi", validationLabels[params.validation]],
    ["Mode export", selectionLabels[params.selection]],
    ["Kisi-kisi dipilih", params.blueprintCodes.length ? params.blueprintCodes.join(", ") : "Semua kisi-kisi"],
    ["Jumlah soal", questions.length],
    ["Jumlah kisi-kisi", new Set(questions.map((question) => question.blueprint.code)).size],
  ];
}

function setWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
}

const EXCEL_CELL_LIMIT = 32767;
const EXCEL_SAFE_CHUNK_SIZE = 30000;

type LongExcelCell = {
  sourceSheet: string;
  rowNumber: number;
  questionCode: string;
  blueprintCode: string;
  columnName: string;
  partNumber: number;
  totalParts: number;
  text: string;
};

function splitExcelText(value: string) {
  const parts: string[] = [];
  for (let index = 0; index < value.length; index += EXCEL_SAFE_CHUNK_SIZE) {
    parts.push(value.slice(index, index + EXCEL_SAFE_CHUNK_SIZE));
  }
  return parts.length ? parts : [""];
}

function makeExcelCellSafe(
  value: unknown,
  context: {
    sourceSheet: string;
    rowNumber: number;
    questionCode: string;
    blueprintCode: string;
    columnName: string;
  },
  longCells: LongExcelCell[],
) {
  if (typeof value !== "string") return value;
  if (value.length <= EXCEL_CELL_LIMIT) return value;

  const parts = splitExcelText(value);
  const baseIndex = longCells.length + 1;
  parts.forEach((part, partIndex) => {
    longCells.push({
      ...context,
      partNumber: partIndex + 1,
      totalParts: parts.length,
      text: part,
    });
  });

  const notice = `\n\n[CATATAN: isi kolom ini melebihi batas Excel ${EXCEL_CELL_LIMIT.toLocaleString("id-ID")} karakter per sel. Isi lengkap dipecah pada sheet "Teks Panjang", mulai baris referensi #${baseIndex}.]`;
  return `${value.slice(0, EXCEL_SAFE_CHUNK_SIZE - notice.length)}${notice}`;
}

function makeRowsExcelSafe<T extends Record<string, unknown>>(
  rows: T[],
  sourceSheet: string,
  longCells: LongExcelCell[],
) {
  return rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const questionCode = String(row["Kode soal"] ?? row["kode_soal"] ?? "");
    const blueprintCode = String(row["Kode kisi-kisi"] ?? row["kode_kisi"] ?? "");

    return Object.fromEntries(
      Object.entries(row).map(([columnName, value]) => [
        columnName,
        makeExcelCellSafe(value, { sourceSheet, rowNumber, questionCode, blueprintCode, columnName }, longCells),
      ]),
    ) as T;
  });
}

function makeAoaExcelSafe(rows: unknown[][]) {
  return rows.map((row) => row.map((value) => {
    if (typeof value !== "string" || value.length <= EXCEL_CELL_LIMIT) return value;
    return value.slice(0, EXCEL_SAFE_CHUNK_SIZE);
  }));
}

function buildWorkbook(params: ExportParams, questions: ExportQuestion[]) {
  const workbook = XLSX.utils.book_new();
  const longCells: LongExcelCell[] = [];

  const summarySheet = XLSX.utils.aoa_to_sheet(makeAoaExcelSafe(buildSummaryRows(params, questions)));
  setWidths(summarySheet, [28, 100]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

  const rows = questions.map((question, index) => {
    const version = question.currentVersion;
    const blueprintVersion = question.blueprint.currentVersion;
    const stimulusVersion = question.stimulus?.currentVersion;
    const options = optionMap(question);
    const stimulusLanguage = question.stimulus?.language ?? "";
    const isEnglishStimulus = stimulusLanguage.toLowerCase().startsWith("en");

    return {
      No: index + 1,
      "Kode soal": question.code,
      "Status soal": question.status,
      "Versi soal": version?.versionNumber ?? "",
      "Kode kisi-kisi": question.blueprint.code,
      "Judul kisi-kisi HTML": blueprintVersion?.titleHtml ?? "",
      "Kelompok tes HTML": blueprintVersion?.testGroupHtml ?? "",
      "Topik tes HTML": blueprintVersion?.testTopicHtml ?? "",
      "Kompetensi HTML": blueprintVersion?.competencyHtml ?? "",
      "Indikator HTML": blueprintVersion?.indicatorHtml ?? "",
      "Materi HTML": blueprintVersion?.materialHtml ?? "",
      "Grid HTML": blueprintVersion?.gridHtml ?? "",
      "Level kognitif": blueprintVersion?.cognitiveLevel ?? "",
      "Target jumlah soal": blueprintVersion?.expectedQuestionCount ?? "",
      "Mode soal": blueprintVersion?.questionMode ?? "",
      "Nomor dalam stimulus": version?.orderInStimulus ?? "",
      "Kode stimulus": question.stimulus?.code ?? "",
      "Status stimulus": question.stimulus?.status ?? "",
      "Jenis stimulus": question.stimulus?.type ?? "",
      "Bahasa stimulus": stimulusLanguage,
      "Judul stimulus HTML": stimulusVersion?.titleHtml ?? "",
      "Instruksi stimulus HTML": stimulusVersion?.instructionsHtml ?? "",
      "Teks bacaan / stimulus HTML": stimulusVersion?.contentHtml ?? "",
      "Teks bacaan bahasa Inggris HTML": isEnglishStimulus ? stimulusVersion?.contentHtml ?? "" : "",
      "Sumber stimulus": stimulusVersion?.source ?? "",
      "Catatan hak cipta stimulus": stimulusVersion?.copyrightNote ?? "",
      "Stem / soal HTML": version?.stemHtml ?? "",
      "Pilihan A HTML": options.A ?? "",
      "Pilihan B HTML": options.B ?? "",
      "Pilihan C HTML": options.C ?? "",
      "Pilihan D HTML": options.D ?? "",
      "Pilihan E HTML": options.E ?? "",
      "Kunci jawaban": version?.answerKey ?? "",
      "Tingkat kesulitan": version?.difficulty ?? "",
      "Pembahasan HTML": version?.explanationHtml ?? "",
      "Dibuat pada": dateTime(question.createdAt),
      "Diubah pada": dateTime(question.updatedAt),
    };
  });

  const questionSheet = XLSX.utils.json_to_sheet(makeRowsExcelSafe(rows, "Data Soal HTML", longCells));
  setWidths(questionSheet, [6, 18, 20, 12, 18, 34, 28, 28, 48, 48, 34, 34, 18, 18, 18, 18, 18, 18, 18, 18, 34, 42, 70, 70, 34, 34, 70, 60, 60, 60, 60, 60, 14, 18, 70, 22, 22]);
  XLSX.utils.book_append_sheet(workbook, questionSheet, "Data Soal HTML");

  const readableRows = questions.map((question, index) => {
    const version = question.currentVersion;
    const blueprintVersion = question.blueprint.currentVersion;
    const stimulusVersion = question.stimulus?.currentVersion;
    const options = optionMap(question);
    return {
      No: index + 1,
      "Kode soal": question.code,
      Status: question.status,
      "Kode kisi-kisi": question.blueprint.code,
      "Judul kisi-kisi": htmlToText(blueprintVersion?.titleHtml),
      "Mode soal": blueprintVersion?.questionMode ?? "",
      "Nomor stimulus": version?.orderInStimulus ?? "",
      "Kode stimulus": question.stimulus?.code ?? "",
      "Teks bacaan": htmlToText(stimulusVersion?.contentHtml),
      Soal: htmlToText(version?.stemHtml),
      A: htmlToText(options.A),
      B: htmlToText(options.B),
      C: htmlToText(options.C),
      D: htmlToText(options.D),
      E: htmlToText(options.E),
      Kunci: version?.answerKey ?? "",
      Kesulitan: version?.difficulty ?? "",
      Pembahasan: htmlToText(version?.explanationHtml),
    };
  });
  const readableSheet = XLSX.utils.json_to_sheet(makeRowsExcelSafe(readableRows, "Versi Teks", longCells));
  setWidths(readableSheet, [6, 18, 18, 18, 34, 18, 14, 18, 70, 70, 42, 42, 42, 42, 42, 10, 15, 70]);
  XLSX.utils.book_append_sheet(workbook, readableSheet, "Versi Teks");

  const templateRows = questions.map((question) => {
    const version = question.currentVersion;
    const options = optionMap(question);
    return {
      kode_kisi: question.blueprint.code,
      kode_soal: question.code,
      urutan_stimulus: version?.orderInStimulus ?? "",
      soal: version?.stemHtml ?? "",
      opsi_a: options.A ?? "",
      opsi_b: options.B ?? "",
      opsi_c: options.C ?? "",
      opsi_d: options.D ?? "",
      opsi_e: options.E ?? "",
      kunci_jawaban: version?.answerKey ?? "",
      kesulitan: version?.difficulty ?? "",
      pembahasan: version?.explanationHtml ?? "",
    };
  });
  const templateSheet = XLSX.utils.json_to_sheet(makeRowsExcelSafe(templateRows, "Format Template", longCells));
  setWidths(templateSheet, [18, 18, 15, 70, 52, 52, 52, 52, 52, 14, 14, 70]);
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Format Template");

  if (longCells.length) {
    const longCellRows = longCells.map((cell, index) => ({
      No: index + 1,
      "Sheet asal": cell.sourceSheet,
      "Baris data": cell.rowNumber,
      "Kode soal": cell.questionCode,
      "Kode kisi-kisi": cell.blueprintCode,
      Kolom: cell.columnName,
      "Bagian ke": cell.partNumber,
      "Total bagian": cell.totalParts,
      Isi: cell.text,
    }));
    const longCellSheet = XLSX.utils.json_to_sheet(longCellRows);
    setWidths(longCellSheet, [8, 22, 12, 18, 18, 28, 12, 12, 110]);
    XLSX.utils.book_append_sheet(workbook, longCellSheet, "Teks Panjang");
  }

  return workbook;
}

function toPdfSafe(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function escapePdfText(value: string) {
  return toPdfSafe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(text: string, maxChars: number) {
  const words = toPdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

class SimplePdf {
  private readonly pageWidth = 595;
  private readonly pageHeight = 842;
  private readonly margin = 42;
  private y = 800;
  private pages: string[][] = [[]];
  private images: PdfImageData[] = [];
  private imageNames = new Map<string, string>();

  private currentPage() {
    return this.pages[this.pages.length - 1];
  }

  private newPage() {
    this.pages.push([]);
    this.y = 800;
  }

  private ensurePoints(points: number) {
    if (this.y - points < this.margin) this.newPage();
  }

  private ensureSpace(lines = 1, size = 10) {
    this.ensurePoints(lines * (size + 4));
  }

  line(text: string, size = 10, font = "F1", indent = 0) {
    const usableWidth = this.pageWidth - this.margin * 2 - indent;
    const maxChars = Math.max(25, Math.floor(usableWidth / (size * 0.53)));
    const sourceLines = String(text || "").split("\n");
    for (const sourceLine of sourceLines) {
      const wrapped = wrapLine(sourceLine, maxChars);
      for (const line of wrapped) {
        this.ensureSpace(1, size);
        this.currentPage().push(`BT /${font} ${size} Tf ${this.margin + indent} ${this.y} Td (${escapePdfText(line)}) Tj ET`);
        this.y -= size + 4;
      }
    }
  }

  labelValue(label: string, value: string | null | undefined) {
    const clean = htmlToText(value ?? "");
    if (!clean) return;
    this.line(`${label}: ${clean}`, 9);
  }

  gap(points = 6) {
    this.ensurePoints(points);
    this.y -= points;
  }

  heading(text: string, size = 13) {
    this.ensureSpace(2, size);
    this.line(text, size, "F2");
    this.gap(2);
  }

  rule() {
    this.ensurePoints(8);
    this.currentPage().push(`${this.margin} ${this.y} m ${this.pageWidth - this.margin} ${this.y} l S`);
    this.y -= 8;
  }

  private registerImage(image: PdfImageData) {
    const existing = this.imageNames.get(image.cacheKey);
    if (existing) return existing;

    const name = `Im${this.images.length + 1}`;
    this.images.push(image);
    this.imageNames.set(image.cacheKey, name);
    return name;
  }

  drawImage(image: PdfImageData, caption?: string | null) {
    const name = this.registerImage(image);
    const maxWidth = this.pageWidth - this.margin * 2;
    const maxHeight = 225;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1.45);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    this.ensurePoints(drawHeight + 28);
    const x = this.margin;
    const y = this.y - drawHeight;
    this.currentPage().push(
      `q ${formatNumber(drawWidth)} 0 0 ${formatNumber(drawHeight)} ${formatNumber(x)} ${formatNumber(y)} cm /${name} Do Q`,
    );
    this.y = y - 5;

    if (caption) {
      this.line(`Gambar: ${caption}`, 8);
    }
  }

  build() {
    const pagesForBuild = this.pages.map((commands, index) => {
      const footer = `Halaman ${index + 1} dari ${this.pages.length}`;
      return [
        ...commands,
        `BT /F1 8 Tf ${this.pageWidth - this.margin - 82} 24 Td (${escapePdfText(footer)}) Tj ET`,
      ];
    });

    const objects: Array<string | Buffer> = [];
    const addObject = (content: string | Buffer) => {
      objects.push(content);
      return objects.length;
    };

    const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesId = addObject("__PAGES__");
    const fontId = 3 + pagesForBuild.length * 2;
    const boldFontId = fontId + 1;
    const imageStartId = boldFontId + 1;
    const imageResource = this.images.length
      ? `/XObject << ${this.images.map((_, index) => `/Im${index + 1} ${imageStartId + index} 0 R`).join(" ")} >>`
      : "";
    const pageIds: number[] = [];

    pagesForBuild.forEach((commands) => {
      const pageId = objects.length + 1;
      const contentId = objects.length + 2;
      pageIds.push(pageId);
      addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> ${imageResource} >> /Contents ${contentId} 0 R >>`);
      const stream = commands.join("\n");
      addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    });

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    this.images.forEach((image) => {
      const decodeParms = image.decodeParms ? ` /DecodeParms ${image.decodeParms}` : "";
      addObject(Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace ${image.colorSpace} /BitsPerComponent ${image.bitsPerComponent} /Filter ${image.filter}${decodeParms} /Length ${image.data.length} >>\nstream\n`, "latin1"),
        image.data,
        Buffer.from("\nendstream", "latin1"),
      ]));
    });

    const buffers: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
    const offsets = [0];
    let length = buffers[0].length;

    objects.forEach((object, index) => {
      offsets[index + 1] = length;
      const header = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
      const body = Buffer.isBuffer(object) ? object : Buffer.from(object, "latin1");
      const footer = Buffer.from("\nendobj\n", "latin1");
      buffers.push(header, body, footer);
      length += header.length + body.length + footer.length;
    });

    const xrefOffset = length;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index <= objects.length; index += 1) {
      xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    buffers.push(Buffer.from(xref, "latin1"));

    return Buffer.concat(buffers);
  }
}

function getAttr(tag: string, name: string) {
  const regex = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(regex);
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function extractImageRefsFromHtml(html: string | null | undefined): ImageRef[] {
  const refs: ImageRef[] = [];
  const source = html ?? "";
  for (const match of source.matchAll(/<\s*img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = getAttr(tag, "src");
    if (!src) continue;
    refs.push({ src, alt: getAttr(tag, "alt") || null, caption: getAttr(tag, "title") || getAttr(tag, "alt") || null, key: src });
  }
  return refs;
}

function assetImageRefs(links: ExportAssetLink[] | null | undefined): ImageRef[] {
  return (links ?? [])
    .filter((link) => link.asset.type === "IMAGE")
    .map((link) => ({
      src: link.asset.storagePath,
      alt: link.asset.altText ?? link.asset.originalFilename,
      caption: link.asset.caption ?? link.asset.altText ?? link.asset.originalFilename,
      mimeType: link.asset.mimeType,
      key: link.asset.id,
    }));
}

function mergeImageRefs(...groups: ImageRef[][]) {
  const seen = new Set<string>();
  const merged: ImageRef[] = [];
  for (const group of groups) {
    for (const item of group) {
      const key = item.key ?? item.src;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function findProjectRoot() {
  let current = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "package.json")) && existsSync(path.join(current, "packages"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function localCandidates(src: string) {
  const projectRoot = findProjectRoot();
  const cwd = process.cwd();
  const clean = decodeURIComponent(src.split("?")[0].split("#")[0]).replace(/^file:\/\//i, "");
  const relative = clean.replace(/^\/+/, "");

  return Array.from(new Set([
    path.isAbsolute(clean) ? clean : "",
    path.join(cwd, clean),
    path.join(cwd, relative),
    path.join(cwd, "public", relative),
    path.join(projectRoot, relative),
    path.join(projectRoot, "public", relative),
    path.join(projectRoot, "apps", "admin", "public", relative),
    path.join(projectRoot, "templates", "media", path.basename(relative)),
  ].filter(Boolean)));
}

function mimeFromSource(src: string, hint?: string | null) {
  if (hint) return hint.toLowerCase();
  const clean = src.split("?")[0].toLowerCase();
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".png")) return "image/png";
  return "";
}

async function readImageBytes(ref: ImageRef): Promise<{ data: Buffer; mimeType: string; cacheKey: string } | null> {
  if (ref.src.startsWith("data:")) {
    const match = ref.src.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) return null;
    const mimeType = (match[1] || ref.mimeType || "").toLowerCase();
    const data = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]), "utf8");
    return { data, mimeType, cacheKey: ref.key ?? ref.src.slice(0, 64) };
  }

  if (/^https?:\/\//i.test(ref.src)) {
    const response = await fetch(ref.src);
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || mimeFromSource(ref.src, ref.mimeType);
    return { data, mimeType, cacheKey: ref.key ?? ref.src };
  }

  for (const candidate of localCandidates(ref.src)) {
    try {
      if (!existsSync(candidate)) continue;
      const data = await readFile(candidate);
      return { data, mimeType: mimeFromSource(candidate, ref.mimeType), cacheKey: ref.key ?? candidate };
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function parseJpeg(data: Buffer, cacheKey: string): PdfImageData | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 2 > data.length) break;

    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) break;

    if (sofMarkers.has(marker)) {
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      const components = data[offset + 7];
      const colorSpace = components === 1 ? "/DeviceGray" : components === 4 ? "/DeviceCMYK" : "/DeviceRGB";
      return { cacheKey, width, height, data, filter: "/DCTDecode", colorSpace, bitsPerComponent: 8 };
    }

    offset += length;
  }

  return null;
}

function paethPredictor(left: number, up: number, upLeft: number) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

function unfilterPngRows(inflated: Buffer, width: number, height: number, bytesPerPixel: number, rowBytes: number) {
  const output = Buffer.alloc(rowBytes * height);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * rowBytes;
    const previousRowStart = rowStart - rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= bytesPerPixel ? output[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? output[previousRowStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? output[previousRowStart + x - bytesPerPixel] : 0;

      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paethPredictor(left, up, upLeft);

      output[rowStart + x] = value & 0xff;
    }

    sourceOffset += rowBytes;
  }

  return output;
}

function parsePng(data: Buffer, cacheKey: string): PdfImageData | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 33 || !data.subarray(0, 8).equals(signature)) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];
  let palette: Buffer | null = null;

  while (offset + 8 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === "IDAT") {
      idatChunks.push(chunk);
    } else if (type === "PLTE") {
      palette = chunk;
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (!width || !height || !idatChunks.length || bitDepth !== 8 || interlace !== 0) return null;

  const channelsByColorType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (!channels || (colorType === 3 && !palette)) return null;

  const rowBytes = width * channels;
  const bytesPerPixel = Math.max(1, channels);
  const inflated = inflateSync(Buffer.concat(idatChunks));
  if (inflated.length < (rowBytes + 1) * height) return null;

  const pixels = unfilterPngRows(inflated, width, height, bytesPerPixel, rowBytes);
  const outputChannels = colorType === 0 || colorType === 4 ? 1 : 3;
  const colorSpace = outputChannels === 1 ? "/DeviceGray" : "/DeviceRGB";
  const outputRowBytes = width * outputChannels;
  const output = Buffer.alloc((outputRowBytes + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const sourceRow = y * rowBytes;
    const targetRow = y * (outputRowBytes + 1);
    output[targetRow] = 0;

    for (let x = 0; x < width; x += 1) {
      if (colorType === 0 || colorType === 4) {
        output[targetRow + 1 + x] = pixels[sourceRow + x * channels];
      } else if (colorType === 2 || colorType === 6) {
        const sourcePixel = sourceRow + x * channels;
        const targetPixel = targetRow + 1 + x * 3;
        output[targetPixel] = pixels[sourcePixel];
        output[targetPixel + 1] = pixels[sourcePixel + 1];
        output[targetPixel + 2] = pixels[sourcePixel + 2];
      } else if (colorType === 3 && palette) {
        const index = pixels[sourceRow + x];
        const targetPixel = targetRow + 1 + x * 3;
        output[targetPixel] = palette[index * 3] ?? 255;
        output[targetPixel + 1] = palette[index * 3 + 1] ?? 255;
        output[targetPixel + 2] = palette[index * 3 + 2] ?? 255;
      }
    }
  }

  return {
    cacheKey,
    width,
    height,
    data: deflateSync(output),
    filter: "/FlateDecode",
    colorSpace,
    bitsPerComponent: 8,
    decodeParms: `<< /Predictor 15 /Colors ${outputChannels} /BitsPerComponent 8 /Columns ${width} >>`,
  };
}

async function loadPdfImage(ref: ImageRef): Promise<PdfImageData | null> {
  try {
    const image = await readImageBytes(ref);
    if (!image) return null;
    const mime = image.mimeType || mimeFromSource(ref.src, ref.mimeType);
    if (mime.includes("jpeg") || mime.includes("jpg") || image.data.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))) {
      return parseJpeg(image.data, image.cacheKey);
    }
    if (mime.includes("png") || image.data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return parsePng(image.data, image.cacheKey);
    }
  } catch {
    return null;
  }

  return null;
}


function imageDisplayName(ref: ImageRef) {
  if (ref.alt) return ref.alt;
  if (ref.caption) return ref.caption;
  if (ref.src.startsWith("data:")) return "gambar dari HTML";
  return path.basename(ref.src.split("?")[0]) || ref.src.slice(0, 80);
}

async function addImages(pdf: SimplePdf, refs: ImageRef[]) {
  for (const ref of refs) {
    const image = await loadPdfImage(ref);
    if (image) {
      pdf.drawImage(image, ref.caption ?? ref.alt ?? imageDisplayName(ref));
    } else {
      pdf.line(`[Gambar tidak dapat dimuat: ${imageDisplayName(ref)}]`, 8);
    }
  }
}

async function addRichBlock(pdf: SimplePdf, label: string, html: string | null | undefined, assetLinks: ExportAssetLink[] = [], font = "F1") {
  const text = htmlToText(html);
  if (text) {
    if (label) pdf.line(label, 10, "F2");
    pdf.line(text, 10, font);
  } else if (label && assetLinks.length) {
    pdf.line(label, 10, "F2");
  }

  const refs = mergeImageRefs(extractImageRefsFromHtml(html), assetImageRefs(assetLinks));
  if (refs.length) await addImages(pdf, refs);
}

async function buildPdf(params: ExportParams, questions: ExportQuestion[]) {
  const pdf = new SimplePdf();
  pdf.heading("SOALFLOW - EXPORT SOAL", 16);
  pdf.line("Dokumen ini dibuat otomatis dari bank soal Olimpiade Fisika.", 10);
  pdf.rule();
  pdf.line(`Tanggal export: ${dateTime(new Date())}`, 10);
  pdf.line(`Status validasi: ${validationLabels[params.validation]}`, 10);
  pdf.line(`Mode export: ${selectionLabels[params.selection]}`, 10);
  pdf.line(`Kisi-kisi dipilih: ${params.blueprintCodes.length ? params.blueprintCodes.join(", ") : "Semua kisi-kisi"}`, 10);
  pdf.line(`Jumlah soal: ${questions.length}`, 10);
  pdf.line(`Jumlah kisi-kisi: ${new Set(questions.map((question) => question.blueprint.code)).size}`, 10);
  pdf.gap(12);

  if (!questions.length) {
    pdf.line("Tidak ada soal yang sesuai dengan pengaturan export.", 11);
    return pdf.build();
  }

  let previousBlueprintCode = "";

  for (const [index, question] of questions.entries()) {
    const version = question.currentVersion;
    const blueprintVersion = question.blueprint.currentVersion;
    const stimulusVersion = question.stimulus?.currentVersion;
    const options = (version?.options ?? []).slice().sort((left, right) => left.sortOrder - right.sortOrder);

    if (question.blueprint.code !== previousBlueprintCode) {
      pdf.rule();
      pdf.heading(`Kisi-kisi ${question.blueprint.code}`, 12);
      previousBlueprintCode = question.blueprint.code;
    }

    pdf.heading(`${index + 1}. ${question.code} (${question.status})`, 12);
    pdf.line(`Nomor stimulus pada kisi-kisi: ${version?.orderInStimulus ?? "Independent / tanpa stimulus"}`, 9);

    if (params.includeBlueprint) {
      pdf.labelValue("Judul kisi-kisi", blueprintVersion?.titleHtml);
      pdf.labelValue("Kelompok tes", blueprintVersion?.testGroupHtml);
      pdf.labelValue("Topik", blueprintVersion?.testTopicHtml);
      pdf.labelValue("Kompetensi", blueprintVersion?.competencyHtml);
      pdf.labelValue("Indikator", blueprintVersion?.indicatorHtml);
      if (blueprintVersion?.cognitiveLevel) pdf.line(`Level kognitif: ${blueprintVersion.cognitiveLevel}`, 9);
      pdf.gap(4);
    }

    if (params.includeStimulus && stimulusVersion) {
      const stimulusTitle = htmlToText(stimulusVersion.titleHtml);
      pdf.line(`STIMULUS ${question.stimulus?.code ?? "-"}${stimulusTitle ? ` - ${stimulusTitle}` : ""}`, 10, "F2");
      await addRichBlock(pdf, "Instruksi stimulus", stimulusVersion.instructionsHtml, []);
      await addRichBlock(pdf, "Teks/gambar stimulus", stimulusVersion.contentHtml, stimulusVersion.assets);
      if (stimulusVersion.source) pdf.line(`Sumber stimulus: ${stimulusVersion.source}`, 8);
      pdf.gap(5);
    }

    await addRichBlock(pdf, "Soal", version?.stemHtml, version?.assets ?? [], "F2");

    for (const option of options) {
      await addRichBlock(pdf, `${option.label}.`, option.contentHtml, option.assets, "F1");
    }

    if (params.includeAnswer) {
      pdf.line(`Kunci jawaban: ${version?.answerKey ?? "-"}`, 10, "F2");
    }
    if (params.includeExplanation && version?.explanationHtml) {
      await addRichBlock(pdf, "Pembahasan", version.explanationHtml, []);
    }
    pdf.gap(10);
  }

  return pdf.build();
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!canAccess(user.roles, ["EXAM_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const params = readParams(request);
  const questions = await loadQuestions(params);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const baseFilename = safeFilename(`export-soal-${params.validation}-${params.selection}-${timestamp}`);

  if (params.format === "pdf") {
    const buffer = await buildPdf(params, questions);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseFilename}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  }

  const workbook = buildWorkbook(params, questions);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseFilename}.xlsx"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
