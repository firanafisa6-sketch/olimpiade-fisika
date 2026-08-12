"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks, Search } from "lucide-react";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/pagination";

type ValidationFilter = "ALL" | "APPROVED" | "UNVALIDATED";

type BlueprintOption = {
  id: string;
  code: string;
  title: string;
  group: string;
  mode: string;
  allCount: number;
  approvedCount: number;
  unvalidatedCount: number;
};

type Props = {
  blueprints: BlueprintOption[];
};

function number(value: number) {
  return value.toLocaleString("id-ID");
}

function getBlueprintCount(blueprint: BlueprintOption, validation: ValidationFilter) {
  if (validation === "APPROVED") return blueprint.approvedCount;
  if (validation === "UNVALIDATED") return blueprint.unvalidatedCount;
  return blueprint.allCount;
}

function validationLabel(validation: ValidationFilter) {
  if (validation === "APPROVED") return "soal tervalidasi";
  if (validation === "UNVALIDATED") return "soal belum tervalidasi";
  return "semua status soal";
}

function pageNumbers(page: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const values = new Set([1, totalPages, page - 1, page, page + 1]);
  return Array.from(values)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
}

export function BlueprintExportSelector({ blueprints }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [draftPageSize, setDraftPageSize] = useState<string>("10");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [validation, setValidation] = useState<ValidationFilter>("APPROVED");

  useEffect(() => {
    const validationSelect = document.querySelector<HTMLSelectElement>('select[name="validation"]');
    const readValue = () => {
      const value = validationSelect?.value;
      setValidation(value === "ALL" || value === "UNVALIDATED" ? value : "APPROVED");
    };

    readValue();
    validationSelect?.addEventListener("change", readValue);
    return () => validationSelect?.removeEventListener("change", readValue);
  }, []);

  const statusBlueprints = useMemo(() => {
    return blueprints.filter((blueprint) => getBlueprintCount(blueprint, validation) > 0);
  }, [blueprints, validation]);

  const statusCodeSet = useMemo(() => new Set(statusBlueprints.map((blueprint) => blueprint.code)), [statusBlueprints]);

  const selectedCodesForCurrentStatus = useMemo(
    () => selectedCodes.filter((code) => statusCodeSet.has(code)),
    [selectedCodes, statusCodeSet],
  );

  const selectedSet = useMemo(() => new Set(selectedCodesForCurrentStatus), [selectedCodesForCurrentStatus]);

  const filteredBlueprints = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return statusBlueprints;

    return statusBlueprints.filter((blueprint) => {
      return [blueprint.code, blueprint.title, blueprint.group, blueprint.mode]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [statusBlueprints, query]);

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(filteredBlueprints.length / pageSize));
  }, [filteredBlueprints.length, pageSize]);
  const currentPage = Math.min(page, totalPages);
  const startIndex = pageSize === "all" ? 0 : (currentPage - 1) * pageSize;
  const endIndex = pageSize === "all" ? filteredBlueprints.length : startIndex + pageSize;
  const pageItems = filteredBlueprints.slice(startIndex, endIndex);
  const from = filteredBlueprints.length ? startIndex + 1 : 0;
  const to = Math.min(endIndex, filteredBlueprints.length);
  const pages = pageNumbers(currentPage, totalPages);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, validation]);

  function setFilter(value: string) {
    setQuery(value);
  }

  function toggleCode(code: string) {
    setSelectedCodes((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      return [...current, code];
    });
  }

  function selectVisiblePage() {
    setSelectedCodes((current) => Array.from(new Set([...current, ...pageItems.map((item) => item.code)])));
  }

  function applyPageSize() {
    if (draftPageSize === "all") {
      setPageSize("all");
      return;
    }

    const parsed = Number(draftPageSize);
    setPageSize(PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed as PageSize : 10);
  }

  return (
    <section className="card panel form-grid" style={{ marginTop: 32 }}>
      {selectedCodesForCurrentStatus.map((code) => (
        <input key={code} type="hidden" name="blueprintCode" value={code} />
      ))}

      <div className="panel-heading" style={{ alignItems: "flex-start", gap: 16 }}>
        <div>
          <h3><ListChecks size={18} /> Export berdasarkan kisi-kisi yang dipilih</h3>
          <p className="muted-text">
            Kisi-kisi yang tampil sudah mengikuti pilihan <strong>Status soal</strong> di atas. Bila tidak ada kisi-kisi yang dicentang, sistem otomatis mengekspor semua kisi-kisi sesuai status soal dan pola export.
          </p>
          <p className="muted-text" style={{ marginTop: 4 }}>
            Terpilih: <strong>{number(selectedCodesForCurrentStatus.length)}</strong> kisi-kisi dari {number(statusBlueprints.length)} kisi-kisi yang memiliki {validationLabel(validation)}.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? "Hide" : "Unhide"}
        </button>
      </div>

      {isOpen ? (
        <div className="form-grid">
          <label className="field-block">
            <span className="field-label">Filter kisi-kisi</span>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ left: 12, position: "absolute", top: 13 }} />
              <input
                className="text-input"
                type="search"
                value={query}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Cari kode kisi-kisi, judul, kelompok tes, atau mode soal..."
                style={{ paddingLeft: 38 }}
              />
            </div>
          </label>

          <div className="package-action-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <button className="secondary-button" type="button" onClick={selectVisiblePage} disabled={!pageItems.length}>
              Pilih halaman ini
            </button>
            <button className="secondary-button" type="button" onClick={() => setSelectedCodes([])} disabled={!selectedCodes.length}>
              Kosongkan pilihan
            </button>
          </div>

          <div className="form-grid" style={{ maxHeight: 420, overflow: "auto", paddingRight: 6 }}>
            {pageItems.length ? pageItems.map((blueprint) => (
              <label key={blueprint.id} className="check-row" style={{ alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(blueprint.code)}
                  onChange={() => toggleCode(blueprint.code)}
                />
                <span>
                  <strong>{blueprint.code}</strong> — {blueprint.title || "Tanpa judul"}
                  <small className="muted-text" style={{ display: "block" }}>
                    {blueprint.group ? `${blueprint.group} · ` : ""}{blueprint.mode || "Mode soal belum diisi"} · {number(getBlueprintCount(blueprint, validation))} soal sesuai status
                  </small>
                </span>
              </label>
            )) : (
              <p className="muted-text">Tidak ada kisi-kisi yang cocok dengan filter dan status soal yang dipilih.</p>
            )}
          </div>

          <div className="pagination-bar">
            <div className="pagination-summary">
              Menampilkan <strong>{number(from)}–{number(to)}</strong> dari <strong>{number(filteredBlueprints.length)}</strong> kisi-kisi
            </div>

            <div className="pagination-size-form">
              <label>
                Tampilkan
                <select value={draftPageSize} onChange={(event) => setDraftPageSize(event.target.value)}>
                  {PAGE_SIZE_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                  <option value="all">All</option>
                </select>
              </label>
              <button className="secondary-button compact-button" type="button" onClick={applyPageSize}>Terapkan</button>
            </div>

            {pageSize !== "all" && totalPages > 1 ? (
              <nav className="pagination-pages" aria-label="Paginasi kisi-kisi export">
                <button
                  className={`pagination-button ${currentPage <= 1 ? "is-disabled" : ""}`}
                  type="button"
                  aria-disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={16} /> Sebelumnya
                </button>
                {pages.map((value, index) => {
                  const previous = pages[index - 1];
                  return (
                    <span className="pagination-number-wrap" key={value}>
                      {previous && value - previous > 1 ? <span className="pagination-ellipsis">…</span> : null}
                      <button
                        className={`pagination-number ${value === currentPage ? "is-active" : ""}`}
                        type="button"
                        aria-current={value === currentPage ? "page" : undefined}
                        onClick={() => setPage(value)}
                      >
                        {number(value)}
                      </button>
                    </span>
                  );
                })}
                <button
                  className={`pagination-button ${currentPage >= totalPages ? "is-disabled" : ""}`}
                  type="button"
                  aria-disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Berikutnya <ChevronRight size={16} />
                </button>
              </nav>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
