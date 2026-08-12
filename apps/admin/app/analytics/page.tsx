import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { requirePageUser } from "@/lib/auth";
import { buildPackageAnalysis } from "@/lib/item-analysis";
import { paginationWindow, parsePage, parsePageSize } from "@/lib/pagination";
import { db } from "@seleksi/database";
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Gauge,
  ListChecks,
  Sigma,
  Target,
  UsersRound,
} from "lucide-react";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    packageId?: string;
    scorePage?: string;
    scoreSize?: string;
    itemPage?: string;
    itemSize?: string;
  }>;
};

function percent(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("id-ID", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function decimal(value: number | null, digits = 3) {
  if (value === null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function score(value: number) {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateTime(value: Date | null) {
  return value?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "–";
}

function statusClass(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("data belum") || normalized.includes("minimal")) return "analysis-neutral";
  if (
    normalized.includes("negatif") ||
    normalized.includes("rendah") ||
    normalized.includes("tidak berfungsi") ||
    normalized.includes("tidak dipilih")
  ) return "analysis-danger";
  if (
    normalized.includes("mudah") ||
    normalized.includes("sukar") ||
    normalized.includes("marginal") ||
    normalized.includes("revisi")
  ) return "analysis-warning";
  if (
    normalized.includes("baik") ||
    normalized.includes("sedang") ||
    normalized.includes("cukup") ||
    normalized === "berfungsi" ||
    normalized === "kunci"
  ) return "analysis-good";
  return "analysis-neutral";
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  await requirePageUser(["EXAM_ADMIN", "SUPER_ADMIN"]);
  const params = await searchParams;
  const packages = await db.examPackage.findMany({
    orderBy: [{ createdAt: "desc" }, { code: "desc" }],
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { sessions: true } },
    },
  });

  const selectedPackageId =
    packages.find((item) => item.id === params?.packageId)?.id ?? packages[0]?.id ?? null;
  const analysis = selectedPackageId ? await buildPackageAnalysis(selectedPackageId) : null;

  const scorePagination = paginationWindow(
    analysis?.scores.length ?? 0,
    parsePage(params?.scorePage),
    parsePageSize(params?.scoreSize),
  );
  const itemPagination = paginationWindow(
    analysis?.items.length ?? 0,
    parsePage(params?.itemPage),
    parsePageSize(params?.itemSize),
  );
  const scoreRows = analysis?.scores.slice(
    scorePagination.skip,
    scorePagination.take ? scorePagination.skip + scorePagination.take : undefined,
  ) ?? [];
  const itemRows = analysis?.items.slice(
    itemPagination.skip,
    itemPagination.take ? itemPagination.skip + itemPagination.take : undefined,
  ) ?? [];

  return (
    <AdminShell
      title="Nilai & Parameter Soal"
      subtitle="Rekap nilai peserta dan analisis butir klasik berdasarkan hasil ujian"
      allowedRoles={["EXAM_ADMIN", "SUPER_ADMIN"]}
    >
      <section className="card panel analysis-filter-panel">
        <div className="panel-heading">
          <div>
            <h3><BarChart3 size={19} /> Pilih paket ujian</h3>
            <p className="muted-text">Analisis hanya memakai attempt final berstatus SUBMITTED atau EXPIRED.</p>
          </div>
          {analysis ? (
            <Link
              className="primary-button"
              href={`/api/analytics/export?packageId=${encodeURIComponent(analysis.packageInfo.id)}`}
            >
              <FileSpreadsheet size={17} /> Unduh Excel
            </Link>
          ) : null}
        </div>
        <form method="get" action="/analytics" className="analysis-package-form">
          <label className="field-block">
            <span className="field-label">Paket ujian</span>
            <select className="select-input" name="packageId" defaultValue={selectedPackageId ?? ""}>
              {!packages.length ? <option value="">Belum ada paket</option> : null}
              {packages.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.code} — {item.name} ({item._count.sessions} peserta)
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" type="submit">Tampilkan analisis</button>
        </form>
      </section>

      {!analysis ? (
        <section className="card panel empty-analysis-state">
          <Gauge size={34} />
          <h2>Belum ada paket yang dapat dianalisis</h2>
          <p>Buat paket ujian dan plot peserta terlebih dahulu.</p>
        </section>
      ) : (
        <>
          <div className="page-header analysis-title-row">
            <div>
              <span className="eyebrow">{analysis.packageInfo.code}</span>
              <h2>{analysis.packageInfo.name}</h2>
              <p>{analysis.packageInfo.fields.join(" • ") || "Bidang belum ditentukan"}</p>
            </div>
            <span className="badge">{analysis.summary.participantCount} hasil final</span>
          </div>

          <section className="analysis-summary-grid">
            <article className="card analysis-summary-card">
              <UsersRound size={22} />
              <div><span>Peserta dianalisis</span><strong>{analysis.summary.participantCount}</strong></div>
            </article>
            <article className="card analysis-summary-card">
              <Target size={22} />
              <div><span>Rata-rata nilai</span><strong>{score(analysis.summary.averageScore)}</strong></div>
            </article>
            <article className="card analysis-summary-card">
              <ListChecks size={22} />
              <div><span>Butir teranalisis</span><strong>{analysis.summary.itemCount}</strong></div>
            </article>
            <article className="card analysis-summary-card">
              <Sigma size={22} />
              <div>
                <span>Reliabilitas paket</span>
                <strong>{decimal(analysis.reliability[0]?.coefficient ?? null)}</strong>
                <small>{analysis.reliability[0]?.category ?? "Data belum cukup"}</small>
              </div>
            </article>
          </section>

          <section className="card panel data-table-wrap analysis-score-section">
            <div className="panel-heading">
              <div>
                <h3><UsersRound size={18} /> Nilai peserta</h3>
                <p className="muted-text">
                  Minimum {score(analysis.summary.minimumScore)} • Median {score(analysis.summary.medianScore)} • Maksimum {score(analysis.summary.maximumScore)}
                </p>
              </div>
              <Link
                className="secondary-button"
                href={`/api/analytics/export?packageId=${encodeURIComponent(analysis.packageInfo.id)}`}
              >
                <Download size={16} /> Download Excel
              </Link>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Nama peserta</th>
                  <th>Benar</th>
                  <th>Salah</th>
                  <th>Kosong</th>
                  <th>Jumlah soal</th>
                  <th>Nilai</th>
                  <th>Waktu kirim</th>
                </tr>
              </thead>
              <tbody>
                {scoreRows.map((row) => (
                  <tr key={row.attemptId}>
                    <td><strong>{row.username}</strong></td>
                    <td>{row.participantName}</td>
                    <td>{row.correctCount}</td>
                    <td>{row.wrongCount}</td>
                    <td>{row.unansweredCount}</td>
                    <td>{row.totalQuestions}</td>
                    <td><strong>{score(row.score)}</strong></td>
                    <td>{dateTime(row.submittedAt)}</td>
                  </tr>
                ))}
                {!scoreRows.length ? (
                  <tr><td colSpan={8}><p className="muted-text">Belum ada peserta yang menyelesaikan ujian.</p></td></tr>
                ) : null}
              </tbody>
            </table>
            <PaginationControls
              basePath="/analytics"
              page={scorePagination.page}
              pageSize={scorePagination.pageSize}
              total={analysis.scores.length}
              totalPages={scorePagination.totalPages}
              from={scorePagination.from}
              to={scorePagination.to}
              itemLabel="nilai peserta"
              pageParam="scorePage"
              sizeParam="scoreSize"
              params={{
                packageId: analysis.packageInfo.id,
                itemPage: String(itemPagination.page),
                itemSize: String(itemPagination.pageSize),
              }}
            />
          </section>

          <section className="card panel analysis-method-panel">
            <div className="panel-heading"><h3><CheckCircle2 size={18} /> Pedoman parameter soal</h3></div>
            <div className="analysis-method-grid">
              <div><strong>Tingkat Kesukaran (P)</strong><p>Proporsi peserta yang menjawab benar. P &lt; 0,30 sukar; 0,30–0,70 sedang; P &gt; 0,70 mudah.</p></div>
              <div><strong>Daya Beda (D)</strong><p>Selisih proporsi benar kelompok atas dan bawah 27%. Nilai tinggi menunjukkan butir lebih mampu membedakan kemampuan.</p></div>
              <div><strong>Validitas point-biserial</strong><p>Korelasi skor butir dengan skor total yang sudah dikurangi butir tersebut. Nilai negatif menandakan butir perlu diperiksa.</p></div>
              <div><strong>Fungsi Pengecoh</strong><p>Pengecoh dinilai berfungsi apabila dipilih sekurang-kurangnya 5% peserta yang menerima butir tersebut.</p></div>
              <div><strong>Reliabilitas</strong><p>Cronbach&apos;s Alpha dihitung dari skor per kisi-kisi. Jika unitnya dikotomis, hasilnya setara pendekatan KR-20.</p></div>
            </div>
          </section>

          <section className="card panel data-table-wrap analysis-item-section">
            <div className="panel-heading">
              <div>
                <h3><Gauge size={18} /> Parameter soal</h3>
                <p className="muted-text">N adalah jumlah peserta yang menerima butir; penting untuk paket dengan random satu soal.</p>
              </div>
              <span className="badge">{analysis.items.length} butir</span>
            </div>
            <table className="data-table analysis-item-table">
              <thead>
                <tr>
                  <th>Bidang / Kisi-kisi</th>
                  <th>Kode soal</th>
                  <th>Isi soal</th>
                  <th>N</th>
                  <th>Kesukaran (P)</th>
                  <th>Daya beda (D)</th>
                  <th>Point-biserial</th>
                  <th>Pengecoh</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((item) => (
                  <tr key={item.sourceQuestionVersionId}>
                    <td><strong>{item.fieldName}</strong><br/><span className="muted-text">{item.blueprintCode}</span></td>
                    <td><strong>{item.questionCode}</strong></td>
                    <td><div className="analysis-stem-text">{item.stemText || "–"}</div></td>
                    <td>{item.participantCount}<br/><span className="muted-text">{item.correctCount} benar</span></td>
                    <td>
                      <strong>{decimal(item.difficultyIndex)}</strong>
                      <span className={`analysis-status ${statusClass(item.difficultyCategory)}`}>{item.difficultyCategory}</span>
                    </td>
                    <td>
                      <strong>{decimal(item.discriminationIndex)}</strong>
                      <span className={`analysis-status ${statusClass(item.discriminationCategory)}`}>{item.discriminationCategory}</span>
                    </td>
                    <td>
                      <strong>{decimal(item.pointBiserial)}</strong>
                      <span className={`analysis-status ${statusClass(item.validityCategory)}`}>{item.validityCategory}</span>
                    </td>
                    <td>
                      <details className="analysis-distractor-details">
                        <summary>Lihat pilihan</summary>
                        <div className="analysis-distractor-list">
                          {item.distractors.map((option) => (
                            <div key={option.label}>
                              <strong>{option.label}{option.isKey ? " (kunci)" : ""}</strong>
                              <span>{option.selectedCount} • {percent(option.percentage, 1)}</span>
                              <small className={statusClass(option.functionStatus)}>{option.functionStatus}</small>
                            </div>
                          ))}
                          <div><strong>Kosong</strong><span>{item.unansweredCount}</span><small>Tanpa jawaban</small></div>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {!itemRows.length ? (
                  <tr><td colSpan={8}><p className="muted-text">Parameter belum dapat dihitung karena belum ada hasil final.</p></td></tr>
                ) : null}
              </tbody>
            </table>
            <PaginationControls
              basePath="/analytics"
              page={itemPagination.page}
              pageSize={itemPagination.pageSize}
              total={analysis.items.length}
              totalPages={itemPagination.totalPages}
              from={itemPagination.from}
              to={itemPagination.to}
              itemLabel="parameter soal"
              pageParam="itemPage"
              sizeParam="itemSize"
              params={{
                packageId: analysis.packageInfo.id,
                scorePage: String(scorePagination.page),
                scoreSize: String(scorePagination.pageSize),
              }}
            />
          </section>

          <section className="card panel data-table-wrap analysis-reliability-section">
            <div className="panel-heading"><h3><Sigma size={18} /> Reliabilitas tes</h3></div>
            <table className="data-table">
              <thead><tr><th>Cakupan</th><th>Metode</th><th>Unit kisi-kisi</th><th>Peserta</th><th>Koefisien</th><th>Interpretasi</th></tr></thead>
              <tbody>
                {analysis.reliability.map((row) => (
                  <tr key={row.scope}>
                    <td><strong>{row.scope}</strong></td>
                    <td>{row.method}</td>
                    <td>{row.unitCount}</td>
                    <td>{row.participantCount}</td>
                    <td><strong>{decimal(row.coefficient)}</strong></td>
                    <td><span className={`analysis-status ${statusClass(row.category)}`}>{row.category}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="analysis-note">
              Koefisien reliabilitas perlu ditafsirkan bersama jumlah peserta, jumlah kisi-kisi, tujuan tes, dan kualitas sampel. Nilai ini bukan satu-satunya dasar keputusan mempertahankan atau membuang soal.
            </p>
          </section>
        </>
      )}
    </AdminShell>
  );
}
