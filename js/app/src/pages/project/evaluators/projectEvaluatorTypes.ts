import { formatDistanceToNow } from "date-fns";

import type { BadgeVariant } from "@phoenix/components/core/badge";
import type { MetricChartTableView } from "@phoenix/pages/project/constants";
import type { EvaluationTarget } from "@phoenix/pages/project/evaluators/__generated__/createProjectLlmEvaluatorMutation.graphql";
import type {
  EvaluatorInputMapping,
  EvaluatorMappingSourceGrain,
} from "@phoenix/types";
import { assertUnreachable, isStringKeyedObject } from "@phoenix/typeUtils";
import { getValueAtPath, parsePathSegments } from "@phoenix/utils/objectUtils";

/**
 * Drops the paths rooted at the record kind an evaluator no longer runs on.
 *
 * A path may be written against the whole record — `metadata.span.attributes…`,
 * `metadata.session.turns…` — and that key exists only on its own kind.
 * Switching an evaluator from spans to sessions would otherwise leave paths
 * behind that match nothing, and a path that matches nothing fails the
 * evaluation.
 */
export function dropOtherGrainEntityPathMappings(
  inputMapping: EvaluatorInputMapping,
  grain: ProjectEvaluatorMappingSourceGrain
): EvaluatorInputMapping {
  const staleRoot = grain === "session" ? "metadata.span" : "metadata.session";
  const pathMapping = Object.fromEntries(
    Object.entries(inputMapping.pathMapping).filter(
      ([, path]) => !isPathRootedAt(path, staleRoot)
    )
  );
  return { ...inputMapping, pathMapping };
}

/**
 * Whether two input mappings carry the same entries, ignoring key order.
 *
 * An edit form compares what it loaded against what the store holds to decide
 * whether to send a mapping at all. The two differ in key order — the store
 * merges the loaded value onto its own defaults, which list `literalMapping`
 * first — so comparing serialized objects reports a change on a form nobody
 * touched, and an evaluator that stored no mapping gets an empty one written
 * over it.
 */
export function isSameInputMapping(
  a: EvaluatorInputMapping,
  b: EvaluatorInputMapping
): boolean {
  return (
    sortedEntriesJson(a.pathMapping) === sortedEntriesJson(b.pathMapping) &&
    sortedEntriesJson(a.literalMapping) === sortedEntriesJson(b.literalMapping)
  );
}

function sortedEntriesJson(mapping: Record<string, unknown> | undefined) {
  return JSON.stringify(
    Object.entries(mapping ?? {}).sort(([x], [y]) =>
      x < y ? -1 : x > y ? 1 : 0
    )
  );
}

/** `metadata.span` and `metadata.span['a.b']` are rooted there; `metadata.spanX` is not. */
function isPathRootedAt(path: string, root: string): boolean {
  if (!path.startsWith(root)) {
    return false;
  }
  const next = path.charAt(root.length);
  return next === "" || next === "." || next === "[";
}

/**
 * The artifact types a project evaluator can run against. Values are the
 * GraphQL `EvaluationTarget` enum members; `satisfies` fails to compile if the
 * schema renames or removes one, and assigning a fetched `EvaluationTarget`
 * to {@link ProjectEvaluatorTarget} fails to compile if the schema adds one.
 */
export const PROJECT_EVALUATOR_TARGETS = [
  "SPAN",
  "TRACE",
  "SESSION",
] as const satisfies readonly EvaluationTarget[];

export type ProjectEvaluatorTarget = (typeof PROJECT_EVALUATOR_TARGETS)[number];

/**
 * The evaluator's result annotations live at the level its target selects on
 * the evaluated project. TRACE evaluators are stored but never scheduled, so
 * an empty trace-level chart is the honest reading for them.
 */
export function getAnnotationLevel(
  evaluationTarget: EvaluationTarget
): MetricChartTableView {
  switch (evaluationTarget) {
    case "SPAN":
      return "spans";
    case "SESSION":
      return "sessions";
    case "TRACE":
      return "traces";
    default:
      return assertUnreachable(evaluationTarget);
  }
}

/** The server rejects anything shorter. */
export const MIN_EVALUATION_DELAY_SECONDS = 10;

/** What the server stores when a create omits the delay. */
export const DEFAULT_EVALUATION_DELAY_SECONDS = 300;

export type ProjectEvaluatorScope = {
  targetType: ProjectEvaluatorTarget;
  filterCondition: string;
  samplingRate: number;
  /** Only session evaluators schedule off this; see `toEvaluationDelayInput`. */
  evaluationDelaySeconds: number;
};

/**
 * The delay half of a create or update input, spread in by every mutation that
 * carries a scope. Only session scheduling waits out a delay, and the server
 * rejects one sent for a span evaluator, so non-session targets send nothing.
 */
export function toEvaluationDelayInput(scope: ProjectEvaluatorScope): {
  evaluationDelaySeconds?: number;
} {
  return scope.targetType === "SESSION"
    ? { evaluationDelaySeconds: scope.evaluationDelaySeconds }
    : {};
}

export const isProjectEvaluatorTarget = (
  value: string
): value is ProjectEvaluatorTarget =>
  PROJECT_EVALUATOR_TARGETS.includes(value as ProjectEvaluatorTarget);

/** A project evaluator runs on a record, never on a dataset example. */
export type ProjectEvaluatorMappingSourceGrain = Exclude<
  EvaluatorMappingSourceGrain,
  "dataset"
>;

/**
 * Which mapping-source vocabulary the records of an evaluated target speak.
 *
 * Span and session sources are structurally identical, so this is the only thing
 * that can tell them apart; every place that builds or resets a project
 * evaluator's mapping source goes through here.
 */
