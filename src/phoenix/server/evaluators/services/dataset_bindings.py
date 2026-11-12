"""Dataset evaluator operations shared by GraphQL and REST."""

from dataclasses import dataclass
from typing import Any, Optional, Sequence, TypedDict, Union

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import (
    is_foreign_key_violation,
)
from phoenix.db.types.annotation_configs import OutputConfigType, as_output_configs
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import AlreadyExists, BadRequest, Conflict, NotFound
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.evaluators.runtime.builtin import get_builtin_evaluator_by_key
from phoenix.server.evaluators.services.definitions import (
    EvaluatorServiceContext,
    ValidatedCode,
    check_output_configs,
    create_code_definition,
    create_llm_definition,
    preflight_code,
    update_llm_definition,
)
from phoenix.server.evaluators.services.management import (
    EVALUATOR_MODEL_BY_KIND,
    generate_unique_evaluator_name,
    get_live_dataset_evaluator,
    get_project_for_dataset_evaluator,
    is_sole_evaluator_binding,
    mark_bindings_deleted,
    parse_evaluator_id,
)
from phoenix.server.evaluators.services.prompt_source import CreatePromptSource
from phoenix.server.evaluators.validation import validate_decision_input_mapping


@dataclass(kw_only=True)
class CreateDatasetLLMEvaluatorInput:
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET
    prompt_source: CreatePromptSource
    output_configs: list[OutputConfigType]
    input_mapping: Optional[InputMapping] = None
    binding_description: Optional[str] = None
    binding_output_configs: Optional[list[OutputConfigType]] = None
    input_schema: Any = None  # a JSON schema object, parsed by the service


@dataclass(kw_only=True)
class UpdateDatasetLLMEvaluatorInput:
    dataset_evaluator_id: GlobalID
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET
    prompt_source: CreatePromptSource
    output_configs: list[OutputConfigType]
    input_mapping: Optional[InputMapping] = None
    binding_description: Optional[str] = UNSET
    binding_output_configs: Optional[list[OutputConfigType]] = UNSET
    input_schema: Any = UNSET  # a JSON schema object, parsed by the service


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
class CodeEvaluatorDefinition:
    source_code: str
    language: models.LanguageName
    sandbox_config_id: GlobalID


@dataclass(kw_only=True)
class CreateDatasetCodeEvaluatorInput:
    dataset_id: GlobalID
    name: Identifier
    evaluator_id: Optional[GlobalID] = None
    definition: Optional[CodeEvaluatorDefinition] = None
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
    delete_associated_prompt_or_decision: bool = False


async def create_dataset_llm_evaluator(
    context: EvaluatorServiceContext, input: CreateDatasetLLMEvaluatorInput
) -> models.DatasetEvaluators:
    """Create an LLM definition, pinned prompt, trace project, and dataset binding."""
    binding = check_dataset_binding(
        dataset_id=input.dataset_id,
        name=input.name,
        input_mapping=input.input_mapping,
        description=input.binding_description,
        output_configs=input.binding_output_configs,
        user_id=context.user_id,
    )
    output_configs = check_output_configs("LLM", input.output_configs)
    try:
        async with context.db() as session:
            evaluator = await create_llm_definition(
                session,
                name=await generate_unique_evaluator_name(session, binding.name),
                prompt_source=input.prompt_source,
                output_configs=output_configs,
                user_id=context.user_id,
                description=input.description if input.description is not UNSET else None,
                input_schema=input.input_schema,
                binding_name=binding.name,
            )
            dataset_evaluator = await bind_dataset_evaluator(session, evaluator, binding)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_error(
            context, error, name=binding.name, dataset_id=input.dataset_id
        ) from error
    return dataset_evaluator


class DatasetEvaluatorWriteValues(TypedDict, total=False):
    name: Identifier
    description: Optional[str]
    input_mapping: InputMapping
    output_configs: Optional[list[OutputConfigType]]
    user_id: Optional[int]


