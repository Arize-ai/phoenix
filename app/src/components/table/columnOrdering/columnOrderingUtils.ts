/**
 * Minimal structural view of a tanstack ColumnDef needed to resolve column ids
 * and leaf columns. Kept structural so the utilities are testable without
 * constructing a table instance.
 */
export interface OrderableColumnDef {
  id?: string;
  accessorKey?: string;
  header?: unknown;
  columns?: OrderableColumnDef[];
}

/**
 * Resolves the id of a column def using the same rules as tanstack table:
 * explicit id, then accessorKey with "." replaced by "_", then the header if
 * it is a string.
 */
export function getColumnDefId(def: OrderableColumnDef): string | null {
  if (def.id != null) {
    return def.id;
  }
  if (def.accessorKey != null) {
    return def.accessorKey.replaceAll(".", "_");
  }
  if (typeof def.header === "string") {
    return def.header;
  }
  return null;
}

/**
 * Resolves the ids of the top-level (group or leaf) column defs.
 */
export function getTopLevelColumnIds(defs: OrderableColumnDef[]): string[] {
  return defs.map(getColumnDefId).filter((id): id is string => id != null);
}

/**
 * Reconciles a persisted column order with the columns that currently exist:
 * ids that no longer exist are dropped, and columns that are not in the
 * persisted order are appended at the end in their natural order. Mirrors how
 * tanstack table treats columns missing from `columnOrder`.
 */
export function mergeColumnOrder({
  columnOrder,
  columnIds,
}: {
  columnOrder: string[];
  columnIds: string[];
}): string[] {
  const existing = new Set(columnIds);
  const ordered = columnOrder.filter((id) => existing.has(id));
  const seen = new Set(ordered);
  for (const id of columnIds) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}

/**
 * Expands an order of top-level column ids into the leaf column id order that
 * tanstack table's `columnOrder` state expects. Group columns expand to their
 * leaf column ids so a group always moves as a contiguous block.
 */
export function expandColumnOrderToLeafIds(
  columnOrder: string[],
  defs: OrderableColumnDef[]
): string[] {
  const leafIdsByTopLevelId = getLeafIdsByTopLevelId(defs);
  return columnOrder.flatMap((id) => leafIdsByTopLevelId.get(id) ?? [id]);
}

/**
 * Maps each top-level column def id to the ids of its leaf columns (a leaf
 * def maps to itself).
 */
export function getLeafIdsByTopLevelId(
  defs: OrderableColumnDef[]
): Map<string, string[]> {
  const leafIdsByTopLevelId = new Map<string, string[]>();
  for (const def of defs) {
    const id = getColumnDefId(def);
    if (id != null) {
      leafIdsByTopLevelId.set(id, getLeafColumnIds(def));
    }
  }
  return leafIdsByTopLevelId;
}

function getLeafColumnIds(def: OrderableColumnDef): string[] {
  if (def.columns == null || def.columns.length === 0) {
    const id = getColumnDefId(def);
    return id != null ? [id] : [];
  }
  return def.columns.flatMap(getLeafColumnIds);
}

/**
 * Applies a reordering of a subset of columns back onto the full column
 * order. Columns not in the subset keep their positions; the subset's slots
 * are refilled in the subset's new order. This lets a filtered view (e.g. a
 * column selector without group columns, or only the visible columns) reorder
 * its slice without disturbing the rest.
 */
export function applySubsetColumnOrder({
  columnOrder,
  orderedSubset,
}: {
  columnOrder: string[];
  orderedSubset: string[];
}): string[] {
  const subset = new Set(orderedSubset);
  let subsetIndex = 0;
  return columnOrder.map((id) =>
    subset.has(id) ? orderedSubset[subsetIndex++] : id
  );
}
