from datetime import datetime, timezone
from secrets import token_hex
from typing import Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.models import EvaluatorKind
from phoenix.db.types.annotation_configs import AnnotationConfigType
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import get_builtin_evaluator_by_key
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.evaluators import (
    validate_consistent_llm_evaluator_and_prompt_version,
    validate_min_one_config,
    validate_unique_config_names,
)
from phoenix.server.api.input_types.AnnotationConfigInput import (
    AnnotationConfigInput,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
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
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.bearer_auth import PhoenixUser


def _validate_llm_evaluator_configs_are_categorical(
    configs: list[AnnotationConfigInput],
) -> None:
    """LLM evaluators only support categorical output configs."""
    for config in configs:
        if config.categorical is None or config.categorical is UNSET:
            raise ValueError(
                "LLM evaluators only support categorical output configs. "
                "Non-categorical config found."
            )


def _output_config_input_to_pydantic(input: AnnotationConfigInput) -> AnnotationConfigType:
    """
    Convert AnnotationConfigInput to pydantic for evaluator output configs.
    Always includes name.
    """
    from phoenix.db.types.annotation_configs import (
        AnnotationType,
        CategoricalAnnotationConfig,
        CategoricalAnnotationValue,
        ContinuousAnnotationConfig,
        FreeformAnnotationConfig,
    )

    if input.categorical is not None and input.categorical is not UNSET:
        cat = input.categorical
        return CategoricalAnnotationConfig(
            type=AnnotationType.CATEGORICAL.value,
            name=cat.name,
            description=cat.description,
            optimization_direction=cat.optimization_direction,
            values=[CategoricalAnnotationValue(label=v.label, score=v.score) for v in cat.values],
        )
    elif input.continuous is not None and input.continuous is not UNSET:
        cont = input.continuous
        return ContinuousAnnotationConfig(
            type=AnnotationType.CONTINUOUS.value,
            name=cont.name,
            description=cont.description,
            optimization_direction=cont.optimization_direction,
            lower_bound=cont.lower_bound,
            upper_bound=cont.upper_bound,
        )
    elif input.freeform is not None and input.freeform is not UNSET:
        ff = input.freeform
        return FreeformAnnotationConfig(
            type=AnnotationType.FREEFORM.value,
            name=ff.name,
            description=ff.description,
        )
    else:
        raise BadRequest("No annotation config provided in output config input")


def _convert_output_config_inputs_to_pydantic(
    configs: list[AnnotationConfigInput],
) -> list[AnnotationConfigType]:
    """Convert a list of AnnotationConfigInput to pydantic models for evaluator output configs."""
    return [_output_config_input_to_pydantic(c) for c in configs]


async def _generate_unique_evaluator_name(
    session: AsyncSession,
    base_name: str,
    max_attempts: int = 5,
) -> IdentifierModel:
    """
    Generate a unique evaluator name by appending a suffix if needed.
    Returns the original name if unique, otherwise appends a random suffix.
    Retries up to max_attempts times if random collisions occur.
    """
    name = IdentifierModel.model_validate(base_name)
    exists = await session.scalar(
        select(models.Evaluator.id).where(models.Evaluator.name == name).limit(1)
    )
    if exists is None:
        return name

    for _ in range(max_attempts):
        candidate = f"{base_name}-{token_hex(4)}"
        candidate_name = IdentifierModel.model_validate(candidate)
        exists = await session.scalar(
            select(models.Evaluator.id).where(models.Evaluator.name == candidate_name).limit(1)
        )
        if exists is None:
            return candidate_name

    raise RuntimeError(f"Failed to generate unique evaluator name after {max_attempts} attempts")


def _get_project_for_dataset_evaluator(
    *,
    dataset_name: str,
    dataset_evaluator_name: str,
) -> models.Project:
    project_name_identifier = _get_dataset_evaluator_project_name_identifier()
    project_name = project_name_identifier.root
    return models.Project(
        name=project_name,
        description=(
            f"Traces for dataset evaluator: {dataset_evaluator_name} on dataset: {dataset_name}"
        ),
    )


def _get_dataset_evaluator_project_name_identifier() -> IdentifierModel:
    project_name = f"dataset-evaluator-{token_hex(12)}"
    return IdentifierModel.model_validate(project_name)


async def _ensure_evaluator_prompt_label(
    session: AsyncSession,
    prompt_id: int,
) -> None:
    """
    Ensures the "evaluator" label exists and is associated with the given prompt.

    Args:
        session: The active database session (must be within a transaction)
        prompt_id: The ID of the prompt to label
    """
    # Get or create the "evaluator" label
    stmt = select(models.PromptLabel).where(models.PromptLabel.name == "evaluator")
    result = await session.execute(stmt)
    label = result.scalar_one_or_none()

    if label is None:
        # Create the label if it doesn't exist
        label = models.PromptLabel(
            name="evaluator",
            description="Automatically assigned to prompts created for LLM evaluators",
            color="#4ecf50",
        )
        session.add(label)
        await session.flush()  # Flush to get the ID

    # Step 2: Check if association already exists
    assoc_stmt = select(models.PromptPromptLabel).where(
        models.PromptPromptLabel.prompt_id == prompt_id,
        models.PromptPromptLabel.prompt_label_id == label.id,
    )
    assoc_result = await session.execute(assoc_stmt)
    existing_association = assoc_result.scalar_one_or_none()

    if existing_association is None:
        # Create the association if it doesn't exist
        association = models.PromptPromptLabel(
            prompt_id=prompt_id,
            prompt_label_id=label.id,
        )
        session.add(association)


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
        BuiltInEvaluator.__name__: "BUILTIN",
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
    prompt_version_id: Optional[GlobalID] = UNSET
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.input
class UpdateDatasetLLMEvaluatorInput:
    dataset_evaluator_id: GlobalID
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = None
    prompt_version_id: Optional[GlobalID] = UNSET
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.type
class DatasetEvaluatorMutationPayload:
    evaluator: DatasetEvaluator
    query: Query


@strawberry.input
class CreateDatasetBuiltinEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None
    output_configs: Optional[list[AnnotationConfigInput]] = None
    description: Optional[str] = None


@strawberry.input
class UpdateDatasetBuiltinEvaluatorInput:
    dataset_evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None
    output_configs: Optional[list[AnnotationConfigInput]] = UNSET
    description: Optional[str] = UNSET


@strawberry.input
class DeleteEvaluatorsInput:
    evaluator_ids: list[GlobalID]


@strawberry.type
class DeleteEvaluatorsPayload:
    evaluator_ids: list[GlobalID]
    query: Query


@strawberry.input
class DeleteDatasetEvaluatorsInput:
    dataset_evaluator_ids: list[GlobalID]
    delete_associated_prompt: bool = True


@strawberry.type
class DeleteDatasetEvaluatorsPayload:
    dataset_evaluator_ids: list[GlobalID]
    query: Query


@strawberry.type
class EvaluatorMutationMixin:
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
        # Validate output configs before conversion
        try:
            validate_min_one_config(input.output_configs)
            validate_unique_config_names(input.output_configs)
            _validate_llm_evaluator_configs_are_categorical(input.output_configs)
        except ValueError as e:
            raise BadRequest(str(e))
        output_configs = _convert_output_config_inputs_to_pydantic(input.output_configs)
        try:
            validated_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        try:
            async with info.context.db() as session:
                evaluator_name = await _generate_unique_evaluator_name(session, input.name)

                dataset_name = await session.scalar(
                    select(models.Dataset.name).where(models.Dataset.id == dataset_id)
                )
                if dataset_name is None:
                    raise NotFound(f"Dataset with id {dataset_id} not found")

                dataset_evaluator_record = models.DatasetEvaluators(
                    dataset_id=dataset_id,
                    name=validated_name,
                    description=input.description if input.description is not UNSET else None,
                    output_configs=output_configs,
                    input_mapping=input.input_mapping.to_orm()
                    if input.input_mapping is not None
                    else InputMapping(literal_mapping={}, path_mapping={}),
                    user_id=user_id,
                    project=_get_project_for_dataset_evaluator(
                        dataset_name=dataset_name,
                        dataset_evaluator_name=str(evaluator_name),
                    ),
                )

                # Handle prompt version ID if provided
                target_prompt_version_id: Optional[int] = None
                prompt: models.Prompt | None = None

                if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
                    prompt_version_id = from_global_id_with_expected_type(
                        global_id=input.prompt_version_id, expected_type_name=PromptVersion.__name__
                    )
                    existing_prompt_version = await session.get(
                        models.PromptVersion, prompt_version_id
                    )
                    if existing_prompt_version is None:
                        raise NotFound(
                            f"Prompt version with id {input.prompt_version_id} not found"
                        )
                    existing_prompt_id = existing_prompt_version.prompt_id

                    # Fetch the existing prompt
                    prompt = await session.get(models.Prompt, existing_prompt_id)
                    if prompt is None:
                        raise NotFound(f"Prompt with id {existing_prompt_id} not found")

                    # Only create a new prompt version if the contents differ
                    if existing_prompt_version.has_identical_content(prompt_version):
                        target_prompt_version_id = existing_prompt_version.id
                    else:
                        prompt_version.prompt_id = existing_prompt_id
                        session.add(prompt_version)
                        await session.flush()
                        target_prompt_version_id = prompt_version.id
                else:
                    # No prompt version ID provided: create new prompt and prompt version
                    prompt_name = IdentifierModel.model_validate(
                        f"{input.name}-evaluator-{token_hex(4)}"
                    )
                    prompt = models.Prompt(
                        name=prompt_name,
                        description=input.description if input.description is not UNSET else None,
                        prompt_versions=[prompt_version],
                    )
                    target_prompt_version_id = None  # Will use prompt_version.id after flush

                llm_evaluator = models.LLMEvaluator(
                    name=evaluator_name,
                    description=input.description if input.description is not UNSET else None,
                    kind="LLM",
                    output_configs=output_configs,
                    user_id=user_id,
                    prompt=prompt,
                    dataset_evaluators=[dataset_evaluator_record],
                )
                llm_evaluator.updated_at = datetime.now(timezone.utc)

                try:
                    validate_consistent_llm_evaluator_and_prompt_version(
                        prompt_version, llm_evaluator
                    )
                except ValueError as error:
                    raise BadRequest(str(error))

                session.add(llm_evaluator)
                await session.flush()

                # Ensure the prompt is labeled as an evaluator prompt
                await _ensure_evaluator_prompt_label(session, prompt.id)
                tag_name = IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}")
                # Use the target prompt version ID (newly created if prompt_version_id
                # provided, otherwise the new prompt version)
                final_prompt_version_id = (
                    target_prompt_version_id
                    if target_prompt_version_id is not None
                    else prompt_version.id
                )
                prompt_tag = models.PromptVersionTag(
                    name=tag_name,
                    prompt_id=prompt.id,
                    prompt_version_id=final_prompt_version_id,
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
            raise BadRequest(
                f"An evaluator with name '{input.name}' already exists for this dataset"
            )
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

        # Validate output configs before conversion
        try:
            validate_min_one_config(input.output_configs)
            validate_unique_config_names(input.output_configs)
            _validate_llm_evaluator_configs_are_categorical(input.output_configs)
        except ValueError as e:
            raise BadRequest(str(e))
        output_configs = _convert_output_config_inputs_to_pydantic(input.output_configs)

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

            # Check if this is a builtin evaluator by looking up the evaluator kind
            if dataset_evaluator.evaluator_id is not None:
                evaluator = await session.get(models.Evaluator, dataset_evaluator.evaluator_id)
                if evaluator is not None and evaluator.kind == "BUILTIN":
                    raise BadRequest("Cannot update a built-in evaluator")

            # Use select instead of session.get to ensure all columns are properly loaded
            llm_stmt = select(models.LLMEvaluator).where(
                models.LLMEvaluator.id == dataset_evaluator.evaluator_id
            )
            llm_result = await session.execute(llm_stmt)
            llm_evaluator = llm_result.scalar_one_or_none()
            if llm_evaluator is None:
                raise NotFound(
                    f"LLM evaluator not found for DatasetEvaluator {input.dataset_evaluator_id}"
                )

            # Handle prompt_version_id if provided
            target_prompt_id = llm_evaluator.prompt_id
            provided_prompt_version_id: Optional[int] = None
            new_prompt: Optional[models.Prompt] = None
            if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
                provided_prompt_version_id = from_global_id_with_expected_type(
                    global_id=input.prompt_version_id, expected_type_name=PromptVersion.__name__
                )
                provided_prompt_version = await session.get(
                    models.PromptVersion, provided_prompt_version_id
                )
                if provided_prompt_version is None:
                    raise NotFound(f"Prompt version with id {input.prompt_version_id} not found")
                # If the provided prompt_version points to a different prompt, update the evaluator
                # to point to the new prompt
                if provided_prompt_version.prompt_id != llm_evaluator.prompt_id:
                    target_prompt_id = provided_prompt_version.prompt_id
                    llm_evaluator.prompt_id = target_prompt_id
                # Update the prompt_version_tag to point to the provided prompt_version
                if llm_evaluator.prompt_version_tag_id is not None:
                    prompt_version_tag = await session.get(
                        models.PromptVersionTag, llm_evaluator.prompt_version_tag_id
                    )
                    if prompt_version_tag is not None:
                        prompt_version_tag.prompt_id = target_prompt_id
                        prompt_version_tag.prompt_version_id = provided_prompt_version_id
                    else:
                        raise NotFound(
                            f"Prompt version tag with id {llm_evaluator.prompt_version_tag_id} "
                            "not found"
                        )

            # Retrieve the active prompt version for comparison
            if provided_prompt_version_id is not None:
                active_prompt_version = await session.get(
                    models.PromptVersion, provided_prompt_version_id
                )
                if active_prompt_version is None:
                    raise NotFound(f"Prompt version with id {provided_prompt_version_id} not found")
            else:
                # No prompt_version_id provided: create new prompt and prompt version
                prompt_name = IdentifierModel.model_validate(
                    f"{input.name}-evaluator-{token_hex(4)}"
                )
                new_prompt = models.Prompt(
                    name=prompt_name,
                    description=input.description or None,
                    prompt_versions=[prompt_version],
                )
                session.add(new_prompt)
                await session.flush()

                # Ensure the new prompt is labeled as an evaluator prompt
                await _ensure_evaluator_prompt_label(session, new_prompt.id)

                target_prompt_id = new_prompt.id
                llm_evaluator.prompt_id = target_prompt_id
                # Use the newly created prompt_version for comparison (it will always be "new")
                active_prompt_version = prompt_version

            dataset_evaluator.name = evaluator_name
            dataset_evaluator.description = (
                input.description if isinstance(input.description, str) else None
            )
            dataset_evaluator.output_configs = output_configs
            dataset_evaluator.input_mapping = (
                input.input_mapping.to_orm()
                if input.input_mapping is not None
                else InputMapping(literal_mapping={}, path_mapping={})
            )
            dataset_evaluator.user_id = user_id

            llm_evaluator.description = (
                input.description if isinstance(input.description, str) else None
            )
            llm_evaluator.output_configs = output_configs
            llm_evaluator.updated_at = datetime.now(timezone.utc)
            llm_evaluator.user_id = user_id

            if new_prompt is not None:
                # We already created a new prompt above
                create_new_prompt_version = False
            else:
                # Check if prompt contents have changed and create new version if needed
                create_new_prompt_version = not active_prompt_version.has_identical_content(
                    prompt_version
                )
                if create_new_prompt_version:
                    prompt_version.prompt_id = target_prompt_id
                    session.add(prompt_version)

            try:
                validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)
            except ValueError as error:
                raise BadRequest(str(error))

            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("An evaluator with this name already exists")

            # Update prompt_version_tag to point to the final prompt version
            final_prompt_version_id = None
            if new_prompt is not None or create_new_prompt_version:
                final_prompt_version_id = prompt_version.id
            elif provided_prompt_version_id is not None:
                final_prompt_version_id = provided_prompt_version_id

            if final_prompt_version_id is not None:
                if llm_evaluator.prompt_version_tag_id is not None:
                    prompt_version_tag = await session.get(
                        models.PromptVersionTag, llm_evaluator.prompt_version_tag_id
                    )
                    if prompt_version_tag is not None:
                        prompt_version_tag.prompt_version_id = final_prompt_version_id
                        # Ensure prompt_id matches
                        prompt_version_tag.prompt_id = target_prompt_id

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

        # Query DB to find which evaluators are builtins (can't be deleted)
        async with info.context.db() as session:
            builtin_ids_result = await session.execute(
                select(models.BuiltinEvaluator.id).where(
                    models.BuiltinEvaluator.id.in_(evaluator_rowids)
                )
            )
            builtin_evaluator_ids = set(builtin_ids_result.scalars().all())

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
    async def delete_dataset_evaluators(
        self, info: Info[Context, None], input: DeleteDatasetEvaluatorsInput
    ) -> DeleteDatasetEvaluatorsPayload:
        """
        Delete dataset evaluators by their IDs.

        All evaluator types (LLM, CODE, BUILTIN) use evaluator_id. The Evaluator record
        is deleted, which cascades to delete both the specific evaluator type record and
        DatasetEvaluators rows.

        If delete_associated_prompt is True (default), the associated prompt for LLM evaluators
        will also be deleted.

        The associated project for each dataset evaluator is also deleted automatically.
        """
        # Parse and validate all dataset_evaluator_ids
        dataset_evaluator_rowids: list[int] = []
        for dataset_evaluator_gid in input.dataset_evaluator_ids:
            try:
                dataset_evaluator_rowid = from_global_id_with_expected_type(
                    global_id=dataset_evaluator_gid,
                    expected_type_name=DatasetEvaluator.__name__,
                )
            except ValueError:
                raise BadRequest(f"Invalid dataset evaluator id: {dataset_evaluator_gid}")
            dataset_evaluator_rowids.append(dataset_evaluator_rowid)

        if not dataset_evaluator_rowids:
            return DeleteDatasetEvaluatorsPayload(
                dataset_evaluator_ids=[],
                query=Query(),
            )

        deleted_gids: list[GlobalID] = []

        async with info.context.db() as session:
            # Fetch all DatasetEvaluators records
            stmt = select(models.DatasetEvaluators).where(
                models.DatasetEvaluators.id.in_(dataset_evaluator_rowids)
            )
            result = await session.execute(stmt)
            dataset_evaluators = list(result.scalars().all())

            evaluator_ids: list[int] = []
            project_ids_to_delete: list[int] = []

            for dataset_evaluator in dataset_evaluators:
                if dataset_evaluator.evaluator_id is not None:
                    evaluator_ids.append(dataset_evaluator.evaluator_id)
                project_ids_to_delete.append(dataset_evaluator.project_id)
                deleted_gids.append(GlobalID(DatasetEvaluator.__name__, str(dataset_evaluator.id)))

            prompt_ids_to_delete: list[int] = []
            if input.delete_associated_prompt and evaluator_ids:
                llm_evaluator_stmt = select(models.LLMEvaluator).where(
                    models.LLMEvaluator.id.in_(evaluator_ids)
                )
                llm_result = await session.execute(llm_evaluator_stmt)
                llm_evaluators = list(llm_result.scalars().all())
                prompt_ids_to_delete = [e.prompt_id for e in llm_evaluators]

            # Delete evaluators (cascades to DatasetEvaluators)
            if evaluator_ids:
                delete_evaluators_stmt = delete(models.Evaluator).where(
                    models.Evaluator.id.in_(evaluator_ids)
                )
                await session.execute(delete_evaluators_stmt)

            if prompt_ids_to_delete:
                delete_prompts_stmt = delete(models.Prompt).where(
                    models.Prompt.id.in_(prompt_ids_to_delete)
                )
                await session.execute(delete_prompts_stmt)

            if project_ids_to_delete:
                delete_projects_stmt = delete(models.Project).where(
                    models.Project.id.in_(project_ids_to_delete)
                )
                await session.execute(delete_projects_stmt)

        return DeleteDatasetEvaluatorsPayload(
            dataset_evaluator_ids=deleted_gids,
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

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        input_mapping: EvaluatorInputMappingInput = (
            input.input_mapping if input.input_mapping is not None else EvaluatorInputMappingInput()
        )

        try:
            name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        # Validate output configs if provided
        if input.output_configs:
            try:
                validate_unique_config_names(input.output_configs)
            except ValueError as e:
                raise BadRequest(str(e))

        try:
            async with info.context.db() as session:
                # Look up the builtin evaluator from DB to get its key
                builtin_db = await session.get(models.BuiltinEvaluator, built_in_evaluator_id)
                if builtin_db is None:
                    raise NotFound(f"Built-in evaluator with id {input.evaluator_id} not found")

                # Get the evaluator class from registry using the key
                builtin_evaluator = get_builtin_evaluator_by_key(builtin_db.key)
                if builtin_evaluator is None:
                    raise NotFound(f"Built-in evaluator class not found for key: {builtin_db.key}")

                # If output_configs provided, convert them; otherwise copy base evaluator's configs
                if input.output_configs:
                    output_configs = _convert_output_config_inputs_to_pydantic(input.output_configs)
                else:
                    output_configs = list(builtin_evaluator().output_configs)

                dataset_name = await session.scalar(
                    select(models.Dataset.name).where(models.Dataset.id == dataset_rowid)
                )
                if dataset_name is None:
                    raise NotFound(f"Dataset with id {dataset_rowid} not found")

                dataset_evaluator = models.DatasetEvaluators(
                    dataset_id=dataset_rowid,
                    name=name,
                    input_mapping=input_mapping.to_orm(),
                    evaluator_id=built_in_evaluator_id,
                    output_configs=output_configs,
                    description=input.description,
                    user_id=user_id,
                    project=_get_project_for_dataset_evaluator(
                        dataset_name=dataset_name,
                        dataset_evaluator_name=str(name),
                    ),
                )

                session.add(dataset_evaluator)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise NotFound(f"Dataset with id {input.dataset_id} not found")
            raise BadRequest(
                f"DatasetEvaluator with name {input.name} already exists"
                f"for dataset {input.dataset_id}"
            )

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id, db_record=dataset_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_builtin_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetBuiltinEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        try:
            dataset_evaluator_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_evaluator_id,
                expected_type_name=DatasetEvaluator.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset evaluator id: {input.dataset_evaluator_id}")

        input_mapping: EvaluatorInputMappingInput = (
            input.input_mapping if input.input_mapping is not None else EvaluatorInputMappingInput()
        )

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        # Validate output configs if provided
        if input.output_configs is not UNSET and input.output_configs is not None:
            try:
                validate_unique_config_names(input.output_configs)
            except ValueError as e:
                raise BadRequest(str(e))

        try:
            async with info.context.db() as session:
                dataset_evaluator = await session.get(
                    models.DatasetEvaluators, dataset_evaluator_rowid
                )
                if dataset_evaluator is None:
                    raise NotFound(
                        f"DatasetEvaluator with id {input.dataset_evaluator_id} not found"
                    )

                # Check if this is a builtin evaluator by looking up the evaluator kind
                if dataset_evaluator.evaluator_id is None:
                    raise BadRequest("Cannot update a non-built-in evaluator")

                builtin_db = await session.get(
                    models.BuiltinEvaluator, dataset_evaluator.evaluator_id
                )
                if builtin_db is None:
                    raise BadRequest("Cannot update a non-built-in evaluator")

                builtin_evaluator = get_builtin_evaluator_by_key(builtin_db.key)
                if builtin_evaluator is None:
                    raise NotFound(f"Built-in evaluator class not found for key: {builtin_db.key}")

                try:
                    name = IdentifierModel.model_validate(input.name)
                except ValidationError as error:
                    raise BadRequest(f"Invalid evaluator name: {error}")
                dataset_evaluator.name = name
                dataset_evaluator.input_mapping = input_mapping.to_orm()
                dataset_evaluator.updated_at = datetime.now(timezone.utc)
                dataset_evaluator.user_id = user_id

                if input.output_configs is not UNSET:
                    if input.output_configs is not None:
                        dataset_evaluator.output_configs = (
                            _convert_output_config_inputs_to_pydantic(input.output_configs)
                        )
                    else:
                        # None means reset to base evaluator's configs
                        dataset_evaluator.output_configs = list(builtin_evaluator().output_configs)

                if input.description is not UNSET:
                    dataset_evaluator.description = input.description
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise NotFound(f"Dataset evaluator with id {input.dataset_evaluator_id} not found")
            raise BadRequest(f"DatasetEvaluator with name {input.name} already exists")

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id, db_record=dataset_evaluator),
            query=Query(),
        )
