"""Dataset evaluator operations shared by GraphQL and REST."""

from dataclasses import dataclass
from datetime import datetime, timezone
from secrets import token_hex
from typing import Optional, cast

from pydantic import ValidationError
from sqlalchemy import delete, select, true
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import aliased
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import (
    SupportedSQLDialect,
    delete_projects_and_evaluator_trace_projects,
)
from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    OutputConfigType,
    as_output_configs,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.evaluators import (
    get_builtin_evaluator_by_key,
)
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.evaluator_management import (
    ensure_evaluator_prompt_label,
    garbage_collect_evaluators,
    generate_unique_evaluator_name,
    get_project_for_dataset_evaluator,
    parse_evaluator_id,
)
from phoenix.server.api.helpers.evaluator_service import (
    EvaluatorServiceContext,
    validate_output_config_names,
)
from phoenix.server.api.helpers.evaluators import (
    LLMEvaluatorOutputConfigs,
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type


@dataclass(kw_only=True)
class CreateDatasetLLMEvaluatorInput:
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET
    prompt_version_id: Optional[GlobalID] = UNSET
    prompt_version: models.PromptVersion
    output_configs: list[OutputConfigType]
    input_mapping: Optional[InputMapping] = None


@dataclass(kw_only=True)
class UpdateDatasetLLMEvaluatorInput:
    dataset_evaluator_id: GlobalID
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET
    prompt_version_id: Optional[GlobalID] = UNSET
    prompt_version: models.PromptVersion
    output_configs: list[OutputConfigType]
    input_mapping: Optional[InputMapping] = None


@dataclass(kw_only=True)
class CreateDatasetBuiltinEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[InputMapping] = None
    output_configs: Optional[list[OutputConfigType]] = None
    description: Optional[str] = None


@dataclass(kw_only=True)
class UpdateDatasetBuiltinEvaluatorInput:
    dataset_evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[InputMapping] = None
    output_configs: Optional[list[OutputConfigType]] = UNSET
    description: Optional[str] = UNSET


@dataclass(kw_only=True)
class CreateDatasetCodeEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[InputMapping] = None
    output_configs: Optional[list[OutputConfigType]] = None
    description: Optional[str] = None


@dataclass(kw_only=True)
class UpdateDatasetCodeEvaluatorInput:
    dataset_evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[InputMapping] = None
    output_configs: Optional[list[OutputConfigType]] = UNSET
    description: Optional[str] = UNSET


@dataclass(kw_only=True)
class DeleteDatasetEvaluatorsInput:
    dataset_evaluator_ids: list[GlobalID]
    delete_associated_prompt: bool = True


async def create_dataset_llm_evaluator(
    context: EvaluatorServiceContext, input: CreateDatasetLLMEvaluatorInput
) -> models.DatasetEvaluators:
    """Create an LLM definition, pinned prompt, trace project, and dataset binding."""
    if input.input_mapping is None:
        raise BadRequest("input_mapping is required")
    dataset_id = from_global_id_with_expected_type(
        global_id=input.dataset_id, expected_type_name="Dataset"
    )
    user_id = context.user_id
    try:
        prompt_version = input.prompt_version
        prompt_version.user_id = user_id
    except ValidationError as error:
        raise BadRequest(str(error))
    try:
        validated_configs = LLMEvaluatorOutputConfigs.model_validate(
            {"configs": input.output_configs}
        )
    except (ValueError, ValidationError) as e:
        raise BadRequest(str(e))
    output_configs: list[CategoricalOutputConfig] = list(validated_configs.configs)
    try:
        validated_name = IdentifierModel.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")

    try:
        async with context.db() as session:
            evaluator_name = await generate_unique_evaluator_name(session, validated_name)

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
                input_mapping=input.input_mapping,
                user_id=user_id,
                project=get_project_for_dataset_evaluator(
                    dataset_name=dataset_name,
                    dataset_evaluator_name=str(evaluator_name),
                ),
            )

            target_prompt_version_id: Optional[int] = None
            prompt: models.Prompt | None = None

            if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
                prompt_version_id = from_global_id_with_expected_type(
                    global_id=input.prompt_version_id, expected_type_name="PromptVersion"
                )
                prompt_version_and_prompt = (
                    await session.execute(
                        select(models.PromptVersion, models.Prompt)
                        .outerjoin(
                            models.Prompt,
                            models.Prompt.id == models.PromptVersion.prompt_id,
                        )
                        .where(models.PromptVersion.id == prompt_version_id)
                    )
                ).one_or_none()
                if prompt_version_and_prompt is None:
                    raise NotFound(f"Prompt version with id {input.prompt_version_id} not found")
                existing_prompt_version, prompt = prompt_version_and_prompt
                existing_prompt_id = existing_prompt_version.prompt_id

                if prompt is None:
                    raise NotFound(f"Prompt with id {existing_prompt_id} not found")

                if existing_prompt_version.has_identical_content(prompt_version):
                    target_prompt_version_id = existing_prompt_version.id
                else:
                    prompt_version.prompt_id = existing_prompt_id
                    session.add(prompt_version)
                    await session.flush()
                    target_prompt_version_id = prompt_version.id
            else:
                prompt_name = IdentifierModel.model_validate(
                    f"{input.name}-evaluator-{token_hex(4)}"
                )
                prompt = models.Prompt(
                    name=prompt_name,
                    description=input.description if input.description is not UNSET else None,
                    prompt_versions=[prompt_version],
                )
                target_prompt_version_id = None

            llm_evaluator = models.LLMEvaluator(
                name=evaluator_name,
                description=input.description if input.description is not UNSET else None,
                kind="LLM",
                output_configs=output_configs,
                user_id=user_id,
                prompt=prompt,
                dataset_evaluators=[dataset_evaluator_record],
            )

            try:
                validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)
            except ValueError as error:
                raise BadRequest(str(error))

            session.add(llm_evaluator)
            await session.flush()

            await ensure_evaluator_prompt_label(session, prompt.id)
            tag_name = IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}")
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
            # Updates to Evaluator do not trigger LLMEvaluator.updated_at.
            llm_evaluator.updated_at = datetime.now(timezone.utc)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        if "foreign" in str(e).lower():
            raise BadRequest(f"Dataset with id {dataset_id} not found")
        raise Conflict(f"An evaluator with name '{input.name}' already exists for this dataset")
    return dataset_evaluator_record


