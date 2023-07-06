from typing import NamedTuple

from phoenix.core.dataset_role import PRIMARY, DatasetRole


class EventId(NamedTuple):
    """Identifies a record (e.g. an prediction event)."""

    row_id: int = 0
    dataset_id: DatasetRole = PRIMARY

    def __str__(self) -> str:
        return ":".join(map(str, self))
