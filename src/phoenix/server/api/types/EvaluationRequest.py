from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.dataloaders.evaluation_requests import (
    EvaluationRequestBlockingReason,
    EvaluationRequestFailureReason,
    EvaluationRequestState,
    SessionEvaluationRequest,
)

if TYPE_CHECKING:
    from .Evaluator import ProjectEvaluator
    from .ProjectSession import ProjectSession

strawberry.enum(
    EvaluationRequestState,
    description=(
        "Where a requested evaluation has reached. REQUESTED means it has been asked for but "
        "has not started, QUEUED means it is waiting to run or running, EVALUATED means it "
        "produced an annotation, and FAILED means it never will."
    ),
)
strawberry.enum(
    EvaluationRequestBlockingReason,
    description=(
        "Why a requested evaluation has not started yet. SESSION_FILTER_NOT_MATCHED means the "
        "session is outside the evaluator's own filter, so the ask waits for the session to come "
        "into scope rather than being declined."
    ),
)
strawberry.enum(
    EvaluationRequestFailureReason,
    description=(
        "Why a requested evaluation will never produce a result. EVALUATOR_CHANGED means the "
        "evaluator was edited while the evaluation was queued, so asking again works; "
        "EVALUATOR_ERROR means it ran and gave up; NO_EVALUATION_RECORDED means the ask was "
        "closed with no evaluation attached to it."
    ),
)


@strawberry.type(
    description=(
        "A standing ask that one session be evaluated by one project evaluator, and how far "
        "that ask has got. At most one exists per session and project evaluator: asking again "
        "while an earlier ask is outstanding updates the same request."
    )
)
class EvaluationRequest(Node):
    id: NodeID[int]
    project_session_rowid: strawberry.Private[int]
    project_evaluator_id: strawberry.Private[int]
    state: EvaluationRequestState
    failure_reason: Optional[EvaluationRequestFailureReason] = strawberry.field(
        description=(
            "Why this evaluation will never produce a result, or null when it still might. "
            "Always null outside the FAILED state."
        )
    )
    requested_at: datetime = strawberry.field(
        description="When this session was most recently asked to be evaluated."
    )

    @strawberry.field(  # type: ignore[untyped-decorator]
        description=(
            "Why the evaluation has not started, or null when nothing is holding it back. "
            "Always null outside the REQUESTED state."
        )
    )
    async def blocking_reason(
        self, info: Info[Context, None]
    ) -> Optional[EvaluationRequestBlockingReason]:
        if self.state is not EvaluationRequestState.REQUESTED:
            return None
        return await info.context.data_loaders.evaluation_request_blocking_reasons.load(
            (self.project_session_rowid, self.project_evaluator_id),
        )

    @strawberry.field
    def project_session(self) -> Annotated["ProjectSession", strawberry.lazy(".ProjectSession")]:
        from .ProjectSession import ProjectSession

        return ProjectSession(id=self.project_session_rowid)

    @strawberry.field
    def project_evaluator(self) -> Annotated["ProjectEvaluator", strawberry.lazy(".Evaluator")]:
        from .Evaluator import ProjectEvaluator

        return ProjectEvaluator(id=self.project_evaluator_id)


def to_gql_evaluation_request(record: SessionEvaluationRequest) -> EvaluationRequest:
    return EvaluationRequest(
        id=record.id,
        project_session_rowid=record.project_session_rowid,
        project_evaluator_id=record.project_evaluator_id,
        state=record.state,
        failure_reason=record.failure_reason,
        requested_at=record.requested_at,
    )
