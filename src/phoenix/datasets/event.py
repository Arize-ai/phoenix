from typing import NamedTuple

from .dataset import DatasetRole


class EventId(NamedTuple):
    """Identifies an event."""

    row_id: int = 0
    dataset_id: DatasetRole = DatasetRole.PRIMARY

    def __str__(self) -> str:
        return ":".join(map(str, self))
