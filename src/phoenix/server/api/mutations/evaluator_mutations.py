from secrets import token_hex
from typing import Optional

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Evaluator import CodeEvaluator, Evaluator, LLMEvaluator
from phoenix.server.api.types.Identifier import Identifier
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.bearer_auth import PhoenixUser


def _parse_evaluator_id(global_id: GlobalID) -> tuple[int, str]:
    """
    Parse evaluator ID accepting both LLMEvaluator and CodeEvaluator types.

    Returns:
        tuple of (evaluator_rowid, evaluator_type_name)
    """
    type_name, evaluator_rowid = from_global_id(global_id)
    if type_name not in (LLMEvaluator.__name__, CodeEvaluator.__name__):
        raise ValueError(
            f"Invalid evaluator type: {type_name}. "
            f"Expected {LLMEvaluator.__name__} or {CodeEvaluator.__name__}"
        )
    return evaluator_rowid, type_name


@strawberry.input
class CreateDatasetLLMEvaluatorInput:
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET
    prompt_version: ChatPromptVersionInput


@strawberry.input
class CreateCodeEvaluatorInput:
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET


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


@strawberry.type
class EvaluatorMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_code_evaluator(
        self, info: Info[Context, None], input: CreateCodeEvaluatorInput
    ) -> CodeEvaluatorMutationPayload:
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
            ],
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
    ) -> LLMEvaluatorMutationPayload:
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
        try:
            evaluator_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")
        llm_evaluator = models.LLMEvaluator(
            name=evaluator_name,
            description=input.description or None,
            kind="LLM",
            output_config={},
            user_id=user_id,
            prompt=prompt,
            datasets_evaluators=[
                models.DatasetsEvaluators(
                    dataset_id=dataset_id,
                    input_config={},
                )
            ],
        )
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
            evaluator_rowid, evaluator_type_name = _parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

        async with info.context.db() as session:
            dataset = await session.get(models.Dataset, dataset_rowid)
            if dataset is None:
                raise NotFound(f"Dataset with id {input.dataset_id} not found")
            evaluator = await session.get(models.Evaluator, evaluator_rowid)
            if evaluator is None:
                raise NotFound(f"Evaluator with id {input.evaluator_id} not found")

            dataset_evaluator = models.DatasetsEvaluators(
                dataset_id=dataset_rowid,
                evaluator_id=evaluator_rowid,
                input_config={},
            )
            session.add(dataset_evaluator)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                pass  # evaluator is already assigned to the dataset

        # Return the appropriate evaluator type based on what was provided
        evaluator_instance: Evaluator
        if evaluator_type_name == LLMEvaluator.__name__:
            evaluator_instance = LLMEvaluator(id=evaluator_rowid)
        else:  # CodeEvaluator
            evaluator_instance = CodeEvaluator(id=evaluator_rowid)

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
            evaluator_rowid, evaluator_type_name = _parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

        async with info.context.db() as session:
            await session.execute(
                delete(models.DatasetsEvaluators).where(
                    models.DatasetsEvaluators.dataset_id == dataset_rowid,
                    models.DatasetsEvaluators.evaluator_id == evaluator_rowid,
                )
            )

        # Return the appropriate evaluator type based on what was provided
        evaluator_instance: Evaluator
        if evaluator_type_name == LLMEvaluator.__name__:
            evaluator_instance = LLMEvaluator(id=evaluator_rowid)
        else:  # CodeEvaluator
            evaluator_instance = CodeEvaluator(id=evaluator_rowid)

        return EvaluatorMutationPayload(
            evaluator=evaluator_instance,
            query=Query(),
        )
