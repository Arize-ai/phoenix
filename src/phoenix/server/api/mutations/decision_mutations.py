"""Permission-protected decision playground execution."""

from typing import Optional

import strawberry
from opentelemetry.context import Context as OtelContext
from strawberry.relay import GlobalID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.decision_clients import (
    DecisionClient,
    DecisionRequest,
    get_custom_provider_decision_client,
    get_decision_client,
)
from phoenix.server.api.helpers.decision_versions import (
    render_state,
    validate_inputs,
    validate_questions,
)
from phoenix.server.api.helpers.playground_project import get_or_create_playground_project_id
from phoenix.server.api.input_types.DecisionConnectionInput import (
    DecisionConnectionInput,
)
from phoenix.server.api.input_types.DecisionVersionInput import (
    DecisionInputDefinitionInput,
    DecisionQuestionInput,
    DecisionStateInput,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.DecisionAnswer import DecisionResult, to_gql_decision_result
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.tracers import Tracer


@strawberry.input(
    description=(
        "A decision run: where it runs, the inputs it declares and their values for this "
        "call, how the state is built from them, and the questions."
    )
)
class RunDecisionInput:
    connection: DecisionConnectionInput
    model_name: str = strawberry.field(
        description=(
            "The decision model to run. Any name the endpoint accepts works; the catalog "
            "only suggests names."
        )
    )
    inputs: list[DecisionInputDefinitionInput] = strawberry.field(
        description="The named inputs a caller passes, in order. Names must be unique."
    )
    state: DecisionStateInput = strawberry.field(
        description="How the state sent to the model is built from the inputs."
    )
    input_values: JSON = strawberry.field(
        description=(
            "An object with one entry per declared input: the key is the input's name, and "
            "the value is any JSON (a string, number, boolean, null, object, or array). "
            "Missing or undeclared names are rejected."
        )
    )
    questions: list[DecisionQuestionInput] = strawberry.field(
        description="The questions, in order. Names must be unique; answers come back under them."
    )


@strawberry.input(
    description=(
        "A run of a saved decision version: its definition, model, and provider as saved, "
        "with this call's input values."
    )
)
class RunDecisionVersionInput:
    decision_version_id: GlobalID
    input_values: JSON = strawberry.field(
        description=(
            "An object with one entry per input the version declares, keyed by name. "
            "Missing or undeclared names are rejected."
        )
    )
    credentials: Optional[list[GenerativeCredentialInput]] = strawberry.field(
        default=None,
        description=(
            "API keys for this request only, for a version on a built-in provider. When "
            "omitted, a stored secret is used, then the server environment. A custom "
            "provider brings its own key."
        ),
    )
    base_url: Optional[str] = strawberry.field(
        default=None,
        description=(
            "Send the request to this endpoint instead of the built-in provider's default, "
            "such as a local Ollama. Requires an API key in `credentials` or a stored secret "
            "where the provider needs one; the server-configured key is never sent to a "
            "custom URL. A custom provider brings its own endpoint."
        ),
    )


@strawberry.type(
    description=(
        "Outcome of one decision run. Problems found before the provider is called fail "
        "the mutation with a GraphQL error."
    )
)
class RunDecisionPayload:
    result: Optional[DecisionResult] = strawberry.field(
        default=None,
        description=(
            "The answers, resolved model, and usage; null when `error` is set. The provider's "
            "own response is on the span."
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


def to_decision_request(input: RunDecisionInput) -> DecisionRequest:
    """Validate the typed input, render its state, and build a provider-independent request.

    Raises:
        BadRequest: The inputs, state, or questions break a write-time rule, or the input
            values don't match the declared inputs.
    """
    if not isinstance(input.input_values, dict):
        raise BadRequest("inputValues must be an object keyed by input name")
    try:
        inputs = [definition.to_orm() for definition in input.inputs]
        state = input.state.to_orm()
        validate_inputs(inputs, state)
        questions = [question.to_orm() for question in input.questions]
        validate_questions(questions)
        return DecisionRequest(
            state=render_state(inputs, state, input.input_values),
            questions=questions,
        )
    except ValueError as error:
        raise BadRequest(str(error)) from error


def version_decision_request(
    version: models.DecisionVersion, input_values: JSON
) -> DecisionRequest:
    """The request for a saved version, which passed the write-time rules when saved.

    Raises:
        BadRequest: The input values don't match the version's declared inputs.
    """
    if not isinstance(input_values, dict):
        raise BadRequest("inputValues must be an object keyed by input name")
    try:
        return DecisionRequest(
            state=render_state(version.inputs, version.state, input_values),
            questions=version.questions,
        )
    except ValueError as error:
        raise BadRequest(str(error)) from error


@strawberry.type
class DecisionMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Run a decision model over `state` with named `questions` and record the "
            "call as a DECISION span in the playground project."
        ),
    )  # type: ignore
    async def run_decision(
        self, info: Info[Context, None], input: RunDecisionInput
    ) -> RunDecisionPayload:
        request = to_decision_request(input)
        async with info.context.db() as session:
            client = await input.connection.resolve_client(
                model_name=input.model_name,
                session=session,
                decrypt=info.context.decrypt,
                allowed_provider_names=info.context.allowed_provider_names,
            )
            project_id = await get_or_create_playground_project_id(session)
        return await _run(info, client=client, request=request, project_id=project_id)

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Run a saved decision version as saved, with this call's input values, and "
            "record the call as a DECISION span in the playground project."
        ),
    )  # type: ignore
    async def run_decision_version(
        self, info: Info[Context, None], input: RunDecisionVersionInput
    ) -> RunDecisionPayload:
        version_id = from_global_id_with_expected_type(input.decision_version_id, "DecisionVersion")
        async with info.context.db() as session:
            version = await session.get(models.DecisionVersion, version_id)
            if version is None:
                raise NotFound(f"Decision version not found: {input.decision_version_id}")
            request = version_decision_request(version, input.input_values)
            if version.custom_provider_id is not None:
                if input.base_url is not None:
                    raise BadRequest(
                        "This version runs on a custom provider, which brings its own endpoint; "
                        "baseUrl is for built-in providers."
                    )
                client = await get_custom_provider_decision_client(
                    custom_provider_id=version.custom_provider_id,
                    model_name=version.model_name,
                    session=session,
                    decrypt=info.context.decrypt,
                )
            else:
                client = await get_decision_client(
                    provider=GenerativeProviderKey.from_model_provider(version.model_provider),
                    model_name=version.model_name,
                    base_url=input.base_url,
                    credentials=input.credentials,
                    session=session,
                    decrypt=info.context.decrypt,
                    allowed_provider_names=info.context.allowed_provider_names,
                )
            project_id = await get_or_create_playground_project_id(session)
        return await _run(info, client=client, request=request, project_id=project_id)


async def _run(
    info: Info[Context, None],
    *,
    client: DecisionClient,
    request: DecisionRequest,
    project_id: int,
) -> RunDecisionPayload:
    """Call the provider and record the call as a span, whether it succeeds or not."""
    tracer = Tracer(span_cost_calculator=info.context.span_cost_calculator)
    result: DecisionResult | None = None
    error_message: str | None = None
    try:
        response = await client.create(request=request, tracer=tracer, otel_context=OtelContext())
        result = to_gql_decision_result(request, response)
    except BadRequest as error:
        error_message = str(error)
    traces = tracer.get_db_traces(project_id=project_id)
    async with info.context.db() as session:
        session.add_all(traces)
        await session.flush()
    info.context.event_queue.put(SpanInsertEvent(ids=(project_id,)))
    span = traces[0].spans[0] if traces and traces[0].spans else None
    return RunDecisionPayload(
        result=result,
        error=error_message,
        span=Span(id=span.id, db_record=span) if span else None,
    )
