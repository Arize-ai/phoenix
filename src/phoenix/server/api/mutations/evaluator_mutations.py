from typing import Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    OutputConfigType,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers import dataset_evaluator_service, evaluator_service
from phoenix.server.api.helpers.evaluator_management import (
    PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION,
    raise_on_uninferable_evaluate_signature,
    validate_code_evaluator_sandbox_config,
)
from phoenix.server.api.input_types.AnnotationConfigInput import (
    AnnotationConfigInput,
)
from phoenix.server.api.input_types.evaluator_adapters import (
    convert_output_config_inputs_to_pydantic,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Evaluator import (
    CodeEvaluator,
    DatasetEvaluator,
    EvaluationTarget,
    ProjectEvaluator,
)
from phoenix.server.api.types.SandboxConfig import (
    Language,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.online_eval.session_policy import (
    DEFAULT_SESSION_EVALUATION_DELAY_SECONDS,
    MINIMUM_EVALUATION_DELAY_SECONDS,
)


def _evaluator_service_context(context: Context) -> evaluator_service.EvaluatorServiceContext:
    request = context.request
    assert isinstance(request, Request)
    return evaluator_service.EvaluatorServiceContext(
        db=context.db,
        sandbox_runtime=context.sandbox_runtime,
        user_id=int(request.user.identity) if "user" in request.scope else None,
    )


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
    description: Optional[str] = UNSET
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
class CreateDatasetCodeEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None
    output_configs: Optional[list[AnnotationConfigInput]] = None
    description: Optional[str] = None


@strawberry.input
class UpdateDatasetCodeEvaluatorInput:
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


@strawberry.input
class CreateProjectLLMEvaluatorInput:
    project_id: GlobalID
    name: Identifier
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    input_mapping: EvaluatorInputMappingInput
    sampling_rate: float
    evaluation_target: EvaluationTarget
    description: Optional[str] = None
    prompt_version_id: Optional[GlobalID] = UNSET
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=None,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit or use null to store the current default of "
            f"{DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} seconds. A session is evaluated only "
            "once, and later activity does not schedule another evaluation."
        ),
    )


@strawberry.input
class UpdateProjectLLMEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Identifier
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    input_mapping: EvaluatorInputMappingInput
    sampling_rate: float
    evaluation_target: EvaluationTarget = strawberry.field(
        description="The evaluation target is fixed at project evaluator creation."
    )
    filter_condition: str
    enabled: Optional[bool] = UNSET
    description: Optional[str] = UNSET
    prompt_version_id: Optional[GlobalID] = UNSET
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=UNSET,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit to preserve the current setting, or use null "
            f"to store the current default of {DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} "
            "seconds. A session is evaluated only once, and later activity does not schedule "
            "another evaluation."
        ),
    )


@strawberry.input
class AddProjectCodeEvaluatorInput:
    project_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    sampling_rate: float
    evaluation_target: EvaluationTarget
    input_mapping: Optional[EvaluatorInputMappingInput] = strawberry.field(
        default=None,
        description=(
            "Project-specific CODE input mapping. Null inherits the evaluator input mapping; "
            "an object overrides it."
        ),
    )
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=None,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit or use null to store the current default of "
            f"{DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} seconds. A session is evaluated only "
            "once, and later activity does not schedule another evaluation."
        ),
    )


@strawberry.input
class CreateProjectCodeEvaluatorInput:
    project_id: GlobalID
    name: Identifier
    source_code: str
    language: Language
    sandbox_config_id: GlobalID
    evaluator_input_mapping: EvaluatorInputMappingInput
    sampling_rate: float
    evaluation_target: EvaluationTarget
    description: Optional[str] = None
    output_configs: Optional[list[AnnotationConfigInput]] = None
    input_mapping: Optional[EvaluatorInputMappingInput] = strawberry.field(
        default=None,
        description=(
            "Project-specific CODE input mapping. Null inherits the evaluator input mapping; "
            "an object overrides it."
        ),
    )
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=None,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit or use null to store the current default of "
            f"{DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} seconds. A session is evaluated only "
            "once, and later activity does not schedule another evaluation."
        ),
    )


