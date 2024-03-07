from datetime import datetime
from itertools import chain
from typing import List, Optional

import strawberry
from strawberry import ID, UNSET
from strawberry.types import Info

from phoenix.core.project import Project as CoreProject
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.SpanSort import SpanSort
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.node import Node
from phoenix.server.api.types.pagination import (
    Connection,
    ConnectionArgs,
    Cursor,
    connection_from_list,
)
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.trace.dsl import SpanFilter
from phoenix.trace.schemas import TraceID


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

    @strawberry.field
    def spans(
        self,
        info: Info[Context, None],
        time_range: Optional[TimeRange] = UNSET,
        trace_ids: Optional[List[ID]] = UNSET,
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
        sort: Optional[SpanSort] = UNSET,
        root_spans_only: Optional[bool] = UNSET,
        filter_condition: Optional[str] = UNSET,
    ) -> Connection[Span]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, Cursor) else None,
            last=last,
            before=before if isinstance(before, Cursor) else None,
        )
        if (traces := info.context.traces) is None:
            return connection_from_list(data=[], args=args)
        evals = info.context.evals
        predicate = (
            SpanFilter(
                condition=filter_condition,
                evals=evals,
            )
            if filter_condition
            else None
        )
        if not trace_ids:
            spans = traces.get_spans(
                start_time=time_range.start if time_range else None,
                stop_time=time_range.end if time_range else None,
                root_spans_only=root_spans_only,
            )
        else:
            spans = chain.from_iterable(
                traces.get_trace(trace_id) for trace_id in map(TraceID, trace_ids)
            )
        if predicate:
            spans = filter(predicate, spans)
        if sort:
            spans = sort(spans, evals=evals)
        data = list(map(to_gql_span, spans))
        return connection_from_list(data=data, args=args)
