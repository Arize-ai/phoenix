/* eslint-disable no-console */
import type {
  ExperimentEvaluationRun,
  ExperimentRun,
  RanExperiment,
} from "@arizeai/phoenix-client/types/experiments";

type LatencyStats = {
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
};

type EvaluatorStats = {
  name: string;
  avgScore: number | null;
  scores: number[];
  labelCounts: Record<string, number>;
  errorCount: number;
  total: number;
};

type RunDetail = {
  runId: string;
  exampleId: string;
  latencyMs: number;
  error: string | null;
  evaluations: Array<{
    name: string;
    score: number | null | undefined;
    label: string | null | undefined;
    explanation: string | null | undefined;
  }>;
};

type ExperimentStats = {
  experimentId: string;
  createdAt: string;
  exampleCount: number;
  successfulRunCount: number;
  failedRunCount: number;
  missingRunCount: number;
  latency: LatencyStats | null;
  evaluators: EvaluatorStats[];
  runDetails: RunDetail[];
  runErrors: Array<{ runId: string; exampleId: string; error: string }>;
  evalErrors: Array<{ evalName: string; runId: string; error: string }>;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str;
  return str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  if (str.length >= len) return str;
  return " ".repeat(len - str.length) + str;
}

function maxLen(strings: string[], minWidth: number): number {
  return Math.max(minWidth, ...strings.map((s) => s.length));
}

export function computeExperimentStats(
  experiment: RanExperiment
): ExperimentStats {
  const runs = Object.values(experiment.runs);
  const evaluationRuns = experiment.evaluationRuns ?? [];

  // Build evaluation lookup: runId -> evaluations
  const evalsByRunId = new Map<string, ExperimentEvaluationRun[]>();
  for (const evalRun of evaluationRuns) {
    const existing = evalsByRunId.get(evalRun.experimentRunId) ?? [];
    existing.push(evalRun);
    evalsByRunId.set(evalRun.experimentRunId, existing);
  }

  // Compute per-run latencies
  const latencies = runs.map(
    (r) => r.endTime.getTime() - r.startTime.getTime()
  );
  const sortedLatencies = [...latencies].sort((a, b) => a - b);

  const latency: LatencyStats | null =
    sortedLatencies.length > 0
      ? {
          avg:
            sortedLatencies.reduce((sum, v) => sum + v, 0) /
            sortedLatencies.length,
          min: sortedLatencies[0],
          max: sortedLatencies[sortedLatencies.length - 1],
          p50: percentile(sortedLatencies, 50),
          p95: percentile(sortedLatencies, 95),
        }
      : null;

  // Compute per-evaluator stats
  const evaluatorMap = new Map<string, EvaluatorStats>();
  for (const evalRun of evaluationRuns) {
    let stats = evaluatorMap.get(evalRun.name);
    if (!stats) {
      stats = {
        name: evalRun.name,
        avgScore: null,
        scores: [],
        labelCounts: {},
        errorCount: 0,
        total: 0,
      };
      evaluatorMap.set(evalRun.name, stats);
    }
    stats.total++;
    if (evalRun.error) {
      stats.errorCount++;
    }
    if (evalRun.result?.score != null) {
      stats.scores.push(evalRun.result.score);
    }
    if (evalRun.result?.label) {
      stats.labelCounts[evalRun.result.label] =
        (stats.labelCounts[evalRun.result.label] ?? 0) + 1;
    }
  }
  for (const stats of evaluatorMap.values()) {
    if (stats.scores.length > 0) {
      stats.avgScore =
        stats.scores.reduce((sum, v) => sum + v, 0) / stats.scores.length;
    }
  }

  // Build per-run details
  const runDetails: RunDetail[] = runs.map((run: ExperimentRun, idx) => {
    const evals = evalsByRunId.get(run.id) ?? [];
    return {
      runId: run.id,
      exampleId: run.datasetExampleId,
      latencyMs: latencies[idx],
      error: run.error,
      evaluations: evals.map((e) => ({
        name: e.name,
        score: e.result?.score,
        label: e.result?.label,
        explanation: e.result?.explanation,
      })),
    };
  });

  // Collect errors
  const runErrors = runs
    .filter((r) => r.error)
    .map((r) => ({
      runId: r.id,
      exampleId: r.datasetExampleId,
      error: r.error!,
    }));

  const evalErrors = evaluationRuns
    .filter((e) => e.error)
    .map((e) => ({
      evalName: e.name,
      runId: e.experimentRunId,
      error: e.error!,
    }));

  return {
    experimentId: experiment.id,
    createdAt: experiment.createdAt,
    exampleCount: experiment.exampleCount,
    successfulRunCount: experiment.successfulRunCount,
    failedRunCount: experiment.failedRunCount,
    missingRunCount: experiment.missingRunCount,
    latency,
    evaluators: Array.from(evaluatorMap.values()),
    runDetails,
    runErrors,
    evalErrors,
  };
}

