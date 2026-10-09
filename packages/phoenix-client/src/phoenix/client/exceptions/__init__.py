from typing import Any, Optional, Sequence, TypedDict

import httpx

__all__ = [
    "PhoenixException",
    "PhoenixAPIError",
    "InvalidSpanInfo",
    "DuplicateSpanInfo",
    "SpanCreationError",
]


class PhoenixException(Exception):
    pass


class PhoenixAPIError(httpx.HTTPStatusError):
    """An error response from the Phoenix API.

    Routes that return RFC 9457 problem details expose the full parsed body as ``problem``,
    including members this client doesn't know about yet: a stable ``code`` (for example
    ``already_exists`` or ``validation_error``, handle one you don't recognize by
    ``response.status_code``), a ``detail`` message not meant to be parsed, an optional
    ``reason`` for a finer condition under ``code`` (handle one you don't recognize by
    ``code``), per-field ``errors`` for a ``validation_error``, and recovery fields such as
    ``existing_id`` (``already_exists``), ``current_version_id`` (``version_mismatch``),
    ``binding_counts`` (``still_bound``), and ``dataset_evaluator_ids``
    (``incompatible_override``). ``problem`` is ``None`` for a response that isn't problem
    JSON shaped like this (a 401's plain-text challenge, an unhandled 500, a proxy's own
    error page); the response body is still on ``response``.
    """

    def __init__(
        self,
        message: str,
        *,
        request: httpx.Request,
        response: httpx.Response,
        problem: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message, request=request, response=response)
        self.problem = problem

    @property
    def code(self) -> Optional[str]:
        return None if self.problem is None else self.problem.get("code")

    @property
    def reason(self) -> Optional[str]:
        return None if self.problem is None else self.problem.get("reason")

    @property
    def existing_id(self) -> Optional[str]:
        return None if self.problem is None else self.problem.get("existing_id")


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
