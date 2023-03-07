from dataclasses import dataclass
from typing import Set

from phoenix.datasets.dataset import DatasetType
from phoenix.datasets.event import EventId


@dataclass
class EmbeddingDimension:
    name: str


def calculate_drift_ratio(events: Set[EventId]) -> float:
    primary_point_count = 0
    reference_point_count = 0

    for event in events:
        if event.dataset_id == DatasetType.PRIMARY:
            primary_point_count += 1
        else:
            reference_point_count += 1

    return (primary_point_count - reference_point_count) / (
        primary_point_count + reference_point_count
    )
