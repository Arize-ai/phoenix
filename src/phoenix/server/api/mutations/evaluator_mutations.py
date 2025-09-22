from typing import Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import select
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.CreateDatasetLLMEvaluatorInput import (
    CreateDatasetLLMEvaluatorInput,
)
from phoenix.server.api.input_types.PromptVersionInput import to_orm_prompt_version
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Dataset import Dataset, to_gql_dataset
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser


@strawberry.type
class DatasetEvaluatorMutationPayload:
    dataset: Dataset
    query: Query


@strawberry.type
class EvaluatorMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
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
        input_prompt_version = input.prompt_version
        async with info.context.db() as session:
            # First we create a new prompt version
            try:
                prompt_version = to_orm_prompt_version(input_prompt_version, user_id)
            except ValidationError as error:
                raise BadRequest(str(error))

            # TODO(evaluators): add a small hash to the end to mitigate collisions
            # TODO(evaluators): make the prompt name identifier compatible
            prompt_name = IdentifierModel.model_validate(input.name + "-evaluator")
            prompt = models.Prompt(
                name=prompt_name, description=input.description, prompt_versions=[prompt_version]
            )
            session.add(prompt)

            # Create the evaluator
            evaluator = models.Evaluator(
                name=f"{input.name}-{input.dataset_id}-llm-evaluator",
                description=input.description,
                kind="LLM",
            )
            session.add(evaluator)

            # Next we construct the llm evaluator to wrap the prompt
            # and we point it to the evaluator
            llm_evaluator = models.LLMEvaluator(
                # TODO(evaluators): figure out if naming
                name=f"{input.name}-{input.dataset_id}-evaluator",
                description=input.description,
                prompt=prompt,
                evaluator=evaluator,
                # TODO(evaluators): flesh out the post-processing
                output_score_mapping={},
            )
            session.add(llm_evaluator)

            dataset = await session.scalar(
                select(models.Dataset).where(models.Dataset.id == dataset_id)
            )
            if dataset is None:
                raise ValueError("Dataset not found")

            dataset_evaluator = models.DatasetEvaluator(
                name=input.name,
                description=input.description,
                dataset_id=dataset_id,
                evaluator=evaluator,
            )

            session.add(dataset_evaluator)

            await session.commit()
            ## TODO(evaluators): handle conflicts with clean errors
            return DatasetEvaluatorMutationPayload(dataset=to_gql_dataset(dataset), query=Query())
