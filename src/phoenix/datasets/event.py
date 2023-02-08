from typing import NamedTuple


class EventId(NamedTuple):
    """Identifies an event."""

    row_id: int = 0
    dataset_id: int = 0

    def __str__(self) -> str:
        return ",".join(map(str, self))
