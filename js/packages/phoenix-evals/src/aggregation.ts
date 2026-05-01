import type { EvaluationResult } from "./types";

export type PairwiseWinRate = {
  group: string;
  win_rate: number;
  wins: number;
  losses: number;
  ties: number;
  n: number;
};

const PAIRWISE_METADATA_KEYS = new Set(["groups", "ordering", "seed", "passes", "tie_reason", "model", "trace_id"]);

function getPairwiseGroups(score: EvaluationResult): string[] | null {
  const metadataGroups = score.metadata?.groups;
  if (
    Array.isArray(metadataGroups) &&
    metadataGroups.every((group): group is string => typeof group === "string")
  ) {
    return metadataGroups;
  }
  const comparatorKeys = Object.keys(score.metadata ?? {}).filter(
    (key) => !PAIRWISE_METADATA_KEYS.has(key)
  );
  return comparatorKeys.length === 2 ? comparatorKeys : null;
}

export function winRate({
  scores,
  group = "output",
  tieValue = 0.5,
}: {
  scores: Iterable<EvaluationResult>;
  group?: string;
  tieValue?: number;
}): PairwiseWinRate {
  let total = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const score of scores) {
    const groups = getPairwiseGroups(score);
    if (!groups || !groups.includes(group)) {
      throw new Error(`Score does not identify group '${group}' as a pairwise comparator.`);
    }
    total += 1;
    if (score.label === group) {
      wins += 1;
    } else if (score.label === "tie") {
      ties += 1;
    } else {
      losses += 1;
    }
  }
  if (total === 0) {
    throw new Error("winRate requires at least one score.");
  }
  return {
    group,
    win_rate: (wins + ties * tieValue) / total,
    wins,
    losses,
    ties,
    n: total,
  };
}
