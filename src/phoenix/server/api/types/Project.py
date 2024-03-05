from datetime import datetime
from typing import Optional

import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context

from .node import Node


@strawberry.type
class Project(Node):
    name: str

    @strawberry.field
    def start_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        if (traces := info.context.traces) is None:
            return None
        start_time, _ = traces.right_open_time_range
        return start_time

    @strawberry.field
    def end_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        if (traces := info.context.traces) is None:
            return None
        _, end_time = traces.right_open_time_range
        return end_time

    @strawberry.field
    def record_count(
        self,
        info: Info[Context, None],
    ) -> int:
        if (traces := info.context.traces) is None:
            return 0
        return traces.span_count

    @strawberry.field
    def token_count_total(
        self,
        info: Info[Context, None],
    ) -> int:
        if (traces := info.context.traces) is None:
            return 0
        return traces.token_count_total

    @strawberry.field
    def latency_ms_p50(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if (traces := info.context.traces) is None:
            return None
        (latency,) = traces.root_span_latency_ms_quantiles(0.50)
        return latency

    @strawberry.field
    def latency_ms_p99(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if (traces := info.context.traces) is None:
            return None
        (latency,) = traces.root_span_latency_ms_quantiles(0.99)
        return latency
