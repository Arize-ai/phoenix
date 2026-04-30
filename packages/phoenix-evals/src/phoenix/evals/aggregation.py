from typing import Iterable

from .evaluators import Score


def win_rate(scores: Iterable[Score], group: str, tie_value: float = 0.5) -> float:
    """Return the fraction of pairwise comparisons won by a group.

    Ties contribute ``tie_value``. Raises when any score does not identify the
    requested group as one of its pairwise comparators.
    """
    total = 0
    wins = 0.0
    for score in scores:
        comparators = [
            key
            for key in score.metadata
            if key
            not in {
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
            }
        ]
        if group not in comparators:
            raise ValueError(
                f"Score does not identify group '{group}' as a pairwise comparator."
            )
        total += 1
        if score.label == group:
            wins += 1.0
        elif score.label == "tie":
            wins += tie_value
    if total == 0:
        raise ValueError("win_rate requires at least one score.")
    return wins / total
