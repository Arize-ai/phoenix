"""GraphQL lifecycle and dataset and project attachment for native decision evaluators."""

from typing import Optional, cast

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db.models import DEFAULT_EVALUATION_DELAY_SECONDS, MINIMUM_EVALUATION_DELAY_SECONDS
from phoenix.db.types.decision_evaluators import (
    DecisionScoringPolicy as StoredDecisionScoringPolicy,
)
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.DecisionScoringPolicyInput import (
    DecisionScoringPolicyInput,
)
from phoenix.server.api.input_types.DecisionVersionInput import DecisionVersionInput
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.mutations.evaluator_mutations import (
    DatasetEvaluatorMutationPayload,
    ProjectEvaluatorMutationPayload,
    _evaluator_service_context,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Evaluator import (
    PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION,
    DatasetEvaluator,
    DecisionEvaluator,
    EvaluationTarget,
    ProjectEvaluator,
)
from phoenix.server.evaluators.services import decisions


def _scoring_policy(
    value: Optional[DecisionScoringPolicyInput],
) -> Optional[StoredDecisionScoringPolicy]:
    """The stored form of a policy; an omitted patch field stays UNSET."""
    if value is UNSET:
        return cast(Optional[StoredDecisionScoringPolicy], UNSET)
    if value is None:
        return None
    return value.to_orm()


@strawberry.input
class CreateDecisionEvaluatorInput:
    name: Identifier
    decision_version_id: GlobalID
    description: Optional[str] = None
    scoring_policy: Optional[DecisionScoringPolicyInput] = None


@strawberry.input
class PatchDecisionEvaluatorInput:
    evaluator_id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    decision_version_id: Optional[GlobalID] = UNSET
    scoring_policy: Optional[DecisionScoringPolicyInput] = UNSET


@strawberry.input
class DeleteDecisionEvaluatorInput:
    evaluator_id: GlobalID


@strawberry.input
class CreateDatasetDecisionEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: Optional[GlobalID] = None
    decision_id: Optional[GlobalID] = None
    evaluator_name: Optional[Identifier] = None
    decision_version_id: Optional[GlobalID] = None
    decision_version: Optional[DecisionVersionInput] = None
    scoring_policy: Optional[DecisionScoringPolicyInput] = None
    name: Identifier
    input_mapping: EvaluatorInputMappingInput
    description: Optional[str] = None


@strawberry.input
class UpdateDatasetDecisionEvaluatorInput:
    dataset_evaluator_id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    input_mapping: Optional[EvaluatorInputMappingInput] = UNSET
    decision_version_id: Optional[GlobalID] = UNSET
    decision_version: Optional[DecisionVersionInput] = None
    scoring_policy: Optional[DecisionScoringPolicyInput] = UNSET


@strawberry.input
class CreateProjectDecisionEvaluatorInput:
    project_id: GlobalID
    evaluator_id: Optional[GlobalID] = None
    decision_id: Optional[GlobalID] = None
    evaluator_name: Optional[Identifier] = None
    decision_version_id: Optional[GlobalID] = None
    decision_version: Optional[DecisionVersionInput] = None
    scoring_policy: Optional[DecisionScoringPolicyInput] = None
    name: Identifier
    input_mapping: EvaluatorInputMappingInput
    sampling_rate: float
    evaluation_target: EvaluationTarget
    description: Optional[str] = None
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=None,
        description=(
            "Seconds a trace or session must stay quiet before evaluation is scheduled; the "
            f"minimum is {MINIMUM_EVALUATION_DELAY_SECONDS} seconds. The delay applies to "
            "TRACE and SESSION targets and is rejected for SPAN. Omit or use null to store the "
            f"default: {DEFAULT_EVALUATION_DELAY_SECONDS} seconds for TRACE and SESSION, and 0 "
            "for SPAN, which evaluates spans as they arrive. A trace or "
            "session is evaluated only once, and later activity does not schedule another "
            "evaluation."
        ),
    )


@strawberry.input
class UpdateProjectDecisionEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    input_mapping: Optional[EvaluatorInputMappingInput] = UNSET
    decision_version_id: Optional[GlobalID] = UNSET
    decision_version: Optional[DecisionVersionInput] = None
    scoring_policy: Optional[DecisionScoringPolicyInput] = UNSET
    sampling_rate: float
    evaluation_target: EvaluationTarget = strawberry.field(
        description="The evaluation target is fixed at project evaluator creation."
    )
    filter_condition: str
    enabled: Optional[bool] = UNSET
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=UNSET,
        description=(
            "Seconds a trace or session must stay quiet before evaluation is scheduled; the "
            f"minimum is {MINIMUM_EVALUATION_DELAY_SECONDS} seconds. The delay applies to "
            "TRACE and SESSION targets and is rejected for SPAN. Omit to preserve the current "
            "setting, or use null to restore the default: "
            f"{DEFAULT_EVALUATION_DELAY_SECONDS} seconds for TRACE and SESSION, and 0 for SPAN. "
            "A trace or session is evaluated "
            "only once, and later activity does not schedule another evaluation."
        ),
    )


@strawberry.type
class DecisionEvaluatorMutationPayload:
    evaluator: DecisionEvaluator
    query: Query


@strawberry.type
class DeleteDecisionEvaluatorPayload:
    query: Query


