/**
 * A tiny, deterministic "app under test".
 *
 * In a real Phoenix eval this is where you call your LLM or agent. To keep
 * these examples runnable with **zero API keys** and **zero flakiness**, the
 * functions below are rule-based stand-ins, so every example passes offline.
 *
 * Swap them for your real model calls when you wire this up to your own app —
 * `evals/07-llm-openai.eval.ts` shows the LLM-backed version of `generateSql`.
 */

/** The canned response the app returns for anything that isn't a data question. */
export const OFFTOPIC_SQL = "-- I can only answer questions about your data.";

export interface SqlResult {
  sql: string;
}

/**
 * Naive natural-language → SQL. A deterministic stand-in for an LLM-powered
 * text-to-SQL feature.
 *
 * Recognizes a handful of shapes:
 *   - "all <things> from the <table> table"      → SELECT * FROM <table>;
 *   - "how many <things> ..." / "count ..."      → SELECT COUNT(*) FROM <table>;
 *   - anything that doesn't look like a question → {@link OFFTOPIC_SQL}
 */
export function generateSql(userQuery: string): SqlResult {
  const query = userQuery.trim().toLowerCase();
  const table = extractTable(query);

  if (!table) {
    return { sql: OFFTOPIC_SQL };
  }

  if (/\b(how many|count|number of)\b/.test(query)) {
    return { sql: `SELECT COUNT(*) FROM ${table};` };
  }

  if (/\b(all|every|list|show)\b/.test(query)) {
    return { sql: `SELECT * FROM ${table};` };
  }

  return { sql: `SELECT * FROM ${table};` };
}

/**
 * Whether a query looks like an on-topic data question. Used by the
 * annotation example to show a code-based classifier.
 */
export function isOnTopic(userQuery: string): boolean {
  return extractTable(userQuery.toLowerCase()) !== null;
}

/** A short list of tables the toy app "knows" about. */
const KNOWN_TABLES = ["customers", "orders", "products", "users", "invoices"];

/**
 * Pull a table name out of the query. Matches "... the <table> table" first,
 * then falls back to any known table name mentioned anywhere in the query.
 */
function extractTable(query: string): string | null {
  const explicit = query.match(/\b(?:from|in)\s+(?:the\s+)?(\w+)\s+table\b/);
  if (explicit?.[1]) {
    return singularToTable(explicit[1]);
  }
  for (const table of KNOWN_TABLES) {
    if (query.includes(table)) return table;
  }
  return null;
}

/** Map a few singular nouns to their table name (orders → orders, etc.). */
function singularToTable(word: string): string {
  const map: Record<string, string> = {
    customer: "customers",
    order: "orders",
    product: "products",
    user: "users",
    invoice: "invoices",
  };
  return map[word] ?? word;
}
