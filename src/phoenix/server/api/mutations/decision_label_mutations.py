"""Manage decision labels and their associations with saved decisions."""

from typing import Optional

import strawberry
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Decision import Decision, DecisionLabel
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateDecisionLabelInput:
    name: str
    description: Optional[str] = None
    color: str


@strawberry.input
class PatchDecisionLabelInput:
    decision_label_id: GlobalID
    name: Optional[str] = None
    description: Optional[str] = None


@strawberry.input
class DeleteDecisionLabelsInput:
    decision_label_ids: list[GlobalID]


@strawberry.input
class SetDecisionLabelsInput:
    decision_id: GlobalID
    decision_label_ids: list[GlobalID]


@strawberry.input
class UnsetDecisionLabelsInput:
    decision_id: GlobalID
    decision_label_ids: list[GlobalID]


@strawberry.type
class DecisionLabelMutationPayload:
    decision_labels: list["DecisionLabel"]
    query: "Query"


@strawberry.type
class DecisionLabelDeleteMutationPayload:
    deleted_decision_label_ids: list["GlobalID"]
    query: "Query"


@strawberry.type
class DecisionLabelAssociationMutationPayload:
    query: "Query"


@strawberry.type
class DecisionLabelMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_decision_label(
        self, info: Info[Context, None], input: CreateDecisionLabelInput
    ) -> DecisionLabelMutationPayload:
        async with info.context.db() as session:
            label_orm = models.DecisionLabel(
                name=input.name, description=input.description, color=input.color
            )
            session.add(label_orm)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"A decision label named '{input.name}' already exists.")

            return DecisionLabelMutationPayload(
                decision_labels=[DecisionLabel(id=label_orm.id, db_record=label_orm)],
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_decision_label(
        self, info: Info[Context, None], input: PatchDecisionLabelInput
    ) -> DecisionLabelMutationPayload:
        async with info.context.db() as session:
            label_id = from_global_id_with_expected_type(
                input.decision_label_id, DecisionLabel.__name__
            )

            label_orm = await session.get(models.DecisionLabel, label_id)
            if not label_orm:
                raise NotFound(f"DecisionLabel with ID {input.decision_label_id} not found")

            if input.name is not None:
                label_orm.name = input.name
            if input.description is not None:
                label_orm.description = input.description

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("Error patching DecisionLabel. Possibly a name conflict?")

            return DecisionLabelMutationPayload(
                decision_labels=[DecisionLabel(id=label_orm.id, db_record=label_orm)],
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_decision_labels(
        self, info: Info[Context, None], input: DeleteDecisionLabelsInput
    ) -> DecisionLabelDeleteMutationPayload:
        """
        Deletes a DecisionLabel (and any crosswalk references).
        """
        async with info.context.db() as session:
            label_ids = [
                from_global_id_with_expected_type(decision_label_id, DecisionLabel.__name__)
                for decision_label_id in input.decision_label_ids
            ]
            stmt = delete(models.DecisionLabel).where(models.DecisionLabel.id.in_(label_ids))
            await session.execute(stmt)

            await session.commit()

            return DecisionLabelDeleteMutationPayload(
                deleted_decision_label_ids=input.decision_label_ids,
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def set_decision_labels(
        self, info: Info[Context, None], input: SetDecisionLabelsInput
    ) -> DecisionLabelAssociationMutationPayload:
        async with info.context.db() as session:
            decision_id = from_global_id_with_expected_type(input.decision_id, Decision.__name__)
            label_ids = [
                from_global_id_with_expected_type(decision_label_id, DecisionLabel.__name__)
                for decision_label_id in input.decision_label_ids
            ]

            crosswalk_items = [
                models.DecisionDecisionLabel(decision_id=decision_id, decision_label_id=label_id)
                for label_id in label_ids
            ]
            session.add_all(crosswalk_items)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
                # The error could be:
                # - Unique constraint violation => row already exists
                # - Foreign key violation => decision_id or label_id doesn't exist
                raise Conflict("Failed to associate DecisionLabel with Decision.") from e

            return DecisionLabelAssociationMutationPayload(
                query=Query(),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def unset_decision_labels(
        self, info: Info[Context, None], input: UnsetDecisionLabelsInput
    ) -> DecisionLabelAssociationMutationPayload:
        """
        Unsets a DecisionLabel from a Decision by removing the row in the crosswalk.
        """
        async with info.context.db() as session:
            decision_id = from_global_id_with_expected_type(input.decision_id, Decision.__name__)
            label_ids = [
                from_global_id_with_expected_type(decision_label_id, DecisionLabel.__name__)
                for decision_label_id in input.decision_label_ids
            ]

            stmt = delete(models.DecisionDecisionLabel).where(
                (models.DecisionDecisionLabel.decision_id == decision_id)
                & (models.DecisionDecisionLabel.decision_label_id.in_(label_ids))
            )
            result = await session.execute(stmt)

            if result.rowcount != len(label_ids):  # type: ignore[attr-defined]
                label_ids_str = ", ".join(str(i) for i in label_ids)
                raise NotFound(
                    f"No association between decision={decision_id} and labels={label_ids_str}."
                )

            await session.commit()

            return DecisionLabelAssociationMutationPayload(
                query=Query(),
            )
