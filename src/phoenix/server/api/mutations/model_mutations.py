import re
from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
import strawberry
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.GenerativeModel import GenerativeModel, to_gql_generative_model
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.TokenPrice import TokenKind


@strawberry.input
class TokenPriceInput:
    token_type: str
    cost_per_million_tokens: float
    kind: TokenKind

    @property
    def token_prices(self) -> models.TokenPrice:
        """Generate TokenPrice instances based on the input."""
        return models.TokenPrice(
            token_type=self.token_type,
            is_prompt=self.kind == TokenKind.PROMPT,
            base_rate=self.cost_per_million_tokens / 1_000_000,
        )


@strawberry.input
class CreateModelMutationInput:
    name: str
    provider: Optional[str] = None
    name_pattern: str
    costs: list[TokenPriceInput]
    start_time: Optional[datetime] = None


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
    costs: list[TokenPriceInput]
    start_time: Optional[datetime] = None


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
        name_pattern = _compile_regular_expression(input.name_pattern)
        token_prices = [cost.token_prices for cost in input.costs]
        model = models.GenerativeModel(
            name=input.name,
            provider=input.provider,
            name_pattern=name_pattern,
            is_built_in=False,
            token_prices=token_prices,
            start_time=input.start_time,
        )
        async with info.context.db() as session:
            session.add(model)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Model with name '{input.name}' already exists")

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
        name_pattern = _compile_regular_expression(input.name_pattern)
        token_prices = [cost.token_prices for cost in input.costs]
        async with info.context.db() as session:
            model = await session.scalar(
                sa.select(models.GenerativeModel)
                .where(models.GenerativeModel.deleted_at.is_(None))
                .where(models.GenerativeModel.id == model_id)
                .options(joinedload(models.GenerativeModel.token_prices))
            )
            if model is None:
                raise NotFound(f'Model "{input.id}" not found')
            if model.is_built_in:
                raise BadRequest("Cannot update built-in model")

            await session.execute(
                delete(models.TokenPrice).where(models.TokenPrice.model_id == model.id)
            )

            await session.refresh(model)

            model.name = input.name
            model.provider = input.provider or ""
            model.name_pattern = name_pattern
            model.token_prices = token_prices
            model.start_time = input.start_time
            session.add(model)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Model with name '{input.name}' already exists")
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
                sa.update(models.GenerativeModel)
                .values(deleted_at=datetime.now(timezone.utc))
                .where(models.GenerativeModel.deleted_at.is_(None))
                .where(models.GenerativeModel.id == model_id)
                .returning(models.GenerativeModel)
            )
            if model is None:
                raise NotFound(f'Model "{input.id}" not found')
            if model.is_built_in:
                await session.rollback()
                raise BadRequest("Cannot delete built-in model")
        return DeleteModelMutationPayload(
            model=to_gql_generative_model(model),
            query=Query(),
        )


def _compile_regular_expression(maybe_regex: str) -> re.Pattern[str]:
    """
    Compile the given string as a regular expression.
    Raises a BadRequest error if the given string is not a valid regex.
    """
    try:
        return re.compile(maybe_regex)
    except re.error as error:
        raise BadRequest(f"Invalid regex: {str(error)}")
