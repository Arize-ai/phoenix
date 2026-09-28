from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Iterator, Optional, Union

import sqlalchemy as sa
import strawberry
from sqlalchemy.orm import QueryableAttribute
from sqlalchemy.sql.elements import SQLColumnExpression

from phoenix.datetime_utils import (
    FIXED_LENGTH_TIME_BIN_UNIT_SECONDS,
    TimeBinUnit,
    get_timestamp_range,
)
from phoenix.db.helpers import SupportedSQLDialect, date_trunc
from phoenix.server.api.exceptions import BadRequest

MAX_TIME_BIN_INTERVAL = 1000


@strawberry.enum
class TimeBinScale(Enum):
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


@strawberry.input
class TimeBinConfig:
    scale: TimeBinScale = strawberry.field(
        default=TimeBinScale.HOUR, description="The scale of time bins for aggregation."
    )
    utc_offset_minutes: int = strawberry.field(
        default=0, description="Offset in minutes from UTC for local time binning."
    )
    interval: int = strawberry.field(
        default=1,
        description=(
            "The width of each time bin as a whole number of scale units, from 1 to "
            f"{MAX_TIME_BIN_INTERVAL}. Values above 1 are supported for MINUTE, HOUR, DAY, "
            "and WEEK only. Multi-unit bins align to local clock boundaries after applying "
            "utcOffsetMinutes (for example, 5-minute bins start at :00, :05, and so on), "
            "and multi-week bins start on a Monday."
        ),
    )


@dataclass(frozen=True)
class TimeBucketSpec:
    """
    A validated time binning: bins `interval` units of `unit` wide, aligned in
    the frame shifted by `utc_offset_minutes`. Bucketing in SQL (`truncate`) and
    generating the bin starts (`timestamps`) share this spec so the two agree.
    """

    unit: TimeBinUnit = "hour"
    interval: int = 1
    utc_offset_minutes: int = 0

    @classmethod
    def from_config(cls, config: Optional[TimeBinConfig]) -> "TimeBucketSpec":
        """Resolve an optional `TimeBinConfig`, raising `BadRequest` if it is invalid."""
        if not isinstance(config, TimeBinConfig):
            return cls()
        interval = config.interval
        if not 1 <= interval <= MAX_TIME_BIN_INTERVAL:
            raise BadRequest(
                f"Time bin interval must be between 1 and {MAX_TIME_BIN_INTERVAL}, got {interval}"
            )
        unit: TimeBinUnit = config.scale.value
        if interval > 1 and unit not in FIXED_LENGTH_TIME_BIN_UNIT_SECONDS:
            raise BadRequest(f"Time bin interval must be 1 for the {config.scale.name} scale")
        return cls(
            unit=unit,
            interval=interval,
            utc_offset_minutes=config.utc_offset_minutes,
        )

    def truncate(
        self,
        dialect: SupportedSQLDialect,
        source: Union[QueryableAttribute[datetime], sa.ColumnElement[datetime]],
    ) -> SQLColumnExpression[datetime]:
        """A SQL expression for the start of the bin that contains `source`."""
        return date_trunc(dialect, self.unit, source, self.utc_offset_minutes, self.interval)

    def timestamps(self, start_time: datetime, end_time: datetime) -> Iterator[datetime]:
        """The starts of every bin from the one containing `start_time` up to `end_time`."""
        return get_timestamp_range(
            start_time=start_time,
            end_time=end_time,
            stride=self.unit,
            utc_offset_minutes=self.utc_offset_minutes,
            interval=self.interval,
        )
