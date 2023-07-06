from datetime import datetime, timedelta, timezone
from functools import cached_property
from typing import Any, Iterator, List, cast, overload

import pandas as pd

from phoenix.core.dataset_role import DatasetRole
from phoenix.core.event import Event
from phoenix.core.event_id import EventId
from phoenix.core.helpers import agg_min_max
from phoenix.core.model_data import Model, ModelData
from phoenix.core.singular_dimensional_role import TIMESTAMP
from phoenix.core.time_range import TimeRange
from phoenix.core.types import ColumnKey, RowId


class Events(ModelData):
    """pd.DataFrame wrapped with extra functions and metadata."""

    def __init__(
        self,
        df: pd.DataFrame,
        /,
        role: DatasetRole,
        **kwargs: Any,
    ) -> None:
        super().__init__(df, **kwargs)
        self._self_role = role

    @property
    def null_value(self) -> "pd.Series[Any]":
        return pd.Series(dtype=object)

    @cached_property
    def time_range(self) -> TimeRange:
        if self._self_model is None or self.empty:
            now = datetime.now(timezone.utc)
            return TimeRange(now, now)
        model = cast(Model, self._self_model)
        min_max = agg_min_max(model[TIMESTAMP](self))
        start_time = cast(datetime, min_max.min())
        end_time = cast(datetime, min_max.max())
        # Add one minute to end_time, because time intervals are right
        # open and one minute is the smallest interval allowed.
        stop_time = end_time + timedelta(minutes=1)
        # Round down to the nearest minute.
        start = _floor_to_minute(start_time)
        stop = _floor_to_minute(stop_time)
        return TimeRange(start, stop)

    def __iter__(self) -> Iterator[Event]:
        for i, event in self.iterrows():
            yield Event(
                event,
                event_id=EventId(i, self._self_role),
                _model=self._self_model,
            )

    @overload
    def __getitem__(self, key: ColumnKey) -> "pd.Series[Any]":
        ...

    @overload
    def __getitem__(self, key: List[RowId]) -> "Events":
        ...

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, list):
            return Events(
                self.loc[key],
                role=self._self_role,
                _model=self._self_model,
            )
        return super().__getitem__(key)


MINUTE_DATETIME_FORMAT = "%Y-%m-%dT%H:%M:00%z"


def _floor_to_minute(dt: datetime) -> datetime:
    """Floor datetime to the minute by taking a round-trip through string
    format because there isn't always an available function to strip the
    nanoseconds if present."""
    try:
        dt_as_string = dt.astimezone(
            timezone.utc,
        ).strftime(
            MINUTE_DATETIME_FORMAT,
        )
    except ValueError:
        # NOTE: as of Python 3.8.16, pandas 1.5.3:
        # >>> isinstance(pd.NaT, datetime.datetime)
        # True
        return cast(datetime, pd.NaT)
    return datetime.strptime(
        dt_as_string,
        MINUTE_DATETIME_FORMAT,
    ).astimezone(
        timezone.utc,
    )
