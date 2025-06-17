from typing import Optional

import strawberry
from sqlalchemy import delete
from sqlalchemy.orm import joinedload
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.GenerativeModel import GenerativeModel, to_gql_generative_model
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CostPerTokenInput:
    token_type: str
    cost_per_token: float


@strawberry.input
class CreateModelMutationInput:
    name: str
    provider: Optional[str] = None
    name_pattern: str
    costs: list[CostPerTokenInput]


@strawberry.type
class CreateModelMutationPayload:
    model: GenerativeModel
    query: Query


@strawberry.input
class UpdateModelMutationInput:
    id: GlobalID
    name: str
    provider: Optional[str]
    name_pattern: str
    costs: list[CostPerTokenInput]


@strawberry.type
class UpdateModelMutationPayload:
    model: GenerativeModel
    query: Query


@strawberry.input
class DeleteModelMutationInput:
    id: GlobalID


@strawberry.type
class DeleteModelMutationPayload:
    model: GenerativeModel
    query: Query


@strawberry.type
class ModelMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def create_model(
        self,
        info: Info[Context, None],
        input: CreateModelMutationInput,
    ) -> CreateModelMutationPayload:
        cost_types = set(cost.token_type for cost in input.costs)
        if "input" not in cost_types:
            raise BadRequest("input cost is required")
        if "output" not in cost_types:
            raise BadRequest("output cost is required")
        costs = [
            models.ModelCost(
                token_type=cost.token_type,
                cost_per_token=cost.cost_per_token,
            )
            for cost in input.costs
        ]
        model = models.GenerativeModel(
            name=input.name,
            provider=input.provider,
            name_pattern=input.name_pattern,
            is_override=True,
            costs=costs,
        )
        async with info.context.db() as session:
            session.add(model)
            await session.commit()

        return CreateModelMutationPayload(
            model=to_gql_generative_model(model),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def update_model(
        self,
        info: Info[Context, None],
        input: UpdateModelMutationInput,
    ) -> UpdateModelMutationPayload:
        try:
            model_id = from_global_id_with_expected_type(input.id, GenerativeModel.__name__)
        except ValueError:
            raise BadRequest(f'Invalid model id: "{input.id}"')

        cost_types = set(cost.token_type for cost in input.costs)
        if "input" not in cost_types:
            raise BadRequest("input cost is required")
        if "output" not in cost_types:
            raise BadRequest("output cost is required")
        costs = [
            models.ModelCost(
                token_type=cost.token_type,
                cost_per_token=cost.cost_per_token,
            )
            for cost in input.costs
        ]
        async with info.context.db() as session:
            model = await session.get(
                models.GenerativeModel,
                model_id,
                options=[joinedload(models.GenerativeModel.costs)],
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
            model.costs = costs
            session.add(model)
            await session.flush()
            await session.refresh(model)

        return UpdateModelMutationPayload(
            model=to_gql_generative_model(model),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def delete_model(
        self,
        info: Info[Context, None],
        input: DeleteModelMutationInput,
    ) -> DeleteModelMutationPayload:
        try:
            model_id = from_global_id_with_expected_type(input.id, GenerativeModel.__name__)
        except ValueError:
            raise BadRequest(f'Invalid model id: "{input.id}"')

        async with info.context.db() as session:
            model = await session.scalar(
                delete(models.GenerativeModel)
                .where(models.GenerativeModel.id == model_id)
                .returning(models.GenerativeModel)
            )
            if model is None:
                raise NotFound(f'Model "{input.id}" not found')
            if not model.is_override:
                await session.rollback()
                raise BadRequest("Cannot delete default model")
        return DeleteModelMutationPayload(
            model=to_gql_generative_model(model),
            query=Query(),
        )
