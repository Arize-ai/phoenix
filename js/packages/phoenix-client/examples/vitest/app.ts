/**
 * A tiny, fully deterministic "text-to-SQL app" plus scorers so the example
 * suites in this folder run offline — no API keys, no network. Swap these for
 * your real application and evaluators when dogfooding against a live model.
 */

export interface SqlInput {
  userQuery: string;
}

export interface SqlOutput {
  sql: string;
}

const CANNED: Array<[RegExp, string]> = [
  [/count.*users|users.*count/i, "SELECT COUNT(*) FROM users;"],
  [/customers/i, "SELECT * FROM customers;"],
  [/orders/i, "SELECT * FROM orders;"],
];

/** Deterministic stand-in for an LLM text-to-SQL call. */
export function generateSql({ userQuery }: SqlInput): SqlOutput {
  for (const [pattern, sql] of CANNED) {
    if (pattern.test(userQuery)) return { sql };
  }
  return { sql: "SELECT 1;" };
}

const normalize = (sql: string): string =>
  sql.trim().toLowerCase().replace(/\s+/g, " ");

/** Exact (normalized) match: `1` when the SQL equals the reference, else `0`. */
export function sqlCorrectness(
  output: SqlOutput,
  expected?: SqlOutput
): number {
  if (!expected) return 0;
  return normalize(output.sql) === normalize(expected.sql) ? 1 : 0;
}

/** Token overlap (F1-ish) in `[0, 1]` between produced and reference SQL. */
export function sqlTokenF1(output: SqlOutput, expected?: SqlOutput): number {
  if (!expected) return 0;
  const produced = new Set(normalize(output.sql).split(" "));
  const reference = new Set(normalize(expected.sql).split(" "));
  if (produced.size === 0 || reference.size === 0) return 0;
  let overlap = 0;
  for (const token of produced) if (reference.has(token)) overlap++;
  const precision = overlap / produced.size;
  const recall = overlap / reference.size;
  const denominator = precision + recall;
  return denominator === 0 ? 0 : (2 * precision * recall) / denominator;
}

/** Cheap structural check: does the output look like a SQL statement? */
export function looksLikeSql(output: SqlOutput): boolean {
  return /^\s*select\b/i.test(output.sql) && output.sql.trim().endsWith(";");
}

/** Deterministic pseudo-latency (ms) derived from the query length. */
export function estimateLatencyMs({ userQuery }: SqlInput): number {
  return 50 + userQuery.length * 3;
}
