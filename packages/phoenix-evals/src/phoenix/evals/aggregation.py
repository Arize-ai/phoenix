from dataclasses import dataclass
from typing import Iterable, Optional

from .evaluators import Score


@dataclass(frozen=True)
class PairwiseWinRate:
    group: str
    win_rate: float
    wins: int
    losses: int
    ties: int
    n: int


_PAIRWISE_METADATA_KEYS = {
    "groups",
    "ordering",
    "seed",
    "passes",
    "tie_reason",
    "model",
    "trace_id",
}


def _pairwise_groups(score: Score) -> Optional[list[str]]:
    metadata_groups = score.metadata.get("groups")
    if isinstance(metadata_groups, list) and all(
        isinstance(group, str) for group in metadata_groups
    ):
        return metadata_groups
    comparators = [
        key
        for key in score.metadata
        if key not in _PAIRWISE_METADATA_KEYS
        and not isinstance(score.metadata.get(key), (dict, list))
    ]
    if len(comparators) == 2:
        return comparators
    return None


def win_rate(
    scores: Iterable[Score], group: str = "output", tie_value: float = 0.5
) -> PairwiseWinRate:
    """Return pairwise win-rate summary for a group.

    Ties contribute ``tie_value`` to the win rate.
    """
    total = 0
    wins = 0
    losses = 0
    ties = 0

    for score in scores:
        groups = _pairwise_groups(score)
        if groups is None or group not in groups:
            raise ValueError(
                f"Score does not identify group '{group}' as a pairwise comparator."
            )
        total += 1
        if score.label == group:
            wins += 1
        elif score.label == "tie":
            ties += 1
        else:
            losses += 1

    if total == 0:
        raise ValueError("win_rate requires at least one score.")

    return PairwiseWinRate(
        group=group,
        win_rate=(wins + ties * tie_value) / total,
        wins=wins,
        losses=losses,
        ties=ties,
        n=total,
    )
