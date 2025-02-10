from typing import List, Optional

import strawberry
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import selectinload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.types.AnnotationConfig import (
    AnnotationConfig,
    AnnotationType,
    ScoreDirection,
    to_gql_annotation_config,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.input
class CreateContinuousAnnotationConfigInput:
    name: str
    score_direction: ScoreDirection
    description: Optional[str] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


@strawberry.input
class CreateCategoricalAnnotationValueInput:
    label: str
    numeric_score: Optional[float] = None


@strawberry.input
class CreateCategoricalAnnotationConfigInput:
    name: str
    score_direction: ScoreDirection
    description: Optional[str] = None
    is_ordinal: bool
    multilabel_allowed: bool
    allowed_values: List[CreateCategoricalAnnotationValueInput]


@strawberry.input
class CreateBinaryAnnotationConfigInput:
    name: str
    score_direction: ScoreDirection
    description: Optional[str] = None
    is_ordinal: bool = False
    multilabel_allowed: bool = False
    allowed_values: List[CreateCategoricalAnnotationValueInput]


@strawberry.input
class CreateFreeformAnnotationConfigInput:
    name: str
    score_direction: ScoreDirection
    description: Optional[str] = None


@strawberry.input
class PatchAnnotationConfigInput:
    config_id: GlobalID
    name: Optional[str] = None
    description: Optional[str] = None
    score_direction: Optional[ScoreDirection] = None


@strawberry.input
class PatchCategoricalAnnotationValuesInput:
    config_id: GlobalID
    allowed_values: List[CreateCategoricalAnnotationValueInput]


@strawberry.input
class PatchCategoricalAnnotationValueInput:
    value_id: GlobalID
    label: Optional[str] = None
    numeric_score: Optional[float] = None


@strawberry.type
class DeleteAnnotationConfigInput:
    config_id: GlobalID


@strawberry.type
class AnnotationConfigMutationMixin:
    @strawberry.mutation
    async def create_continuous_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateContinuousAnnotationConfigInput,
    ) -> AnnotationConfig:
        async with info.context.db() as session:
            config = models.AnnotationConfig(
                name=input.name,
                annotation_type=AnnotationType.CONTINUOUS,
                score_direction=input.score_direction.upper(),
                description=input.description,
            )
            cont = models.ContinuousAnnotationConfig(
                lower_bound=input.lower_bound,
                upper_bound=input.upper_bound,
            )
            config.continuous_config = cont
            session.add(config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")
            return to_gql_annotation_config(config)

    @strawberry.mutation
    async def create_categorical_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateCategoricalAnnotationConfigInput,
    ) -> AnnotationConfig:
        async with info.context.db() as session:
            config = models.AnnotationConfig(
                name=input.name,
                annotation_type=AnnotationType.CATEGORICAL,
                score_direction=input.score_direction.upper(),
                description=input.description,
            )
            cat = models.CategoricalAnnotationConfig(
                is_ordinal=input.is_ordinal,
                multilabel_allowed=input.multilabel_allowed,
            )
            for val in input.allowed_values:
                allowed_value = models.CategoricalAnnotationValue(
                    label=val.label,
                    numeric_score=val.numeric_score,
                )
                cat.allowed_values.append(allowed_value)
            config.categorical_config = cat
            session.add(config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")
        return to_gql_annotation_config(config)

    @strawberry.mutation
    async def create_binary_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateBinaryAnnotationConfigInput,
    ) -> AnnotationConfig:
        if len(input.allowed_values) != 2:
            raise BadRequest("Binary annotation configuration must have exactly two allowed values")
        async with info.context.db() as session:
            config = models.AnnotationConfig(
                name=input.name,
                annotation_type="BINARY",
                score_direction=input.score_direction.upper(),
                description=input.description,
            )
            cat = models.CategoricalAnnotationConfig(
                is_ordinal=input.is_ordinal,
                multilabel_allowed=input.multilabel_allowed,
            )
            for val in input.allowed_values:
                allowed_value = models.CategoricalAnnotationValue(
                    label=val.label,
                    numeric_score=val.numeric_score,
                )
                cat.allowed_values.append(allowed_value)
            config.categorical_config = cat
            session.add(config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")
            return to_gql_annotation_config(config)

    @strawberry.mutation
    async def create_freeform_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateFreeformAnnotationConfigInput,
    ) -> AnnotationConfig:
        async with info.context.db() as session:
            config = models.AnnotationConfig(
                name=input.name,
                annotation_type="FREEFORM",
                score_direction=input.score_direction.upper(),
                description=input.description,
            )
            session.add(config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")
            return to_gql_annotation_config(config)

    @strawberry.mutation
    async def patch_annotation_config(
        self,
        info: Info[Context, None],
        input: PatchAnnotationConfigInput,
    ) -> AnnotationConfig:
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name="AnnotationConfig"
        )
        async with info.context.db() as session:
            values = {}
            if input.name is not None:
                values["name"] = input.name
            if input.description is not None:
                values["description"] = input.description
            if input.score_direction is not None:
                values["score_direction"] = input.score_direction.upper()
            if not values:
                config = await session.get(models.AnnotationConfig, config_id)
                if not config:
                    raise NotFound(
                        f"Annotation configuration with ID '{input.config_id}' not found"
                    )
                return to_gql_annotation_config(config)

            stmt = (
                update(models.AnnotationConfig)
                .where(models.AnnotationConfig.id == config_id)
                .values(**values)
                .returning(models.AnnotationConfig)
            )
            result = await session.execute(stmt)
            config = result.scalar_one_or_none()
            if config is None:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")
            await session.commit()
        return to_gql_annotation_config(config)

    @strawberry.mutation
    async def patch_categorical_annotation_values(
        self,
        info: Info[Context, None],
        input: PatchCategoricalAnnotationValuesInput,
    ) -> AnnotationConfig:
        """
        Replace the entire list of allowed values for a categorical (or binary) annotation
        configuration. For binary configurations, the new list must contain exactly two allowed
        values.
        """
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name="AnnotationConfig"
        )
        async with info.context.db() as session:
            stmt = (
                select(models.AnnotationConfig)
                .options(
                    selectinload(models.AnnotationConfig.categorical_config),
                    selectinload(models.CategoricalAnnotationConfig.allowed_values),
                )
                .where(models.AnnotationConfig.id == config_id)
            )
            config = await session.scalar(stmt)
            if not config or not config.categorical_config:
                raise NotFound(
                    f"Categorical annotation configuration with ID '{input.config_id}' not found"
                )
            cat = config.categorical_config

            if config.annotation_type.upper() == "BINARY" and len(input.allowed_values) != 2:
                raise BadRequest(
                    "Binary annotation configuration must have exactly two allowed values"
                )

            for old_value in list(cat.allowed_values):
                await session.delete(old_value)
            new_values = []
            for val in input.allowed_values:
                new_val = models.CategoricalAnnotationValue(
                    label=val.label,
                    numeric_score=val.numeric_score,
                )
                new_values.append(new_val)
            cat.allowed_values = new_values
            await session.commit()
        return to_gql_annotation_config(config)

    @strawberry.mutation
    async def patch_categorical_annotation_value(
        self,
        info: Info[Context, None],
        input: PatchCategoricalAnnotationValueInput,
    ) -> AnnotationConfig:
        """
        Patch an individual allowed categorical annotation value without replacing the entire list.
        """
        value_id = from_global_id_with_expected_type(
            global_id=input.value_id, expected_type_name="CategoricalAnnotationValue"
        )
        async with info.context.db() as session:
            allowed_value = await session.get(models.CategoricalAnnotationValue, value_id)
            if not allowed_value:
                raise NotFound(f"Categorical annotation value with ID '{input.value_id}' not found")
            update_values = {}
            if input.label is not None:
                update_values["label"] = input.label
            if input.numeric_score is not None:
                update_values["numeric_score"] = input.numeric_score
            if update_values:
                stmt = (
                    update(models.CategoricalAnnotationValue)
                    .where(models.CategoricalAnnotationValue.id == value_id)
                    .values(**update_values)
                    .returning(models.CategoricalAnnotationValue)
                )
                await session.execute(stmt)
                await session.commit()
            config = allowed_value.categorical_config.annotation_config
            return to_gql_annotation_config(config)

    @strawberry.mutation
    async def delete_annotation_config(
        self,
        info: Info[Context, None],
        input: DeleteAnnotationConfigInput,
    ) -> bool:
        """
        Delete an annotation configuration by its global ID.
        Returns True on successful deletion.
        """
        real_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name="AnnotationConfig"
        )
        async with info.context.db() as session:
            stmt = delete(models.AnnotationConfig).where(models.AnnotationConfig.id == real_id)
            result = await session.execute(stmt)
            if result.rowcount == 0:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")
            await session.commit()
        return True
