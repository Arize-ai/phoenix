"""Ask that one session be evaluated now by one project evaluator."""

import strawberry
from fastapi import Request
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.EvaluationRequest import (
    EvaluationRequest,
    to_gql_evaluation_request,
)
from phoenix.server.api.types.Evaluator import ProjectEvaluator
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.online_eval.requests import (
    EvaluationRequestRejected,
    RequestRejection,
    SessionTarget,
    request_evaluation,
)

# Provenance stamped on requests this mutation records, beside the drain's "trigger".
_REQUESTED_BY = "user"

_REJECTION_MESSAGES: dict[RequestRejection, str] = {
    RequestRejection.CRITERIA_NOT_FOUND: "Project evaluator not found.",
    RequestRejection.CRITERIA_TARGET_MISMATCH: (
        "This evaluator does not evaluate sessions. Only an evaluator whose evaluation target "
        "is SESSION can be asked to evaluate a session."
    ),
    RequestRejection.SESSION_NOT_FOUND: "Session not found.",
    RequestRejection.PROJECT_MISMATCH: (
        "This session and this evaluator belong to different projects."
    ),
    RequestRejection.SESSION_CONTENT_INCOMPLETE: (
        "Some of this session's traces have been deleted, so it can no longer be evaluated."
    ),
    RequestRejection.SESSION_CONTENT_IDENTITY_MISSING: (
        "This session has not ingested any spans yet, so there is nothing to evaluate."
    ),
}

_NOT_FOUND_REJECTIONS = frozenset(
    (RequestRejection.CRITERIA_NOT_FOUND, RequestRejection.SESSION_NOT_FOUND)
)
_BAD_REQUEST_REJECTIONS = frozenset(
    (RequestRejection.CRITERIA_TARGET_MISMATCH, RequestRejection.PROJECT_MISMATCH)
)


@strawberry.input
class RequestProjectSessionEvaluationInput:
    project_session_id: GlobalID
    project_evaluator_id: GlobalID
    force: bool = strawberry.field(
        default=False,
        description=(
            "Ask for a fresh evaluation even when this session already has one from the same "
            "evaluator configuration. Without it, an existing result answers the request."
        ),
    )


@strawberry.type
class RequestProjectSessionEvaluationPayload:
    evaluation_request: EvaluationRequest
    query: Query


@strawberry.type
class ProjectSessionEvaluationMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Ask that this session be evaluated by this project evaluator. The evaluation runs "
            "asynchronously; the returned request reports how far it has got. Asking again "
            "while an earlier ask is outstanding updates the same request rather than "
            "creating a second one."
        ),
    )  # type: ignore
    async def request_project_session_evaluation(
        self,
        info: Info[Context, None],
        input: RequestProjectSessionEvaluationInput,
    ) -> RequestProjectSessionEvaluationPayload:
        try:
            project_session_rowid = from_global_id_with_expected_type(
                input.project_session_id, ProjectSession.__name__
            )
            project_evaluator_id = from_global_id_with_expected_type(
                input.project_evaluator_id, ProjectEvaluator.__name__
            )
        except ValueError as error:
            raise BadRequest(str(error))

        requested_by = _REQUESTED_BY
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            requested_by = f"{_REQUESTED_BY}:{int(user.identity)}"

        async with info.context.db() as session:
            try:
                await request_evaluation(
                    session,
                    SessionTarget(project_session_rowid=project_session_rowid),
                    project_evaluator_id,
                    requested_by=requested_by,
                    force=input.force,
                )
            except EvaluationRequestRejected as rejected:
                raise _rejection_error(rejected.rejection)

        record = await info.context.data_loaders.evaluation_requests.load(
            (project_session_rowid, project_evaluator_id),
        )
        if record is None:
            raise NotFound("The evaluation request could not be read back after being recorded.")
        return RequestProjectSessionEvaluationPayload(
            evaluation_request=to_gql_evaluation_request(record),
            query=Query(),
        )


def _rejection_error(rejection: RequestRejection) -> Exception:
    """Give each way an ask can be refused its own error, so callers can act on it."""
    message = _REJECTION_MESSAGES[rejection]
    if rejection in _NOT_FOUND_REJECTIONS:
        return NotFound(message)
    if rejection in _BAD_REQUEST_REJECTIONS:
        return BadRequest(message)
    return Conflict(message)