export function printExperimentSummary({
  experiment,
  experimentName,
}: {
  experiment: RanExperiment;
  experimentName?: string;
}): void {
  const stats = computeExperimentStats(experiment);
  const divider = "-".repeat(60);

  // Header
  console.log("");
  console.log("=".repeat(60));
  console.log("  Experiment Summary");
  console.log("=".repeat(60));
  if (experimentName) {
    console.log(`  Name:      ${experimentName}`);
  }
  console.log(`  ID:        ${stats.experimentId}`);
  console.log(`  Examples:  ${stats.exampleCount}`);
  console.log(`  Created:   ${stats.createdAt}`);

  // Task Run Stats
  console.log("");
  console.log(divider);
  console.log("  Task Runs");
  console.log(divider);
  console.log(
    `  Total: ${stats.exampleCount}  |  Success: ${stats.successfulRunCount}  |  Failed: ${stats.failedRunCount}  |  Missing: ${stats.missingRunCount}`
  );
  if (stats.latency) {
    const l = stats.latency;
    console.log(
      `  Latency:  avg=${formatMs(l.avg)}  min=${formatMs(l.min)}  max=${formatMs(l.max)}  p50=${formatMs(l.p50)}  p95=${formatMs(l.p95)}`
    );
  }

  // Per-Evaluator Stats
  for (const evaluator of stats.evaluators) {
    console.log("");
    console.log(divider);
    console.log(`  Evaluator: ${evaluator.name}`);
    console.log(divider);

    if (evaluator.avgScore != null) {
      console.log(`  Avg Score: ${evaluator.avgScore.toFixed(3)}`);
    }

    // Score distribution
    const scoreDistribution = new Map<number, number>();
    for (const score of evaluator.scores) {
      scoreDistribution.set(score, (scoreDistribution.get(score) ?? 0) + 1);
    }
    const sortedScores = [...scoreDistribution.entries()].sort(
      (a, b) => b[0] - a[0]
    );
    for (const [score, count] of sortedScores) {
      const pct = ((count / evaluator.total) * 100).toFixed(1);
      console.log(
        `  Score=${score}: ${count} / ${evaluator.total} (${pct}%)`
      );
    }

    // Label distribution
    const labels = Object.entries(evaluator.labelCounts);
    if (labels.length > 0) {
      const labelStr = labels
        .map(([label, count]) => `${label}=${count}`)
        .join(", ");
      console.log(`  Labels: ${labelStr}`);
    }

    if (evaluator.errorCount > 0) {
      console.log(`  Errors: ${evaluator.errorCount}`);
    }
  }

  // Per-Example Results Table
  console.log("");
  console.log(divider);
  console.log("  Per-Example Results");
  console.log(divider);

  // Pre-compute all cell values so we can size columns dynamically
  const rows = stats.runDetails.map((detail, i) => {
    const firstEval = detail.evaluations[0];
    return {
      num: String(i + 1),
      id: detail.exampleId,
      score: firstEval?.score != null ? String(firstEval.score) : "-",
      label: firstEval?.label ?? "-",
      latency: formatMs(detail.latencyMs),
      explanation: firstEval?.explanation ?? "-",
    };
  });

  const colNum = maxLen(rows.map((r) => r.num), "#".length);
  const colId = maxLen(rows.map((r) => r.id), "Example ID".length);
  const colScore = maxLen(rows.map((r) => r.score), "Score".length);
  const colLabel = maxLen(rows.map((r) => r.label), "Label".length);
  const colLatency = maxLen(rows.map((r) => r.latency), "Latency".length);
  const colExplanation = maxLen(
    rows.map((r) => r.explanation),
    "Explanation".length
  );

  const header = [
    padRight("#", colNum),
    padRight("Example ID", colId),
    padRight("Score", colScore),
    padRight("Label", colLabel),
    padRight("Latency", colLatency),
    padRight("Explanation", colExplanation),
  ].join("  ");
  console.log(`  ${header}`);
  console.log(`  ${"-".repeat(header.length)}`);

  for (const row of rows) {
    const line = [
      padLeft(row.num, colNum),
      padRight(row.id, colId),
      padRight(row.score, colScore),
      padRight(row.label, colLabel),
      padRight(row.latency, colLatency),
      row.explanation,
    ].join("  ");
    console.log(`  ${line}`);
  }

  // Errors Section
  const totalErrors = stats.runErrors.length + stats.evalErrors.length;
  console.log("");
  console.log(divider);
  console.log(`  Errors (${totalErrors})`);
  console.log(divider);

  if (totalErrors === 0) {
    console.log("  None");
  } else {
    for (const err of stats.runErrors) {
      console.log(`  [Run] Example=${err.exampleId}: ${err.error}`);
    }
    for (const err of stats.evalErrors) {
      console.log(
        `  [Eval] ${err.evalName} on run=${err.runId}: ${err.error}`
      );
    }
  }

  console.log("");
}
