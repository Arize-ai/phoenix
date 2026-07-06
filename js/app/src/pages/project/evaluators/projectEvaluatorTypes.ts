/**
 * The artifact types a project evaluator can run against.
 */
export const PROJECT_EVALUATOR_TARGETS = ["span", "trace", "session"] as const;

export type ProjectEvaluatorTarget = (typeof PROJECT_EVALUATOR_TARGETS)[number];

export const isProjectEvaluatorTarget = (
  value: string
): value is ProjectEvaluatorTarget =>
  PROJECT_EVALUATOR_TARGETS.includes(value as ProjectEvaluatorTarget);
