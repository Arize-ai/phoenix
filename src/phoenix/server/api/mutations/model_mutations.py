from typing import Optional

import strawberry
from openinference.semconv.trace import OpenInferenceLLMProviderValues
from sqlalchemy import delete
from sqlalchemy.orm import joinedload
from strawberry.relay import GlobalID
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.Model import Model, to_gql_model
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateModelMutationInput:
    name: str
    provider: Optional[str] = None
    name_pattern: str
    input_cost_per_token: float
    output_cost_per_token: float
    cache_read_cost_per_token: Optional[float] = None
    cache_write_cost_per_token: Optional[float] = None
    prompt_audio_cost_per_token: Optional[float] = None
    completion_audio_cost_per_token: Optional[float] = None
    reasoning_cost_per_token: Optional[float] = None


@strawberry.type
class CreateModelMutationPayload:
    model: Model
    query: Query


@strawberry.input
class UpdateModelMutationInput:
    id: GlobalID
    name: str
    provider: Optional[str]
    name_pattern: str
    input_cost_per_token: float
    output_cost_per_token: float
    cache_read_cost_per_token: Optional[float] = None
    cache_write_cost_per_token: Optional[float] = None
    prompt_audio_cost_per_token: Optional[float] = None
    completion_audio_cost_per_token: Optional[float] = None
    reasoning_cost_per_token: Optional[float] = None


@strawberry.type
class UpdateModelMutationPayload:
    model: Model
    query: Query


@strawberry.input
class DeleteModelMutationInput:
    id: GlobalID


@strawberry.type
class DeleteModelMutationPayload:
    model: Model
    query: Query


@strawberry.type
class ModelMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def create_model(
        self,
        info: Info[Context, None],
        input: CreateModelMutationInput,
    ) -> CreateModelMutationPayload:
        async with info.context.db() as session:
            model = models.Model(
                name=input.name,
                provider=input.provider,
                name_pattern=input.name_pattern,
                is_override=True,
            )
            model.costs.append(
                models.ModelCost(
                    token_type="input",
                    cost_per_token=input.input_cost_per_token,
                )
            )
            model.costs.append(
                models.ModelCost(
                    token_type="output",
                    cost_per_token=input.output_cost_per_token,
                )
            )
            if input.cache_read_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        token_type="cache_read",
                        cost_per_token=input.cache_read_cost_per_token,
                    )
                )
            if input.cache_write_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        token_type="cache_write",
                        cost_per_token=input.cache_write_cost_per_token,
                    )
                )
            if input.prompt_audio_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        token_type="prompt_audio",
                        cost_per_token=input.prompt_audio_cost_per_token,
                    )
                )
            if input.completion_audio_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        token_type="completion_audio",
                        cost_per_token=input.completion_audio_cost_per_token,
                    )
                )
            if input.reasoning_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        token_type="reasoning",
                        cost_per_token=input.reasoning_cost_per_token,
                    )
                )

            session.add(model)
            await session.commit()

        return CreateModelMutationPayload(
            model=to_gql_model(model),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def update_model(
        self,
        info: Info[Context, None],
        input: UpdateModelMutationInput,
    ) -> UpdateModelMutationPayload:
        try:
            model_id = from_global_id_with_expected_type(input.id, Model.__name__)
        except ValueError:
            raise BadRequest(f'Invalid model id: "{input.id}"')

        async with info.context.db() as session:
            model = await session.get(
                models.Model,
                model_id,
                options=[joinedload(models.Model.costs)],
            )
            if model is None:
                raise NotFound(f'Model "{input.id}" not found')
            if not model.is_override:
                raise BadRequest("Cannot update default model")

            await session.execute(
                delete(models.ModelCost).where(models.ModelCost.model_id == model.id)
            )

            await session.refresh(model)

            model.name = input.name
            model.provider = input.provider
            model.name_pattern = input.name_pattern
            model.costs.append(
                models.ModelCost(
                    model_id=model.id,
                    token_type="input",
                    cost_per_token=input.input_cost_per_token,
                )
            )
            model.costs.append(
                models.ModelCost(
                    model_id=model.id,
                    token_type="output",
                    cost_per_token=input.output_cost_per_token,
                )
            )
            if input.cache_read_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        model_id=model.id,
                        token_type="cache_read",
                        cost_per_token=input.cache_read_cost_per_token,
                    )
                )
            if input.cache_write_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        model_id=model.id,
                        token_type="cache_write",
                        cost_per_token=input.cache_write_cost_per_token,
                    )
                )
            if input.prompt_audio_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        model_id=model.id,
                        token_type="prompt_audio",
                        cost_per_token=input.prompt_audio_cost_per_token,
                    )
                )
            if input.completion_audio_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        model_id=model.id,
                        token_type="completion_audio",
                        cost_per_token=input.completion_audio_cost_per_token,
                    )
                )
            if input.reasoning_cost_per_token is not None:
                model.costs.append(
                    models.ModelCost(
                        model_id=model.id,
                        token_type="reasoning",
                        cost_per_token=input.reasoning_cost_per_token,
                    )
                )
            session.add(model)
            await session.flush()
            await session.refresh(model)

        return UpdateModelMutationPayload(
            model=to_gql_model(model),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_model(
        self,
        info: Info[Context, None],
        input: DeleteModelMutationInput,
    ) -> DeleteModelMutationPayload:
        try:
            model_id = from_global_id_with_expected_type(input.id, Model.__name__)
        except ValueError:
            raise BadRequest(f'Invalid model id: "{input.id}"')

        async with info.context.db() as session:
            model = await session.scalar(
                delete(models.Model).where(models.Model.id == model_id).returning(models.Model)
            )
            if model is None:
                raise NotFound(f'Model "{input.id}" not found')
            if not model.is_override:
                await session.rollback()
                raise BadRequest("Cannot delete default model")
        return DeleteModelMutationPayload(
            model=to_gql_model(model),
            query=Query(),
        )


def _gql_to_semconv_provider(provider: GenerativeProviderKey) -> OpenInferenceLLMProviderValues:
    """
    Translates a GQL provider key to a semconv provider.
    """
    if provider == GenerativeProviderKey.OPENAI:
        return OpenInferenceLLMProviderValues.OPENAI
    elif provider == GenerativeProviderKey.ANTHROPIC:
        return OpenInferenceLLMProviderValues.ANTHROPIC
    elif provider == GenerativeProviderKey.AZURE_OPENAI:
        return OpenInferenceLLMProviderValues.AZURE
    elif provider == GenerativeProviderKey.GOOGLE:
        return OpenInferenceLLMProviderValues.GOOGLE
    elif provider == GenerativeProviderKey.DEEPSEEK:
        return OpenInferenceLLMProviderValues.DEEPSEEK
    elif provider == GenerativeProviderKey.XAI:
        return OpenInferenceLLMProviderValues.XAI
    elif provider == GenerativeProviderKey.OLLAMA:
        raise BadRequest("Model cost is not supported for Ollama since it is self-hosted")
    assert_never(provider)
