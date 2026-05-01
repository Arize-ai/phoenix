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
  // Mirror Python's filter: exclude reserved keys AND any key whose value is a
  // non-null object/array. Without this, a downstream caller adding an extra
  // metadata key with a structured value (e.g. an annotation list) would have
  // it treated as a comparator group and break aggregation.
  const comparatorKeys = Object.keys(score.metadata ?? {}).filter((key) => {
    if (PAIRWISE_METADATA_KEYS.has(key)) {
      return false;
    }
    const value = score.metadata?.[key];
    return !(typeof value === "object" && value !== null);
  });
  return comparatorKeys.length === 2 ? comparatorKeys : null;
}

/**
 * Return pairwise win-rate summary for the first group in each score's
 * `metadata.groups`.
 *
 * Win rate is always computed for `groups[0]` — the group that receives
 * `score = 1.0` when it wins. All scores must share the same comparator pair;
 * mixing comparisons across different group pairs throws.
 *
 * Ties contribute `tieValue` to the win rate.
 */
export function winRate({
  scores,
  tieValue = 0.5,
}: {
  scores: Iterable<EvaluationResult>;
  tieValue?: number;
}): PairwiseWinRate {
  let total = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let referenceGroups: string[] | null = null;
  for (const score of scores) {
    const groups = getPairwiseGroups(score);
    if (!groups || groups.length !== 2) {
      throw new Error(
        "Score metadata must identify exactly two comparator groups (set metadata.groups = [groupA, groupB])."
      );
    }
    if (referenceGroups === null) {
      referenceGroups = groups;
    } else if (
      groups[0] !== referenceGroups[0] ||
      groups[1] !== referenceGroups[1]
    ) {
      throw new Error(
        `Scores must share the same comparator groups; saw [${referenceGroups.join(", ")}] and [${groups.join(", ")}].`
      );
    }
    total += 1;
    const targetGroup = groups[0];
    if (score.label === targetGroup) {
      wins += 1;
    } else if (score.label === "tie") {
      ties += 1;
    } else {
      losses += 1;
    }
  }
  if (total === 0 || referenceGroups === null) {
    throw new Error("winRate requires at least one score.");
  }
  return {
    group: referenceGroups[0],
    win_rate: (wins + ties * tieValue) / total,
    wins,
    losses,
    ties,
    n: total,
  };
}
