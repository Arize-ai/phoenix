import { formatAcceptanceResult } from "./acceptance";
import type { TestResult } from "./state";
import type { AcceptanceResult, Annotation } from "./types";

/**
 * The serializable summary of one suite that the reporter renders. This is the
 * payload written to and read from the artifact files in `report-artifacts.ts`,
 * so it holds only plain data — no clients, tracers, or live state.
 */
export interface SuiteSummary {
  /** Suite name (also the dataset / experiment name in Phoenix). */
  name: string;
  /** True when the suite did not sync to Phoenix (dry run, disabled, or error). */
  trackingDisabled?: boolean;
  /** Human-readable reason tracking was disabled, when known. */
  trackingDisabledReason?: string;
  /** Setup failure that disabled tracking, reduced to its message for printing. */
  setupError?: { message: string };
  /** Number of best-effort uploads (runs + annotations) that failed. */
  uploadFailureCount?: number;
  /** Per-test outcomes shown in the summary. */
  results: TestResult[];
  /** Aggregate acceptance results shown in the summary. */
  acceptanceResults?: AcceptanceResult[];
  /** Phoenix UI links (dataset / experiment) printed at the end of the block. */
  links: Array<{ label: string; url: string }>;
}

/**
 * Options that control how the reporter renders. Resolved once per run from the
 * environment and the output stream (see {@link resolveRenderOptions}) and then
 * threaded through every formatting function so jest and vitest behave
 * identically without either reporter class needing options of its own.
 */
export interface RenderOptions {
  /** Show every test row plus the legacy per-test `output:` detail block. */
  verbose: boolean;
  /** Emit ANSI color escapes. */
  color: boolean;
  /** Max test rows shown per suite in compact mode (failures are never hidden). */
  maxRows: number;
  /** Terminal width budget used to size tables. */
  maxWidth: number;
}

// ---------------------------------------------------------------------------
// Option / environment resolution
// ---------------------------------------------------------------------------

function isTruthyFlag(value: string | undefined): boolean {
  const v = (value ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "on" || v === "yes";
}

function isFalsyFlag(value: string | undefined): boolean {
  const v = (value ?? "").toLowerCase();
  return v === "false" || v === "0" || v === "off" || v === "no";
}

/**
 * Resolve {@link RenderOptions} from the environment and output stream.
 *
 * Verbosity: `PHOENIX_TEST_REPORTER=verbose` (or the `PHOENIX_TEST_VERBOSE=1`
 * alias) restores the full per-test dump; the default is the compact view.
 * `PHOENIX_TEST_REPORTER_MAX_ROWS` caps the per-suite rows (default 10).
 *
 * Color follows the common ecosystem rules: off when `NO_COLOR` is set, in CI,
 * on a non-TTY, or a "dumb" terminal; `PHOENIX_TEST_COLOR` / `FORCE_COLOR`
 * force it on or off.
 */
export function resolveRenderOptions(
  env: NodeJS.ProcessEnv = process.env,
  stream: { isTTY?: boolean; columns?: number } = process.stdout
): RenderOptions {
  const verbose =
    (env.PHOENIX_TEST_REPORTER ?? "").toLowerCase() === "verbose" ||
    isTruthyFlag(env.PHOENIX_TEST_VERBOSE);

  const parsedRows = Number.parseInt(
    env.PHOENIX_TEST_REPORTER_MAX_ROWS ?? "",
    10
  );
  const maxRows =
    Number.isFinite(parsedRows) && parsedRows > 0 ? parsedRows : 10;

  const color = resolveColor(env, stream);

  const columns =
    typeof stream.columns === "number" && stream.columns > 0
      ? stream.columns
      : 80;
  const maxWidth = Math.min(columns, 120);

  return { verbose, color, maxRows, maxWidth };
}

function resolveColor(
  env: NodeJS.ProcessEnv,
  stream: { isTTY?: boolean }
): boolean {
  if (isTruthyFlag(env.PHOENIX_TEST_COLOR)) return true;
  if (isFalsyFlag(env.PHOENIX_TEST_COLOR)) return false;
  if (
    env.FORCE_COLOR != null &&
    env.FORCE_COLOR !== "" &&
    env.FORCE_COLOR !== "0"
  )
    return true;
  if (env.NO_COLOR != null && env.NO_COLOR !== "") return false;
  if (env.CI != null && env.CI !== "") return false;
  if (env.TERM === "dumb") return false;
  return stream.isTTY === true;
}

// ---------------------------------------------------------------------------
// Zero-dependency ASCII / ANSI toolkit
// ---------------------------------------------------------------------------

const ANSI = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
} as const;