@strawberry.type
class DecisionEvaluatorMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_decision_evaluator(
        self, info: Info[Context, None], input: CreateDecisionEvaluatorInput
    ) -> DecisionEvaluatorMutationPayload:
        evaluator = await decisions.create_decision_evaluator(
            _evaluator_service_context(info.context),
            decisions.CreateDecisionEvaluatorInput(
                name=input.name,
                decision_version_id=input.decision_version_id,
                description=input.description,
                scoring_policy=_scoring_policy(input.scoring_policy),
            ),
        )
        return DecisionEvaluatorMutationPayload(
            evaluator=DecisionEvaluator(id=evaluator.id, db_record=evaluator), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_decision_evaluator(
        self, info: Info[Context, None], input: PatchDecisionEvaluatorInput
    ) -> DecisionEvaluatorMutationPayload:
        evaluator = await decisions.patch_decision_evaluator(
            _evaluator_service_context(info.context),
            input.evaluator_id,
            decisions.DecisionEvaluatorPatch(
                name=input.name,
                description=input.description,
                decision_version_id=input.decision_version_id,
                scoring_policy=_scoring_policy(input.scoring_policy),
            ),
        )
        return DecisionEvaluatorMutationPayload(
            evaluator=DecisionEvaluator(id=evaluator.id, db_record=evaluator), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_decision_evaluator(
        self, info: Info[Context, None], input: DeleteDecisionEvaluatorInput
    ) -> DeleteDecisionEvaluatorPayload:
        await decisions.delete_decision_evaluator(
            _evaluator_service_context(info.context), input.evaluator_id
        )
        return DeleteDecisionEvaluatorPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_decision_evaluator(
        self, info: Info[Context, None], input: CreateDatasetDecisionEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        binding = await decisions.create_dataset_decision_evaluator(
            _evaluator_service_context(info.context),
            dataset_id=input.dataset_id,
            evaluator_id=input.evaluator_id,
            evaluator_name=input.evaluator_name,
            decision_id=input.decision_id,
            decision_version_id=input.decision_version_id,
            decision_version=input.decision_version.to_orm(user_id=info.context.user_id)
            if input.decision_version is not None
            else None,
            scoring_policy=_scoring_policy(input.scoring_policy),
            name=input.name,
            input_mapping=input.input_mapping.to_orm(),
            description=input.description,
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=binding.id, db_record=binding), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_decision_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetDecisionEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        binding = await decisions.update_dataset_decision_evaluator(
            _evaluator_service_context(info.context),
            dataset_evaluator_id=input.dataset_evaluator_id,
            name=input.name,
            description=input.description,
            input_mapping=input.input_mapping.to_orm()
            if input.input_mapping is not UNSET and input.input_mapping is not None
            else input.input_mapping,
            decision_version_id=input.decision_version_id,
            decision_version=input.decision_version.to_orm(user_id=info.context.user_id)
            if input.decision_version is not None
            else None,
            scoring_policy=_scoring_policy(input.scoring_policy),
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=binding.id, db_record=binding), query=Query()
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Create a decision project evaluator from an existing decision evaluator, a saved "
            f"decision version, or a new one. {PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}"
        ),
    )  # type: ignore
    async def create_project_decision_evaluator(
        self, info: Info[Context, None], input: CreateProjectDecisionEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        binding = await decisions.create_project_decision_evaluator(
            _evaluator_service_context(info.context),
            decisions.CreateProjectDecisionEvaluatorInput(
                project_id=input.project_id,
                name=input.name,
                input_mapping=input.input_mapping.to_orm(),
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target.value,
                filter_condition=input.filter_condition,
                enabled=input.enabled,
                evaluation_delay_seconds=input.evaluation_delay_seconds,
                description=input.description,
                evaluator_id=input.evaluator_id,
                decision_id=input.decision_id,
                evaluator_name=input.evaluator_name,
                decision_version_id=input.decision_version_id,
                decision_version=input.decision_version.to_orm(user_id=info.context.user_id)
                if input.decision_version is not None
                else None,
                scoring_policy=_scoring_policy(input.scoring_policy),
            ),
        )
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=binding.id, db_record=binding), query=Query()
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Update a decision project evaluator. Its decision version, scoring policy, and "
            "description belong to the underlying evaluator and apply to every project and "
            f"dataset it is bound to. {PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}"
        ),
    )  # type: ignore
    async def update_project_decision_evaluator(
        self, info: Info[Context, None], input: UpdateProjectDecisionEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        binding = await decisions.update_project_decision_evaluator(
            _evaluator_service_context(info.context),
            decisions.UpdateProjectDecisionEvaluatorInput(
                project_evaluator_id=input.project_evaluator_id,
                sampling_rate=input.sampling_rate,
                evaluation_target=input.evaluation_target.value,
                filter_condition=input.filter_condition,
                name=input.name,
                description=input.description,
                input_mapping=input.input_mapping.to_orm()
                if input.input_mapping is not UNSET and input.input_mapping is not None
                else input.input_mapping,
                decision_version_id=input.decision_version_id,
                decision_version=input.decision_version.to_orm(user_id=info.context.user_id)
                if input.decision_version is not None
                else None,
                scoring_policy=_scoring_policy(input.scoring_policy),
                enabled=input.enabled,
                evaluation_delay_seconds=input.evaluation_delay_seconds,
            ),
        )
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=binding.id, db_record=binding), query=Query()
        )
