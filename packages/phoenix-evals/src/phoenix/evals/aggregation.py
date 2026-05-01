from dataclasses import dataclass
from typing import Iterable, Optional

from .evaluators import Score


@dataclass(frozen=True)
class PairwiseWinRate:
    group: str
    rate: float
    wins: int
    losses: int
    ties: int
    n: int


def _pairwise_groups(score: Score) -> Optional[list[str]]:
    """Return the comparator groups declared in score metadata.

    A Score is considered pairwise iff it carries an explicit
    ``metadata["groups"] = [group_a, group_b]`` list of strings. Hand-rolled
    Scores must populate this key — there is no inference fallback. Locking
    the contract avoids ambiguity if Score metadata is later loaded from a
    serialization boundary (DB, user upload).
    """
    metadata_groups = score.metadata.get("groups")
    if isinstance(metadata_groups, list) and all(
        isinstance(group, str) for group in metadata_groups
    ):
        return metadata_groups
    return None


def win_rate(scores: Iterable[Score], tie_value: float = 0.5) -> PairwiseWinRate:
    """Return pairwise win-rate summary for the first group in each Score's
    ``metadata["groups"]``.

    Win rate is always computed for ``groups[0]`` — the group that receives
    ``score=1.0`` when it wins. All scores must share the same comparator
    pair; mixing comparisons across different group pairs raises ``ValueError``.

    Ties contribute ``tie_value`` to the win rate.
    """
    total = 0
    wins = 0
    losses = 0
    ties = 0
    reference_groups: Optional[list[str]] = None

    for score in scores:
        groups = _pairwise_groups(score)
        if groups is None or len(groups) != 2:
            raise ValueError(
                "Score metadata must identify exactly two comparator groups "
                "(set metadata['groups'] = [group_a, group_b])."
            )
        if reference_groups is None:
            reference_groups = groups
        elif groups != reference_groups:
            raise ValueError(
                f"Scores must share the same comparator groups; saw "
                f"{reference_groups} and {groups}."
            )
        total += 1
        target_group = groups[0]
        if score.label == target_group:
            wins += 1
        elif score.label == "tie":
            ties += 1
        else:
            losses += 1

    if total == 0 or reference_groups is None:
        raise ValueError("win_rate requires at least one score.")

    return PairwiseWinRate(
        group=reference_groups[0],
        rate=(wins + ties * tie_value) / total,
        wins=wins,
        losses=losses,
        ties=ties,
        n=total,
    )
