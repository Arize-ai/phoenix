"""Saving decisions: create, add versions, patch, delete, and tag versions, as for prompts."""

from typing import Optional

import strawberry
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import sdk_offers_decisions
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.input_types.DecisionVersionInput import DecisionVersionInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Decision import Decision, DecisionVersion, DecisionVersionTag
from phoenix.server.api.types.GenerativeProvider import (
    CONFIG_TYPE_TO_GENERATIVE_PROVIDER_KEY,
    GenerativeProviderKey,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateDecisionVersionTagInput:
    name: Identifier
    description: Optional[str] = None


@strawberry.input
class CreateDecisionInput:
    name: Identifier
    description: Optional[str] = None
    metadata: Optional[JSON] = None
    version: DecisionVersionInput
    tags: Optional[list[CreateDecisionVersionTagInput]] = None


@strawberry.input
class CreateDecisionVersionInput:
    decision_id: GlobalID
    version: DecisionVersionInput
    tags: Optional[list[CreateDecisionVersionTagInput]] = None


@strawberry.input
class PatchDecisionInput:
    decision_id: GlobalID
    description: Optional[str] = UNSET
    metadata: Optional[JSON] = UNSET


@strawberry.input
class DeleteDecisionInput:
    decision_id: GlobalID


@strawberry.input
class SetDecisionVersionTagInput:
    decision_version_id: GlobalID
    name: Identifier
    description: Optional[str] = None


@strawberry.input
class DeleteDecisionVersionTagInput:
    decision_version_tag_id: GlobalID


@strawberry.type
class DeleteDecisionMutationPayload:
    query: Query


@strawberry.type
class DecisionVersionTagMutationPayload:
    decision_version_tag: Optional[DecisionVersionTag]
    decision: Decision
    query: Query


def _user_id(info: Info[Context, None]) -> Optional[int]:
    return info.context.user_id


def _metadata(metadata: Optional[JSON]) -> dict[str, object]:
    if metadata is None:
        return {}
    if not isinstance(metadata, dict):
        raise BadRequest("metadata must be an object")
    return dict(metadata)


async def _validate_custom_provider(session: AsyncSession, version: models.DecisionVersion) -> None:
    """Reject a custom provider that is missing, serves no decision models, or speaks another
    API than the version's provider."""
    if (provider_id := version.custom_provider_id) is None:
        return
    provider = await session.get(models.GenerativeModelCustomProvider, provider_id)
    global_id = GlobalID("GenerativeModelCustomProvider", str(provider_id))
    if provider is None:
        raise NotFound(f"Custom provider not found: {global_id}")
    if not sdk_offers_decisions(provider.sdk):
        raise BadRequest(f"Custom provider '{provider.name}' does not serve decision models.")
    provider_key = CONFIG_TYPE_TO_GENERATIVE_PROVIDER_KEY[provider.sdk]
    version_key = GenerativeProviderKey.from_model_provider(version.model_provider)
    if provider_key is not version_key:
        raise BadRequest(
            f"Custom provider '{provider.name}' speaks the {provider_key.name} API, not "
            f"{version_key.name}."
        )


async def _upsert_tag(
    session: AsyncSession,
    *,
    decision_id: int,
    decision_version_id: int,
    name: Identifier,
    description: Optional[str],
    user_id: Optional[int],
) -> models.DecisionVersionTag:
    """Create the tag, or move it to the version if the decision already has it."""
    tag = await session.scalar(
        select(models.DecisionVersionTag).where(
            models.DecisionVersionTag.decision_id == decision_id,
            models.DecisionVersionTag.name == name,
        )
    )
    if tag is None:
        tag = models.DecisionVersionTag(
            name=name,
            description=description,
            decision_id=decision_id,
            decision_version_id=decision_version_id,
            user_id=user_id,
        )
        session.add(tag)
    else:
        tag.decision_version_id = decision_version_id
        if description is not None:
            tag.description = description
    await session.flush()
    return tag


async def _get_decision(session: AsyncSession, decision_id: GlobalID) -> models.Decision:
    row_id = from_global_id_with_expected_type(decision_id, Decision.__name__)
    decision = await session.get(models.Decision, row_id)
    if decision is None:
        raise NotFound(f"Decision not found: {decision_id}")
    return decision


@strawberry.type
class SavedDecisionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_decision(
        self, info: Info[Context, None], input: CreateDecisionInput
    ) -> Decision:
        user_id = _user_id(info)
        version = input.version.to_orm(user_id=user_id)
        decision = models.Decision(
            name=input.name,
            description=input.description,
            metadata_=_metadata(input.metadata),
            user_id=user_id,
            decision_versions=[version],
        )
        async with info.context.db() as session:
            await _validate_custom_provider(session, version)
            session.add(decision)
            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A decision named '{input.name}' already exists")
            for tag in input.tags or ():
                await _upsert_tag(
                    session,
                    decision_id=decision.id,
                    decision_version_id=version.id,
                    name=tag.name,
                    description=tag.description,
                    user_id=user_id,
                )
        return Decision(id=decision.id, db_record=decision)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_decision_version(
        self, info: Info[Context, None], input: CreateDecisionVersionInput
    ) -> Decision:
        user_id = _user_id(info)
        version = input.version.to_orm(user_id=user_id)
        async with info.context.db() as session:
            decision = await _get_decision(session, input.decision_id)
            await _validate_custom_provider(session, version)
            version.decision_id = decision.id
            session.add(version)
            await session.flush()
            for tag in input.tags or ():
                await _upsert_tag(
                    session,
                    decision_id=decision.id,
                    decision_version_id=version.id,
                    name=tag.name,
                    description=tag.description,
                    user_id=user_id,
                )
            await session.refresh(decision)
        return Decision(id=decision.id, db_record=decision)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_decision(
        self, info: Info[Context, None], input: PatchDecisionInput
    ) -> Decision:
        async with info.context.db() as session:
            decision = await _get_decision(session, input.decision_id)
            if input.description is not UNSET:
                decision.description = input.description
            if input.metadata is not UNSET:
                decision.metadata_ = _metadata(input.metadata)
            await session.flush()
            await session.refresh(decision)
        return Decision(id=decision.id, db_record=decision)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_decision(
        self, info: Info[Context, None], input: DeleteDecisionInput
    ) -> DeleteDecisionMutationPayload:
        row_id = from_global_id_with_expected_type(input.decision_id, Decision.__name__)
        async with info.context.db() as session:
            result = await session.execute(
                delete(models.Decision).where(models.Decision.id == row_id)
            )
            if result.rowcount == 0:  # type: ignore[attr-defined]
                raise NotFound(f"Decision not found: {input.decision_id}")
        return DeleteDecisionMutationPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def set_decision_version_tag(
        self, info: Info[Context, None], input: SetDecisionVersionTagInput
    ) -> DecisionVersionTagMutationPayload:
        version_id = from_global_id_with_expected_type(
            input.decision_version_id, DecisionVersion.__name__
        )
        async with info.context.db() as session:
            version = await session.get(models.DecisionVersion, version_id)
            if version is None:
                raise NotFound(f"Decision version not found: {input.decision_version_id}")
            tag = await _upsert_tag(
                session,
                decision_id=version.decision_id,
                decision_version_id=version.id,
                name=input.name,
                description=input.description,
                user_id=_user_id(info),
            )
            decision = await session.get(models.Decision, version.decision_id)
            assert decision is not None
        return DecisionVersionTagMutationPayload(
            decision_version_tag=DecisionVersionTag(id=tag.id, db_record=tag),
            decision=Decision(id=decision.id, db_record=decision),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_decision_version_tag(
        self, info: Info[Context, None], input: DeleteDecisionVersionTagInput
    ) -> DecisionVersionTagMutationPayload:
        tag_id = from_global_id_with_expected_type(
            input.decision_version_tag_id, DecisionVersionTag.__name__
        )
        async with info.context.db() as session:
            tag = await session.get(models.DecisionVersionTag, tag_id)
            if tag is None:
                raise NotFound(f"Decision version tag not found: {input.decision_version_tag_id}")
            decision = await session.get(models.Decision, tag.decision_id)
            assert decision is not None
            await session.delete(tag)
        return DecisionVersionTagMutationPayload(
            decision_version_tag=None,
            decision=Decision(id=decision.id, db_record=decision),
            query=Query(),
        )
