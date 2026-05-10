import type { SuiteState, TestResult } from "./state";
import type { Annotation } from "./types";

/**
 * Render a single suite's results as a human-readable block.
 *
 * The layout is intentionally simple — pass/fail per test, any annotation
 * scores aggregated by name, and a list of links to the Phoenix UI.
 */
export function formatSuiteSummary(suite: SuiteState): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`Phoenix Eval Suite: ${suite.name}`);
  if (suite.trackingDisabled) {
    if (suite.setupError) {
      lines.push(`  (tracking disabled — ${suite.setupError.message})`);
    } else if (suite.trackingDisabledReason) {
      lines.push(`  (tracking disabled — ${suite.trackingDisabledReason})`);
    } else {
      lines.push(`  (tracking disabled)`);
    }
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

  for (const result of suite.results) {
    const status =
      result.status === "passed"
        ? "PASS"
        : result.status === "failed"
          ? "FAIL"
          : "SKIP";
    lines.push(
      `    [${status}] ${result.testName} (${formatDuration(result.durationMs)})`
    );
    if (result.output !== undefined) {
      lines.push(`      output: ${stringifyForLog(result.output)}`);
    }
    if (result.error) {
      lines.push(`      error: ${result.error}`);
    }
    for (const ann of result.annotations) {
      if (ann.name === "pass") continue;
      lines.push(`      annotation ${ann.name}: ${formatScore(ann)}`);
    }
  }

  for (const link of suite.links) {
    lines.push(`  ${link.label}: ${link.url}`);
  }
  return lines.join("\n");
}

/** Convenience that prints summaries to stdout. */
export function printSuiteSummaries(suites: readonly SuiteState[]): void {
  for (const suite of suites) {
    // eslint-disable-next-line no-console
    console.log(formatSuiteSummary(suite));
  }
}

function aggregateAnnotations(results: TestResult[]): Record<string, string> {
  const numericByName = new Map<string, number[]>();
  const booleanByName = new Map<string, { t: number; f: number }>();
  for (const result of results) {
    for (const ann of result.annotations) {
      if (ann.name === "pass") continue;
      if (typeof ann.score === "number") {
        const arr = numericByName.get(ann.name) ?? [];
        arr.push(ann.score);
        numericByName.set(ann.name, arr);
      } else if (typeof ann.score === "boolean") {
        const cur = booleanByName.get(ann.name) ?? { t: 0, f: 0 };
        if (ann.score) cur.t++;
        else cur.f++;
        booleanByName.set(ann.name, cur);
      }
    }
  }
  const out: Record<string, string> = {};
  for (const [name, scores] of numericByName) {
    const avg = scores.reduce((acc, s) => acc + s, 0) / scores.length;
    out[name] =
      `avg ${avg.toFixed(3)} (${scores.length} sample${scores.length === 1 ? "" : "s"})`;
  }
  for (const [name, counts] of booleanByName) {
    out[name] = `${counts.t}/${counts.t + counts.f} true`;
  }
  return out;
}

function formatScore(ann: Annotation): string {
  if (typeof ann.score === "number") return ann.score.toString();
  if (typeof ann.score === "boolean") return ann.score ? "true" : "false";
  if (ann.label) return ann.label;
  return "(no score)";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
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
