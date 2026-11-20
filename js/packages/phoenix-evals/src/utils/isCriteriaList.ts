import type { ClassificationChoicesMap, Criterion } from "../types/evals";

/**
 * Type guard that distinguishes the multi-criterion `choices` format (a list of
 * {@link Criterion}) from the single-criterion label-to-score map.
 */
export function isCriteriaList(
  choices: ClassificationChoicesMap | Criterion[]
): choices is Criterion[] {
  return Array.isArray(choices);
}
