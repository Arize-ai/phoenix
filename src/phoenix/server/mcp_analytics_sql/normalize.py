from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional


def normalize_row_values(values: list[Any]) -> list[Any]:
    return [_normalize_value(value) for value in values]


def _normalize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return value
    if isinstance(value, Decimal):
        f = float(value)
        return None if not math.isfinite(f) else f
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.loads(json.dumps(value, default=str))
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


# Timestamp literals in caller SQL.
#
# A timestamp column is `TIMESTAMP WITH TIME ZONE` on PostgreSQL and text on
# SQLite, written by `UtcTimeStamp` as UTC in `YYYY-MM-DD HH:MM:SS.ffffff` with
# the offset dropped. Two consequences follow for a literal compared against one.
#
# The offset is not optional information. A naive literal means "ask the
# environment", and three different environments answer: `normalize_datetime`
# localises a naive value to the writing process's zone, PostgreSQL reads a
# naive literal in the session `TimeZone`, and SQLite compares text against
# whatever those produced. None of them is the caller's stated intent.
#
# The spelling is not information at all. Once an instant is known, the layout
# it was written in carries nothing, which is why parsing is lenient: anything
# date-shaped that resolves to an instant is accepted, and the value is re-emitted
# in the form the target needs.
_DATE_SHAPED = re.compile(r"^\d{4}-\d{2}-\d{2}")
_COMPACT_OFFSET = re.compile(r"([+-]\d{2})(\d{2})$")
_BARE_OFFSET = re.compile(r"([+-]\d{2})$")


@dataclass(frozen=True)
class TimestampLiteral:
    value: datetime
    # Whether the caller wrote a time of day. A bare date names a day rather than
    # an instant, so it is treated differently from a naive time: `2026-07-01`
    # is a whole-day boundary that UTC resolves without guessing, while
    # `2026-07-01 14:30:00` names an instant the caller did not finish stating.
    has_time: bool

    @property
    def is_aware(self) -> bool:
        return self.value.tzinfo is not None


def parse_timestamp_literal(text: str) -> Optional[TimestampLiteral]:
    """Read a caller's timestamp literal, or None if it is not one.

    Deliberately lenient about form and strict about nothing except being
    date-shaped. `Z`, a bare `+00` and a compact `+0000` are all spellings
    `datetime.fromisoformat` rejects on this Python and that callers write
    anyway, so they are rewritten before parsing rather than refused.

    The date-shaped guard is what keeps this from engaging on strings that
    merely look numeric. A quoted integer is a plausible thing to compare a
    column against and must not be read as a unix epoch.
    """
    raw = text.strip()
    if not _DATE_SHAPED.match(raw):
        return None
    has_time = len(raw) > 10 and raw[10] in " Tt"
    candidate = raw
    # Only once a time is present, because a bare date ends in `-DD`, which the
    # offset patterns would otherwise read as an offset and corrupt.
    if has_time:
        if candidate[-1] in "Zz":
            candidate = candidate[:-1] + "+00:00"
        candidate = _COMPACT_OFFSET.sub(r"\1:\2", candidate)
        candidate = _BARE_OFFSET.sub(r"\1:00", candidate)
    try:
        value = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    return TimestampLiteral(value=value, has_time=has_time)


def format_timestamp_for_sqlite(value: datetime) -> str:
    """The layout `UtcTimeStamp` writes, which is the only one SQLite compares correctly.

    Storage is text and comparison is character by character, so a literal has
    to match the stored layout or the comparison is decided by the wrong
    characters. An ISO `T` differs from the stored space at index 10, and since
    `' ' < 'T'`, every row sharing the boundary's date sorts before an ISO-spelled
    boundary regardless of its clock time -- dropping a whole day from the low
    end of a window and admitting one at the high end.
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")


def timestamp_column_names(tables: frozenset[str]) -> frozenset[str]:
    """Names that hold a timestamp on the given tables.

    Matched by name rather than by resolving each reference back to its table,
    the way the hidden-column check matches. Sound here only because no
    allowlisted table gives one of these names to a column of another type,
    which a test pins so that a future migration cannot quietly break it.
    """
    from phoenix.db.models import Base

    names: set[str] = set()
    for table_name, table in Base.metadata.tables.items():
        if table_name not in tables:
            continue
        for column in table.columns:
            if "TIMESTAMP" in str(column.type).upper():
                names.add(column.name)
    return frozenset(names)
