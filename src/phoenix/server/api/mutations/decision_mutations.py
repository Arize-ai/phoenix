"""Permission-protected decision playground execution."""

from typing import Optional

import strawberry
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_clients import (
    DecisionClient,
    DecisionRequest,
    get_custom_provider_decision_client,
    get_decision_client,
)
from phoenix.server.api.helpers.decision_versions import render_state, validate_inputs
from phoenix.server.api.helpers.playground_project import get_or_create_playground_project_id
from phoenix.server.api.input_types.DecisionVersionInput import (
    DecisionInputDefinitionInput,
    DecisionQuestionInput,
    DecisionStateInput,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.DecisionAnswer import DecisionResult, to_gql_decision_result
from phoenix.server.api.types.GenerativeModelCustomProvider import GenerativeModelCustomProvider
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.tracers import Tracer


@strawberry.input(description="A built-in provider, reached with its own or given credentials.")
class BuiltInDecisionConnectionInput:
    provider_key: GenerativeProviderKey = strawberry.field(
        description=(
            "The provider whose decision API runs the request; it must offer decision models."
        )
    )
    base_url: Optional[str] = strawberry.field(
        default=None,
        description=(
            "Send the request to this endpoint instead of the provider default. Requires an "
            "API key in `credentials` or a stored secret; the server-configured key is never "
            "sent to a custom URL."
        ),
    )
    credentials: Optional[list[GenerativeCredentialInput]] = strawberry.field(
        default=None,
        description=(
            "API keys for this request only, by environment variable name. When omitted, a "
            "stored secret is used, then the server environment."
        ),
    )


@strawberry.input(
    description=(
        "A custom provider, reached with its stored key, endpoint, and headers. Its SDK must "
        "serve decision models: `openai` runs OpenAI's Decisions API, `typesafe` runs System "
        "One."
    )
)
class CustomProviderDecisionConnectionInput:
    id: GlobalID = strawberry.field(description="The custom provider's ID.")


@strawberry.input(one_of=True, description="Where a decision runs.")
class DecisionConnectionInput:
    built_in: Optional[BuiltInDecisionConnectionInput] = UNSET
    custom_provider: Optional[CustomProviderDecisionConnectionInput] = UNSET


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
        return DecisionRequest(
            state=render_state(inputs, state, input.input_values),
            questions=[question.to_orm() for question in input.questions],
        )
    except ValidationError as error:
        raise BadRequest(format_validation_error(error)) from error
    except ValueError as error:
        raise BadRequest(str(error)) from error


_VALUE_ERROR_PREFIX = "Value error, "


def format_validation_error(error: ValidationError) -> str:
    """Pydantic's report as one readable line.

    Union branch tags (the question ``type`` discriminator, the ``state`` alternatives) are
    dropped from paths since callers never wrote them, custom-validator messages lose the
    ``Value error,`` boilerplate, and duplicate lines collapse.
    """
    messages: list[str] = []
    for item in error.errors(include_input=False):
        location = [str(part) for part in item["loc"]]
        if location and location[0] == "state":
            location = ["state"]
        elif len(location) >= 3 and location[0] == "questions":
            location = location[:2] + location[3:]
        message = str(item["msg"])
        if message.startswith(_VALUE_ERROR_PREFIX):
            message = message[len(_VALUE_ERROR_PREFIX) :]
        path = ".".join(location)
        line = f"{path}: {message}" if path else message
        if line not in messages:
            messages.append(line)
    return "; ".join(messages)


async def resolve_decision_client(
    info: Info[Context, None], input: RunDecisionInput, session: AsyncSession
) -> DecisionClient:
    """The client for the run's connection: a built-in provider or a custom provider."""
    connection = input.connection
    if connection.custom_provider:
        try:
            custom_provider_id = from_global_id_with_expected_type(
                connection.custom_provider.id, GenerativeModelCustomProvider.__name__
            )
        except ValueError as error:
            raise BadRequest(
                f"Invalid custom provider ID: {connection.custom_provider.id}"
            ) from error
        return await get_custom_provider_decision_client(
            custom_provider_id=custom_provider_id,
            model_name=input.model_name,
            session=session,
            decrypt=info.context.decrypt,
        )
    built_in = connection.built_in
    if not built_in:
        raise BadRequest("A connection is required: builtIn or customProvider.")
    if (
        info.context.allowed_provider_names is not None
        and built_in.provider_key.name not in info.context.allowed_provider_names
    ):
        raise BadRequest("This decision provider is not permitted by the server configuration.")
    return await get_decision_client(
        provider=built_in.provider_key,
        model_name=input.model_name,
        base_url=built_in.base_url,
        credentials=built_in.credentials,
        session=session,
        decrypt=info.context.decrypt,
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
    async def run_decision(
        self, info: Info[Context, None], input: RunDecisionInput
    ) -> RunDecisionPayload:
        request = to_decision_request(input)
        async with info.context.db() as session:
            client = await resolve_decision_client(info, input, session)
            project_id = await get_or_create_playground_project_id(session)
        tracer = Tracer(span_cost_calculator=info.context.span_cost_calculator)
        result: DecisionResult | None = None
        error_message: str | None = None
        try:
            response = await client.create(request=request, tracer=tracer)
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
