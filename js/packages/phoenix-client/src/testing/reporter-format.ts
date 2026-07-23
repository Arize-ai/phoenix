import { formatAcceptanceResult } from "./acceptance";
import type { TestResult } from "./state";
import type {
  AcceptanceResult,
  Annotation,
  OptimizationDirection,
} from "./types";

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

  // When piped (no TTY width) assume a roomy-but-safe 100 columns so the
  // overview table doesn't over-truncate suite names in CI logs.
  const columns =
    typeof stream.columns === "number" && stream.columns > 0
      ? stream.columns
      : 100;
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
  /** A summary row rendered as the final line (e.g. an AGGREGATE row). */
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

  const lastCol = colCount - 1;
  const formatRow = (cells: string[]) =>
    cells
      .map((cell, i) => {
        const text = truncateMiddle(cell ?? "", widths[i]!);
        // The last column is never padded — trailing spaces are wasted tokens.
        return i === lastCol ? text : padCell(text, widths[i]!);
      })
      .join(gutter)
      // Drop the dangling gutter when the final cell is empty (e.g. a clean
      // suite's blank Result column).
      .trimEnd();

  const out = [formatRow(headers), ...rows.map(formatRow)];
  if (spec.footer) out.push(formatRow(spec.footer));
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

interface AcceptanceBar {
  bar: number;
  direction: OptimizationDirection;
}

/**
 * Per-annotation score bar a single run must clear to avoid counting as a
 * "miss". Only `average` criteria contribute one: the aggregate `threshold`
 * reused as a per-run heuristic (the suite-level acceptance block still reports
 * the true aggregate verdict). `passRate` criteria decide passing with an
 * arbitrary `passFn` predicate — there is no static numeric bar to highlight
 * against — so their rows fall back to the default miss heuristic.
 */
function buildAcceptanceBars(suite: SuiteSummary): Map<string, AcceptanceBar> {
  const bars = new Map<string, AcceptanceBar>();
  for (const result of suite.acceptanceResults ?? []) {
    if (result.metric !== "average") continue;
    bars.set(result.annotationName, {
      bar: result.threshold,
      direction: result.direction ?? "maximize",
    });
  }
  return bars;
}

/**
 * Whether a passing test's evaluator scores fall short. When maximizing, a
 * boolean `false` or a numeric score below its bar is a miss; when minimizing,
 * a boolean `true` or a score above its bar is a miss. With no criterion for an
 * annotation, only a non-positive score counts (keeps zero-config suites quiet).
 */
