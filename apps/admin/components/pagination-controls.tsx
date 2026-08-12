import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/pagination";

type PaginationControlsProps = {
  basePath: string;
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  itemLabel: string;
  params?: Record<string, string | undefined>;
  pageParam?: string;
  sizeParam?: string;
};

function buildHref(
  basePath: string,
  params: Record<string, string | undefined>,
  pageParam: string,
  sizeParam: string,
  page: number,
  pageSize: PageSize,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== pageParam && key !== sizeParam) query.set(key, value);
  }
  query.set(pageParam, String(page));
  query.set(sizeParam, String(pageSize));
  return `${basePath}?${query.toString()}`;
}

function pageNumbers(page: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const values = new Set([1, totalPages, page - 1, page, page + 1]);
  return Array.from(values)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
}

export function PaginationControls({
  basePath,
  page,
  pageSize,
  total,
  totalPages,
  from,
  to,
  itemLabel,
  params = {},
  pageParam = "page",
  sizeParam = "size",
}: PaginationControlsProps) {
  const pages = pageNumbers(page, totalPages);
  return (
    <div className="pagination-bar">
      <div className="pagination-summary">
        Menampilkan <strong>{from}–{to}</strong> dari <strong>{total}</strong> {itemLabel}
      </div>

      <form className="pagination-size-form" action={basePath} method="get">
        {Object.entries(params).map(([key, value]) =>
          value && key !== pageParam && key !== sizeParam ? (
            <input key={key} type="hidden" name={key} value={value} />
          ) : null,
        )}
        <input type="hidden" name={pageParam} value="1" />
        <label>
          Tampilkan
          <select name={sizeParam} defaultValue={String(pageSize)}>
            {PAGE_SIZE_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
            <option value="all">All</option>
          </select>
        </label>
        <button className="secondary-button compact-button" type="submit">Terapkan</button>
      </form>

      {pageSize !== "all" && totalPages > 1 ? (
        <nav className="pagination-pages" aria-label={`Paginasi ${itemLabel}`}>
          <Link
            className={`pagination-button ${page <= 1 ? "is-disabled" : ""}`}
            aria-disabled={page <= 1}
            href={buildHref(basePath, params, pageParam, sizeParam, Math.max(1, page - 1), pageSize)}
          >
            <ChevronLeft size={16} /> Sebelumnya
          </Link>
          {pages.map((value, index) => {
            const previous = pages[index - 1];
            return (
              <span className="pagination-number-wrap" key={value}>
                {previous && value - previous > 1 ? <span className="pagination-ellipsis">…</span> : null}
                <Link
                  className={`pagination-number ${value === page ? "is-active" : ""}`}
                  aria-current={value === page ? "page" : undefined}
                  href={buildHref(basePath, params, pageParam, sizeParam, value, pageSize)}
                >
                  {value}
                </Link>
              </span>
            );
          })}
          <Link
            className={`pagination-button ${page >= totalPages ? "is-disabled" : ""}`}
            aria-disabled={page >= totalPages}
            href={buildHref(basePath, params, pageParam, sizeParam, Math.min(totalPages, page + 1), pageSize)}
          >
            Berikutnya <ChevronRight size={16} />
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
