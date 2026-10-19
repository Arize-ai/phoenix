"""Permission-protected decision playground execution."""

from typing import Any, Optional

import strawberry
from pydantic import ValidationError
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_clients import DecisionRequest, get_decision_client
from phoenix.server.api.helpers.playground_project import get_or_create_playground_project_id
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.Span import Span
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.tracers import Tracer


@strawberry.input
class CreateDecisionInput:
    provider_key: GenerativeProviderKey
    model_name: str
    state: JSON
    questions: JSON
    base_url: Optional[str] = None
    credentials: Optional[list[GenerativeCredentialInput]] = None


@strawberry.type(
    description=(
        "Outcome of one decision run. Problems found before the provider is called "
        "(invalid questions, a provider the server does not permit, missing credentials) "
        "fail the mutation with a GraphQL error. Once the provider has been called, a "
        "failure is returned in `error` so the traced `span` is still available."
    )
)
class CreateDecisionPayload:
    result: Optional[JSON] = strawberry.field(
        default=None,
        description=(
            "The provider response with `answers` keyed by question name; null when `error` is set."
        ),
    )
    span: Optional[Span] = strawberry.field(
        default=None,
        description="The DECISION span recorded for the provider call, successful or not.",
    )
    error: Optional[str] = strawberry.field(
        default=None,
        description="Why the provider call failed; null on success.",
    )


@strawberry.type
class DecisionMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Run a decision model over `state` with named `questions` and record the "
            "call as a DECISION span in the playground project."
        ),
    )  # type: ignore
    async def create_decision(
        self, info: Info[Context, None], input: CreateDecisionInput
    ) -> CreateDecisionPayload:
        if (
            info.context.allowed_provider_names is not None
            and input.provider_key.name not in info.context.allowed_provider_names
        ):
            raise BadRequest("This decision provider is not permitted by the server configuration.")
        try:
            request = DecisionRequest.model_validate(
                {"state": input.state, "questions": input.questions}
            )
        except ValidationError as error:
            details = "; ".join(
                f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
                for item in error.errors(include_input=False)
            )
            raise BadRequest(details) from error
        async with info.context.db() as session:
            client = await get_decision_client(
                provider=input.provider_key,
                model_name=input.model_name,
                base_url=input.base_url,
                credentials=input.credentials,
                session=session,
                decrypt=info.context.decrypt,
            )
            project_id = await get_or_create_playground_project_id(session)
        tracer = Tracer(span_cost_calculator=info.context.span_cost_calculator)
        result: Any = None
        error_message: str | None = None
        try:
            result = await client.create(request=request, tracer=tracer)
        except BadRequest as error:
            error_message = str(error)
        traces = tracer.get_db_traces(project_id=project_id)
        async with info.context.db() as session:
            session.add_all(traces)
            await session.flush()
        info.context.event_queue.put(SpanInsertEvent(ids=(project_id,)))
        span = traces[0].spans[0] if traces and traces[0].spans else None
        return CreateDecisionPayload(
            result=result,
            error=error_message,
            span=Span(id=span.id, db_record=span) if span else None,
        )
