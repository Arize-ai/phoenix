from typing import Optional

import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context

from .node import Node


@strawberry.type
class Project(Node):
    name: str

    @strawberry.field
    def latency_ms_p50(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if (traces := info.context.traces) is None:
            return None
        (latency_ms_p50,) = traces.root_span_latency_ms_quantiles(0.50)
        return latency_ms_p50
