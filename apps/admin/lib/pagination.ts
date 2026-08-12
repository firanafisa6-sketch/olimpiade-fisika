export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number] | "all";

export function parsePage(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parsePageSize(value?: string): PageSize {
  if (value === "all") return "all";
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
    ? (parsed as (typeof PAGE_SIZE_OPTIONS)[number])
    : 10;
}

export function paginationWindow(total: number, requestedPage: number, pageSize: PageSize) {
  if (pageSize === "all") {
    return {
      page: 1,
      pageSize,
      skip: 0,
      take: undefined as number | undefined,
      totalPages: 1,
      from: total ? 1 : 0,
      to: total,
    };
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const skip = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    skip,
    take: pageSize as number | undefined,
    totalPages,
    from: total ? skip + 1 : 0,
    to: Math.min(total, skip + pageSize),
  };
}
