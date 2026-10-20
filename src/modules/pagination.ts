/** Rows per page on every admin list; wide enough to scan, short enough to stay one screen of reading on a laptop. */
export const PAGE_SIZE = 20;

/**
 * Turns a total and the `?page=` value into a safe window. Anything that is not a whole number falls back to the
 * first page, and a page past the end lands on the last one, so a stale link never shows an empty list.
 */
export function pageWindow(total: number, requested: unknown, size = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const wanted = typeof requested === "string" && /^\d{1,9}$/.test(requested) ? Number(requested) : 1;
  const page = Math.min(Math.max(wanted, 1), pageCount);
  const offset = (page - 1) * size;
  return { page, pageCount, offset, size, total, from: total ? offset + 1 : 0, to: Math.min(offset + size, total) };
}

export type PageWindow = ReturnType<typeof pageWindow>;

/** Page numbers to render: first, last, the current page and its neighbours, with `null` marking a gap. */
export function pageNumbers({ page, pageCount }: Pick<PageWindow, "page" | "pageCount">): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((n, index) => (index && n - sorted[index - 1] > 1 ? [null, n] : [n]));
}
