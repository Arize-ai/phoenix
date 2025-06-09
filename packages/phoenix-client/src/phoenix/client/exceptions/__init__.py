from typing import Optional, Sequence

from phoenix.client.__generated__ import v1


class SpanCreationError(Exception):
    """Raised when some spans fail to be queued for creation."""

    def __init__(
        self,
        message: str,
        invalid_spans: Optional[Sequence[v1.InvalidSpanInfo]] = None,
        duplicate_spans: Optional[Sequence[v1.DuplicateSpanInfo]] = None,
        total_received: int = 0,
        total_queued: int = 0,
        total_invalid: int = 0,
        total_duplicates: int = 0,
    ):
        super().__init__(message)
        self.invalid_spans = invalid_spans or []
        self.duplicate_spans = duplicate_spans or []
        self.total_received = total_received
        self.total_queued = total_queued
        self.total_invalid = total_invalid
        self.total_duplicates = total_duplicates
