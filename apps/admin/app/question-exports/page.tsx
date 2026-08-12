import { AdminShell } from "@/components/admin-shell";
import { requirePageUser } from "@/lib/auth";
import { db } from "@seleksi/database";
import {
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  FileText,
  ListFilter,
  Shuffle,
} from "lucide-react";
import { BlueprintExportSelector } from "./blueprint-export-selector";

export const dynamic = "force-dynamic";

function number(value: number) {
  return value.toLocaleString("id-ID");
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
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

export default async function QuestionExportsPage() {
  await requirePageUser(["EXAM_ADMIN", "SUPER_ADMIN"]);

  const [
    totalQuestions,
    approvedQuestions,
    totalBlueprints,
    blueprints,
    questionCountsByBlueprint,
    approvedQuestionCountsByBlueprint,
  ] = await Promise.all([
    db.question.count({ where: { currentVersionId: { not: null } } }),
    db.question.count({ where: { currentVersionId: { not: null }, status: "APPROVED" } }),
    db.blueprint.count({ where: { currentVersionId: { not: null } } }),
    db.blueprint.findMany({
      where: { currentVersionId: { not: null } },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        currentVersion: {
          select: {
            titleHtml: true,
            testGroupHtml: true,
            indicatorHtml: true,
            questionMode: true,
          },
        },
      },
    }),
    db.question.groupBy({
      by: ["blueprintId"],
      where: { currentVersionId: { not: null } },
      _count: { _all: true },
    }),
    db.question.groupBy({
      by: ["blueprintId"],
      where: { currentVersionId: { not: null }, status: "APPROVED" },
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map(questionCountsByBlueprint.map((item) => [item.blueprintId, item._count._all]));
  const approvedCountMap = new Map(
    approvedQuestionCountsByBlueprint.map((item) => [item.blueprintId, item._count._all]),
  );

  const unvalidatedQuestions = Math.max(totalQuestions - approvedQuestions, 0);
  const blueprintOptions = blueprints.map((blueprint) => {
    const version = blueprint.currentVersion;
    const allCount = countMap.get(blueprint.id) ?? 0;
    const approvedCount = approvedCountMap.get(blueprint.id) ?? 0;
    return {
      id: blueprint.id,
      code: blueprint.code,
      title: htmlToText(version?.titleHtml) || htmlToText(version?.indicatorHtml) || "Tanpa judul",
      group: htmlToText(version?.testGroupHtml),
      mode: version?.questionMode ?? "",
      allCount,
      approvedCount,
      unvalidatedCount: Math.max(allCount - approvedCount, 0),
    };
  });

  return (
    <AdminShell
      title="Export Soal"
      subtitle="Export bank soal ke Excel berisi HTML atau PDF siap baca"
      allowedRoles={["EXAM_ADMIN", "SUPER_ADMIN"]}
    >
      <div className="page-header">
        <div>
          <h2>Pengaturan export bank soal</h2>
          <p>
            Pilih status validasi, pola pengambilan soal, opsi isi PDF, dan kisi-kisi tertentu bila diperlukan.
          </p>
        </div>
        <span className="badge">Export Soal</span>
      </div>

      <section className="analysis-summary-grid">
        <article className="card analysis-summary-card">
          <FileText size={22} />
          <div><span>Total soal aktif</span><strong>{number(totalQuestions)}</strong></div>
        </article>
        <article className="card analysis-summary-card">
          <CheckCircle2 size={22} />
          <div><span>Soal tervalidasi</span><strong>{number(approvedQuestions)}</strong></div>
        </article>
        <article className="card analysis-summary-card">
          <ListFilter size={22} />
          <div><span>Belum tervalidasi</span><strong>{number(unvalidatedQuestions)}</strong></div>
        </article>
        <article className="card analysis-summary-card">
          <Shuffle size={22} />
          <div><span>Kisi-kisi aktif</span><strong>{number(totalBlueprints)}</strong></div>
        </article>
      </section>

      <form method="get" action="/api/question-exports" className="form-grid">
        <section className="card panel form-grid">
          <div className="panel-heading">
            <div>
              <h3><FileDown size={19} /> Form export soal</h3>
              <p className="muted-text">
                Excel selalu dibuat lengkap dengan kode soal, HTML soal, opsi, kunci, pembahasan, kisi-kisi, teks bacaan/stimulus, dan sheet format template.
              </p>
            </div>
          </div>

          <div className="two-columns">
            <label className="field-block">
              <span className="field-label">Status soal</span>
              <select className="select-input" name="validation" defaultValue="APPROVED">
                <option value="ALL">Semua soal</option>
                <option value="APPROVED">Soal tervalidasi / APPROVED</option>
                <option value="UNVALIDATED">Soal belum tervalidasi / selain APPROVED</option>
              </select>
            </label>
            <label className="field-block">
              <span className="field-label">Pola export</span>
              <select className="select-input" name="selection" defaultValue="ALL">
                <option value="ALL">Seluruh soal sesuai filter</option>
                <option value="RANDOM_PER_BLUEPRINT">Random 1 soal pada setiap kisi-kisi</option>
              </select>
            </label>
          </div>

          <section className="card soft-card form-grid">
            <div>
              <strong>Pengaturan khusus PDF</strong>
              <p className="muted-text">
                Pilihan ini hanya memengaruhi PDF. Excel tetap mengekspor data lengkap dalam sel HTML dan versi teks.
              </p>
            </div>
            <div className="two-columns">
              <input type="hidden" name="includeAnswer" value="0" />
              <label className="check-row"><input type="checkbox" name="includeAnswer" value="1" defaultChecked /> Sertakan kunci jawaban</label>

              <input type="hidden" name="includeBlueprint" value="0" />
              <label className="check-row"><input type="checkbox" name="includeBlueprint" value="1" defaultChecked /> Sertakan informasi kisi-kisi</label>

              <input type="hidden" name="includeStimulus" value="0" />
              <label className="check-row"><input type="checkbox" name="includeStimulus" value="1" defaultChecked /> Sertakan teks bacaan/stimulus dan gambar</label>

              <label className="check-row"><input type="checkbox" name="includeExplanation" value="1" /> Sertakan pembahasan</label>
            </div>
          </section>
        </section>

        <BlueprintExportSelector blueprints={blueprintOptions} />

        <section className="card panel">
          <div className="package-action-grid">
            <button className="primary-button" type="submit" name="format" value="xlsx">
              <FileSpreadsheet size={17} /> Export Excel HTML
            </button>
            <button className="secondary-button" type="submit" name="format" value="pdf">
              <FileText size={17} /> Export PDF
            </button>
          </div>
        </section>
      </form>
    </AdminShell>
  );
}
