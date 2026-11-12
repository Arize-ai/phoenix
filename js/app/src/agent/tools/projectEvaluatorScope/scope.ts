import { z } from "zod";

import {
  getDefaultProjectEvaluatorFilterCondition,
  hasEvaluationDelay,
  MIN_EVALUATION_DELAY_SECONDS,
  PROJECT_EVALUATOR_TARGETS,
  type ProjectEvaluatorRecordKind,
  type ProjectEvaluatorScope,
  type ProjectEvaluatorTarget,
  toEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * Input for `evaluators.project.scope.edit`: a partial scope. Fields left out
 * keep their current value.
 */
export const editProjectEvaluatorScopeInputSchema = z
  .strictObject({
    targetType: z
      .enum(PROJECT_EVALUATOR_TARGETS)
      .optional()
      .describe(
        "What one evaluation runs on: SPAN, TRACE, or SESSION. Changing it " +
          "swaps the filter language, so the filter resets to that target's " +
          "default (or the filter last used on it) unless `filterCondition` " +
          "is also given. Only a create form can change it."
      ),
    filterCondition: z
      .string()
      .optional()
      .describe(
        "Which records of the target are evaluated, in the target's filter " +
          "language (span: `span_kind == 'LLM'`; trace: `num_spans >= 5`; " +
          "session: `num_traces >= 5`). An empty string evaluates every " +
          "record. The condition is validated against the project before it " +
          "is applied."
      ),
    samplingRate: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        "Fraction of matching records evaluated, from 0 to 1 (25% is 0.25). " +
          "The form keeps whole percents."
      ),
    evaluationDelaySeconds: z
      .number()
      .int()
      .min(MIN_EVALUATION_DELAY_SECONDS)
      .optional()
      .describe(
        "Seconds of inactivity a trace or session waits before it is " +
          `evaluated (at least ${MIN_EVALUATION_DELAY_SECONDS}). Trace and ` +
          "session targets only."
      ),
    tracingEnabled: z
      .boolean()
      .optional()
      .describe(
        "Whether each evaluation stores a trace of its inputs, outputs, " +
          "latency, and cost."
      ),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Give at least one scope field to change.",
  });

export type ProjectEvaluatorScopePatch = z.output<
  typeof editProjectEvaluatorScopeInputSchema
>;

/** What `evaluators.project.scope.read` returns. */
export type ProjectEvaluatorScopeSnapshot = {
  targetType: ProjectEvaluatorTarget;
  /** The filter language `filterCondition` is written in. */
  filterLanguage: ProjectEvaluatorRecordKind;
  filterCondition: string;
  samplingRate: number;
  /** Null for span targets, which are evaluated without a delay. */
  evaluationDelaySeconds: number | null;
  tracingEnabled: boolean;
  /** False on an edit form: a saved evaluator keeps its target. */
  isTargetEditable: boolean;
};

export function toProjectEvaluatorScopeSnapshot({
  scope,
  isTargetEditable,
}: {
  scope: ProjectEvaluatorScope;
  isTargetEditable: boolean;
}): ProjectEvaluatorScopeSnapshot {
  return {
    targetType: scope.targetType,
    filterLanguage: toEvaluatorRecordKind(scope.targetType),
    filterCondition: scope.filterCondition,
    samplingRate: scope.samplingRate,
    evaluationDelaySeconds: hasEvaluationDelay(scope.targetType)
      ? scope.evaluationDelaySeconds
      : null,
    tracingEnabled: scope.tracingEnabled,
    isTargetEditable,
  };
}

export type ProjectEvaluatorScopePatchResult =
  | { ok: true; scope: ProjectEvaluatorScope }
  | { ok: false; error: string };

/**
 * The scope a patch leads to, by the rules the scope fields enforce: a saved
 * evaluator keeps its target, a target change brings that target's filter,
 * sampling is kept to whole percents, and only delayed targets take a delay.
 * The filter's syntax is not checked here; that needs the server.
 */
export function applyProjectEvaluatorScopePatch({
  scope,
  patch,
  isTargetEditable,
  rememberedFilters = {},
}: {
  scope: ProjectEvaluatorScope;
  patch: ProjectEvaluatorScopePatch;
  isTargetEditable: boolean;
  /** Filters written on other targets, restored when the scope returns to one. */
  rememberedFilters?: Partial<Record<ProjectEvaluatorTarget, string>>;
}): ProjectEvaluatorScopePatchResult {
  const targetType = patch.targetType ?? scope.targetType;
  const isTargetChange = targetType !== scope.targetType;
  if (isTargetChange && !isTargetEditable) {
    return {
      ok: false,
      error:
        `This form edits a saved evaluator, whose target (${scope.targetType}) ` +
        "cannot change. Create a new evaluator to evaluate another target.",
    };
  }
  if (patch.evaluationDelaySeconds != null && !hasEvaluationDelay(targetType)) {
    return {
      ok: false,
      error:
        "evaluationDelaySeconds applies only to TRACE and SESSION targets; " +
        "span evaluators run as spans arrive.",
    };
  }
  const filterCondition =
    patch.filterCondition ??
    (isTargetChange
      ? (rememberedFilters[targetType] ??
        getDefaultProjectEvaluatorFilterCondition(targetType))
      : scope.filterCondition);
  return {
    ok: true,
    scope: {
      targetType,
      filterCondition: filterCondition.trim(),
      samplingRate:
        patch.samplingRate != null
          ? Math.round(patch.samplingRate * 100) / 100
          : scope.samplingRate,
      evaluationDelaySeconds:
        patch.evaluationDelaySeconds ?? scope.evaluationDelaySeconds,
      tracingEnabled: patch.tracingEnabled ?? scope.tracingEnabled,
    },
  };
}
