"use client";

import { useMemo, useState } from "react";

export type SortDef<T> = { key: string; label: string; compare: (a: T, b: T) => number };
export type FilterDef<T> = { key: string; label: string; test: (row: T) => boolean };

type Config<T> = {
  /** Return true when the row matches the (already lower-cased) query. */
  search: (row: T, query: string) => boolean;
  filters?: FilterDef<T>[];
  sorts: SortDef<T>[];
  pageSize?: number;
};

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Search + filter + sort + paginate, in the browser.
 *
 * Admin lists here are hundreds of rows at most, so shipping the whole set and
 * narrowing it client-side keeps every control instant and needs no new
 * endpoints. If a list ever outgrows that, this is the seam to move onto the
 * server — the calling components only read `pageRows`.
 */
export function useTableView<T>(rows: T[], config: Config<T>) {
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState("all");
  const [sortKey, setSortKey] = useState(config.sorts[0]?.key ?? "");
  const [pageSize, setPageSize] = useState(config.pageSize ?? 25);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = config.filters?.find((f) => f.key === filterKey);
    const sort = config.sorts.find((s) => s.key === sortKey);
    const out = rows.filter(
      (row) => (!q || config.search(row, q)) && (!filter || filter.test(row)),
    );
    return sort ? [...out].sort(sort.compare) : out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, filterKey, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Narrowing the set can strand you past the last page — clamp on read rather
  // than in an effect, so the render is never briefly empty.
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  function reset(fn: () => void) {
    fn();
    setPage(1);
  }

  return {
    query,
    setQuery: (v: string) => reset(() => setQuery(v)),
    filterKey,
    setFilterKey: (v: string) => reset(() => setFilterKey(v)),
    sortKey,
    setSortKey: (v: string) => reset(() => setSortKey(v)),
    pageSize,
    setPageSize: (v: number) => reset(() => setPageSize(v)),
    page: current,
    setPage,
    pageCount,
    pageRows,
    total: rows.length,
    matched: filtered.length,
    from: filtered.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, filtered.length),
  };
}

export type TableView<T> = ReturnType<typeof useTableView<T>>;

export function TableToolbar<T>({
  view,
  filters,
  sorts,
  searchPlaceholder,
}: {
  view: TableView<T>;
  filters?: FilterDef<T>[];
  sorts: SortDef<T>[];
  searchPlaceholder: string;
}) {
  return (
    <div className="table-toolbar">
      <label className="toolbar-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4" />
        </svg>
        <input
          type="search"
          value={view.query}
          onChange={(e) => view.setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </label>

      {filters && filters.length > 0 && (
        <label className="toolbar-field">
          <span>Show</span>
          <select value={view.filterKey} onChange={(e) => view.setFilterKey(e.target.value)}>
            <option value="all">All</option>
            {filters.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="toolbar-field">
        <span>Sort</span>
        <select value={view.sortKey} onChange={(e) => view.setSortKey(e.target.value)}>
          {sorts.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function TablePager<T>({ view, noun }: { view: TableView<T>; noun: string }) {
  return (
    <div className="table-pager">
      <p className="pager-count">
        {view.matched === 0
          ? `No ${noun} match`
          : `${view.from}–${view.to} of ${view.matched} ${noun}`}
        {view.matched !== view.total && ` (${view.total} total)`}
      </p>

      <div className="pager-controls">
        <label className="toolbar-field">
          <span>Per page</span>
          <select value={view.pageSize} onChange={(e) => view.setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="pager-buttons">
          <button
            type="button"
            className="btn-mini"
            onClick={() => view.setPage(view.page - 1)}
            disabled={view.page <= 1}
          >
            ← Prev
          </button>
          <span className="pager-page">
            Page {view.page} of {view.pageCount}
          </span>
          <button
            type="button"
            className="btn-mini"
            onClick={() => view.setPage(view.page + 1)}
            disabled={view.page >= view.pageCount}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
