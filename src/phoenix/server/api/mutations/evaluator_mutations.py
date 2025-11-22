from datetime import datetime, timezone
from secrets import token_hex
from typing import Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.models import EvaluatorKind
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.evaluators import (
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
from phoenix.server.api.mutations.annotation_config_mutations import (
    CategoricalAnnotationConfigInput,
    _to_pydantic_categorical_annotation_config,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Evaluator import (
    CodeEvaluator,
    Evaluator,
    LLMEvaluator,
)
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser


def _parse_evaluator_id(global_id: GlobalID) -> tuple[int, EvaluatorKind]:
    """
    Parse evaluator ID accepting both LLMEvaluator and CodeEvaluator types.

    Returns:
        tuple of (evaluator_rowid, evaluator_kind)
    """
    type_name, evaluator_rowid = from_global_id(global_id)
    if type_name not in (LLMEvaluator.__name__, CodeEvaluator.__name__):
        raise ValueError(
            f"Invalid evaluator type: {type_name}. "
            f"Expected {LLMEvaluator.__name__} or {CodeEvaluator.__name__}"
        )
    # Convert class name to EvaluatorKind literal
    evaluator_kind: EvaluatorKind = "LLM" if type_name == LLMEvaluator.__name__ else "CODE"
    return evaluator_rowid, evaluator_kind


@strawberry.input
class CreateLLMEvaluatorInput:
    dataset_id: Optional[GlobalID] = UNSET
    name: Identifier
    description: Optional[str] = UNSET
    prompt_version: ChatPromptVersionInput
    output_config: CategoricalAnnotationConfigInput


@strawberry.input
class CreateCodeEvaluatorInput:
    dataset_id: Optional[GlobalID] = UNSET
    name: Identifier
    description: Optional[str] = UNSET


@strawberry.input
class UpdateLLMEvaluatorInput:
    evaluator_id: GlobalID
    name: Identifier
    description: Optional[str] = None
    prompt_version: ChatPromptVersionInput
    output_config: CategoricalAnnotationConfigInput


@strawberry.type
class LLMEvaluatorMutationPayload:
    evaluator: LLMEvaluator
    query: Query


@strawberry.type
class CodeEvaluatorMutationPayload:
    evaluator: CodeEvaluator
    query: Query


@strawberry.type
class EvaluatorMutationPayload:
    """Payload that can handle both LLM and Code evaluators."""

    evaluator: Evaluator
    query: Query


@strawberry.input
class AssignEvaluatorToDatasetInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID


@strawberry.input
class UnassignEvaluatorFromDatasetInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID


@strawberry.input
class DeleteEvaluatorsInput:
    evaluator_ids: list[GlobalID]


@strawberry.type
class DeleteEvaluatorsPayload:
    evaluator_ids: list[GlobalID]
    query: Query


@strawberry.type
class EvaluatorMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_code_evaluator(
        self, info: Info[Context, None], input: CreateCodeEvaluatorInput
    ) -> CodeEvaluatorMutationPayload:
        dataset_id: Optional[int] = None
        if input.dataset_id is not UNSET and input.dataset_id is not None:
            dataset_id = from_global_id_with_expected_type(
                global_id=input.dataset_id, expected_type_name=Dataset.__name__
            )
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)
        try:
            evaluator_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")
        code_evaluator = models.CodeEvaluator(
            name=evaluator_name,
            description=input.description or None,
            kind="CODE",
            user_id=user_id,
            datasets_evaluators=[
                models.DatasetsEvaluators(
                    dataset_id=dataset_id,
                    input_config={},
                )
            ]
            # only add dataset relationship if dataset_id is provided
            if dataset_id is not None
            else [],
        )
        try:
            async with info.context.db() as session:
                session.add(code_evaluator)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise BadRequest(f"Dataset with id {dataset_id} not found")
            raise BadRequest(f"Evaluator with name {input.name} already exists")
        return CodeEvaluatorMutationPayload(
            evaluator=CodeEvaluator(id=code_evaluator.id, db_record=code_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_llm_evaluator(
        self, info: Info[Context, None], input: CreateLLMEvaluatorInput
    ) -> LLMEvaluatorMutationPayload:
        dataset_id: Optional[int] = None
        if input.dataset_id is not UNSET and input.dataset_id is not None:
            dataset_id = from_global_id_with_expected_type(
                global_id=input.dataset_id, expected_type_name=Dataset.__name__
            )
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)
        try:
            prompt_version = input.prompt_version.to_orm_prompt_version(user_id)
        except ValidationError as error:
            raise BadRequest(str(error))
        prompt_name = IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}")
        prompt = models.Prompt(
            name=prompt_name,
            description=input.description or None,
            prompt_versions=[prompt_version],
        )
        config = _to_pydantic_categorical_annotation_config(input.output_config)
        try:
            evaluator_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")
        llm_evaluator = models.LLMEvaluator(
            name=evaluator_name,
            description=input.description or None,
            kind="LLM",
            annotation_name=input.output_config.name,
            output_config=config,
            user_id=user_id,
            prompt=prompt,
            datasets_evaluators=[
                models.DatasetsEvaluators(
                    dataset_id=dataset_id,
                    input_config={},
                )
            ]
            # only add dataset relationship if dataset_id is provided
            if dataset_id is not None
            else [],
        )
        # manually update the updated_at field since updating the description or other fields
        # solely on the parent record Evaluator does not trigger an update of the updated_at
        # field on the LLMEvaluator record
        llm_evaluator.updated_at = datetime.now(timezone.utc)

        try:
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)
        except ValueError as error:
            raise BadRequest(str(error))
        try:
            async with info.context.db() as session:
                session.add(llm_evaluator)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise BadRequest(f"Dataset with id {dataset_id} not found")
            raise BadRequest(f"Evaluator with name {input.name} already exists")
        return LLMEvaluatorMutationPayload(
            evaluator=LLMEvaluator(id=llm_evaluator.id, db_record=llm_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_llm_evaluator(
        self, info: Info[Context, None], input: UpdateLLMEvaluatorInput
    ) -> LLMEvaluatorMutationPayload:
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        try:
            evaluator_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        output_config = _to_pydantic_categorical_annotation_config(input.output_config)

        try:
            prompt_version = input.prompt_version.to_orm_prompt_version(user_id)
        except ValidationError as error:
            raise BadRequest(str(error))

        try:
            evaluator_rowid = from_global_id_with_expected_type(
                global_id=input.evaluator_id,
                expected_type_name=LLMEvaluator.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid LLM evaluator id: {input.evaluator_id}")

        async with info.context.db() as session:
            llm_evaluator = await session.scalar(
                select(models.LLMEvaluator)
                .where(models.LLMEvaluator.id == evaluator_rowid)
                .options(
                    joinedload(models.LLMEvaluator.prompt).joinedload(models.Prompt.prompt_versions)
                )
            )
            if llm_evaluator is None:
                raise NotFound(f"LLM evaluator with id {input.evaluator_id} not found")

            llm_evaluator.name = evaluator_name
            llm_evaluator.description = (
                input.description if isinstance(input.description, str) else None
            )
            llm_evaluator.output_config = output_config
            llm_evaluator.annotation_name = input.output_config.name
            # manually update the updated_at field since updating the description or other fields
            # solely on the parent record Evaluator does not trigger an update of the updated_at
            # field on the LLMEvaluator record
            llm_evaluator.updated_at = datetime.now(timezone.utc)

            # todo: compare against active prompt version as determined by prompt tag or version
            # https://github.com/Arize-ai/phoenix/issues/10142
            active_prompt_version = llm_evaluator.prompt.prompt_versions[-1]
            create_new_prompt_version = not active_prompt_version.has_identical_content(
                prompt_version
            )
            if create_new_prompt_version:
                llm_evaluator.prompt.prompt_versions.append(prompt_version)

            try:
                validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)
            except ValueError as error:
                raise BadRequest(str(error))

            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("An evaluator with this name already exists")

        return LLMEvaluatorMutationPayload(
            evaluator=LLMEvaluator(id=llm_evaluator.id, db_record=llm_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_evaluators(
        self, info: Info[Context, None], input: DeleteEvaluatorsInput
    ) -> DeleteEvaluatorsPayload:
        evaluator_rowids: set[int] = set()
        for evaluator_gid in input.evaluator_ids:
            try:
                evaluator_rowid, _ = _parse_evaluator_id(evaluator_gid)
            except ValueError:
                raise BadRequest(f"Invalid evaluator id: {str(evaluator_gid)}")
            evaluator_rowids.add(evaluator_rowid)

        stmt = delete(models.Evaluator).where(models.Evaluator.id.in_(evaluator_rowids))
        async with info.context.db() as session:
            await session.execute(stmt)
        return DeleteEvaluatorsPayload(
            evaluator_ids=input.evaluator_ids,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def assign_evaluator_to_dataset(
        self, info: Info[Context, None], input: AssignEvaluatorToDatasetInput
    ) -> EvaluatorMutationPayload:
        try:
            dataset_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

        try:
            evaluator_rowid, evaluator_kind = _parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

        # Use upsert for idempotent assignment
        # Foreign key constraints will ensure dataset and evaluator exist
        try:
            async with info.context.db() as session:
                await session.execute(
                    insert_on_conflict(
                        {
                            "dataset_id": dataset_rowid,
                            "evaluator_id": evaluator_rowid,
                            "input_config": {},
                        },
                        dialect=info.context.db.dialect,
                        table=models.DatasetsEvaluators,
                        unique_by=("dataset_id", "evaluator_id"),
                        on_conflict=OnConflict.DO_UPDATE,
                        constraint_name="pk_datasets_evaluators",
                    )
                )
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            # Foreign key constraint violation
            if "foreign" in str(e).lower():
                raise NotFound(
                    f"Dataset with id {input.dataset_id} or "
                    f"evaluator with id {input.evaluator_id} not found"
                )
            raise

        # Return the appropriate evaluator type based on what was provided
        evaluator_instance: Evaluator
        if evaluator_kind == "LLM":
            evaluator_instance = LLMEvaluator(id=evaluator_rowid)
        elif evaluator_kind == "CODE":
            evaluator_instance = CodeEvaluator(id=evaluator_rowid)
        else:
            assert_never(evaluator_kind)

        return EvaluatorMutationPayload(
            evaluator=evaluator_instance,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def unassign_evaluator_from_dataset(
        self, info: Info[Context, None], input: UnassignEvaluatorFromDatasetInput
    ) -> EvaluatorMutationPayload:
        try:
            dataset_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

        try:
            evaluator_rowid, evaluator_kind = _parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

        stmt = delete(models.DatasetsEvaluators).where(
            models.DatasetsEvaluators.dataset_id == dataset_rowid,
            models.DatasetsEvaluators.evaluator_id == evaluator_rowid,
        )
        async with info.context.db() as session:
            await session.execute(stmt)

        # Return the appropriate evaluator type based on what was provided
        evaluator_instance: Evaluator
        if evaluator_kind == "LLM":
            evaluator_instance = LLMEvaluator(id=evaluator_rowid)
        elif evaluator_kind == "CODE":
            evaluator_instance = CodeEvaluator(id=evaluator_rowid)
        else:
            assert_never(evaluator_kind)

        return EvaluatorMutationPayload(
            evaluator=evaluator_instance,
            query=Query(),
        )
