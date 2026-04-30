import type { EvaluationResult } from "./types";

const PAIRWISE_METADATA_KEYS = new Set([
  "presented_first",
  "ordering",
  "seed",
  "judge_choice_pass_1",
  "judge_choice_pass_2",
  "judge_rationale_pass_1",
  "judge_rationale_pass_2",
  "tie_reason",
  "model",
  "trace_id",
  "error",
]);

export function winRate({
  scores,
  group,
  tieValue = 0.5,
}: {
  scores: Iterable<EvaluationResult>;
  group: string;
  tieValue?: number;
}): number {
  let total = 0;
  let wins = 0;
  for (const score of scores) {
    const comparatorKeys = Object.keys(score.metadata ?? {}).filter(
      (key) => !PAIRWISE_METADATA_KEYS.has(key)
    );
    if (!comparatorKeys.includes(group)) {
      throw new Error(`Score does not identify group '${group}' as a pairwise comparator.`);
    }
    total += 1;
    if (score.label === group) {
      wins += 1;
    } else if (score.label === "tie") {
      wins += tieValue;
    }
  }
  if (total === 0) {
    throw new Error("winRate requires at least one score.");
  }
  return wins / total;
}
