from typing import Optional, Sequence, TypedDict

__all__ = ["PhoenixException", "InvalidSpanInfo", "DuplicateSpanInfo", "SpanCreationError"]


class PhoenixException(Exception):
    pass


class InvalidSpanInfo(TypedDict):
    """Information about an invalid span."""

    span_id: str
    trace_id: str
    error: str


class DuplicateSpanInfo(TypedDict):
    """Information about a duplicate span."""

    span_id: str
    trace_id: str


class SpanCreationError(PhoenixException):
    """Raised when some spans fail to be queued for creation."""

    def __init__(
        self,
        message: str,
        invalid_spans: Optional[Sequence[InvalidSpanInfo]] = None,
        duplicate_spans: Optional[Sequence[DuplicateSpanInfo]] = None,
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
