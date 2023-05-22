from dataclasses import dataclass
from typing import Set

import numpy as np

from phoenix.datasets.dataset import DatasetRole
from phoenix.datasets.event import EventId


@dataclass
class EmbeddingDimension:
    name: str


def calculate_drift_ratio(events: Set[EventId]) -> float:
    """
    Calculates the drift score of the cluster. The score will be a value
    representing the balance of points between the primary and the reference
    datasets, and will be on a scale between 1 (all primary) and -1 (all
    reference), with 0 being an even balance between the two datasets.

    Returns
    -------
    drift_ratio : float

    """
    if not events:
        return np.nan

    primary_point_count = 0
    reference_point_count = 0

    for event in events:
        if event.dataset_id == DatasetRole.PRIMARY:
            primary_point_count += 1
        else:
            reference_point_count += 1

    return (primary_point_count - reference_point_count) / (
        primary_point_count + reference_point_count
    )