async def update_dataset_llm_evaluator(
    context: EvaluatorServiceContext, input: UpdateDatasetLLMEvaluatorInput
) -> models.DatasetEvaluators:
    """Update a dataset binding and its shared LLM definition."""
    user_id = context.user_id

    try:
        evaluator_name = IdentifierModel.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")

    try:
        validated_configs = LLMEvaluatorOutputConfigs.model_validate(
            {"configs": input.output_configs}
        )
    except (ValueError, ValidationError) as e:
        raise BadRequest(str(e))
    output_configs: list[CategoricalOutputConfig] = list(validated_configs.configs)

    try:
        prompt_version = input.prompt_version
        prompt_version.user_id = user_id
    except ValidationError as error:
        raise BadRequest(str(error))

    try:
        dataset_evaluator_rowid = from_global_id_with_expected_type(
            global_id=input.dataset_evaluator_id,
            expected_type_name="DatasetEvaluator",
        )
    except ValueError:
        raise BadRequest(f"Invalid DatasetEvaluator id: {input.dataset_evaluator_id}")

    async with context.db() as session:
        dataset_evaluator_row = await session.execute(
            select(
                models.DatasetEvaluators,
                models.LLMEvaluator,
                models.PromptVersionTag,
            )
            .join(
                models.LLMEvaluator,
                models.DatasetEvaluators.evaluator_id == models.LLMEvaluator.id,
            )
            .outerjoin(
                models.PromptVersionTag,
                models.LLMEvaluator.prompt_version_tag_id == models.PromptVersionTag.id,
            )
            .where(models.DatasetEvaluators.id == dataset_evaluator_rowid)
        )
        dataset_evaluator_triplet = dataset_evaluator_row.one_or_none()
        if dataset_evaluator_triplet is None:
            dataset_evaluator = await session.get(models.DatasetEvaluators, dataset_evaluator_rowid)
            if dataset_evaluator is None:
                raise NotFound(f"DatasetEvaluator with id {input.dataset_evaluator_id} not found")
            evaluator = (
                await session.get(models.Evaluator, dataset_evaluator.evaluator_id)
                if dataset_evaluator.evaluator_id is not None
                else None
            )
            if evaluator is not None and evaluator.kind == "BUILTIN":
                raise BadRequest("Cannot update a built-in evaluator")
            raise NotFound(
                f"LLM evaluator not found for DatasetEvaluator {input.dataset_evaluator_id}"
            )
        dataset_evaluator, llm_evaluator, prompt_version_tag = dataset_evaluator_triplet
        shared_evaluator_changed = False

        target_prompt_id = llm_evaluator.prompt_id
        provided_prompt_version_id: Optional[int] = None
        provided_prompt_version: Optional[models.PromptVersion] = None
        new_prompt: Optional[models.Prompt] = None
        if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
            provided_prompt_version_id = from_global_id_with_expected_type(
                global_id=input.prompt_version_id, expected_type_name="PromptVersion"
            )
            provided_prompt_version = await session.get(
                models.PromptVersion, provided_prompt_version_id
            )
            if provided_prompt_version is None:
                raise NotFound(f"Prompt version with id {input.prompt_version_id} not found")
            if provided_prompt_version.prompt_id != llm_evaluator.prompt_id:
                target_prompt_id = provided_prompt_version.prompt_id
                llm_evaluator.prompt_id = target_prompt_id
                shared_evaluator_changed = True
            if llm_evaluator.prompt_version_tag_id is not None:
                if prompt_version_tag is not None:
                    if (
                        prompt_version_tag.prompt_id != target_prompt_id
                        or prompt_version_tag.prompt_version_id != provided_prompt_version_id
                    ):
                        prompt_version_tag.prompt_id = target_prompt_id
                        prompt_version_tag.prompt_version_id = provided_prompt_version_id
                        shared_evaluator_changed = True
                else:
                    raise NotFound(
                        f"Prompt version tag with id {llm_evaluator.prompt_version_tag_id} "
                        "not found"
                    )

        if provided_prompt_version is not None:
            active_prompt_version = provided_prompt_version
        else:
            prompt_name = IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}")
            new_prompt = models.Prompt(
                name=prompt_name,
                description=input.description or None,
                prompt_versions=[prompt_version],
            )
            session.add(new_prompt)
            await session.flush()

            await ensure_evaluator_prompt_label(session, new_prompt.id)

            target_prompt_id = new_prompt.id
            llm_evaluator.prompt_id = target_prompt_id
            shared_evaluator_changed = True
            active_prompt_version = prompt_version

        dataset_evaluator.name = evaluator_name
        if input.description is not UNSET:
            dataset_evaluator.description = input.description
        dataset_evaluator.output_configs = list(output_configs)
        if input.input_mapping is None:
            raise BadRequest("input_mapping is required")
        dataset_evaluator.input_mapping = input.input_mapping
        dataset_evaluator.user_id = user_id

        if input.description is not UNSET and llm_evaluator.description != input.description:
            llm_evaluator.description = input.description
            shared_evaluator_changed = True
        if llm_evaluator.output_configs != list(output_configs):
            llm_evaluator.output_configs = list(output_configs)
            shared_evaluator_changed = True

        if new_prompt is not None:
            create_new_prompt_version = False
        else:
            create_new_prompt_version = not active_prompt_version.has_identical_content(
                prompt_version
            )
            if create_new_prompt_version:
                prompt_version.prompt_id = target_prompt_id
                session.add(prompt_version)
                shared_evaluator_changed = True

        try:
            validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)
        except ValueError as error:
            raise BadRequest(str(error))

        try:
            await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("An evaluator with this name already exists")

        final_prompt_version_id = None
        if new_prompt is not None or create_new_prompt_version:
            final_prompt_version_id = prompt_version.id
        elif provided_prompt_version_id is not None:
            final_prompt_version_id = provided_prompt_version_id

        if final_prompt_version_id is not None:
            if llm_evaluator.prompt_version_tag_id is not None:
                if prompt_version_tag is not None:
                    if (
                        prompt_version_tag.prompt_version_id != final_prompt_version_id
                        or prompt_version_tag.prompt_id != target_prompt_id
                    ):
                        prompt_version_tag.prompt_version_id = final_prompt_version_id
                        prompt_version_tag.prompt_id = target_prompt_id
                        shared_evaluator_changed = True

        if shared_evaluator_changed:
            llm_evaluator.updated_at = datetime.now(timezone.utc)
            llm_evaluator.user_id = user_id

    return cast(models.DatasetEvaluators, dataset_evaluator)