@strawberry.input
class UpdateProjectCodeEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Identifier
    sampling_rate: float
    evaluation_target: EvaluationTarget = strawberry.field(
        description="The evaluation target is fixed at project evaluator creation."
    )
    filter_condition: str
    evaluator_input_mapping: Optional[EvaluatorInputMappingInput] = UNSET
    enabled: Optional[bool] = UNSET
    description: Optional[str] = UNSET
    source_code: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    output_configs: Optional[list[AnnotationConfigInput]] = UNSET
    input_mapping: Optional[EvaluatorInputMappingInput] = strawberry.field(
        default=UNSET,
        description=(
            "Project-specific CODE input mapping patch. Omit to preserve the current setting, "
            "use null to inherit the evaluator input mapping, or provide an object to override it."
        ),
    )
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=UNSET,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit to preserve the current setting, or use null "
            f"to store the current default of {DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} "
            "seconds. A session is evaluated only once, and later activity does not schedule "
            "another evaluation."
        ),
    )


@strawberry.input
class SetProjectEvaluatorEnabledInput:
    project_evaluator_id: GlobalID
    enabled: bool


@strawberry.type
class ProjectEvaluatorMutationPayload:
    evaluator: ProjectEvaluator
    query: Query


@strawberry.input
class DeleteProjectEvaluatorsInput:
    project_evaluator_ids: list[GlobalID]
    delete_associated_prompt: bool = True


@strawberry.type
class DeleteProjectEvaluatorsPayload:
    project_evaluator_ids: list[GlobalID]
    query: Query


@strawberry.input
class CreateCodeEvaluatorInput:
    name: Identifier
    source_code: str
    language: Language
    sandbox_config_id: GlobalID
    description: Optional[str] = None
    output_configs: Optional[list[AnnotationConfigInput]] = None
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.input
class PatchCodeEvaluatorInput:
    id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    input_mapping: Optional[EvaluatorInputMappingInput] = UNSET
    output_configs: Optional[list[AnnotationConfigInput]] = UNSET


@strawberry.input
class CreateCodeEvaluatorVersionInput:
    code_evaluator_id: GlobalID
    source_code: str


@strawberry.type
class CodeEvaluatorMutationPayload:
    evaluator: CodeEvaluator
    query: Query


@strawberry.type
class CreateCodeEvaluatorVersionPayload:
    evaluator: CodeEvaluator
    was_created: bool = strawberry.field(
        description=(
            "True when a new CodeEvaluatorVersion row was appended. False when the call"
            " dedup'd against the existing tip because source_code was unchanged."
        )
    )
    query: Query


