from typing import List, Optional

import strawberry
from strawberry import ID, UNSET, Private

from phoenix.core.project import Project
from phoenix.server.api.types.Evaluation import TraceEvaluation
from phoenix.server.api.types.pagination import (
    Connection,
    ConnectionArgs,
    Cursor,
    connection_from_list,
)
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.trace.schemas import TraceID


@strawberry.type
class Trace:
    trace_id: ID
    project: Private[Project]

    @strawberry.field
    def spans(
        self,
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
    ) -> Connection[Span]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, Cursor) else None,
            last=last,
            before=before if isinstance(before, Cursor) else None,
        )
        spans = sorted(
            self.project.get_trace(TraceID(self.trace_id)),
            key=lambda span: span.start_time,
        )
        data = [to_gql_span(span, self.project) for span in spans]
        return connection_from_list(data=data, args=args)

    @strawberry.field(description="Evaluations associated with the trace")  # type: ignore
    def trace_evaluations(self) -> List[TraceEvaluation]:
        evaluations = self.project.get_evaluations_by_trace_id(TraceID(self.trace_id))
        return [TraceEvaluation.from_pb_evaluation(evaluation) for evaluation in evaluations]