function isMiss(result: TestResult, bars: Map<string, AcceptanceBar>): boolean {
  for (const ann of result.annotations) {
    if (ann.name === "pass") continue;
    const acceptanceBar = bars.get(ann.name);
    const minimizing = acceptanceBar?.direction === "minimize";
    if (typeof ann.score === "boolean") {
      if (minimizing ? ann.score : !ann.score) return true;
    } else if (typeof ann.score === "number" && Number.isFinite(ann.score)) {
      if (acceptanceBar === undefined) {
        if (ann.score <= 0) return true;
      } else if (
        minimizing
          ? ann.score > acceptanceBar.bar
          : ann.score < acceptanceBar.bar
      ) {
        return true;
      }
    }
  }
  return false;
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

/** The aggregate cell for an annotation column. */
function aggregateCell(stats: AnnotationStat[], name: string): string {
  const stat = stats.find((s) => s.name === name);
  if (!stat) return "—";
  return stat.kind === "number"
    ? `avg ${stat.avg!.toFixed(2)}`
    : `${stat.trueCount}/${stat.count}`;
}

// ---------------------------------------------------------------------------
// Suite rendering
// ---------------------------------------------------------------------------

type SuiteStatus = "pass" | "miss" | "fail";

/** A suite's headline numbers, computed once and shared by every renderer. */
interface SuiteVitals {
  total: number;
  passed: number;
  failed: number;
  missCount: number;
  status: SuiteStatus;
  meanLatencyMs: number;
  /** Failing tests first, then below-bar misses, each worst-score first. */
  problems: TestResult[];
  acceptanceFailed: boolean;
}

function computeSuiteVitals(suite: SuiteSummary): SuiteVitals {
  const bars = buildAcceptanceBars(suite);
  const total = suite.results.length;
  const passed = suite.results.filter((r) => r.status === "passed").length;
  const failed = suite.results.filter((r) => r.status === "failed").length;
  const misses = suite.results
    .filter((r) => r.status === "passed" && isMiss(r, bars))
    .sort((a, b) => worstScore(a) - worstScore(b));
  const acceptanceFailed = (suite.acceptanceResults ?? []).some(
    (r) => !r.passed
  );
  const status: SuiteStatus =
    failed > 0 || acceptanceFailed
      ? "fail"
      : misses.length > 0
        ? "miss"
        : "pass";
  const meanLatencyMs =
    total > 0 ? suite.results.reduce((a, r) => a + r.durationMs, 0) / total : 0;
  return {
    total,
    passed,
    failed,
    missCount: misses.length,
    status,
    meanLatencyMs,
    problems: [
      ...suite.results.filter((r) => r.status === "failed"),
      ...misses,
    ],
    acceptanceFailed,
  };
}

/** The worst (lowest) evaluator score on a row, for ordering most-broken first. */
function worstScore(result: TestResult): number {
  let worst = Number.POSITIVE_INFINITY;
  for (const ann of result.annotations) {
    if (ann.name === "pass") continue;
    worst = Math.min(worst, annotationScoreValue(ann));
  }
  return worst;
}

/** ANSI color matching a status (green pass / yellow miss / red fail). */
function statusColor(status: SuiteStatus): AnsiColor {
  return status === "fail" ? "red" : status === "miss" ? "yellow" : "green";
}

/** `2/2 passed · 1 failed · 3 misses`, dropping any zero clause. */
function countsLabel(v: SuiteVitals): string {
  const parts = [`${v.passed}/${v.total} passed`];
  if (v.failed > 0) parts.push(`${v.failed} failed`);
  if (v.missCount > 0)
    parts.push(`${v.missCount} miss${v.missCount === 1 ? "" : "es"}`);
  return parts.join(" · ");
}

/** Setup / upload problems worth surfacing regardless of test status. */
function warningLines(suite: SuiteSummary, o: RenderOptions): string[] {
  const out: string[] = [];
  if (suite.setupError?.message) {
    out.push(
      `  ${colorize("setup error:", "red", o)} ${suite.setupError.message}`
    );
  }
  const n = suite.uploadFailureCount ?? 0;
  if (n > 0) {
    out.push(
      `  ${colorize("warning:", "yellow", o)} ${n} upload${n === 1 ? "" : "s"} failed (auth or network?)`
    );
  }
  return out;
}

/**
 * Render a single suite. A clean suite collapses to one line; a suite with
 * failures or misses expands into a per-row diagnosis (scores, rationale,
 * output, and the Phoenix ids needed to pull the trace). Pass a verbose
 * {@link RenderOptions} to restore the full per-test dump.
 */
export function formatSuiteSummary(
  suite: SuiteSummary,
  o: RenderOptions = resolveRenderOptions()
): string {
  return o.verbose
    ? formatVerboseSuite(suite)
    : formatSuiteDetail(suite, computeSuiteVitals(suite), o);
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

/** Dim one-line roll-up of every metric average plus mean latency. */
function vitalsInline(
  suite: SuiteSummary,
  v: SuiteVitals,
  o: RenderOptions
): string {
  const parts = computeAnnotationStats(suite.results).map((s) =>
    s.kind === "number"
      ? `${s.name} ${s.avg!.toFixed(2)}`
      : `${s.name} ${s.trueCount}/${s.count}`
  );
  parts.push(`avg ${formatDuration(v.meanLatencyMs)}`);
  return colorize(parts.join("   "), "dim", o);
}

function formatSuiteDetail(
  suite: SuiteSummary,
  v: SuiteVitals,
  o: RenderOptions
): string {
  const title = `${colorize(suite.name, statusColor(v.status), o)}  ${colorize(
    countsLabel(v),
    "dim",
    o
  )}`;
  const warnings = warningLines(suite, o);

  // Clean suite with nothing to warn about: one line is the whole story.
  if (v.status === "pass" && warnings.length === 0) {
    return `${title}   ${vitalsInline(suite, v, o)}`;
  }

  const lines = [title, `  ${vitalsInline(suite, v, o)}`, ...warnings];
  // Never hide a hard failure; cap the number of below-bar misses shown.
  const failures = v.problems.filter((r) => r.status === "failed");
  const misses = v.problems.filter((r) => r.status !== "failed");
  const shownMisses = misses.slice(0, Math.max(o.maxRows - failures.length, 0));
  for (const r of [...failures, ...shownMisses]) {
    lines.push(...problemEntry(r, o));
  }
  const hidden = misses.length - shownMisses.length;
  if (hidden > 0) {
    lines.push(
      colorize(`  … ${hidden} more miss${hidden === 1 ? "" : "es"}`, "dim", o)
    );
  }
  for (const a of suite.acceptanceResults ?? []) {
    if (!a.passed) {
      lines.push(
        `  ${colorize("✗ acceptance", "red", o)} ${formatAcceptanceResult(
          a
        ).replace(/^FAIL /, "")}`
      );
    }
  }
  for (const link of suite.links) {
    lines.push(`  ${link.label}: ${link.url}`);
  }
  return lines.join("\n");
}

/**
 * One failing / missing row: a weighted title with its scores, then the dim
 * detail an agent needs to fix it — rationale, model output, and trace ids.
 */
function problemEntry(result: TestResult, o: RenderOptions): string[] {
  const mark = colorize("✗", result.status === "failed" ? "red" : "yellow", o);
  const name = truncateEnd(humanizeLabel(result.testName), 72);
  const dry = result.dryRun ? colorize(" (dry run)", "dim", o) : "";
  const lines = [`  ${mark} ${colorize(name, "bold", o)}${dry}`];
  const indent = "      ";

  const err = compactError(result.error);
  if (err) lines.push(`${indent}${colorize(err, "red", o)}`);

  // The sub-perfect evaluators that dragged the row down, worst score first —
  // a clean `1.0` metric isn't what broke it, so it stays out of the way.
  const rationales = [...result.annotations]
    .filter((a) => a.name !== "pass" && annotationScoreValue(a) < 1)
    .sort((a, b) => annotationScoreValue(a) - annotationScoreValue(b))
    .slice(0, 3);
  for (const ann of rationales) {
    const reason = ann.explanation ?? ann.label;
    const tail = reason
      ? ` ${colorize("·", "dim", o)} ${truncateSummary(reason, 160)}`
      : "";
    lines.push(
      `${indent}${colorize(ann.name, "dim", o)} ${formatScore(ann)}${tail}`
    );
  }

  const output = summarizeValue(result.output, 160);
  if (output !== null) {
    lines.push(`${indent}${colorize("output", "dim", o)} ${output}`);
  }

  const ids = formatResultIds(result);
  if (ids) lines.push(`${indent}${colorize(ids, "dim", o)}`);

  return lines;
}

/** The legacy verbose view: every test as a delimited block including output. */
function formatVerboseSuite(suite: SuiteSummary): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(suite.name);
  if (suite.trackingDisabled) {
    lines.push(`  (tracking disabled — ${friendlyTrackingReason(suite)})`);
  }
  const total = suite.results.length;
  const passed = suite.results.filter((r) => r.status === "passed").length;
  const failed = suite.results.filter((r) => r.status === "failed").length;
  lines.push(
    `  ${passed}/${total} passed${failed ? `, ${failed} failed` : ""}`
  );
  if (suite.uploadFailureCount && suite.uploadFailureCount > 0) {
    lines.push(
      `  warning: ${suite.uploadFailureCount} upload${suite.uploadFailureCount === 1 ? "" : "s"} failed (auth or network?)`
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
      `    [${status}] ${humanizeLabel(result.testName)} (${formatDuration(result.durationMs)})${tag}${annotationSuffix}`
    );
    if (result.error) {
      lines.push(`      error: ${result.error}`);
    }
    if (result.output !== undefined) {
      lines.push(`      output: ${stringifyForLog(result.output)}`);
    }
    for (const ann of result.annotations) {
      if (ann.name !== "pass" && ann.explanation) {
        lines.push(`      why (${ann.name}): ${ann.explanation}`);
      }
    }
    const ids = formatResultIds(result);
    if (ids) {
      lines.push(`      ids: ${ids}`);
    }
  }

  lines.push(...linkLines(suite));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Cross-suite overview
// ---------------------------------------------------------------------------

/** Friendly, env-var-free reason a suite ran locally. */
function friendlyTrackingReason(suite: SuiteSummary): string {
  return suite.setupError?.message ?? "local only";
}

/** A single tracking note when every suite ran locally for the same reason. */
function sharedTrackingNote(
  suites: readonly SuiteSummary[]
): string | undefined {
  return suites.length > 0 &&
    suites.every((s) => s.trackingDisabled && !s.setupError)
    ? "tracking disabled (local only)"
    : undefined;
}

/** The primary metric stat for a suite's overview row, or `null`. */
function primaryStat(suite: SuiteSummary): AnnotationStat | null {
  const stats = computeAnnotationStats(suite.results);
  const primary = selectAnnotationColumns(suite)[0];
  return stats.find((s) => s.name === primary) ?? null;
}

/**
 * Render the run header (totals + tracking note) and, for multi-suite runs, an
 * aligned overview table: one row per suite with its pass count, primary metric,
 * acceptance verdict, mean latency, and a miss/fail note. This is the index;
 * only suites with problems are expanded into a detail block below it.
 */
export function formatScoreboard(
  suites: readonly SuiteSummary[],
  o: RenderOptions = resolveRenderOptions()
): string {
  if (suites.length === 0) return "";

  const vitals = suites.map(computeSuiteVitals);
  const passed = vitals.reduce((a, v) => a + v.passed, 0);
  const total = vitals.reduce((a, v) => a + v.total, 0);
  const failedTests = vitals.reduce((a, v) => a + v.failed, 0);
  const misses = vitals.reduce((a, v) => a + v.missCount, 0);
  const acceptFails = vitals.filter((v) => v.acceptanceFailed).length;
  const uploadFails = suites.reduce(
    (a, s) => a + (s.uploadFailureCount ?? 0),
    0
  );

  // Totals are test/row-level so the clauses stay in one unit; the per-suite
  // breakdown lives in the table below.
  const header = [
    "Eval Results",
    `${suites.length} suite${suites.length === 1 ? "" : "s"}`,
    `${passed}/${total} passed`,
  ];
  if (failedTests > 0) header.push(`${failedTests} failed`);
  if (misses > 0) header.push(`${misses} miss${misses === 1 ? "" : "es"}`);
  if (acceptFails > 0) {
    header.push(
      `${acceptFails} acceptance failure${acceptFails === 1 ? "" : "s"}`
    );
  }
  if (uploadFails > 0) header.push(`${uploadFails} uploads failed`);
  const note = sharedTrackingNote(suites);
  if (note) header.push(note);
  const headerLine = colorize(header.join(" · "), "bold", o);

  // A single suite's own detail block is the overview; just print the header.
  if (suites.length === 1) return headerLine;

  // Columns appear only when at least one suite has something to put in them.
  const anyScore = suites.some((s) => primaryStat(s) !== null);
  const anyAccept = suites.some((s) => (s.acceptanceResults ?? []).length > 0);
  const anyLink = suites.some((s) => s.links.length > 0);
  const primaries = suites.map((s) => selectAnnotationColumns(s)[0]);
  const shared =
    primaries.every((p) => p && p === primaries[0]) && primaries[0]
      ? primaries[0]
      : undefined;

  const headers = ["Suite", "Tests"];
  const caps = [34, 7];
  if (anyScore) {
    headers.push(shared ?? "Score");
    caps.push(22);
  }
  if (anyAccept) {
    headers.push("Accept");
    caps.push(7);
  }
  headers.push("Latency", "Result");
  caps.push(8, 12);
  if (anyLink) {
    headers.push("Link");
    caps.push(48);
  }

  const rows = suites.map((suite, i) => {
    const v = vitals[i]!;
    const stats = computeAnnotationStats(suite.results);
    const stat = primaryStat(suite);
    const row = [suite.name, `${v.passed}/${v.total}`];
    if (anyScore) {
      row.push(
        !stat
          ? "—"
          : shared
            ? aggregateCell(stats, stat.name)
            : `${stat.name} ${aggregateCell(stats, stat.name).replace(/^avg /, "")}`
      );
    }
    if (anyAccept) {
      row.push(
        (suite.acceptanceResults ?? []).length === 0
          ? "—"
          : v.acceptanceFailed
            ? colorize("FAIL", "red", o)
            : colorize("PASS", "green", o)
      );
    }
    row.push(formatDuration(v.meanLatencyMs), resultNote(v, o));
    if (anyLink) row.push(suite.links[0]?.url ?? "—");
    return row;
  });

  return [headerLine, "", ...renderTable(headers, rows, o, { caps })].join(
    "\n"
  );
}

/** The overview "Result" cell: what went wrong, colored, or blank when clean. */
function resultNote(v: SuiteVitals, o: RenderOptions): string {
  if (v.failed > 0) return colorize(`${v.failed} failed`, "red", o);
  if (v.acceptanceFailed) return colorize("accept ✗", "red", o);
  if (v.missCount > 0) {
    return colorize(
      `${v.missCount} miss${v.missCount === 1 ? "" : "es"}`,
      "yellow",
      o
    );
  }
  return "";
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Print the run summary: the overview header (and, for multi-suite runs, the
 * index table), then an expanded detail block for every suite that failed or
 * had misses. Clean suites are fully described by their overview row. A
 * single-suite run always prints its block; verbose prints every block.
 */
export function printSuiteSummaries(suites: readonly SuiteSummary[]): void {
  const o = resolveRenderOptions();
  const overview = formatScoreboard(suites, o);
  // eslint-disable-next-line no-console
  if (overview) console.log(overview);

  const expand = o.verbose
    ? suites
    : suites.length === 1
      ? suites
      : suites.filter((s) => computeSuiteVitals(s).status !== "pass");
  for (const suite of expand) {
    // eslint-disable-next-line no-console
    console.log(`\n${formatSuiteSummary(suite, o)}`);
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

// ---------------------------------------------------------------------------
// Per-failure detail helpers
//
// A problem row's block answers the two questions an agent needs to fix it:
// *why* (the judge's rationale and the model output) and *where* (the Phoenix
// trace / run / example ids it can pull for the full picture).
// ---------------------------------------------------------------------------

/** A run's numeric score for sorting (booleans as 1/0, missing as +∞). */
function annotationScoreValue(ann: Annotation): number {
  if (typeof ann.score === "number") return ann.score;
  if (typeof ann.score === "boolean") return ann.score ? 1 : 0;
  return Number.POSITIVE_INFINITY;
}

/** First non-empty line of a multi-line error, truncated for one-line display. */
function compactError(error: string | undefined): string | null {
  if (!error) return null;
  const firstLine = error
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ? truncateSummary(firstLine, 160) : null;
}

/** Phoenix ids for a run as a single `trace=… run=… example=…` string. */
function formatResultIds(result: TestResult): string | null {
  const parts: string[] = [];
  if (result.traceId) parts.push(`trace=${result.traceId}`);
  if (result.runId) parts.push(`run=${result.runId}`);
  if (result.exampleId) parts.push(`example=${result.exampleId}`);
  return parts.length > 0 ? parts.join("  ") : null;
}

// ---------------------------------------------------------------------------
// Label humanization
// ---------------------------------------------------------------------------

/**
 * Turn a machine test name into a readable title. A `test.each` row is named by
 * stringifying its input (`{"userQuery":"Show active users"}`); we surface the
 * value of a single-field object directly (`Show active users`) and fold a
 * multi-field object to `key=value` pairs. Non-JSON names pass through.
 */
function humanizeLabel(name: string): string {
  const trimmed = name.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return name;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return name;
  }
  if (Array.isArray(parsed)) return summarizeValue(parsed) ?? name;
  if (!isRecord(parsed)) return name;
  const entries = Object.entries(parsed).filter(
    ([, v]) => v != null && v !== ""
  );
  if (entries.length === 0) return name;
  if (entries.length === 1 && typeof entries[0]![1] === "string") {
    return entries[0]![1] as string;
  }
  return entries
    .map(([k, v]) => `${k}=${summaryPrimitive(v) ?? ""}`)
    .join("  ");
}

/** Truncate keeping the head (most identifying for a title), trailing ellipsis. */
function truncateEnd(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Token-efficient value summarization (adapted from the vitest-evals reporter)
//
// Replaces a blind JSON truncation with a key-preferring summary: the salient
// keys of an eval output (`score`, `output`, `error`, …) come first, primitives
// are rendered compactly, and JSON-encoded strings are parsed so the same
// summary applies. The result is far denser and more legible per token.
// ---------------------------------------------------------------------------

/** Keys surfaced first when summarizing a record, in priority order. */
const PREFERRED_SUMMARY_KEYS = [
  "score",
  "label",
  "pass",
  "passed",
  "output",
  "result",
  "answer",
  "response",
  "reason",
  "rationale",
  "explanation",
  "error",
  "message",
  "name",
  "id",
  "status",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function truncateSummary(value: string, maxLength = 96): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

/** Render a single value as a short token: scalars inline, containers as counts. */
function summaryPrimitive(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return "null";
  if (typeof value === "string") {
    const truncated = truncateSummary(value, 48);
    // Bare-word strings stay unquoted; anything with spaces/punctuation is
    // quoted so the key=value pairs remain unambiguous.
    return /^[\w.:/@-]+$/.test(truncated)
      ? truncated
      : JSON.stringify(truncated);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") {
    return `object(${Object.keys(value).length})`;
  }
  return String(value);
}

function summarizeRecord(
  record: Record<string, unknown>,
  maxLength: number
): string | null {
  const keys = Object.keys(record);
  if (keys.length === 0) return "object(0)";
  const ordered = [
    ...PREFERRED_SUMMARY_KEYS.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !PREFERRED_SUMMARY_KEYS.includes(key)),
  ].slice(0, 4);
  const parts = ordered
    .map((key) => {
      const formatted = summaryPrimitive(record[key]);
      return formatted === null ? null : `${key}=${formatted}`;
    })
    .filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  const suffix = keys.length > ordered.length ? " …" : "";
  return truncateSummary(`${parts.join(" ")}${suffix}`, maxLength);
}

/**
 * Summarize an arbitrary value to a compact, single-line string, or `null` when
 * there's nothing to show (`undefined`). JSON-encoded strings are parsed first
 * so the key-preferring record summary still applies.
 */
function summarizeValue(value: unknown, maxLength = 96): string | null {
  if (value === undefined) return null;
  if (value === null) return "null";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return summarizeValue(JSON.parse(trimmed), maxLength);
      } catch {
        // Not valid JSON — fall through to plain-string handling.
      }
    }
    return truncateSummary(value, maxLength);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "array(0)";
    const first = summaryPrimitive(value[0]);
    const suffix = value.length > 1 ? " …" : "";
    return truncateSummary(
      `array(${value.length}) ${first ?? ""}${suffix}`.trim(),
      maxLength
    );
  }
  if (isRecord(value)) {
    return summarizeRecord(value, maxLength);
  }
  return truncateSummary(String(value), maxLength);
}