@strawberry.type
class EvaluatorMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=f"Create an LLM project evaluator. {PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}",
    )  # type: ignore
    async def create_project_llm_evaluator(
        self, info: Info[Context, None], input: CreateProjectLLMEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        command = evaluator_service.CreateProjectLLMEvaluatorInput(
            project_id=input.project_id,
            name=input.name,
            prompt_version=input.prompt_version.to_orm_prompt_version(),
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            sampling_rate=input.sampling_rate,
            evaluation_target=input.evaluation_target.value,
            description=input.description,
            prompt_version_id=input.prompt_version_id,
            filter_condition=input.filter_condition,
            enabled=input.enabled,
            evaluation_delay_seconds=input.evaluation_delay_seconds,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.create_project_llm_evaluator(context, command)
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=f"Update an LLM project evaluator. {PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}",
    )  # type: ignore
    async def update_project_llm_evaluator(
        self, info: Info[Context, None], input: UpdateProjectLLMEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        command = evaluator_service.UpdateProjectLLMEvaluatorInput(
            project_evaluator_id=input.project_evaluator_id,
            name=input.name,
            prompt_version=input.prompt_version.to_orm_prompt_version(),
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            sampling_rate=input.sampling_rate,
            evaluation_target=input.evaluation_target.value,
            filter_condition=input.filter_condition,
            enabled=input.enabled,
            description=input.description,
            prompt_version_id=input.prompt_version_id,
            evaluation_delay_seconds=input.evaluation_delay_seconds,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.update_project_llm_evaluator(context, command)
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Bind an existing CODE evaluator to a project. The evaluator's configuration is "
            "shared with every project and dataset it is bound to. "
            f"{PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}"
        ),
    )  # type: ignore
    async def add_project_code_evaluator(
        self, info: Info[Context, None], input: AddProjectCodeEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        command = evaluator_service.AddProjectCodeEvaluatorInput(
            project_id=input.project_id,
            evaluator_id=input.evaluator_id,
            name=input.name,
            sampling_rate=input.sampling_rate,
            evaluation_target=input.evaluation_target.value,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            filter_condition=input.filter_condition,
            enabled=input.enabled,
            evaluation_delay_seconds=input.evaluation_delay_seconds,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.add_project_code_evaluator(context, command)
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=f"Create a CODE project evaluator. {PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}",
    )  # type: ignore
    async def create_project_code_evaluator(
        self, info: Info[Context, None], input: CreateProjectCodeEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        command = evaluator_service.CreateProjectCodeEvaluatorInput(
            project_id=input.project_id,
            name=input.name,
            source_code=input.source_code,
            language=input.language.to_orm(),
            sandbox_config_id=input.sandbox_config_id,
            evaluator_input_mapping=input.evaluator_input_mapping.to_orm()
            if input.evaluator_input_mapping is not None
            and input.evaluator_input_mapping is not UNSET
            else input.evaluator_input_mapping,
            sampling_rate=input.sampling_rate,
            evaluation_target=input.evaluation_target.value,
            description=input.description,
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            filter_condition=input.filter_condition,
            enabled=input.enabled,
            evaluation_delay_seconds=input.evaluation_delay_seconds,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.create_project_code_evaluator(context, command)
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Update a CODE project evaluator. Editing changes the underlying evaluator, which "
            "applies to every project and dataset it is bound to. "
            f"{PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}"
        ),
    )  # type: ignore
    async def update_project_code_evaluator(
        self, info: Info[Context, None], input: UpdateProjectCodeEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        command = evaluator_service.UpdateProjectCodeEvaluatorInput(
            project_evaluator_id=input.project_evaluator_id,
            name=input.name,
            sampling_rate=input.sampling_rate,
            evaluation_target=input.evaluation_target.value,
            filter_condition=input.filter_condition,
            evaluator_input_mapping=input.evaluator_input_mapping.to_orm()
            if input.evaluator_input_mapping is not None
            and input.evaluator_input_mapping is not UNSET
            else input.evaluator_input_mapping,
            enabled=input.enabled,
            description=input.description,
            source_code=input.source_code,
            sandbox_config_id=input.sandbox_config_id,
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            evaluation_delay_seconds=input.evaluation_delay_seconds,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.update_project_code_evaluator(context, command)
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Enable or disable a project evaluator. Flips only the enabled flag on the "
            "project binding, leaving the underlying evaluator untouched. Works for both "
            "LLM and CODE evaluators."
        ),
    )  # type: ignore
    async def set_project_evaluator_enabled(
        self, info: Info[Context, None], input: SetProjectEvaluatorEnabledInput
    ) -> ProjectEvaluatorMutationPayload:
        command = evaluator_service.SetProjectEvaluatorEnabledInput(
            project_evaluator_id=input.project_evaluator_id,
            enabled=input.enabled,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.set_project_evaluator_enabled(context, command)
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_project_evaluators(
        self, info: Info[Context, None], input: DeleteProjectEvaluatorsInput
    ) -> DeleteProjectEvaluatorsPayload:
        command = evaluator_service.DeleteProjectEvaluatorsInput(
            project_evaluator_ids=input.project_evaluator_ids,
            delete_associated_prompt=input.delete_associated_prompt,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.delete_project_evaluators(context, command)
        return DeleteProjectEvaluatorsPayload(project_evaluator_ids=result, query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_llm_evaluator(
        self, info: Info[Context, None], input: CreateDatasetLLMEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        command = dataset_evaluator_service.CreateDatasetLLMEvaluatorInput(
            dataset_id=input.dataset_id,
            name=input.name,
            description=input.description,
            prompt_version_id=input.prompt_version_id,
            prompt_version=input.prompt_version.to_orm_prompt_version(),
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
        )
        result = await dataset_evaluator_service.create_dataset_llm_evaluator(
            _evaluator_service_context(info.context), command
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_llm_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetLLMEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        command = dataset_evaluator_service.UpdateDatasetLLMEvaluatorInput(
            dataset_evaluator_id=input.dataset_evaluator_id,
            dataset_id=input.dataset_id,
            name=input.name,
            description=input.description,
            prompt_version_id=input.prompt_version_id,
            prompt_version=input.prompt_version.to_orm_prompt_version(),
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
        )
        result = await dataset_evaluator_service.update_dataset_llm_evaluator(
            _evaluator_service_context(info.context), command
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_dataset_evaluators(
        self, info: Info[Context, None], input: DeleteDatasetEvaluatorsInput
    ) -> DeleteDatasetEvaluatorsPayload:
        command = dataset_evaluator_service.DeleteDatasetEvaluatorsInput(
            dataset_evaluator_ids=input.dataset_evaluator_ids,
            delete_associated_prompt=input.delete_associated_prompt,
        )
        result = await dataset_evaluator_service.delete_dataset_evaluators(
            _evaluator_service_context(info.context), command
        )
        return DeleteDatasetEvaluatorsPayload(dataset_evaluator_ids=result, query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_builtin_evaluator(
        self, info: Info[Context, None], input: CreateDatasetBuiltinEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        command = dataset_evaluator_service.CreateDatasetBuiltinEvaluatorInput(
            dataset_id=input.dataset_id,
            evaluator_id=input.evaluator_id,
            name=input.name,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            description=input.description,
        )
        result = await dataset_evaluator_service.create_dataset_builtin_evaluator(
            _evaluator_service_context(info.context), command
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_builtin_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetBuiltinEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        command = dataset_evaluator_service.UpdateDatasetBuiltinEvaluatorInput(
            dataset_evaluator_id=input.dataset_evaluator_id,
            name=input.name,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            description=input.description,
        )
        result = await dataset_evaluator_service.update_dataset_builtin_evaluator(
            _evaluator_service_context(info.context), command
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_code_evaluator(
        self, info: Info[Context, None], input: CreateDatasetCodeEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        command = dataset_evaluator_service.CreateDatasetCodeEvaluatorInput(
            dataset_id=input.dataset_id,
            evaluator_id=input.evaluator_id,
            name=input.name,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            description=input.description,
        )
        result = await dataset_evaluator_service.create_dataset_code_evaluator(
            _evaluator_service_context(info.context), command
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_code_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetCodeEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        command = dataset_evaluator_service.UpdateDatasetCodeEvaluatorInput(
            dataset_evaluator_id=input.dataset_evaluator_id,
            name=input.name,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
            description=input.description,
        )
        result = await dataset_evaluator_service.update_dataset_code_evaluator(
            _evaluator_service_context(info.context), command
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_code_evaluator(
        self,
        info: Info[Context, None],
        input: CreateCodeEvaluatorInput,
    ) -> CodeEvaluatorMutationPayload:
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        try:
            validated_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        output_configs: list[OutputConfigType] = (
            convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs
            else []
        )
        if input.input_mapping is None:
            raise BadRequest("input_mapping is required")
        input_mapping_orm = input.input_mapping.to_orm()
        raise_on_uninferable_evaluate_signature(input.source_code, input.language.to_orm())
        sandbox_config_id = await validate_code_evaluator_sandbox_config(
            info.context.db,
            sandbox_config_global_id=input.sandbox_config_id,
            language=input.language.value,
            action="creating this evaluator",
            source_code=input.source_code,
            sandbox_runtime=info.context.sandbox_runtime,
        )

        try:
            async with info.context.db() as session:
                row = models.CodeEvaluator(
                    name=validated_name,
                    description=input.description,
                    language=input.language.value,
                    user_id=user_id,
                    sandbox_config_id=sandbox_config_id,
                    input_mapping=input_mapping_orm,
                    output_configs=output_configs,
                )
                session.add(row)
                await session.flush()

                version = models.CodeEvaluatorVersion(
                    code_evaluator_id=row.id,
                    source_code=input.source_code,
                    user_id=user_id,
                )
                session.add(version)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            raise BadRequest(f"Could not create code evaluator: {e}")

        return CodeEvaluatorMutationPayload(
            evaluator=CodeEvaluator(id=row.id, db_record=row),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_code_evaluator(
        self,
        info: Info[Context, None],
        input: PatchCodeEvaluatorInput,
    ) -> CodeEvaluatorMutationPayload:
        command = evaluator_service.PatchCodeEvaluatorInput(
            id=input.id,
            name=input.name,
            description=input.description,
            sandbox_config_id=input.sandbox_config_id,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not None and input.input_mapping is not UNSET
            else input.input_mapping,
            output_configs=convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs is not None and input.output_configs is not UNSET
            else input.output_configs,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.patch_code_evaluator(context, command)
        return CodeEvaluatorMutationPayload(
            evaluator=CodeEvaluator(id=result.id, db_record=result), query=Query()
        )

    @strawberry.mutation(  # type: ignore
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Append a new immutable CodeEvaluatorVersion. If source_code matches the"
            " current tip, no row is appended and was_created=false."
        ),
    )
    async def create_code_evaluator_version(
        self,
        info: Info[Context, None],
        input: CreateCodeEvaluatorVersionInput,
    ) -> CreateCodeEvaluatorVersionPayload:
        command = evaluator_service.CreateCodeEvaluatorVersionInput(
            code_evaluator_id=input.code_evaluator_id,
            source_code=input.source_code,
        )
        context = _evaluator_service_context(info.context)
        result = await evaluator_service.create_code_evaluator_version(context, command)
        evaluator, _, was_created = result
        return CreateCodeEvaluatorVersionPayload(
            evaluator=CodeEvaluator(id=evaluator.id, db_record=evaluator),
            was_created=was_created,
            query=Query(),
        )
