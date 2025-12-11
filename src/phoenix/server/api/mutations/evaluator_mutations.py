from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.models import EvaluatorKind
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import get_builtin_evaluator_by_id, get_builtin_evaluator_ids
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.evaluators import (
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
from phoenix.server.api.mutations.annotation_config_mutations import (
    CategoricalAnnotationConfigInput,
    _to_pydantic_categorical_annotation_config,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Evaluator import (
    BuiltInEvaluator,
    CodeEvaluator,
    DatasetEvaluator,
    LLMEvaluator,
)
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser


def _parse_evaluator_id(global_id: GlobalID) -> tuple[int, EvaluatorKind]:
    """
    Parse evaluator ID accepting LLMEvaluator, CodeEvaluator and BuiltInEvaluator types.

    Returns:
        tuple of (evaluator_rowid, evaluator_kind)
    """
    type_name, evaluator_rowid = from_global_id(global_id)
    evaluator_types: dict[str, EvaluatorKind] = {
        LLMEvaluator.__name__: "LLM",
        CodeEvaluator.__name__: "CODE",
        BuiltInEvaluator.__name__: "CODE",
    }
    if type_name not in evaluator_types:
        raise ValueError(
            f"Invalid evaluator type: {type_name}. "
            f"Expected one of {', '.join(evaluator_types.keys())}"
        )
    return evaluator_rowid, evaluator_types[type_name]


@strawberry.input
class CreateDatasetLLMEvaluatorInput:
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET
    prompt_version: ChatPromptVersionInput
    output_config: CategoricalAnnotationConfigInput
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.input
class CreateCodeEvaluatorInput:
    dataset_id: Optional[GlobalID] = UNSET
    name: Identifier
    description: Optional[str] = UNSET


@strawberry.input
class UpdateDatasetLLMEvaluatorInput:
    dataset_evaluator_id: GlobalID
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = None
    prompt_version: ChatPromptVersionInput
    output_config: CategoricalAnnotationConfigInput
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.type
class DatasetEvaluatorMutationPayload:
    evaluator: DatasetEvaluator
    query: Query


@strawberry.type
class CodeEvaluatorMutationPayload:
    evaluator: CodeEvaluator
    query: Query


@strawberry.input
class AssignEvaluatorToDatasetInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    display_name: Optional[Identifier] = None
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.input
class UnassignEvaluatorFromDatasetInput:
    dataset_id: GlobalID
    dataset_evaluator_id: GlobalID


@strawberry.input
class CreateDatasetBuiltinEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    display_name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.input
class UpdateDatasetBuiltinEvaluatorInput:
    dataset_evaluator_id: GlobalID
    display_name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None


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
            dataset_evaluators=[
                models.DatasetEvaluators(
                    dataset_id=dataset_id,
                    display_name=evaluator_name,
                    input_mapping={},
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
    async def create_dataset_llm_evaluator(
        self, info: Info[Context, None], input: CreateDatasetLLMEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
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
        dataset_evaluator_record = models.DatasetEvaluators(
            dataset_id=dataset_id,
            display_name=evaluator_name,
            input_mapping=input.input_mapping or {"literal_mapping": {}, "path_mapping": {}},
        )
        llm_evaluator = models.LLMEvaluator(
            name=evaluator_name,
            description=input.description or None,
            kind="LLM",
            annotation_name=input.output_config.name,
            output_config=config,
            user_id=user_id,
            prompt=prompt,
            dataset_evaluators=[dataset_evaluator_record],
        )
        llm_evaluator.updated_at = datetime.now(timezone.utc)

        try:
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)
        except ValueError as error:
            raise BadRequest(str(error))
        try:
            async with info.context.db() as session:
                session.add(llm_evaluator)
                await session.flush()
                tag_name = IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}")
                prompt_tag = models.PromptVersionTag(
                    name=tag_name,
                    prompt_id=prompt.id,
                    prompt_version_id=prompt_version.id,
                )
                llm_evaluator.prompt_version_tag = prompt_tag
                # Manually update the updated_at field because updating the description
                # or other fields solely on the parent record Evaluator does not
                # trigger an update of the updated_at field on the LLMEvaluator record.
                llm_evaluator.updated_at = datetime.now(timezone.utc)
                session.add(llm_evaluator)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise BadRequest(f"Dataset with id {dataset_id} not found")
            raise BadRequest(f"Evaluator with name {input.name} already exists")
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(
                id=dataset_evaluator_record.id, db_record=dataset_evaluator_record
            ),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_llm_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetLLMEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
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
            dataset_evaluator_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_evaluator_id,
                expected_type_name=DatasetEvaluator.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid DatasetEvaluator id: {input.dataset_evaluator_id}")

        async with info.context.db() as session:
            dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_rowid)
            if dataset_evaluator is None:
                raise NotFound(f"DatasetEvaluator with id {input.dataset_evaluator_id} not found")
            if dataset_evaluator.builtin_evaluator_id is not None:
                raise BadRequest("Cannot update a built-in evaluator")

            llm_evaluator = await session.get(models.LLMEvaluator, dataset_evaluator.evaluator_id)
            if llm_evaluator is None:
                raise NotFound(
                    f"LLM evaluator not found for DatasetEvaluator {input.dataset_evaluator_id}"
                )

            # todo: compare against active prompt version as determined by prompt tag or version
            # https://github.com/Arize-ai/phoenix/issues/10142
            active_prompt_version = await session.scalar(
                select(models.PromptVersion)
                .where(models.PromptVersion.prompt_id == llm_evaluator.prompt_id)
                .order_by(models.PromptVersion.id.desc())
                .limit(1)
            )
            if active_prompt_version is None:
                raise NotFound(
                    f"No prompt versions found for evaluator {input.dataset_evaluator_id}"
                )

            dataset_evaluator.display_name = evaluator_name
            dataset_evaluator.input_mapping = (
                input.input_mapping.to_dict()
                if input.input_mapping is not None
                else {
                    "literal_mapping": {},
                    "path_mapping": {},
                }
            )

            llm_evaluator.description = (
                input.description if isinstance(input.description, str) else None
            )
            llm_evaluator.output_config = output_config
            llm_evaluator.annotation_name = input.output_config.name
            llm_evaluator.updated_at = datetime.now(timezone.utc)

            create_new_prompt_version = not active_prompt_version.has_identical_content(
                prompt_version
            )
            if create_new_prompt_version:
                prompt_version.prompt_id = llm_evaluator.prompt_id
                session.add(prompt_version)

            try:
                validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)
            except ValueError as error:
                raise BadRequest(str(error))

            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("An evaluator with this name already exists")

            # Update prompt_version_tag to point to the new prompt version if one was created
            if create_new_prompt_version and llm_evaluator.prompt_version_tag_id is not None:
                prompt_version_tag = await session.get(
                    models.PromptVersionTag, llm_evaluator.prompt_version_tag_id
                )
                if prompt_version_tag is not None:
                    prompt_version_tag.prompt_version_id = prompt_version.id

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id),
            query=Query(),
        )

    # TODO: should this always just get called instead of unlink for DatasetEvaluators?
    # TODO: this should accept dataset evaluator ids in addition to evaluator ids, or create a new
    # delete_dataset_evaluators mutation
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

        builtin_evaluator_ids = set(get_builtin_evaluator_ids())
        filtered_rowids: list[int] = []
        filtered_gids: list[GlobalID] = []
        for gid, rowid in zip(input.evaluator_ids, evaluator_rowids):
            if rowid in builtin_evaluator_ids:
                continue
            filtered_rowids.append(rowid)
            filtered_gids.append(gid)

        stmt = delete(models.Evaluator).where(models.Evaluator.id.in_(filtered_rowids))
        async with info.context.db() as session:
            await session.execute(stmt)
        return DeleteEvaluatorsPayload(
            evaluator_ids=filtered_gids,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def assign_evaluator_to_dataset(
        self, info: Info[Context, None], input: AssignEvaluatorToDatasetInput
    ) -> DatasetEvaluatorMutationPayload:
        try:
            dataset_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

        try:
            evaluator_rowid, _ = _parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

        input_mapping: EvaluatorInputMappingInput = (
            input.input_mapping if input.input_mapping is not None else EvaluatorInputMappingInput()
        )

        is_builtin = evaluator_rowid < 0

        assignment_name: IdentifierModel
        if input.display_name is not None:
            assignment_name = IdentifierModel.model_validate(input.display_name)
        elif is_builtin:
            builtin_evaluator = get_builtin_evaluator_by_id(evaluator_rowid)
            if builtin_evaluator is None:
                raise NotFound(f"Built-in evaluator with id {input.evaluator_id} not found")
            assignment_name = IdentifierModel.model_validate(
                builtin_evaluator.name.lower().replace(" ", "_")
            )
        else:
            async with info.context.db() as session:
                evaluator = await session.get(models.Evaluator, evaluator_rowid)
                if evaluator is None:
                    raise NotFound(f"Evaluator with id {input.evaluator_id} not found")
                assignment_name = evaluator.name

        values: dict[str, Any] = {
            "dataset_id": dataset_rowid,
            "display_name": assignment_name,
            "input_mapping": input_mapping.to_dict(),
        }
        if is_builtin:
            values["builtin_evaluator_id"] = evaluator_rowid
            values["evaluator_id"] = None
            unique_by = ("dataset_id", "builtin_evaluator_id", "display_name")
        else:
            values["evaluator_id"] = evaluator_rowid
            values["builtin_evaluator_id"] = None
            unique_by = ("dataset_id", "evaluator_id", "display_name")

        try:
            async with info.context.db() as session:
                result = await session.execute(
                    insert_on_conflict(
                        values,
                        dialect=info.context.db.dialect,
                        table=models.DatasetEvaluators,
                        unique_by=unique_by,
                        on_conflict=OnConflict.DO_UPDATE,
                    ).returning(models.DatasetEvaluators)
                )
                dataset_evaluator = result.scalar_one()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise NotFound(
                    f"Dataset with id {input.dataset_id} or "
                    f"evaluator with id {input.evaluator_id} not found"
                )
            raise

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_builtin_evaluator(
        self, info: Info[Context, None], input: CreateDatasetBuiltinEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        try:
            dataset_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

        try:
            built_in_evaluator_id, _ = _parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

        input_mapping: EvaluatorInputMappingInput = (
            input.input_mapping if input.input_mapping is not None else EvaluatorInputMappingInput()
        )

        if built_in_evaluator_id >= 0:  # built-in evaluator IDs are always negative
            raise BadRequest(f"Invalid built-in evaluator id: {input.evaluator_id}")

        builtin_evaluator = get_builtin_evaluator_by_id(built_in_evaluator_id)
        if builtin_evaluator is None:
            raise NotFound(f"Built-in evaluator with id {input.evaluator_id} not found")
        display_name = IdentifierModel.model_validate(input.display_name)

        dataset_evaluator = models.DatasetEvaluators(
            dataset_id=dataset_rowid,
            display_name=display_name,
            input_mapping=input_mapping.to_dict(),
            builtin_evaluator_id=built_in_evaluator_id,
            evaluator_id=None,
        )

        try:
            async with info.context.db() as session:
                session.add(dataset_evaluator)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise NotFound(f"Dataset with id {input.dataset_id} not found")
            raise BadRequest(
                f"DatasetEvaluator with display name {input.display_name} already exists"
                f"for dataset {input.dataset_id}"
            )

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id, db_record=dataset_evaluator),
            query=Query(),
        )

    # TODO: should this always just get deleted in favor of always calling
    # delete_evaluators for DatasetEvaluators?
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def unassign_evaluator_from_dataset(
        self, info: Info[Context, None], input: UnassignEvaluatorFromDatasetInput
    ) -> DatasetEvaluatorMutationPayload:
        try:
            dataset_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

        try:
            dataset_evaluator_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_evaluator_id,
                expected_type_name=DatasetEvaluator.__name__,
            )
        except ValueError as e:
            raise BadRequest(f"Invalid dataset evaluator id: {input.dataset_evaluator_id}. {e}")

        select_stmt = select(models.DatasetEvaluators).where(
            models.DatasetEvaluators.dataset_id == dataset_rowid,
            models.DatasetEvaluators.id == dataset_evaluator_rowid,
        )

        async with info.context.db() as session:
            dataset_evaluator = await session.scalar(select_stmt)
            if dataset_evaluator is None:
                raise NotFound(
                    f"DatasetEvaluator not found for dataset {input.dataset_id}, "
                    f"dataset evaluator {input.dataset_evaluator_id}"
                )
            dataset_evaluator_id = dataset_evaluator.id
            dataset_evaluator_display_name = dataset_evaluator.display_name
            dataset_evaluator_evaluator_id = dataset_evaluator.evaluator_id
            dataset_evaluator_builtin_evaluator_id = dataset_evaluator.builtin_evaluator_id
            dataset_evaluator_dataset_id = dataset_evaluator.dataset_id
            dataset_evaluator_input_mapping = dataset_evaluator.input_mapping
            await session.delete(dataset_evaluator)

        deleted_record = models.DatasetEvaluators(
            id=dataset_evaluator_id,
            display_name=dataset_evaluator_display_name,
            evaluator_id=dataset_evaluator_evaluator_id,
            builtin_evaluator_id=dataset_evaluator_builtin_evaluator_id,
            dataset_id=dataset_evaluator_dataset_id,
            input_mapping=dataset_evaluator_input_mapping,
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator_id, db_record=deleted_record),
            query=Query(),
        )
