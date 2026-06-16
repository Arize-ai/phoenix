/**
 * A small, curated text-to-SQL eval set, shared across the example suites.
 *
 * The cases span easy "select all" / counts, medium filters and "top N" asks,
 * and a couple of hard ones (a boolean flag, a two-condition filter) that the
 * deterministic app in `src/app.ts` is expected to *miss*. Keeping a known mix
 * of difficulties is what makes the eval scores realistic — a perfect 100% on
 * every metric usually means your eval set is too easy, not that your app is
 * flawless.
 */
import { OFFTOPIC_SQL } from "./app";

export interface EvalCase {
  /** Stable id, used to upsert the dataset example across runs. */
  id: string;
  input: { userQuery: string };
  expected: { sql: string };
  metadata: {
    difficulty: "easy" | "medium" | "hard";
    /** The SQL skill the case exercises, handy for slicing results in Phoenix. */
    skill: string;
  };
  // Lets a case be passed straight to `px.test.each`, whose rows are an open
  // record (so you can carry extra per-row fields through to the test body).
  [key: string]: unknown;
}

export const TEXT_TO_SQL_CASES: EvalCase[] = [
  {
    id: "t2sql-001",
    input: { userQuery: "Show all customers" },
    expected: { sql: "SELECT * FROM customers;" },
    metadata: { difficulty: "easy", skill: "select-all" },
  },
  {
    id: "t2sql-002",
    input: { userQuery: "How many orders are there?" },
    expected: { sql: "SELECT COUNT(*) FROM orders;" },
    metadata: { difficulty: "easy", skill: "aggregate" },
  },
  {
    id: "t2sql-003",
    input: { userQuery: "Which orders are over $100?" },
    expected: { sql: "SELECT * FROM orders WHERE total > 100;" },
    metadata: { difficulty: "medium", skill: "numeric-filter" },
  },
  {
    id: "t2sql-004",
    input: { userQuery: "List customers in California" },
    expected: { sql: "SELECT * FROM customers WHERE state = 'California';" },
    metadata: { difficulty: "medium", skill: "equality-filter" },
  },
  {
    id: "t2sql-005",
    input: { userQuery: "How many pending orders are there?" },
    expected: { sql: "SELECT COUNT(*) FROM orders WHERE status = 'pending';" },
    metadata: { difficulty: "medium", skill: "aggregate-filter" },
  },
  {
    id: "t2sql-006",
    input: { userQuery: "Top 5 products by price" },
    expected: { sql: "SELECT * FROM products ORDER BY price DESC LIMIT 5;" },
    metadata: { difficulty: "medium", skill: "order-limit" },
  },
  {
    id: "t2sql-007",
    input: { userQuery: "The 3 cheapest products" },
    expected: { sql: "SELECT * FROM products ORDER BY price ASC LIMIT 3;" },
    metadata: { difficulty: "medium", skill: "order-limit" },
  },
  {
    // Hard: the app doesn't translate the "active" flag into a boolean filter.
    id: "t2sql-008",
    input: { userQuery: "Show active users" },
    expected: { sql: "SELECT * FROM users WHERE active = TRUE;" },
    metadata: { difficulty: "hard", skill: "boolean-filter" },
  },
  {
    // Hard: two conditions; the app only captures the location filter.
    id: "t2sql-009",
    input: { userQuery: "Customers in Texas who signed up this year" },
    expected: {
      sql: "SELECT * FROM customers WHERE state = 'Texas' AND signup_date >= '2024-01-01';",
    },
    metadata: { difficulty: "hard", skill: "multi-condition" },
  },
  {
    // Guardrail: anything off-topic must be refused, not answered with SQL.
    id: "t2sql-010",
    input: { userQuery: "What's the weather today?" },
    expected: { sql: OFFTOPIC_SQL },
    metadata: { difficulty: "easy", skill: "offtopic-guardrail" },
  },
];