export function toEvaluatorMappingSourceGrain(
  target: ProjectEvaluatorTarget
): ProjectEvaluatorMappingSourceGrain {
  switch (target) {
    case "SESSION":
      return "session";
    case "SPAN":
    case "TRACE":
      return "span";
    default:
      return assertUnreachable(target);
  }
}

export function toProjectEvaluatorSamplingFraction(percent: number): number {
  return Math.min(100, Math.max(0, percent)) / 100;
}

/** "SPAN" -> "Span", for display in the evaluators table and details page. */
export function formatEvaluationTarget(target: EvaluationTarget): string {
  return `${target.charAt(0)}${target.slice(1).toLowerCase()}`;
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

/** Every reason the server can report, including ones this build predates. */
export function getSchedulabilityExplanation(
  reason: string | null | undefined
): string {
  switch (reason) {
    case "DISABLED":
      return "This evaluator is disabled. Enable it to resume scheduling.";
    case "TRACE_TARGET_UNSUPPORTED":
      return "Trace evaluators are saved but are not scheduled yet.";
    case "SESSION_FILTER_UNSUPPORTED":
      return "Session evaluators with a filter are saved but never scheduled. Clear the filter to schedule this evaluator.";
    case "SESSION_SAMPLING_UNSUPPORTED":
      return "Session evaluators with a sampling rate below 100% are saved but never scheduled. Set sampling to 100% to schedule this evaluator.";
    default:
      return "This evaluator does not meet the current scheduling requirements.";
  }
}

export type ProjectEvaluatorRunSummary = {
  status: string;
  lastRunAt: string | null;
  queuedCount: number;
  evaluatedCount: number;
  failedCount: number;
};

export type ProjectEvaluatorStatus = {
  label: string;
  variant: BadgeVariant;
  /** Why the evaluator is in this state, shown on hover and on the details page. */
  explanation: string;
};

/**
 * The one status a row reports. A configuration that keeps the evaluator from
 * ever being scheduled outranks whatever its past runs say, because clearing it
 * is the only thing that will change the rest.
 */
export function getProjectEvaluatorStatus({
  schedulabilityStatus,
  schedulabilityReason,
  runSummary,
}: {
  schedulabilityStatus: string;
  schedulabilityReason: string | null | undefined;
  // Only the status is read, so callers that have just that need not fetch
  // the counts as well.
  runSummary: Pick<ProjectEvaluatorRunSummary, "status">;
}): ProjectEvaluatorStatus {
  if (schedulabilityStatus === "NOT_SCHEDULABLE") {
    return {
      label: "Not scheduled",
      variant: "warning",
      explanation: getSchedulabilityExplanation(schedulabilityReason),
    };
  }
  switch (runSummary.status) {
    case "FAILING":
      return {
        label: "Failing",
        variant: "danger",
        explanation: "The most recent evaluation failed.",
      };
    case "HEALTHY":
      return {
        label: "Healthy",
        variant: "success",
        explanation: "Evaluations are running and producing annotations.",
      };
    case "QUEUED":
      return {
        label: "Queued",
        variant: "info",
        explanation: "Evaluations are waiting to run.",
      };
    default:
      return {
        label: "Never ran",
        variant: "default",
        explanation:
          "No evaluations have been scheduled for this evaluator yet.",
      };
  }
}

export function formatLastRun(lastRunAt: string | null): string {
  return lastRunAt == null
    ? "Never"
    : formatDistanceToNow(new Date(lastRunAt), { addSuffix: true });
}

const countFormatter = new Intl.NumberFormat();

/** "118 evaluated · 2 failed · 3 queued", dropping the parts that are zero. */
export function formatProjectEvaluatorRunCounts(
  runSummary: ProjectEvaluatorRunSummary
): string {
  const parts = (
    [
      [runSummary.evaluatedCount, "evaluated"],
      [runSummary.failedCount, "failed"],
      [runSummary.queuedCount, "queued"],
    ] as const
  )
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${countFormatter.format(count)} ${label}`);
  return parts.join(" · ");
}

export type ProjectEvaluatorMappingDiagnostic = {
  variable: string;
  path: string;
  status: "resolved" | "missing" | "optional-missing" | "unverified";
  /**
   * Where the value comes from: a path the author wrote, or a field of the same
   * name at the top of the evaluation context. Only `path` carries a path worth
   * showing.
   */
  source: "path" | "context";
};

export function getProjectEvaluatorMappingDiagnostics({
  context,
  pathMapping,
  variables,
  requiredVariables = variables,
}: {
  context: unknown;
  pathMapping: Record<string, string>;
  variables: string[];
  requiredVariables?: string[];
}): ProjectEvaluatorMappingDiagnostic[] {
  const requiredVariableNames = new Set(requiredVariables);
  const missingStatus = (variable: string) =>
    requiredVariableNames.has(variable) ? "missing" : "optional-missing";
  return variables.map((variable): ProjectEvaluatorMappingDiagnostic => {
    const mappedPath = pathMapping[variable];
    if (mappedPath != null) {
      // Wildcards and slices only the server can resolve are left to it.
      if (parsePathSegments(mappedPath) === null) {
        return {
          variable,
          path: mappedPath,
          status: "unverified",
          source: "path",
        };
      }
      return {
        variable,
        path: mappedPath,
        status:
          getValueAtPath(context, mappedPath) === undefined
            ? missingStatus(variable)
            : "resolved",
        source: "path",
      };
    }
    // An unmapped variable binds only from a field of the same name at the top
    // of the context — never by walking into it — so a dotted variable name
    // resolves here exactly as little as it does at evaluation time.
    if (isStringKeyedObject(context) && variable in context) {
      return {
        variable,
        path: variable,
        status: "resolved",
        source: "context",
      };
    }
    return {
      variable,
      path: variable,
      status: missingStatus(variable),
      source: "context",
    };
  });
}
