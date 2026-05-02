import type { EvaluationResult } from "./types";

export type PairwiseWinRate = {
  group: string;
  rate: number;
  wins: number;
  losses: number;
  ties: number;
  n: number;
};

/**
 * Return the comparator groups declared in score metadata.
 *
 * A Score is considered pairwise iff it carries an explicit
 * `metadata.groups = [groupA, groupB]` array of strings. Hand-rolled Scores
 * must populate this key — there is no inference fallback. Locking the
 * contract avoids ambiguity if Score metadata is later loaded from a
 * serialization boundary (DB, user upload).
 */
function getPairwiseGroups(
  score: EvaluationResult
): [string, string] | null {
  const metadataGroups = score.metadata?.groups;
  if (
    Array.isArray(metadataGroups) &&
    metadataGroups.length === 2 &&
    typeof metadataGroups[0] === "string" &&
    typeof metadataGroups[1] === "string"
  ) {
    return [metadataGroups[0], metadataGroups[1]];
  }
  return null;
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
  let referenceGroups: [string, string] | null = null;
  for (const score of scores) {
    const groups = getPairwiseGroups(score);
    if (!groups) {
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
    rate: (wins + ties * tieValue) / total,
    wins,
    losses,
    ties,
    n: total,
  };
}
