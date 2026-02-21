import type { ExperimentEvaluationRun } from "../types/experiments";
import type { Logger } from "../logger";

/**
 * Progress line prefixes used in experiment run output.
 * e.g. "[start] Tasks (3 examples × 1 repetition)"
 */
export const PREFIX = {
  start: "[start]",
  progress: "[progress]",
  completed: "[completed]",
} as const;

/**
 * Log a task summary table.
 * Outputs a header + a single-row table keyed as "summary".
 */
export function logTaskSummary(
  logger: Logger,
  {
    nExamples,
    repetitions,
    nRuns,
    nErrors,
  }: {
    nExamples: number;
    repetitions: number;
    nRuns: number;
    nErrors: number;
  }
): void {
  logger.info("");
  logger.info("Task Summary");
  const row: Record<string, unknown> = { examples: nExamples };
  if (repetitions > 1) row.repetitions = repetitions;
  row.runs = nRuns;
  if (nErrors > 0) row.errors = nErrors;
  logger.table({ summary: row });
}

/**
 * Log an evaluation summary table, keyed by evaluator name.
 * Aggregates scores and labels per evaluator.
 */
export function logEvalSummary(
  logger: Logger,
  evalRuns: ExperimentEvaluationRun[]
): void {
  logger.info("");
  logger.info("Evaluation Summary");

  const byEvaluator = new Map<string, ExperimentEvaluationRun[]>();
  for (const ev of evalRuns) {
    const list = byEvaluator.get(ev.name) ?? [];
    list.push(ev);
    byEvaluator.set(ev.name, list);
  }

  const tableObj: Record<string, Record<string, unknown>> = {};
  for (const [name, evs] of byEvaluator.entries()) {
    const scores = evs.flatMap((ev) =>
      ev.result?.score != null ? [ev.result.score] : []
    );
    const labels = evs.flatMap((ev) =>
      ev.result?.label != null ? [ev.result.label] : []
    );
    const errors = evs.filter((ev) => ev.error != null);

    const row: Record<string, unknown> = { runs: evs.length };
    if (errors.length > 0) row.errors = errors.length;
    if (scores.length > 0) {
      row.scores = scores.length;
      row["avg score"] = Number(
        (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)
      );
    }
    if (labels.length > 0) {
      row.labels = labels.length;
      const counts: Record<string, number> = {};
      for (const label of labels) counts[label] = (counts[label] ?? 0) + 1;
      const topLabels = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);
      if (topLabels[0]) row["label 1"] = `${topLabels[0][0]} (${topLabels[0][1]})`;
      if (topLabels[1]) row["label 2"] = `${topLabels[1][0]} (${topLabels[1][1]})`;
    }
    tableObj[name] = row;
  }

  logger.table(tableObj);
}

/**
 * Log a padded "Links" block.
 * Labels are padded to align URLs. No-ops when links is empty.
 */
export function logLinks(
  logger: Logger,
  links: Array<{ label: string; url: string }>
): void {
  if (links.length === 0) return;
  const maxLen = Math.max(...links.map((link) => link.label.length));
  logger.info("");
  logger.info("Links");
  for (const { label, url } of links) {
    logger.info(`  ${label.padEnd(maxLen)}  ${url}`);
  }
  logger.info("");
}

/**
 * Log experiment resume summary table.
 * Outputs a header + a single-row table keyed as "summary".
 */
export function logExperimentResumeSummary(
  logger: Logger,
  {
    experimentId,
    processed,
    completed,
    failed,
  }: {
    experimentId: string;
    processed: number;
    completed: number;
    failed: number;
  }
): void {
  logger.info("Experiment Resume Summary");
  logger.table({
    summary: {
      "experiment id": experimentId,
      processed,
      completed,
      failed,
    },
  });
}

/**
 * Log experiment resume links block.
 */
export function logExperimentResumeLinks(
  logger: Logger,
  {
    experimentsUrl,
    experimentUrl,
  }: {
    experimentsUrl: string;
    experimentUrl: string;
  }
): void {
  logger.info("\nLinks");
  logger.info(`  Experiments  ${experimentsUrl}`);
  logger.info(`  Experiment   ${experimentUrl}`);
}

/**
 * Log evaluation resume summary table.
 * Outputs a header + a single-row table keyed as "summary".
 */
export function logEvalResumeSummary(
  logger: Logger,
  {
    experimentId,
    processed,
    completed,
    failed,
  }: {
    experimentId: string;
    processed: number;
    completed: number;
    failed: number;
  }
): void {
  logger.info("Evaluation Resume Summary");
  logger.table({
    summary: {
      "experiment id": experimentId,
      processed,
      completed,
      failed,
    },
  });
}
