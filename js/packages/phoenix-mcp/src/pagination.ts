import { DEFAULT_PAGE_SIZE } from "./constants.js";

/**
 * Result returned by a single page fetch during paginated iteration.
 */
export interface PageResult<TItem> {
  /** Items returned by this page. */
  data: TItem[];
  /** Opaque cursor for the next page, or `undefined` when exhausted. */
  nextCursor: string | undefined;
}

/**
 * Fetch items across multiple API pages until the requested `limit` is reached
 * or no more pages remain.
 *
 * Each call site supplies a `fetchPage` callback that encapsulates the
 * endpoint-specific request and response parsing.  The helper handles cursor
 * propagation, page-size clamping, and limit enforcement.
 *
 * @param options.fetchPage - Callback that retrieves a single page given a cursor and page size.
 * @param options.limit - Maximum total items to collect across all pages.
 * @param options.initialCursor - Optional cursor to resume pagination from.
 * @returns Collected items, truncated to `limit`.
 */
export async function fetchAllPages<TItem>({
  fetchPage,
  limit,
  initialCursor,
}: {
  fetchPage: (
    cursor: string | undefined,
    pageSize: number
  ) => Promise<PageResult<TItem>>;
  limit: number;
  initialCursor?: string;
}): Promise<TItem[]> {
  const items: TItem[] = [];
  let cursor: string | undefined = initialCursor;

  do {
    const pageSize = Math.min(limit - items.length, DEFAULT_PAGE_SIZE);
    const page = await fetchPage(cursor, pageSize);
    items.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor && items.length < limit);

  return items.slice(0, limit);
}
