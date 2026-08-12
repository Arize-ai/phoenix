import type { EvaluationTarget } from "@phoenix/pages/project/evaluators/__generated__/createProjectLlmEvaluatorMutation.graphql";
import type { EvaluatorInputMapping } from "@phoenix/types";
import { getValueAtPath } from "@phoenix/utils/objectUtils";

/** A span evaluation context has no counterpart to a dataset `reference`. */
export function dropReferencePathMappings(
  inputMapping: EvaluatorInputMapping
): EvaluatorInputMapping {
  const pathMapping = Object.fromEntries(
    Object.entries(inputMapping.pathMapping).filter(
      ([, path]) => path !== "reference" && !path.startsWith("reference.")
    )
  );
  return { ...inputMapping, pathMapping };
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

/** The server rejects anything shorter. */
export const MIN_EVALUATION_DELAY_SECONDS = 10;

/** What the server stores when a create omits the delay. */
export const DEFAULT_EVALUATION_DELAY_SECONDS = 300;

export type ProjectEvaluatorScope = {
  targetType: ProjectEvaluatorTarget;
  filterCondition: string;
  samplingRate: number;
  /** Only session evaluators use this; other targets store it unused. */
  evaluationDelaySeconds: number;
};

export const isProjectEvaluatorTarget = (
  value: string
): value is ProjectEvaluatorTarget =>
  PROJECT_EVALUATOR_TARGETS.includes(value as ProjectEvaluatorTarget);

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

/**
 * Why a session evaluator would be stored but never scheduled. Mirrors the
 * server's SESSION schedulability conditions, in their order, so the form can
 * warn before submit; a saved evaluator reports the server's own verdict.
 */
export type SessionScopeUnschedulableReason = "filter" | "sampling";

export function getSessionScopeUnschedulableReason(
  scope: ProjectEvaluatorScope
): SessionScopeUnschedulableReason | null {
  if (scope.targetType !== "SESSION") {
    return null;
  }
  if (scope.filterCondition !== "") {
    return "filter";
  }
  if (scope.samplingRate !== 1) {
    return "sampling";
  }
  return null;
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

export type ProjectEvaluatorMappingDiagnostic = {
  variable: string;
  path: string;
  status: "resolved" | "missing" | "optional-missing" | "unverified";
};

// Only dot-separated bare JSONPath identifiers resolve client-side; anything
// else (hyphens, brackets, quotes) is left to server validation.
const SIMPLE_MAPPING_PATH_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;

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
  return variables.map((variable) => {
    const path = pathMapping[variable] ?? variable;
    if (!SIMPLE_MAPPING_PATH_PATTERN.test(path)) {
      return { variable, path, status: "unverified" };
    }
    return {
      variable,
      path,
      status:
        getValueAtPath(context, path) === undefined
          ? requiredVariableNames.has(variable)
            ? "missing"
            : "optional-missing"
          : "resolved",
    };
  });
}
