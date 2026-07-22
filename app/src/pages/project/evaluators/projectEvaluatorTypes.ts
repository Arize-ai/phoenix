import type { EvaluatorInputMapping } from "@phoenix/types";
import { getValueAtPath } from "@phoenix/utils/objectUtils";

/**
 * Drops path-mapping entries that resolve against a dataset `reference`, which
 * has no counterpart in a span evaluation context.
 */
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
 * The artifact types a project evaluator can run against.
 */
export const PROJECT_EVALUATOR_TARGETS = ["span", "trace", "session"] as const;

export type ProjectEvaluatorTarget = (typeof PROJECT_EVALUATOR_TARGETS)[number];

export type ProjectEvaluatorGraphQLTarget = "SPAN" | "TRACE" | "SESSION";

export type ProjectEvaluatorScope = {
  targetType: ProjectEvaluatorTarget;
  filterCondition: string;
  samplingRatePercent: number;
};

export const isProjectEvaluatorTarget = (
  value: string
): value is ProjectEvaluatorTarget =>
  PROJECT_EVALUATOR_TARGETS.includes(value as ProjectEvaluatorTarget);

export function toProjectEvaluatorGraphQLTarget(
  target: ProjectEvaluatorTarget
): ProjectEvaluatorGraphQLTarget {
  switch (target) {
    case "span":
      return "SPAN";
    case "trace":
      return "TRACE";
    case "session":
      return "SESSION";
  }
}

export function fromProjectEvaluatorGraphQLTarget(
  target: ProjectEvaluatorGraphQLTarget
): ProjectEvaluatorTarget {
  switch (target) {
    case "SPAN":
      return "span";
    case "TRACE":
      return "trace";
    case "SESSION":
      return "session";
  }
}

export function toProjectEvaluatorSamplingFraction(percent: number): number {
  return Math.min(100, Math.max(0, percent)) / 100;
}

export type ProjectEvaluatorMappingDiagnostic = {
  variable: string;
  path: string;
  status: "resolved" | "missing" | "unverified";
};

// Only dot-separated bare JSONPath identifiers can be resolved client-side.
// Anything else (hyphens, brackets, quotes) is left to server validation.
const SIMPLE_MAPPING_PATH_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;

export function getProjectEvaluatorMappingDiagnostics({
  context,
  pathMapping,
}: {
  context: unknown;
  pathMapping: Record<string, string>;
}): ProjectEvaluatorMappingDiagnostic[] {
  return Object.entries(pathMapping).map(([variable, path]) => {
    if (!SIMPLE_MAPPING_PATH_PATTERN.test(path)) {
      return { variable, path, status: "unverified" };
    }
    return {
      variable,
      path,
      status:
        getValueAtPath(context, path) === undefined ? "missing" : "resolved",
    };
  });
}
