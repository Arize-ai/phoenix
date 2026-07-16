"""Shared limits and ranking helpers for annotation metrics responses."""

from collections.abc import Iterable

MAX_ANNOTATION_LABEL_COUNT = 12


def get_top_annotation_labels(
    label_counts: Iterable[tuple[str, int]],
    limit: int = MAX_ANNOTATION_LABEL_COUNT,
) -> list[str]:
    """Return labels ordered by descending count with stable alphabetical ties."""
    return [
        label
        for label, _ in sorted(
            label_counts,
            key=lambda item: (-item[1], item[0]),
        )[:limit]
    ]


def get_bounded_annotation_labels(
    labels: Iterable[str],
    reference_label_counts: Iterable[tuple[str, int]],
    limit: int = MAX_ANNOTATION_LABEL_COUNT,
) -> list[str]:
    """Keep small label sets intact and rank large sets by their reference point."""
    unique_labels = sorted(set(labels))
    if len(unique_labels) <= limit:
        return unique_labels
    return get_top_annotation_labels(reference_label_counts, limit)