async def delete_dataset_evaluators(
    context: EvaluatorServiceContext, input: DeleteDatasetEvaluatorsInput
) -> list[GlobalID]:
    """Delete bindings and trace projects; collect unreferenced LLM/code definitions.

    Built-ins are retained. Associated prompts are collected only when requested
    and no LLM evaluator references them.
    """
    dataset_evaluator_rowids: list[int] = []
    for dataset_evaluator_gid in input.dataset_evaluator_ids:
        try:
            dataset_evaluator_rowid = from_global_id_with_expected_type(
                global_id=dataset_evaluator_gid,
                expected_type_name="DatasetEvaluator",
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset evaluator id: {dataset_evaluator_gid}")
        dataset_evaluator_rowids.append(dataset_evaluator_rowid)

    if not dataset_evaluator_rowids:
        return []

    deleted_gids: list[GlobalID] = []

    async with context.db() as session:
        dialect = SupportedSQLDialect(session.bind.dialect.name)

        # Flat aliasing prevents SQLAlchemy from rewriting the base kind discriminator.
        llm_evaluator_alias = aliased(models.LLMEvaluator, flat=True)
        # PostgreSQL can delete and return bindings in one CTE; SQLite requires two statements.
        if dialect is SupportedSQLDialect.POSTGRESQL:
            deleted_links_cte = (
                delete(models.DatasetEvaluators)
                .where(models.DatasetEvaluators.id.in_(dataset_evaluator_rowids))
                .returning(
                    models.DatasetEvaluators.id,
                    models.DatasetEvaluators.evaluator_id,
                    models.DatasetEvaluators.project_id,
                )
                .cte("deleted_links")
            )
            gather_stmt = (
                select(
                    deleted_links_cte.c.id,
                    deleted_links_cte.c.evaluator_id,
                    deleted_links_cte.c.project_id,
                    models.Evaluator.kind,
                    llm_evaluator_alias.prompt_id,
                )
                .select_from(deleted_links_cte)
                .join(
                    models.Evaluator,
                    models.Evaluator.id == deleted_links_cte.c.evaluator_id,
                )
                .outerjoin(
                    llm_evaluator_alias,
                    llm_evaluator_alias.id == deleted_links_cte.c.evaluator_id,
                )
            )
        else:
            gather_stmt = (
                select(
                    models.DatasetEvaluators.id,
                    models.DatasetEvaluators.evaluator_id,
                    models.DatasetEvaluators.project_id,
                    models.Evaluator.kind,
                    llm_evaluator_alias.prompt_id,
                )
                .join(
                    models.Evaluator,
                    models.DatasetEvaluators.evaluator_id == models.Evaluator.id,
                )
                .outerjoin(
                    llm_evaluator_alias,
                    models.DatasetEvaluators.evaluator_id == llm_evaluator_alias.id,
                )
                .where(models.DatasetEvaluators.id.in_(dataset_evaluator_rowids))
            )
        rows = (await session.execute(gather_stmt)).all()

        link_ids: list[int] = []
        project_ids: list[int] = []
        gc_candidate_evaluator_ids: set[int] = set()
        candidate_prompt_ids: set[int] = set()

        for link_id, evaluator_id, project_id, kind, prompt_id in rows:
            link_ids.append(link_id)
            project_ids.append(project_id)
            deleted_gids.append(GlobalID("DatasetEvaluator", str(link_id)))
            if kind != "BUILTIN":
                gc_candidate_evaluator_ids.add(evaluator_id)
                if prompt_id is not None:
                    candidate_prompt_ids.add(prompt_id)

        if project_ids:
            cascade_rows = (
                await session.execute(
                    select(
                        models.ProjectEvaluator.evaluator_id,
                        models.Evaluator.kind,
                        llm_evaluator_alias.prompt_id,
                    )
                    .join(
                        models.Evaluator,
                        models.ProjectEvaluator.evaluator_id == models.Evaluator.id,
                    )
                    .outerjoin(
                        llm_evaluator_alias,
                        models.ProjectEvaluator.evaluator_id == llm_evaluator_alias.id,
                    )
                    .where(models.ProjectEvaluator.project_id.in_(project_ids))
                )
            ).all()
            for evaluator_id, kind, prompt_id in cascade_rows:
                if kind != "BUILTIN":
                    gc_candidate_evaluator_ids.add(evaluator_id)
                    if prompt_id is not None:
                        candidate_prompt_ids.add(prompt_id)

        if not link_ids:
            return []

        # Remove bindings before trace projects to satisfy the RESTRICT foreign key.
        if dialect is not SupportedSQLDialect.POSTGRESQL:
            await session.execute(
                delete(models.DatasetEvaluators).where(models.DatasetEvaluators.id.in_(link_ids))
            )

        if project_ids:
            await delete_projects_and_evaluator_trace_projects(session, project_ids)

        await garbage_collect_evaluators(
            session,
            evaluator_ids=gc_candidate_evaluator_ids,
            prompt_ids=candidate_prompt_ids,
            delete_associated_prompt=input.delete_associated_prompt,
        )

    return deleted_gids


async def create_dataset_builtin_evaluator(
    context: EvaluatorServiceContext, input: CreateDatasetBuiltinEvaluatorInput
) -> models.DatasetEvaluators:
    """Bind a registered built-in evaluator, inheriting unset output overrides."""
    try:
        dataset_rowid = from_global_id_with_expected_type(
            global_id=input.dataset_id,
            expected_type_name="Dataset",
        )
    except ValueError:
        raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

    try:
        built_in_evaluator_id, _ = parse_evaluator_id(input.evaluator_id)
    except ValueError as e:
        raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

    user_id = context.user_id

    if input.input_mapping is None:
        raise BadRequest("input_mapping is required")
    input_mapping: InputMapping = input.input_mapping

    try:
        name = IdentifierModel.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")

    if input.output_configs is not None:
        try:
            validate_output_config_names(input.output_configs)
        except ValueError as e:
            raise BadRequest(str(e))

    try:
        async with context.db() as session:
            builtin_and_dataset = (
                await session.execute(
                    select(models.BuiltinEvaluator, models.Dataset.name)
                    .select_from(models.BuiltinEvaluator)
                    .join(models.Dataset, true())
                    .where(
                        models.BuiltinEvaluator.id == built_in_evaluator_id,
                        models.Dataset.id == dataset_rowid,
                    )
                )
            ).one_or_none()
            if builtin_and_dataset is None:
                builtin_db = await session.get(models.BuiltinEvaluator, built_in_evaluator_id)
                if builtin_db is None:
                    raise NotFound(f"Built-in evaluator with id {input.evaluator_id} not found")
                dataset_name = await session.scalar(
                    select(models.Dataset.name).where(models.Dataset.id == dataset_rowid)
                )
                if dataset_name is None:
                    raise NotFound(f"Dataset with id {dataset_rowid} not found")
            else:
                builtin_db, dataset_name = builtin_and_dataset

            builtin_evaluator = get_builtin_evaluator_by_key(builtin_db.key)
            if builtin_evaluator is None:
                raise NotFound(f"Built-in evaluator class not found for key: {builtin_db.key}")

            output_configs: Optional[list[OutputConfigType]] = None
            if input.output_configs is not None:
                output_configs = input.output_configs

            dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset_rowid,
                name=name,
                input_mapping=input_mapping,
                evaluator_id=built_in_evaluator_id,
                output_configs=output_configs,
                description=input.description,
                user_id=user_id,
                project=get_project_for_dataset_evaluator(
                    dataset_name=dataset_name,
                    dataset_evaluator_name=str(name),
                ),
            )

            session.add(dataset_evaluator)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        if "foreign" in str(e).lower():
            raise NotFound(f"Dataset with id {input.dataset_id} not found")
        raise Conflict(
            f"DatasetEvaluator with name {input.name} already exists for dataset {input.dataset_id}"
        )

    # Eager response configs avoid a concurrent GraphQL read; persisted null retains inheritance.
    if output_configs is None:
        dataset_evaluator.output_configs = list(builtin_evaluator().output_configs)

    return dataset_evaluator


