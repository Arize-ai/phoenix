import re
from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
import strawberry
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.GenerativeModel import GenerativeModel
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
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
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
        # The database column is non-nullable and the empty string is how a
        # provider-agnostic model is represented, so normalize null the same way
        # `update_model` does.
        provider = input.provider or ""
        model = models.GenerativeModel(
            name=input.name,
            provider=provider,
            name_pattern=name_pattern,
            is_built_in=False,
            token_prices=token_prices,
            start_time=input.start_time,
        )
        async with info.context.db() as session:
            try:
                # The savepoint keeps the session usable after a rejected write, so the
                # conflict can be diagnosed without the happy path paying for a pre-check.
                async with session.begin_nested():
                    session.add(model)
                    await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise await _conflicting_model_error(
                    session,
                    name=input.name,
                    provider=provider,
                    name_pattern=name_pattern,
                )

        return CreateModelMutationPayload(
            model=GenerativeModel(id=model.id, db_record=model),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
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
            # Explicitly set updated_at so the GenerativeModelStore daemon picks up this
            # change (SQLAlchemy's onupdate may not trigger for relationship-only changes).
            model.updated_at = datetime.now(timezone.utc)
            session.add(model)
            try:
                async with session.begin_nested():
                    await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise await _conflicting_model_error(
                    session,
                    name=input.name,
                    provider=input.provider or "",
                    name_pattern=name_pattern,
                    exclude_model_id=model_id,
                )

        return UpdateModelMutationPayload(
            model=GenerativeModel(id=model.id, db_record=model),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
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
            model=GenerativeModel(id=model.id, db_record=model),
            query=Query(),
        )


async def _conflicting_model_error(
    session: AsyncSession,
    *,
    name: str,
    provider: str,
    name_pattern: re.Pattern[str],
    exclude_model_id: Optional[int] = None,
) -> Conflict:
    """
    Describe the constraint that a rejected write actually violated.

    Custom models are covered by two partial unique indexes over non-deleted rows:
    `(name, is_built_in)` and `(name_pattern, provider, is_built_in)`. The failure
    alone cannot tell them apart, because the backends describe it differently --
    PostgreSQL names the index, SQLite names the columns -- so this looks up the
    offending row rather than guessing, which is how an unrelated failure used to
    be reported as a name conflict.

    Only called once a write has been rejected, so the happy path does not pay for
    it. Autoflush is suppressed because the rejected changes are still pending in
    the session and would otherwise be retried by this query.
    """
    stmt = (
        sa.select(models.GenerativeModel.name)
        .where(models.GenerativeModel.deleted_at.is_(None))
        .where(models.GenerativeModel.is_built_in.is_(False))
        .where(
            sa.or_(
                models.GenerativeModel.name == name,
                sa.and_(
                    models.GenerativeModel.name_pattern == name_pattern,
                    models.GenerativeModel.provider == provider,
                ),
            )
        )
    )
    if exclude_model_id is not None:
        stmt = stmt.where(models.GenerativeModel.id != exclude_model_id)
    with session.no_autoflush:
        conflicting_names = list(await session.scalars(stmt))
    if name in conflicting_names:
        return Conflict(f"Model with name '{name}' already exists")
    if conflicting_names:
        described_provider = f"provider '{provider}'" if provider else "no provider"
        return Conflict(
            f"Model '{conflicting_names[0]}' already uses name pattern "
            f"'{name_pattern.pattern}' with {described_provider}"
        )
    # Some other constraint rejected the write, e.g. duplicate token prices.
    return Conflict(f"Model '{name}' conflicts with an existing model")


def _compile_regular_expression(maybe_regex: str) -> re.Pattern[str]:
    """
    Compile the given string as a regular expression.
    Raises a BadRequest error if the given string is not a valid regex.
    """
    try:
        return re.compile(maybe_regex)
    except re.error as error:
        raise BadRequest(f"Invalid regex: {str(error)}")