type AnsiColor = keyof Omit<typeof ANSI, "reset">;

/** Wrap a string in an ANSI color, or return it unchanged when color is off. */
function colorize(s: string, code: AnsiColor, o: RenderOptions): string {
  return o.color ? `${ANSI[code]}${s}${ANSI.reset}` : s;
}

// eslint-disable-next-line no-control-regex -- matching the ESC control byte is the point
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/** Visible length of a string, ignoring any ANSI escape codes. */
function visibleLen(s: string): string["length"] {
  return s.replace(ANSI_PATTERN, "").length;
}

/**
 * Truncate `s` to `max` visible characters, keeping the head and tail with an
 * ellipsis in the middle. Strings containing ANSI codes are returned unchanged
 * to avoid slicing through an escape sequence (colored cells are always short
 * enough to fit, so they never need truncating).
 */
function truncateMiddle(s: string, max: number): string {
  if (max <= 1 || ANSI_PATTERN.test(s)) return s;
  if (s.length <= max) return s;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${s.slice(0, head)}…${tail > 0 ? s.slice(s.length - tail) : ""}`;
}

/** Left-pad-end a cell to `width`, measuring with {@link visibleLen}. */
function padCell(s: string, width: number): string {
  const pad = width - visibleLen(s);
  return pad > 0 ? s + " ".repeat(pad) : s;
}

interface TableSpec {
  /** Per-column max width caps; columns without a cap auto-size. */
  caps?: number[];
  /** A summary row rendered below a rule line (e.g. an AGGREGATE row). */
  footer?: string[];
}

/**
 * Render an aligned ASCII table (no table dependency). Column widths auto-size
 * to content, clamped by `spec.caps`, and the first column is shrunk toward a
 * floor when the table would exceed `o.maxWidth`. Cells longer than their final
 * width are middle-truncated; widths are computed with {@link visibleLen} so
 * ANSI color never breaks alignment.
 */
function renderTable(
  headers: string[],
  rows: string[][],
  o: RenderOptions,
  spec: TableSpec = {}
): string[] {
  const colCount = headers.length;
  const gutter = "  ";
  const allRows = [headers, ...rows, ...(spec.footer ? [spec.footer] : [])];

  const widths = headers.map((_, i) => {
    const natural = Math.max(...allRows.map((r) => visibleLen(r[i] ?? "")));
    const cap = spec.caps?.[i];
    return cap ? Math.min(natural, cap) : natural;
  });

  const FIRST_COL_FLOOR = 16;
  const totalWidth = () =>
    widths.reduce((a, b) => a + b, 0) + gutter.length * (colCount - 1);
  while (totalWidth() > o.maxWidth && widths[0]! > FIRST_COL_FLOOR) {
    widths[0]!--;
  }

  const formatRow = (cells: string[]) =>
    cells
      .map((cell, i) =>
        padCell(truncateMiddle(cell ?? "", widths[i]!), widths[i]!)
      )
      .join(gutter);
  const rule = widths.map((w) => "-".repeat(w)).join(gutter);

  const out = [formatRow(headers), rule, ...rows.map(formatRow)];
  if (spec.footer) {
    if (rows.length > 0) out.push(rule);
    out.push(formatRow(spec.footer));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Annotation aggregation
// ---------------------------------------------------------------------------

/** Structured aggregate of one annotation across a suite's results. */
interface AnnotationStat {
  name: string;
  kind: "number" | "boolean";
  /** Mean score for numeric annotations. */
  avg?: number;
  /** Count of `true` scores for boolean annotations. */
  trueCount?: number;
  /** Number of scored samples. */
  count: number;
}

/**
 * Aggregate every (non-`pass`) annotation across results, preserving the order
 * in which annotation names are first seen. Numeric and boolean annotations are
 * tracked separately; if a name appears as both, the first kind seen wins.
 */
function computeAnnotationStats(
  results: readonly TestResult[]
): AnnotationStat[] {
  const order: string[] = [];
  const numeric = new Map<string, number[]>();
  const boolean = new Map<string, { t: number; total: number }>();
  for (const result of results) {
    for (const ann of result.annotations) {
      if (ann.name === "pass") continue;
      if (typeof ann.score === "number" && Number.isFinite(ann.score)) {
        if (!numeric.has(ann.name) && !boolean.has(ann.name))
          order.push(ann.name);
        const arr = numeric.get(ann.name);
        if (arr) arr.push(ann.score);
        else if (!boolean.has(ann.name)) numeric.set(ann.name, [ann.score]);
      } else if (typeof ann.score === "boolean") {
        if (!numeric.has(ann.name) && !boolean.has(ann.name))
          order.push(ann.name);
        const cur = boolean.get(ann.name);
        if (cur) {
          cur.total++;
          if (ann.score) cur.t++;
        } else if (!numeric.has(ann.name)) {
          boolean.set(ann.name, { t: ann.score ? 1 : 0, total: 1 });
        }
      }
    }
  }
  return order.map((name) => {
    const nums = numeric.get(name);
    if (nums) {
      return {
        name,
        kind: "number",
        avg: nums.reduce((a, b) => a + b, 0) / nums.length,
        count: nums.length,
      };
    }
    const bools = boolean.get(name)!;
    return { name, kind: "boolean", trueCount: bools.t, count: bools.total };
  });
}

/** Format an annotation stat as the aggregate-line string used historically. */
function formatStat(stat: AnnotationStat): string {
  const samples = `${stat.count} sample${stat.count === 1 ? "" : "s"}`;
  return stat.kind === "number"
    ? `avg ${stat.avg!.toFixed(3)} (${samples})`
    : `${stat.trueCount}/${stat.count} true`;
}

/**
 * Aggregate annotations into the legacy `name -> summary` string map (kept for
 * the verbose view and any external callers).
 */
function aggregateAnnotations(
  results: readonly TestResult[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const stat of computeAnnotationStats(results)) {
    out[stat.name] = formatStat(stat);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Miss detection + row selection
// ---------------------------------------------------------------------------

/**
 * Per-annotation score bar below which a single run counts as a "miss". For a
 * `passRate` criterion this is the configured `passingScore` (default 1); for an
 * `average` criterion the aggregate threshold is reused as a per-run heuristic
 * (the suite-level acceptance block still reports the true aggregate verdict).
 */
function buildAcceptanceBars(suite: SuiteSummary): Map<string, number> {
  const bars = new Map<string, number>();
  for (const result of suite.acceptanceResults ?? []) {
    bars.set(
      result.annotationName,
      result.metric === "passRate"
        ? (result.passingScore ?? 1)
        : result.threshold
    );
  }
  return bars;
}

/**
 * Whether a passing test's evaluator scores fall short. A boolean `false`, or a
 * numeric score below its configured bar, is a miss; with no criterion for an
 * annotation, only a non-positive score counts (keeps zero-config suites quiet).
 */
function isMiss(result: TestResult, bars: Map<string, number>): boolean {
  for (const ann of result.annotations) {
    if (ann.name === "pass") continue;
    if (typeof ann.score === "boolean") {
      if (!ann.score) return true;
    } else if (typeof ann.score === "number" && Number.isFinite(ann.score)) {
      const bar = bars.get(ann.name);
      if (bar === undefined ? ann.score <= 0 : ann.score < bar) return true;
    }
  }
  return false;
}

interface VisibleRows {
  rows: TestResult[];
  hiddenPassing: number;
  hiddenMisses: number;
}

/**
 * Choose which test rows to show in compact mode: every failure (never hidden),
 * then evaluator misses (worst score first) up to the remaining row budget.
 * Clean passing rows are always hidden — their detail lives in the JSON
 * artifact. In verbose mode every row is returned.
 */
function selectVisibleRows(suite: SuiteSummary, o: RenderOptions): VisibleRows {
  if (o.verbose) {
    return { rows: [...suite.results], hiddenPassing: 0, hiddenMisses: 0 };
  }
  const bars = buildAcceptanceBars(suite);
  const primary = selectAnnotationColumns(suite)[0];
  const score = (r: TestResult): number => {
    if (!primary) return Number.POSITIVE_INFINITY;
    const ann = r.annotations.find((a) => a.name === primary);
    return typeof ann?.score === "number"
      ? ann.score
      : ann?.score === false
        ? 0
        : ann?.score === true
          ? 1
          : Number.POSITIVE_INFINITY;
  };

  const failures = suite.results.filter((r) => r.status === "failed");
  const misses = suite.results
    .filter((r) => r.status === "passed" && isMiss(r, bars))
    .sort((a, b) => score(a) - score(b));
  const passers = suite.results.filter(
    (r) => r.status === "passed" && !isMiss(r, bars)
  );

  const budget = Math.max(o.maxRows - failures.length, 0);
  const shownMisses = misses.slice(0, budget);
  return {
    rows: [...failures, ...shownMisses],
    hiddenPassing: passers.length,
    hiddenMisses: misses.length - shownMisses.length,
  };
}

/**
 * Annotation columns for a suite's table: the acceptance-gated metrics first
 * (the ones a user cares about), else the union of annotation names by
 * first-seen order. Capped at three to keep the table narrow.
 */
function selectAnnotationColumns(suite: SuiteSummary): string[] {
  const MAX_COLUMNS = 3;
  const gated = (suite.acceptanceResults ?? []).map((r) => r.annotationName);
  const ordered =
    gated.length > 0
      ? gated
      : computeAnnotationStats(suite.results).map((s) => s.name);
  return [...new Set(ordered)].slice(0, MAX_COLUMNS);
}

// ---------------------------------------------------------------------------
// Per-test cell rendering
// ---------------------------------------------------------------------------

/** A single annotation's score rendered for a table cell. */
function annotationCell(result: TestResult, name: string): string {
  const ann = result.annotations.find((a) => a.name === name);
  if (!ann) return "—";
  return formatScore(ann);
}

/** The aggregate cell for an annotation column. */
function aggregateCell(stats: AnnotationStat[], name: string): string {
  const stat = stats.find((s) => s.name === name);
  if (!stat) return "—";
  return stat.kind === "number"
    ? `avg ${stat.avg!.toFixed(3)}`
    : `${stat.trueCount}/${stat.count}`;
}

/** Compact status word for a row, colored when enabled. */
function rowStatus(
  result: TestResult,
  bars: Map<string, number>,
  o: RenderOptions
): string {
  if (result.status === "failed") return colorize("FAIL", "red", o);
  if (result.status === "skipped") return colorize("SKIP", "dim", o);
  if (isMiss(result, bars)) return colorize("MISS", "yellow", o);
  return colorize("PASS", "green", o);
}

// ---------------------------------------------------------------------------
// Suite rendering
// ---------------------------------------------------------------------------

/**
 * Render a single suite's results as a human-readable block. Compact by default
 * (an aligned table of failures + evaluator misses, with passing rows hidden);
 * pass a verbose {@link RenderOptions} to restore the full per-test dump.
 */
export function formatSuiteSummary(
  suite: SuiteSummary,
  o: RenderOptions = resolveRenderOptions()
): string {
  return o.verbose ? formatVerboseSuite(suite) : formatCompactSuite(suite, o);
}

function suiteHeaderLines(suite: SuiteSummary, o: RenderOptions): string[] {
  const lines: string[] = [
    "",
    colorize(`Phoenix Eval Suite: ${suite.name}`, "bold", o),
  ];
  if (suite.trackingDisabled) {
    const reason = suite.setupError?.message ?? suite.trackingDisabledReason;
    lines.push(
      reason ? `  (tracking disabled — ${reason})` : `  (tracking disabled)`
    );
  }
  if (suite.uploadFailureCount && suite.uploadFailureCount > 0) {
    lines.push(
      `  warning: ${suite.uploadFailureCount} upload${suite.uploadFailureCount === 1 ? "" : "s"} to Phoenix failed (auth or network?)`
    );
  }
  return lines;
}

/** Verbatim acceptance-criteria block (kept stable for downstream parsers). */
function acceptanceLines(suite: SuiteSummary): string[] {
  if (!suite.acceptanceResults || suite.acceptanceResults.length === 0)
    return [];
  return [
    "  Acceptance Criteria:",
    ...suite.acceptanceResults.map((r) => `    ${formatAcceptanceResult(r)}`),
  ];
}

function linkLines(suite: SuiteSummary): string[] {
  return suite.links.map((link) => `  ${link.label}: ${link.url}`);
}

function formatCompactSuite(suite: SuiteSummary, o: RenderOptions): string {
  const lines = suiteHeaderLines(suite, o);

  const total = suite.results.length;
  const passed = suite.results.filter((r) => r.status === "passed").length;
  const failed = suite.results.filter((r) => r.status === "failed").length;
  const bars = buildAcceptanceBars(suite);
  const missCount = suite.results.filter(
    (r) => r.status === "passed" && isMiss(r, bars)
  ).length;
  const parts = [`${passed}/${total} passed`];
  if (failed > 0) parts.push(`${failed} failed`);
  if (missCount > 0)
    parts.push(`${missCount} miss${missCount === 1 ? "" : "es"}`);
  lines.push(`  (${parts.join(", ")})`);

  const stats = computeAnnotationStats(suite.results);
  const columns = selectAnnotationColumns(suite);
  const { rows, hiddenPassing, hiddenMisses } = selectVisibleRows(suite, o);

  const headers = ["Test", "Status", ...columns, "Latency"];
  const caps = [48, 6, ...columns.map(() => 14), 9];
  const dataRows = rows.map((r) => [
    r.testName + (r.dryRun ? " (dry run)" : ""),
    rowStatus(r, bars, o),
    ...columns.map((c) => annotationCell(r, c)),
    formatDuration(r.durationMs),
  ]);
  const meanLatency =
    total > 0 ? suite.results.reduce((a, r) => a + r.durationMs, 0) / total : 0;
  const aggregate = [
    `AGGREGATE (${total})`,
    `${passed}/${total}`,
    ...columns.map((c) => aggregateCell(stats, c)),
    `avg ${formatDuration(meanLatency)}`,
  ];

  lines.push("");
  lines.push(...renderTable(headers, dataRows, o, { caps, footer: aggregate }));

  if (hiddenPassing > 0 || hiddenMisses > 0) {
    const noun = hiddenMisses > 0 ? "rows" : "passing rows";
    const hidden = hiddenPassing + hiddenMisses;
    lines.push(
      colorize(
        `  … ${hidden} ${noun} hidden (PHOENIX_TEST_REPORTER=verbose to show all)`,
        "dim",
        o
      )
    );
  }

  // Metrics that didn't fit as table columns still get an aggregate line.
  const overflow = stats.filter((s) => !columns.includes(s.name));
  for (const stat of overflow) {
    lines.push(`    ${stat.name}: ${formatStat(stat)}`);
  }

  lines.push(...acceptanceLines(suite));
  lines.push(...linkLines(suite));
  return lines.join("\n");
}

/** The legacy verbose view: every test as a delimited block including output. */
function formatVerboseSuite(suite: SuiteSummary): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`Phoenix Eval Suite: ${suite.name}`);
  if (suite.trackingDisabled) {
    const reason = suite.setupError?.message ?? suite.trackingDisabledReason;
    lines.push(
      reason ? `  (tracking disabled — ${reason})` : `  (tracking disabled)`
    );
  }
  const total = suite.results.length;
  const passed = suite.results.filter((r) => r.status === "passed").length;
  const failed = suite.results.filter((r) => r.status === "failed").length;
  lines.push(
    `  ${passed}/${total} passed${failed ? `, ${failed} failed` : ""}`
  );
  if (suite.uploadFailureCount && suite.uploadFailureCount > 0) {
    lines.push(
      `  warning: ${suite.uploadFailureCount} upload${suite.uploadFailureCount === 1 ? "" : "s"} to Phoenix failed (auth or network?)`
    );
  }

  const aggregated = aggregateAnnotations(suite.results);
  for (const [name, summary] of Object.entries(aggregated)) {
    lines.push(`    ${name}: ${summary}`);
  }
  lines.push(...acceptanceLines(suite));

  for (const result of suite.results) {
    const status =
      result.status === "passed"
        ? "PASS"
        : result.status === "failed"
          ? "FAIL"
          : "SKIP";
    const tag = result.dryRun ? " (dry run — not uploaded)" : "";
    const annotations = formatAnnotationsInline(result.annotations);
    const annotationSuffix = annotations ? `  →  ${annotations}` : "";
    lines.push("");
    lines.push(
      `    [${status}] ${result.testName} (${formatDuration(result.durationMs)})${tag}${annotationSuffix}`
    );
    if (result.error) {
      lines.push(`      error: ${result.error}`);
    }
    if (result.output !== undefined) {
      lines.push(`      output: ${stringifyForLog(result.output)}`);
    }
  }

  lines.push(...linkLines(suite));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Cross-suite scoreboard
// ---------------------------------------------------------------------------

/**
 * Render the cross-suite scoreboard: one row per suite with pass count, primary
 * metric average, acceptance verdict, and experiment link, plus a one-line
 * totals summary. For a single suite the table is omitted (the per-suite block
 * already covers it) and only the summary line is returned.
 */
export function formatScoreboard(
  suites: readonly SuiteSummary[],
  o: RenderOptions = resolveRenderOptions()
): string {
  if (suites.length === 0) return "";

  const totals = suites.reduce(
    (acc, s) => {
      acc.passed += s.results.filter((r) => r.status === "passed").length;
      acc.total += s.results.length;
      if ((s.acceptanceResults ?? []).some((r) => !r.passed)) acc.failures++;
      return acc;
    },
    { passed: 0, total: 0, failures: 0 }
  );
  const summary = [
    `${suites.length} suite${suites.length === 1 ? "" : "s"}`,
    `${totals.passed}/${totals.total} passed`,
    `${totals.failures} acceptance failure${totals.failures === 1 ? "" : "s"}`,
  ].join(" · ");

  if (suites.length === 1) return summary;

  // Use a shared metric-name header when every suite gates on the same metric.
  const primaries = suites.map((s) => selectAnnotationColumns(s)[0]);
  const shared =
    primaries.every((p) => p && p === primaries[0]) && primaries[0]
      ? primaries[0]
      : undefined;

  const headers = ["Suite", "Passed", shared ?? "Score", "Accept", "Link"];
  const caps = [32, 9, 16, 7, 30];
  const rows = suites.map((suite) => {
    const passed = suite.results.filter((r) => r.status === "passed").length;
    const stats = computeAnnotationStats(suite.results);
    const primary = selectAnnotationColumns(suite)[0];
    const stat = stats.find((s) => s.name === primary);
    const scoreCell = !stat
      ? "—"
      : shared
        ? aggregateCell(stats, stat.name)
        : `${stat.name} ${aggregateCell(stats, stat.name).replace(/^avg /, "")}`;
    return [
      suite.name,
      `${passed}/${suite.results.length}`,
      scoreCell,
      acceptCell(suite, o),
      suite.links[0]?.url ?? "—",
    ];
  });

  return [
    "",
    colorize("Phoenix Eval Scoreboard", "bold", o),
    "",
    ...renderTable(headers, rows, o, { caps }),
    "",
    summary,
  ].join("\n");
}

function acceptCell(suite: SuiteSummary, o: RenderOptions): string {
  const results = suite.acceptanceResults ?? [];
  if (results.length === 0) return "—";
  return results.some((r) => !r.passed)
    ? colorize("FAIL", "red", o)
    : colorize("PASS", "green", o);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Print the scoreboard followed by each suite's block to stdout. */
export function printSuiteSummaries(suites: readonly SuiteSummary[]): void {
  const o = resolveRenderOptions();
  const scoreboard = formatScoreboard(suites, o);
  // eslint-disable-next-line no-console
  if (scoreboard) console.log(scoreboard);
  for (const suite of suites) {
    // eslint-disable-next-line no-console
    console.log(formatSuiteSummary(suite, o));
  }
}

// ---------------------------------------------------------------------------
// Shared formatters
// ---------------------------------------------------------------------------

/**
 * Render a test's annotations as a compact, single-line `name=score` list for
 * the verbose per-test header. The implicit `pass` annotation is omitted.
 */
function formatAnnotationsInline(annotations: readonly Annotation[]): string {
  return annotations
    .filter((ann) => ann.name !== "pass")
    .map((ann) => `${ann.name}=${formatScore(ann)}`)
    .join(", ");
}

function formatScore(ann: Annotation): string {
  if (typeof ann.score === "number") return ann.score.toString();
  if (typeof ann.score === "boolean") return ann.score ? "true" : "false";
  if (ann.label) return ann.label;
  return "(no score)";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function stringifyForLog(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json && json.length > 200
      ? `${json.slice(0, 197)}...`
      : (json ?? "");
  } catch {
    return String(value);
  }
}