async def update_dataset_builtin_evaluator(
    context: EvaluatorServiceContext, input: UpdateDatasetBuiltinEvaluatorInput
) -> models.DatasetEvaluators:
    """Replace binding settings while preserving omitted output overrides."""
    try:
        dataset_evaluator_rowid = from_global_id_with_expected_type(
            global_id=input.dataset_evaluator_id,
            expected_type_name="DatasetEvaluator",
        )
    except ValueError:
        raise BadRequest(f"Invalid dataset evaluator id: {input.dataset_evaluator_id}")

    if input.input_mapping is None:
        raise BadRequest("input_mapping is required")
    input_mapping: InputMapping = input.input_mapping

    user_id = context.user_id

    if input.output_configs is not UNSET and input.output_configs is not None:
        try:
            validate_output_config_names(input.output_configs)
        except ValueError as e:
            raise BadRequest(str(e))

    try:
        async with context.db() as session:
            dataset_evaluator_row = await session.execute(
                select(models.DatasetEvaluators, models.BuiltinEvaluator)
                .join(
                    models.BuiltinEvaluator,
                    models.DatasetEvaluators.evaluator_id == models.BuiltinEvaluator.id,
                )
                .where(models.DatasetEvaluators.id == dataset_evaluator_rowid)
            )
            dataset_evaluator_pair = dataset_evaluator_row.one_or_none()
            if dataset_evaluator_pair is None:
                dataset_evaluator = await session.get(
                    models.DatasetEvaluators, dataset_evaluator_rowid
                )
                if dataset_evaluator is None:
                    raise NotFound(
                        f"DatasetEvaluator with id {input.dataset_evaluator_id} not found"
                    )
                raise BadRequest("Cannot update a non-built-in evaluator")
            dataset_evaluator, builtin_db = dataset_evaluator_pair

            builtin_evaluator = get_builtin_evaluator_by_key(builtin_db.key)
            if builtin_evaluator is None:
                raise NotFound(f"Built-in evaluator class not found for key: {builtin_db.key}")

            try:
                name = IdentifierModel.model_validate(input.name)
            except ValidationError as error:
                raise BadRequest(f"Invalid evaluator name: {error}")
            dataset_evaluator.name = name
            dataset_evaluator.input_mapping = input_mapping
            dataset_evaluator.updated_at = datetime.now(timezone.utc)
            dataset_evaluator.user_id = user_id

            if input.output_configs is not UNSET:
                if input.output_configs is not None:
                    dataset_evaluator.output_configs = input.output_configs
                else:
                    dataset_evaluator.output_configs = None

            if input.description is not UNSET:
                dataset_evaluator.description = input.description
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        if "foreign" in str(e).lower():
            raise NotFound(f"Dataset evaluator with id {input.dataset_evaluator_id} not found")
        raise BadRequest(f"DatasetEvaluator with name {input.name} already exists")

    # Eager response configs avoid a concurrent GraphQL read; persisted null retains inheritance.
    if dataset_evaluator.output_configs is None:
        dataset_evaluator.output_configs = list(builtin_evaluator().output_configs)

    return cast(models.DatasetEvaluators, dataset_evaluator)


