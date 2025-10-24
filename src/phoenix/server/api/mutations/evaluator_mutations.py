from secrets import token_hex
from typing import Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.CreateDatasetLLMEvaluatorInput import (
    CreateDatasetLLMEvaluatorInput,
)
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Evaluator import LLMEvaluator
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.type
class LLMEvaluatorMutationPayload:
    evaluator: LLMEvaluator
    query: Query


@strawberry.type
class EvaluatorMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_llm_evaluator(
        self, info: Info[Context, None], input: CreateDatasetLLMEvaluatorInput
    ) -> LLMEvaluatorMutationPayload:
        dataset_id = from_global_id_with_expected_type(
            global_id=input.dataset_id, expected_type_name=Dataset.__name__
        )
        user_id: Optional[int] = None

        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)
        input_prompt_version = input.prompt_version
        async with info.context.db() as session:
            # First, verify the dataset exists
            dataset = await session.get(models.Dataset, dataset_id)
            if dataset is None:
                raise BadRequest(f"Dataset with id {dataset_id} not found")

            # Create a new prompt version
            try:
                prompt_version = input_prompt_version.to_orm_prompt_version(user_id)
            except ValidationError as error:
                raise BadRequest(str(error))

            prompt_name = IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}")
            prompt = models.Prompt(
                name=prompt_name, description=input.description, prompt_versions=[prompt_version]
            )
            session.add(prompt)
            await session.flush()

            evaluator_name = IdentifierModel.model_validate(f"{input.name}")
            llm_evaluator = models.LLMEvaluator(
                name=evaluator_name,
                description=input.description,
                kind="LLM",
                prompt_id=prompt.id,
                output_config={},
                user_id=user_id,
            )
            session.add(llm_evaluator)
            await session.flush()

            dataset_evaluator = models.DatasetEvaluator(
                dataset_id=dataset_id,
                evaluator_id=llm_evaluator.id,
                input_config={},
            )
            session.add(dataset_evaluator)

        return LLMEvaluatorMutationPayload(
            evaluator=LLMEvaluator(id=llm_evaluator.id, db_record=llm_evaluator),
            query=Query(),
        )
