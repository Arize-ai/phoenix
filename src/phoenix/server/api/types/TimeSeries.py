from datetime import datetime
from typing import Any, Hashable, Iterable, List, Optional, Protocol, Tuple

import strawberry


@strawberry.type
class TimeSeriesDataPoint:
    """A data point in a time series"""

    """The timestamp of the data point"""
    timestamp: datetime

    """The value of the data point"""
    value: Optional[float]


@strawberry.interface
class TimeSeries:
    """A collection of data points over time"""

    data: List[TimeSeriesDataPoint]


class IndexableContainer(Protocol):
    def __getitem__(self, key: Hashable) -> Any:
        ...


class CanGetValue(Protocol):
    def get_value(self, container: IndexableContainer) -> float:
        ...


class HasTimestampedRows(Protocol):
    empty: bool

    def iterrows(self) -> Iterable[Tuple[datetime, IndexableContainer]]:
        ...


def to_gql_timeseries(df: HasTimestampedRows, extractor: CanGetValue) -> Optional[TimeSeries]:
    return (
        None
        if df.empty
        else TimeSeries(
            data=[
                TimeSeriesDataPoint(
                    timestamp=timestamp,
                    value=extractor.get_value(row),
                )
                for timestamp, row in df.iterrows()
            ]
        )
    )