async def create_dataset_code_evaluator(
    context: EvaluatorServiceContext, input: CreateDatasetCodeEvaluatorInput
) -> models.DatasetEvaluators:
    """Bind an existing code evaluator and create its dataset trace project."""
    try:
        dataset_rowid = from_global_id_with_expected_type(
            global_id=input.dataset_id,
            expected_type_name="Dataset",
        )
    except ValueError:
        raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

    try:
        evaluator_id, evaluator_kind = parse_evaluator_id(input.evaluator_id)
    except ValueError as e:
        raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")
    if evaluator_kind != "CODE":
        raise BadRequest("Evaluator must be a code evaluator")

    if input.input_mapping is None:
        raise BadRequest("input_mapping is required")
    input_mapping: InputMapping = input.input_mapping

    user_id = context.user_id

    try:
        name = IdentifierModel.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")

    output_configs: Optional[list[OutputConfigType]] = None
    if input.output_configs is not None:
        try:
            validate_output_config_names(input.output_configs)
        except ValueError as e:
            raise BadRequest(str(e))
        output_configs = input.output_configs

    try:
        async with context.db() as session:
            evaluator_and_dataset = (
                await session.execute(
                    select(models.CodeEvaluator, models.Dataset.name)
                    .select_from(models.CodeEvaluator)
                    .join(models.Dataset, true())
                    .where(
                        models.CodeEvaluator.id == evaluator_id,
                        models.Dataset.id == dataset_rowid,
                    )
                )
            ).one_or_none()
            if evaluator_and_dataset is None:
                code_evaluator = await session.get(models.CodeEvaluator, evaluator_id)
                if code_evaluator is None:
                    raise NotFound(f"Code evaluator with id {input.evaluator_id} not found")
                dataset_name = await session.scalar(
                    select(models.Dataset.name).where(models.Dataset.id == dataset_rowid)
                )
                if dataset_name is None:
                    raise NotFound(f"Dataset with id {dataset_rowid} not found")
            else:
                code_evaluator, dataset_name = evaluator_and_dataset

            dataset_evaluator = models.DatasetEvaluators(
                dataset_id=dataset_rowid,
                name=name,
                input_mapping=input_mapping,
                evaluator_id=evaluator_id,
                output_configs=output_configs,
                description=input.description,
                user_id=user_id,
                project=get_project_for_dataset_evaluator(
                    dataset_name=dataset_name,
                    dataset_evaluator_name=str(name),
                ),
            )

            session.add(dataset_evaluator)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        if "foreign" in str(e).lower():
            raise NotFound(f"Dataset with id {input.dataset_id} not found")
        raise Conflict(
            f"DatasetEvaluator with name {input.name} already exists for dataset {input.dataset_id}"
        )

    # Eager response configs avoid a concurrent GraphQL read; persisted null retains inheritance.
    if output_configs is None:
        dataset_evaluator.output_configs = as_output_configs(code_evaluator.output_configs)

    return dataset_evaluator


