from datetime import datetime
from typing import Optional

import strawberry

from phoenix.core.project import Project as CoreProject
from phoenix.server.api.types.node import Node


@strawberry.type
class Project(Node):
    name: str
    project: strawberry.Private[CoreProject]

    @strawberry.field
    def start_time(self) -> Optional[datetime]:
        start_time, _ = self.project.right_open_time_range
        return start_time

    @strawberry.field
    def end_time(self) -> Optional[datetime]:
        _, end_time = self.project.right_open_time_range
        return end_time

    @strawberry.field
    def record_count(self) -> int:
        return self.project.span_count

    @strawberry.field
    def token_count_total(self) -> int:
        return self.project.token_count_total

    @strawberry.field
    def latency_ms_p50(self) -> Optional[float]:
        return self.project.root_span_latency_ms_quantiles(0.50)

    @strawberry.field
    def latency_ms_p99(self) -> Optional[float]:
        return self.project.root_span_latency_ms_quantiles(0.99)
