/**
 * A small, deterministic text-to-SQL "app under test".
 *
 * In a real Phoenix eval this is where you'd call your LLM or agent. To keep
 * these examples runnable with **zero API keys** and **zero flakiness**, this is
 * a rule-based stand-in instead of a model.
 *
 * It is deliberately *good but imperfect*: it nails the common shapes (select
 * all, counts, simple filters, "top N") and is plausibly wrong on the harder
 * ones (boolean flags, multi-condition filters). That mix is the point — it
 * gives the evaluators in `src/evaluators.ts` a realistic spread of scores to
 * report, the same way a real model would. The one hard guarantee it makes:
 * an on-topic question always yields a syntactically valid `SELECT`, and an
 * off-topic one always yields {@link OFFTOPIC_SQL}.
 *
 * Swap it for your real model call when you wire this up to your own app —
 * `evals/07-llm-openai.eval.ts` shows the LLM-backed version.
 */

export interface SqlResult {
  sql: string;
}

/** The canned refusal the app returns for anything that isn't a data question. */
export const OFFTOPIC_SQL = "-- I can only answer questions about your data.";

/**
 * The toy database the app "knows" about. Each table lists its columns; the
 * column the app sorts and filters on is chosen explicitly in {@link MEASURE_COLUMN}.
 */
export const SCHEMA = {
  customers: ["id", "name", "state", "signup_date"],
  orders: ["id", "customer_id", "total", "status", "placed_at"],
  products: ["id", "name", "price", "category"],
  invoices: ["id", "customer_id", "amount", "paid"],
  users: ["id", "email", "active"],
} as const;

export type TableName = keyof typeof SCHEMA;

/** The column the app filters / sorts on when a query implies "how much". */
const MEASURE_COLUMN: Record<TableName, string> = {
  customers: "id",
  orders: "total",
  products: "price",
  invoices: "amount",
  users: "id",
};

/**
 * Naive natural-language → SQL. A deterministic stand-in for an LLM-powered
 * text-to-SQL feature.
 *
 * The pipeline is: resolve the target table (else refuse), then layer on an
 * optional `WHERE` filter, and finally either aggregate with `COUNT(*)` or add
 * an optional `ORDER BY ... LIMIT` for "top N" style asks.
 */
export function generateSql(userQuery: string): SqlResult {
  const query = userQuery.trim().toLowerCase();
  const table = resolveTable(query);

  if (!table) {
    return { sql: OFFTOPIC_SQL };
  }

  const where = buildWhereClause(query, table);

  // "How many ...": an aggregate count, keeping any filter that applies.
  if (/\b(how many|count|number of)\b/.test(query)) {
    return { sql: `SELECT COUNT(*) FROM ${table}${where};` };
  }

  const orderLimit = buildOrderLimitClause(query, table);
  return { sql: `SELECT * FROM ${table}${where}${orderLimit};` };
}

/**
 * Whether a query looks like an on-topic data question (i.e. it names a table
 * the app knows about). Used by the annotation example as a code-based
 * classifier.
 */
export function isOnTopic(userQuery: string): boolean {
  return resolveTable(userQuery.toLowerCase()) !== null;
}

/**
 * Pick the table a query is about. Prefers an explicit "... the <table> table"
 * mention, then falls back to any known table name (singular or plural) that
 * appears anywhere in the query.
 */
function resolveTable(query: string): TableName | null {
  const explicit = query.match(/\b(?:from|in)\s+(?:the\s+)?(\w+)\s+table\b/);
  if (explicit?.[1]) {
    const table = normalizeTable(explicit[1]);
    if (table) return table;
  }
  for (const table of Object.keys(SCHEMA) as TableName[]) {
    // Match the table name in singular or plural form ("order" or "orders").
    const singular = table.replace(/s$/, "");
    if (new RegExp(`\\b${singular}s?\\b`).test(query)) {
      return table;
    }
  }
  return null;
}

/** Map a singular or plural noun onto a known table name, if any. */
function normalizeTable(word: string): TableName | null {
  const plural = (word.endsWith("s") ? word : `${word}s`) as TableName;
  return plural in SCHEMA ? plural : null;
}

/**
 * Build an optional `WHERE` clause from a few common phrasings:
 *   - numeric comparisons: "over 100", "more than $50", "under 10"
 *   - status filters on orders: "pending orders", "shipped orders"
 *   - location filters on customers: "customers in California"
 *
 * Only the first matching pattern is applied, so multi-condition questions are
 * intentionally under-served — a realistic place for the app to lose points.
 */
function buildWhereClause(query: string, table: TableName): string {
  const comparison = query.match(
    /\b(over|above|more than|greater than|under|below|less than)\s+\$?(\d+(?:\.\d+)?)\b/
  );
  if (comparison) {
    const op = /(over|above|more than|greater than)/.test(comparison[1]!)
      ? ">"
      : "<";
    return ` WHERE ${MEASURE_COLUMN[table]} ${op} ${comparison[2]}`;
  }

  if (table === "orders") {
    const status = query.match(/\b(pending|shipped|cancelled|refunded)\b/);
    if (status) return ` WHERE status = '${status[1]}'`;
  }

  if (table === "customers") {
    const location = query.match(/\bin\s+([a-z][a-z ]+?)(?:\s+who\b|$)/);
    if (location) return ` WHERE state = '${titleCase(location[1]!.trim())}'`;
  }

  return "";
}

/**
 * Build an optional `ORDER BY ... LIMIT` for "top N" / "N cheapest" style asks.
 * Direction is inferred from superlatives ("most expensive" → DESC, "cheapest"
 * → ASC); the sort column is the table's measure column.
 */
function buildOrderLimitClause(query: string, table: TableName): string {
  const limitMatch =
    query.match(/\b(?:top|first|bottom)\s+(\d+)\b/) ??
    query.match(
      /\b(\d+)\s+(?:most|least|cheapest|priciest|biggest|smallest)\b/
    );
  if (!limitMatch) return "";

  const descending =
    /\b(top|most|highest|largest|biggest|priciest|expensive)\b/.test(query);
  const direction = descending ? "DESC" : "ASC";
  return ` ORDER BY ${MEASURE_COLUMN[table]} ${direction} LIMIT ${limitMatch[1]}`;
}

/** Title-case a place name so `california` becomes `California`. */
function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