async def write_dataset_evaluator(
    session: AsyncSession, dataset_evaluator_id: int, values: DatasetEvaluatorWriteValues
) -> models.DatasetEvaluators:
    """Update binding columns and return the row as the database stored it.

    The row is handed to resolvers after the session closes, so server-generated values
    such as updated_at must come back with the write instead of being loaded lazily.
    """
    row: models.DatasetEvaluators | None = await session.scalar(
        update(models.DatasetEvaluators)
        .where(
            models.DatasetEvaluators.id == dataset_evaluator_id,
            models.DatasetEvaluators.deleted_at.is_(None),
        )
        .values(**values)
        .returning(models.DatasetEvaluators)
    )
    if row is None:
        raise NotFound(f"Dataset evaluator not found: {dataset_evaluator_id}")
    return row


async def update_dataset_llm_evaluator(
    context: EvaluatorServiceContext, input: UpdateDatasetLLMEvaluatorInput
) -> models.DatasetEvaluators:
    """Update a dataset binding and its shared LLM definition."""
    try:
        evaluator_name = Identifier.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")
    output_configs = check_output_configs("LLM", input.output_configs)
    try:
        dataset_evaluator_rowid = from_global_id_with_expected_type(
            global_id=input.dataset_evaluator_id,
            expected_type_name="DatasetEvaluator",
        )
    except ValueError:
        raise BadRequest(f"Invalid DatasetEvaluator id: {input.dataset_evaluator_id}")
    if input.input_mapping is None:
        raise BadRequest("input_mapping is required")

    try:
        async with context.db() as session:
            # Edits and deletes take the evaluator row first, so they queue instead of deadlocking.
            evaluator_id = await session.scalar(
                select(models.DatasetEvaluators.evaluator_id).where(
                    models.DatasetEvaluators.id == dataset_evaluator_rowid,
                    models.DatasetEvaluators.deleted_at.is_(None),
                )
            )
            if evaluator_id is not None:
                await session.get(models.LLMEvaluator, evaluator_id, with_for_update=True)
            pair = (
                await session.execute(
                    select(models.DatasetEvaluators, models.LLMEvaluator)
                    .join(
                        models.LLMEvaluator,
                        models.DatasetEvaluators.evaluator_id == models.LLMEvaluator.id,
                    )
                    .where(
                        models.DatasetEvaluators.id == dataset_evaluator_rowid,
                        models.DatasetEvaluators.deleted_at.is_(None),
                    )
                )
            ).one_or_none()
            if pair is None:
                raise NotFound(f"LLM dataset evaluator not found: {input.dataset_evaluator_id}")
            dataset_evaluator, llm_evaluator = pair
            shared_evaluator_changed = False
            if dataset_evaluator.name != evaluator_name and await is_sole_evaluator_binding(
                session, llm_evaluator.id
            ):
                llm_evaluator.name = await generate_unique_evaluator_name(session, evaluator_name)
                shared_evaluator_changed = True
            await update_llm_definition(
                session,
                llm_evaluator,
                prompt_source=input.prompt_source,
                output_configs=output_configs,
                description=input.description,
                name=evaluator_name,
                user_id=context.user_id,
                shared_evaluator_changed=shared_evaluator_changed,
                input_schema=input.input_schema,
            )
            binding_values = DatasetEvaluatorWriteValues(
                name=evaluator_name,
                input_mapping=input.input_mapping,
                user_id=context.user_id,
            )
            if input.binding_description is not UNSET:
                binding_values["description"] = input.binding_description
            if input.binding_output_configs is not UNSET:
                binding_values["output_configs"] = dataset_binding_overrides(
                    llm_evaluator, input.binding_output_configs
                )
            dataset_evaluator = await write_dataset_evaluator(
                session, dataset_evaluator.id, binding_values
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_error(
            context,
            error,
            name=evaluator_name,
            dataset_evaluator_id=input.dataset_evaluator_id,
        ) from error
    return dataset_evaluator


async def delete_dataset_evaluators(
    context: EvaluatorServiceContext, input: DeleteDatasetEvaluatorsInput
) -> list[GlobalID]:
    """Delete bindings, returning those deleted now; missing or already deleted ones are skipped.

    A deleted binding disappears at once, and its trace project and traces are removed in the
    background. LLM and code definitions that nothing else binds are removed with them;
    built-ins are retained. Associated prompts are removed only when requested and no LLM
    evaluator references them.
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

    async with context.db() as session:
        deleted_rowids = await mark_bindings_deleted(
            session,
            models.DatasetEvaluators,
            dataset_evaluator_rowids,
            delete_unused_evaluator=True,
            delete_associated_prompt_or_decision=input.delete_associated_prompt_or_decision,
        )
    if deleted_rowids:
        context.wake_evaluator_purger()
    return [GlobalID("DatasetEvaluator", str(rowid)) for rowid in deleted_rowids]


async def create_dataset_builtin_evaluator(
    context: EvaluatorServiceContext, input: CreateDatasetBuiltinEvaluatorInput
) -> models.DatasetEvaluators:
    """Bind a registered built-in evaluator, inheriting unset output overrides."""
    binding = check_dataset_binding(
        dataset_id=input.dataset_id,
        name=input.name,
        input_mapping=input.input_mapping,
        description=input.description,
        output_configs=input.output_configs,
        user_id=context.user_id,
    )
    try:
        built_in_evaluator_id, _ = parse_evaluator_id(input.evaluator_id)
    except ValueError as e:
        raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

    try:
        async with context.db() as session:
            builtin_db = await session.get(models.BuiltinEvaluator, built_in_evaluator_id)
            if builtin_db is None:
                raise NotFound(f"Built-in evaluator with id {input.evaluator_id} not found")
            builtin_evaluator = get_builtin_evaluator_by_key(builtin_db.key)
            if builtin_evaluator is None:
                raise NotFound(f"Built-in evaluator class not found for key: {builtin_db.key}")
            dataset_evaluator = await bind_dataset_evaluator(session, builtin_db, binding)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_error(
            context, error, name=binding.name, dataset_id=input.dataset_id
        ) from error

    # Eager response configs avoid a concurrent GraphQL read; persisted null retains inheritance.
    if dataset_evaluator.output_configs is None:
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

    try:
        name = Identifier.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")
    try:
        async with context.db() as session:
            dataset_evaluator_row = await session.execute(
                select(models.DatasetEvaluators, models.BuiltinEvaluator)
                .join(
                    models.BuiltinEvaluator,
                    models.DatasetEvaluators.evaluator_id == models.BuiltinEvaluator.id,
                )
                .where(
                    models.DatasetEvaluators.id == dataset_evaluator_rowid,
                    models.DatasetEvaluators.deleted_at.is_(None),
                )
            )
            dataset_evaluator_pair = dataset_evaluator_row.one_or_none()
            if dataset_evaluator_pair is None:
                dataset_evaluator = await get_live_dataset_evaluator(
                    session, dataset_evaluator_rowid
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

            binding_values = DatasetEvaluatorWriteValues(
                name=name,
                input_mapping=input_mapping,
                user_id=user_id,
            )
            if input.output_configs is not UNSET:
                binding_values["output_configs"] = dataset_binding_overrides(
                    builtin_db, input.output_configs
                )
            if input.description is not UNSET:
                binding_values["description"] = input.description
            dataset_evaluator = await write_dataset_evaluator(
                session, dataset_evaluator.id, binding_values
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_error(
            context, error, name=name, dataset_evaluator_id=input.dataset_evaluator_id
        ) from error

    # Eager response configs avoid a concurrent GraphQL read; persisted null retains inheritance.
    if dataset_evaluator.output_configs is None:
        dataset_evaluator.output_configs = list(builtin_evaluator().output_configs)

    return dataset_evaluator


async def create_dataset_code_evaluator(
    context: EvaluatorServiceContext, input: CreateDatasetCodeEvaluatorInput
) -> models.DatasetEvaluators:
    """Bind an existing or new code evaluator and create its dataset trace project."""
    binding = check_dataset_binding(
        dataset_id=input.dataset_id,
        name=input.name,
        input_mapping=input.input_mapping,
        description=input.description,
        output_configs=input.output_configs,
        user_id=context.user_id,
    )
    if (input.evaluator_id is None) == (input.definition is None):
        raise BadRequest("Provide exactly one of evaluator_id or definition")
    evaluator_id: Optional[int] = None
    if input.evaluator_id is not None:
        try:
            evaluator_id, evaluator_kind = parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")
        if evaluator_kind != "CODE":
            raise BadRequest("Evaluator must be a code evaluator")

    definition = input.definition
    code: Optional[ValidatedCode] = None
    output_configs: list[OutputConfigType] = []
    if definition is not None:
        output_configs = check_output_configs("CODE", input.output_configs)
        code = await preflight_code(
            context,
            source_code=definition.source_code,
            language=definition.language,
            sandbox_config_id=definition.sandbox_config_id,
            action="creating this evaluator",
        )

    try:
        async with context.db() as session:
            code_evaluator: Optional[models.CodeEvaluator]
            if evaluator_id is not None:
                # Locked so a concurrent definition delete sees the binding.
                code_evaluator = await session.get(
                    models.CodeEvaluator, evaluator_id, with_for_update=True
                )
                if code_evaluator is None:
                    raise NotFound(f"Code evaluator with id {input.evaluator_id} not found")
            else:
                assert code is not None
                code_evaluator = await create_code_definition(
                    session,
                    name=await generate_unique_evaluator_name(session, binding.name),
                    code=code,
                    input_mapping=binding.input_mapping,
                    output_configs=output_configs,
                    user_id=context.user_id,
                    description=input.description,
                )
            dataset_evaluator = await bind_dataset_evaluator(session, code_evaluator, binding)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_error(
            context, error, name=binding.name, dataset_id=input.dataset_id
        ) from error

    # Eager response configs avoid a concurrent GraphQL read; persisted null retains inheritance.
    if dataset_evaluator.output_configs is None:
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

    try:
        name = Identifier.model_validate(input.name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")
    try:
        async with context.db() as session:
            dataset_evaluator_row = await session.execute(
                select(models.DatasetEvaluators, models.CodeEvaluator)
                .join(
                    models.CodeEvaluator,
                    models.DatasetEvaluators.evaluator_id == models.CodeEvaluator.id,
                )
                .where(
                    models.DatasetEvaluators.id == dataset_evaluator_rowid,
                    models.DatasetEvaluators.deleted_at.is_(None),
                )
            )
            dataset_evaluator_pair = dataset_evaluator_row.one_or_none()
            if dataset_evaluator_pair is None:
                dataset_evaluator = await get_live_dataset_evaluator(
                    session, dataset_evaluator_rowid
                )
                if dataset_evaluator is None:
                    raise NotFound(
                        f"DatasetEvaluator with id {input.dataset_evaluator_id} not found"
                    )
                raise BadRequest("Cannot update a non-code dataset evaluator")
            dataset_evaluator, evaluator = dataset_evaluator_pair

            binding_values = DatasetEvaluatorWriteValues(
                name=name,
                input_mapping=input_mapping,
                user_id=user_id,
            )
            if input.output_configs is not UNSET:
                binding_values["output_configs"] = dataset_binding_overrides(
                    evaluator, input.output_configs
                )
            if input.description is not UNSET:
                binding_values["description"] = input.description
            dataset_evaluator = await write_dataset_evaluator(
                session, dataset_evaluator.id, binding_values
            )
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_error(
            context, error, name=name, dataset_evaluator_id=input.dataset_evaluator_id
        ) from error

    # Eager response configs avoid a concurrent GraphQL read; persisted null retains inheritance.
    if dataset_evaluator.output_configs is None:
        dataset_evaluator.output_configs = as_output_configs(evaluator.output_configs)

    return dataset_evaluator


@dataclass(kw_only=True)
class DatasetEvaluatorPatch:
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    input_mapping: Optional[InputMapping] = UNSET
    output_configs: Optional[list[OutputConfigType]] = UNSET


@dataclass(kw_only=True)
class CreateDatasetLLMBindingInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: InputMapping
    description: Optional[str] = None
    output_configs: Optional[list[OutputConfigType]] = None


async def create_dataset_llm_binding(
    context: EvaluatorServiceContext, input: CreateDatasetLLMBindingInput
) -> models.DatasetEvaluators:
    """Bind an existing LLM evaluator to a dataset and create the binding's trace project.

    The evaluator row is locked so a concurrent definition delete sees the binding.
    """
    binding = check_dataset_binding(
        dataset_id=input.dataset_id,
        name=input.name,
        input_mapping=input.input_mapping,
        description=input.description,
        output_configs=input.output_configs,
        user_id=context.user_id,
    )
    evaluator_rowid = _decode_id(input.evaluator_id, "LLMEvaluator", "evaluator")
    try:
        async with context.db() as session:
            evaluator = await session.get(
                models.LLMEvaluator, evaluator_rowid, with_for_update=True
            )
            if evaluator is None:
                raise NotFound(f"LLM evaluator not found: {input.evaluator_id}")
            dataset_evaluator = await bind_dataset_evaluator(session, evaluator, binding)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_error(
            context, error, name=binding.name, dataset_id=input.dataset_id
        ) from error
    return dataset_evaluator


@dataclass(frozen=True, kw_only=True)
class DatasetBinding:
    """A dataset binding's settings, checked before the transaction that writes it.
    `dataset_id` is the id as the caller sent it, which errors name."""

    dataset_id: GlobalID
    dataset_rowid: int
    name: Identifier
    input_mapping: InputMapping
    description: Optional[str]
    output_configs: Optional[list[OutputConfigType]]
    user_id: Optional[int]


def check_dataset_binding(
    *,
    dataset_id: GlobalID,
    name: Identifier,
    input_mapping: Optional[InputMapping],
    user_id: Optional[int],
    description: Optional[str] = None,
    output_configs: Optional[list[OutputConfigType]] = None,
) -> DatasetBinding:
    """Refuse binding settings that are invalid whatever the database holds."""
    dataset_rowid = _decode_id(dataset_id, "Dataset", "dataset")
    if input_mapping is None:
        raise BadRequest("input_mapping is required")
    try:
        validated_name = Identifier.model_validate(name)
    except ValidationError as error:
        raise BadRequest(f"Invalid evaluator name: {error}")
    return DatasetBinding(
        dataset_id=dataset_id,
        dataset_rowid=dataset_rowid,
        name=validated_name,
        input_mapping=input_mapping,
        description=description,
        output_configs=output_configs,
        user_id=user_id,
    )


async def bind_dataset_evaluator(
    session: AsyncSession, evaluator: models.Evaluator, binding: DatasetBinding
) -> models.DatasetEvaluators:
    """Bind an evaluator to a dataset with its own trace project, after check_dataset_binding.
    A decision evaluator's mapping must fill its variables from an experiment run."""
    dataset_name = await session.scalar(
        select(models.Dataset.name).where(models.Dataset.id == binding.dataset_rowid)
    )
    if dataset_name is None:
        raise NotFound(f"Dataset not found: {binding.dataset_id}")
    output_configs = (
        dataset_binding_overrides(evaluator, binding.output_configs)
        if binding.output_configs is not None
        else None
    )
    if isinstance(evaluator, models.DecisionEvaluator):
        validate_decision_input_mapping(evaluator.selected_version, binding.input_mapping)
    dataset_evaluator = models.DatasetEvaluators(
        dataset_id=binding.dataset_rowid,
        evaluator_id=evaluator.id,
        name=binding.name,
        description=binding.description,
        output_configs=output_configs,
        input_mapping=binding.input_mapping,
        user_id=binding.user_id,
        project=get_project_for_dataset_evaluator(
            dataset_name=dataset_name,
            dataset_evaluator_name=binding.name.root,
        ),
    )
    session.add(dataset_evaluator)
    await session.flush()
    return dataset_evaluator


def dataset_binding_overrides(
    evaluator: models.Evaluator, output_configs: Optional[list[OutputConfigType]]
) -> Optional[list[OutputConfigType]]:
    """The output configs a dataset binding of this evaluator stores when it is given these;
    None inherits the evaluator's. A decision evaluator's outputs follow its questions and
    scoring policy, so its binding stores None and is refused any other outputs."""
    if isinstance(evaluator, models.DecisionEvaluator):
        if output_configs is None or list(output_configs) != evaluator.output_configs:
            raise BadRequest(
                "Decision outputs are derived from the questions and scoring policy; "
                "edit the scoring policy to change scoring"
            )
        return None
    if output_configs is None:
        return None
    if isinstance(evaluator, models.LLMEvaluator):
        return list(check_output_configs("LLM", output_configs))
    return check_output_configs("CODE", output_configs)


async def dataset_binding_error(
    context: EvaluatorServiceContext,
    error: Union[PostgreSQLIntegrityError, SQLiteIntegrityError],
    *,
    name: Optional[Identifier],
    dataset_id: Optional[GlobalID] = None,
    dataset_evaluator_id: Optional[GlobalID] = None,
) -> Exception:
    """The error for a dataset binding write the database refused. A create passes the
    dataset it binds to, an edit the binding it edits. A missing parent row is NotFound;
    a name another binding of the dataset holds is AlreadyExists; anything else is a
    conflicting resource. An edit's own binding never counts as holding its name."""
    binding_rowid = (
        _decode_id(dataset_evaluator_id, "DatasetEvaluator", "dataset evaluator")
        if dataset_evaluator_id is not None
        else None
    )
    if is_foreign_key_violation(error):
        if dataset_evaluator_id is not None:
            return NotFound(f"Dataset evaluator not found: {dataset_evaluator_id}")
        return NotFound(f"Dataset not found: {dataset_id}")
    existing_id: Optional[int] = None
    if name is not UNSET and name is not None:
        name = Identifier.model_validate(name)
        query = select(models.DatasetEvaluators.id).where(
            models.DatasetEvaluators.name == name,
            models.DatasetEvaluators.deleted_at.is_(None),
        )
        if binding_rowid is not None:
            query = query.where(
                models.DatasetEvaluators.dataset_id
                == select(models.DatasetEvaluators.dataset_id)
                .where(models.DatasetEvaluators.id == binding_rowid)
                .scalar_subquery(),
                models.DatasetEvaluators.id != binding_rowid,
            )
        else:
            assert dataset_id is not None
            query = query.where(
                models.DatasetEvaluators.dataset_id == _decode_id(dataset_id, "Dataset", "dataset")
            )
        async with context.db() as session:
            existing_id = await session.scalar(query)
    if existing_id is not None:
        assert name is not None
        return AlreadyExists(
            f"An evaluator named '{name.root}' already exists for this dataset",
            existing_id=str(GlobalID("DatasetEvaluator", str(existing_id))),
        )
    if binding_rowid is not None:
        return Conflict("Could not update the dataset evaluator because of a conflicting resource")
    return Conflict(f"Could not bind evaluator '{name}' because of a conflicting resource")


async def detach_dataset_evaluators(
    context: EvaluatorServiceContext,
    dataset_evaluator_ids: list[GlobalID],
    *,
    dataset_id: Optional[GlobalID] = None,
) -> None:
    """Delete bindings while preserving shared definitions and prompts.

    A deleted binding disappears at once, and its trace project and traces are removed in the
    background. Missing or already deleted bindings are ignored. With a dataset, a binding of
    another dataset is refused before any change.
    """
    rowids = [
        _decode_id(binding_id, "DatasetEvaluator", "dataset evaluator")
        for binding_id in dataset_evaluator_ids
    ]
    async with context.db() as session:
        elsewhere: Sequence[int] = []
        if dataset_id is not None:
            dataset_rowid = _decode_id(dataset_id, "Dataset", "dataset")
            elsewhere = (
                await session.scalars(
                    select(models.DatasetEvaluators.id).where(
                        models.DatasetEvaluators.id.in_(rowids),
                        models.DatasetEvaluators.dataset_id != dataset_rowid,
                        models.DatasetEvaluators.deleted_at.is_(None),
                    )
                )
            ).all()
        if elsewhere:
            listed = ", ".join(str(GlobalID("DatasetEvaluator", str(i))) for i in elsewhere)
            raise BadRequest(f"These bindings belong to another dataset: {listed}")

        deleted_rowids = await mark_bindings_deleted(
            session,
            models.DatasetEvaluators,
            rowids,
            delete_unused_evaluator=False,
            delete_associated_prompt_or_decision=False,
        )
    if deleted_rowids:
        context.wake_evaluator_purger()


async def patch_dataset_evaluator(
    context: EvaluatorServiceContext,
    dataset_evaluator_id: GlobalID,
    patch: DatasetEvaluatorPatch,
) -> models.DatasetEvaluators:
    """Patch binding overrides without editing the shared evaluator definition."""
    try:
        row_id = from_global_id_with_expected_type(dataset_evaluator_id, "DatasetEvaluator")
    except ValueError as error:
        raise BadRequest(f"Invalid dataset evaluator id: {dataset_evaluator_id}") from error
    try:
        async with context.db() as session:
            row = await get_live_dataset_evaluator(session, row_id)
            if row is None:
                raise NotFound(f"Dataset evaluator not found: {dataset_evaluator_id}")
            kind = await session.scalar(
                select(models.Evaluator.kind).where(models.Evaluator.id == row.evaluator_id)
            )
            assert kind is not None
            evaluator = await session.get(EVALUATOR_MODEL_BY_KIND[kind], row.evaluator_id)
            assert evaluator is not None
            values = DatasetEvaluatorWriteValues(user_id=context.user_id)
            if patch.name is not UNSET:
                try:
                    values["name"] = Identifier.model_validate(patch.name)
                except ValidationError as error:
                    raise BadRequest(f"Invalid evaluator name: {error}") from error
            if patch.input_mapping is not UNSET:
                if patch.input_mapping is None:
                    raise BadRequest("input_mapping cannot be null for dataset evaluators")
                if isinstance(evaluator, models.DecisionEvaluator):
                    validate_decision_input_mapping(evaluator.selected_version, patch.input_mapping)
                values["input_mapping"] = patch.input_mapping
            if patch.description is not UNSET:
                values["description"] = patch.description
            if patch.output_configs is not UNSET:
                values["output_configs"] = dataset_binding_overrides(
                    evaluator, patch.output_configs
                )
            row = await write_dataset_evaluator(session, row.id, values)
    except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_error(
            context, error, name=patch.name, dataset_evaluator_id=dataset_evaluator_id
        ) from error
    return row


def _decode_id(global_id: GlobalID, type_name: str, label: str) -> int:
    """Decode a typed GlobalID, reporting a malformed or mistyped id as a client error."""
    try:
        return from_global_id_with_expected_type(global_id=global_id, expected_type_name=type_name)
    except ValueError as error:
        raise BadRequest(f"Invalid {label} id: {global_id}") from error
