import { formatDistanceToNow } from "date-fns";

import type { EvaluationTarget } from "@phoenix/pages/project/evaluators/__generated__/createProjectLlmEvaluatorMutation.graphql";
import { formatQueueCount } from "@phoenix/pages/project/evaluators/evaluationQueueCounts";
import type { ProjectEvaluatorStatusFields } from "@phoenix/pages/project/evaluators/projectEvaluatorStatus";
import type { ProjectEvaluatorRecordKind } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** "SPAN" -> "Span", for display in the evaluators table and details page. */
export function formatEvaluationTarget(target: EvaluationTarget): string {
  return `${target.charAt(0)}${target.slice(1).toLowerCase()}`;
}

/** "span" -> "Span", for a column or token that names the record kind. */
export function formatEvaluationRecordKind(
  recordKind: ProjectEvaluatorRecordKind
): string {
  return `${recordKind.charAt(0).toUpperCase()}${recordKind.slice(1)}`;
}

/** "SPAN" -> "spans", for prose that names what an evaluator runs on. */
export function formatEvaluationTargetPlural(target: EvaluationTarget): string {
  return `${target.toLowerCase()}s`;
}

/** "300" -> "5 minutes"; whole minutes read better than raw seconds. */
export function formatEvaluationDelay(seconds: number): string {
  if (seconds < 60 || seconds % 60 !== 0) {
    return `${seconds.toLocaleString()} second${seconds === 1 ? "" : "s"}`;
  }
  const minutes = seconds / 60;
  return `${minutes.toLocaleString()} minute${minutes === 1 ? "" : "s"}`;
}

// Hoisted: Intl.NumberFormat construction does locale resolution, and the
// evaluators table calls this per row per render.
const samplingRateFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 2,
});

/** Formats a sampling fraction (0-1) as a percentage for display. */
export function formatSamplingRate(samplingRate: number): string {
  return samplingRateFormatter.format(samplingRate);
}

/** "5 minutes ago", or "Never" without a time. */
export function formatRelativeOrNever(at: string | null): string {
  return at == null
    ? "Never"
    : formatDistanceToNow(new Date(at), { addSuffix: true });
}

const countFormatter = new Intl.NumberFormat();

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A duration in its largest whole unit: "<1m", "12m", "3h", "2d". */
export function formatDurationShort(milliseconds: number): string {
  const duration = Math.max(0, milliseconds);
  if (duration >= DAY_MS) {
    return `${Math.floor(duration / DAY_MS)}d`;
  }
  if (duration >= HOUR_MS) {
    return `${Math.floor(duration / HOUR_MS)}h`;
  }
  if (duration >= MINUTE_MS) {
    return `${Math.floor(duration / MINUTE_MS)}m`;
  }
  return "<1m";
}

/** A lag in its two largest units: "42s", "3m 50s", "2h 35m", "1d 4h". */
export function formatLag(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
}

/** Time elapsed since `since`, in its largest whole unit. */
export function formatElapsedShort(
  since: string,
  now: number = Date.now()
): string {
  return formatDurationShort(now - new Date(since).getTime());
}

/**
 * "118 evaluated · 2 failed · 3 cleared · 4 in queue", dropping the parts that
 * are zero. Outcomes count every retained evaluation; in queue is now.
 */
export function formatRetainedOutcomeCounts(
  runSummary: Pick<
    ProjectEvaluatorStatusFields,
    "evaluatedCount" | "failedCount" | "clearedCount" | "queuedCount"
  >
): string {
  const { evaluatedCount, failedCount, clearedCount, queuedCount } = runSummary;
  return [
    evaluatedCount > 0 && `${countFormatter.format(evaluatedCount)} evaluated`,
    failedCount > 0 && `${countFormatter.format(failedCount)} failed`,
    clearedCount > 0 && `${countFormatter.format(clearedCount)} cleared`,
    queuedCount > 0 && `${formatQueueCount(queuedCount)} in queue`,
  ]
    .filter((part): part is string => part !== false)
    .join(" · ");
}