async def update_dataset_code_evaluator(
    context: EvaluatorServiceContext, input: UpdateDatasetCodeEvaluatorInput
) -> models.DatasetEvaluators:
    """Replace binding settings without editing the code definition."""
    try:
        dataset_evaluator_rowid = from_global_id_with_expected_type(
            global_id=input.dataset_evaluator_id,
            expected_type_name="DatasetEvaluator",
        )
    except ValueError:
        raise BadRequest(f"Invalid dataset evaluator id: {input.dataset_evaluator_id}")

    if input.input_mapping is None:
        raise BadRequest("input_mapping is required")
    input_mapping: InputMapping = input.input_mapping

    user_id = context.user_id

    if input.output_configs is not UNSET and input.output_configs is not None:
        try:
            validate_output_config_names(input.output_configs)
        except ValueError as e:
            raise BadRequest(str(e))

    try:
        async with context.db() as session:
            dataset_evaluator_row = await session.execute(
                select(models.DatasetEvaluators, models.CodeEvaluator)
                .join(
                    models.CodeEvaluator,
                    models.DatasetEvaluators.evaluator_id == models.CodeEvaluator.id,
                )
                .where(models.DatasetEvaluators.id == dataset_evaluator_rowid)
            )
            dataset_evaluator_pair = dataset_evaluator_row.one_or_none()
            if dataset_evaluator_pair is None:
                dataset_evaluator = await session.get(
                    models.DatasetEvaluators, dataset_evaluator_rowid
                )
                if dataset_evaluator is None:
                    raise NotFound(
                        f"DatasetEvaluator with id {input.dataset_evaluator_id} not found"
                    )
                raise BadRequest("Cannot update a non-code dataset evaluator")
            dataset_evaluator, evaluator = dataset_evaluator_pair

            try:
                name = IdentifierModel.model_validate(input.name)
            except ValidationError as error:
                raise BadRequest(f"Invalid evaluator name: {error}")
            dataset_evaluator.name = name
            dataset_evaluator.input_mapping = input_mapping
            dataset_evaluator.updated_at = datetime.now(timezone.utc)
            dataset_evaluator.user_id = user_id

            if input.output_configs is not UNSET:
                if input.output_configs is not None:
                    dataset_evaluator.output_configs = input.output_configs
                else:
                    dataset_evaluator.output_configs = None

            if input.description is not UNSET:
                dataset_evaluator.description = input.description
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
        if "foreign" in str(e).lower():
            raise NotFound(f"Dataset evaluator with id {input.dataset_evaluator_id} not found")
        raise BadRequest(f"DatasetEvaluator with name {input.name} already exists")

    # Eager response configs avoid a concurrent GraphQL read; persisted null retains inheritance.
    if dataset_evaluator.output_configs is None:
        dataset_evaluator.output_configs = as_output_configs(evaluator.output_configs)

    return cast(models.DatasetEvaluators, dataset_evaluator)
