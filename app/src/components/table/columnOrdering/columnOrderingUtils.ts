/** Minimal shape of a tanstack ColumnDef needed to resolve ids and leaf columns, testable without a table instance. */
export interface OrderableColumnDef {
  id?: string;
  accessorKey?: string | number;
  header?: unknown;
  columns?: OrderableColumnDef[];
}

/** Resolves a column def's id the same way tanstack table does: id, then accessorKey (dots to underscores), then string header. */
export function getColumnDefId(def: OrderableColumnDef): string | null {
  if (def.id != null) {
    return def.id;
  }
  if (def.accessorKey != null) {
    return String(def.accessorKey).replaceAll(".", "_");
  }
  if (typeof def.header === "string") {
    return def.header;
  }
  return null;
}

/** Resolves the ids of the top-level (group or leaf) column defs. */
export function getTopLevelColumnIds(defs: OrderableColumnDef[]): string[] {
  return defs.map(getColumnDefId).filter((id): id is string => id != null);
}

/**
 * Reconciles a persisted column order with the columns that currently exist:
 * drops stale ids, appends new ones at the end in natural order.
 */
export function mergeColumnOrder({
  columnOrder,
  columnIds,
}: {
  columnOrder: string[];
  columnIds: string[];
}): string[] {
  const existing = new Set(columnIds);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of columnOrder) {
    if (existing.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of columnIds) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  return ordered;
}

/**
 * Expands top-level column ids into the leaf id order tanstack table's
 * `columnOrder` expects, so group columns move as one contiguous block.
 */
export function expandColumnOrderToLeafIds(
  columnOrder: string[],
  defs: OrderableColumnDef[]
): string[] {
  const leafIdsByTopLevelId = getLeafIdsByTopLevelId(defs);
  return columnOrder.flatMap((id) => leafIdsByTopLevelId.get(id) ?? [id]);
}

/** Maps each top-level column id to its leaf column ids (a leaf def maps to itself). */
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
 * Sorts a column selector's columns into the persisted column order, dropping
 * ids that no longer exist and appending columns the order has not seen yet.
 */
export function orderColumns<T extends { id: string }>({
  columns,
  columnOrder,
}: {
  columns: T[];
  columnOrder: string[];
}): T[] {
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  return mergeColumnOrder({
    columnOrder,
    columnIds: columns.map((column) => column.id),
  }).flatMap((columnId) => {
    const column = columnsById.get(columnId);
    return column == null ? [] : [column];
  });
}

/**
 * Reorders a subset of columns within the full column order, leaving
 * non-subset columns in place. Lets a filtered view (e.g. only visible
 * columns) reorder its slice without disturbing the rest.
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
