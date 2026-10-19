"""GraphQL lifecycle and dataset attachment for native decision evaluators."""

from typing import Any, Optional, cast

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db.types.identifier import Identifier
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.helpers import decision_evaluator_service as service
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.mutations.evaluator_mutations import (
    DatasetEvaluatorMutationPayload,
    _evaluator_service_context,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Evaluator import DatasetEvaluator, DecisionEvaluator


@strawberry.input
class CreateDecisionEvaluatorInput:
    name: Identifier
    decision_version_id: GlobalID
    description: Optional[str] = None
    projection_policy: Optional[JSON] = None


@strawberry.input
class PatchDecisionEvaluatorInput:
    evaluator_id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    decision_version_id: Optional[GlobalID] = UNSET
    projection_policy: Optional[JSON] = UNSET


@strawberry.input
class DeleteDecisionEvaluatorInput:
    evaluator_id: GlobalID


@strawberry.input
class CreateDatasetDecisionEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: EvaluatorInputMappingInput
    description: Optional[str] = None
    projection_policy: Optional[JSON] = None


@strawberry.input
class PatchDatasetDecisionEvaluatorInput:
    dataset_evaluator_id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    input_mapping: Optional[EvaluatorInputMappingInput] = UNSET
    projection_policy: Optional[JSON] = UNSET


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
        evaluator = await service.create_decision_evaluator(
            _evaluator_service_context(info.context),
            service.CreateDecisionEvaluatorInput(
                name=input.name,
                decision_version_id=input.decision_version_id,
                description=input.description,
                projection_policy=cast(Optional[dict[str, Any]], input.projection_policy),
            ),
        )
        return DecisionEvaluatorMutationPayload(
            evaluator=DecisionEvaluator(id=evaluator.id, db_record=evaluator), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_decision_evaluator(
        self, info: Info[Context, None], input: PatchDecisionEvaluatorInput
    ) -> DecisionEvaluatorMutationPayload:
        evaluator = await service.patch_decision_evaluator(
            _evaluator_service_context(info.context),
            input.evaluator_id,
            service.DecisionEvaluatorPatch(
                name=input.name,
                description=input.description,
                decision_version_id=input.decision_version_id,
                projection_policy=cast(Optional[dict[str, Any]], input.projection_policy),
            ),
        )
        return DecisionEvaluatorMutationPayload(
            evaluator=DecisionEvaluator(id=evaluator.id, db_record=evaluator), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_decision_evaluator(
        self, info: Info[Context, None], input: DeleteDecisionEvaluatorInput
    ) -> DeleteDecisionEvaluatorPayload:
        await service.delete_decision_evaluator(
            _evaluator_service_context(info.context), input.evaluator_id
        )
        return DeleteDecisionEvaluatorPayload(query=Query())

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_decision_evaluator(
        self, info: Info[Context, None], input: CreateDatasetDecisionEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        binding = await service.create_dataset_decision_binding(
            _evaluator_service_context(info.context),
            service.CreateDatasetDecisionBindingInput(
                dataset_id=input.dataset_id,
                evaluator_id=input.evaluator_id,
                name=input.name,
                input_mapping=input.input_mapping.to_orm(),
                description=input.description,
                projection_policy=cast(Optional[dict[str, Any]], input.projection_policy),
            ),
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=binding.id, db_record=binding), query=Query()
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_dataset_decision_evaluator(
        self, info: Info[Context, None], input: PatchDatasetDecisionEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        from phoenix.server.api.helpers.dataset_evaluator_service import (
            DatasetEvaluatorPatch,
            patch_dataset_evaluator,
        )

        binding = await patch_dataset_evaluator(
            _evaluator_service_context(info.context),
            input.dataset_evaluator_id,
            DatasetEvaluatorPatch(
                name=input.name,
                description=input.description,
                input_mapping=input.input_mapping.to_orm()
                if input.input_mapping is not UNSET and input.input_mapping is not None
                else input.input_mapping,
                decision_projection_policy=cast(Optional[dict[str, Any]], input.projection_policy),
            ),
        )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=binding.id, db_record=binding), query=Query()
        )
