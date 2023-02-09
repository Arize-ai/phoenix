import strawberry

from .TimeSeries import TimeSeries


@strawberry.type
class DriftTimeSeries(TimeSeries):
    """A time series of drift metrics"""

    pass
