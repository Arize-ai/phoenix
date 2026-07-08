from collections import Counter, defaultdict
from typing import Any, Iterable, Mapping, Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import Span
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import EXCEPTION_TYPE

TraceRowId: TypeAlias = int
ExceptionType: TypeAlias = Optional[str]

Key: TypeAlias = TraceRowId
Result: TypeAlias = list[tuple[ExceptionType, int]]

_ERROR_STATUS = "ERROR"
_EXCEPTION_EVENT_NAME = "exception"


class TraceErrorsByTypeDataLoader(DataLoader[Key, Result]):
    """Aggregates errored-span exception types per trace.

    For every span in the trace with ``status_code == 'ERROR'``:

    - Each ``exception`` event on the span contributes a count for its
      ``exception.type`` attribute. Multiple exception events on the same
      span each count.
    - Errored spans that carry no ``exception`` event contribute a single
      count to the ``None`` bucket (OTel permits ``ERROR`` without an
      accompanying exception event).

    Results are returned sorted by count descending, then exception type
    ascending (``None`` sorts first), so snapshot tests are deterministic.

    The JSON walk is done in Python rather than SQL to stay
    dialect-agnostic (Postgres ``jsonb`` vs SQLite ``JSON``); error volumes
    per trace are typically small. If this becomes hot we can push the
    extraction into dialect-specific SQL later.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        keys = list(keys)
        stmt = (
            select(Span.trace_rowid, Span.events)
            .where(Span.trace_rowid.in_(keys))
            .where(Span.status_code == _ERROR_STATUS)
        )
        counters: dict[Key, Counter[ExceptionType]] = defaultdict(Counter)
        async with self._db.read() as session:
            async for trace_rowid, events in await session.stream(stmt):
                counters[trace_rowid].update(_exception_types_from_events(events))
        return [_sorted_counts(counters[key]) for key in keys]


def _exception_types_from_events(events: Any) -> list[ExceptionType]:
    """Extract one ``exception.type`` entry per ``exception`` event.

    If the span has no exception events at all, return ``[None]`` so the
    errored span still contributes to the null bucket.
    """
    types: list[ExceptionType] = []
    if isinstance(events, list):
        for event in events:
            if not isinstance(event, Mapping):
                continue
            if event.get("name") != _EXCEPTION_EVENT_NAME:
                continue
            attributes = event.get("attributes") or {}
            exc_type = attributes.get(EXCEPTION_TYPE) if isinstance(attributes, Mapping) else None
            types.append(exc_type if isinstance(exc_type, str) and exc_type else None)
    if not types:
        return [None]
    return types


def _sorted_counts(counter: Counter[ExceptionType]) -> list[tuple[ExceptionType, int]]:
    # Sort by count desc, then exception type asc. ``None`` sorts before any string.
    return sorted(
        counter.items(),
        key=lambda row: (-row[1], row[0] is not None, row[0] or ""),
    )
