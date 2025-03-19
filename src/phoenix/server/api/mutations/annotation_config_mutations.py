from typing import Any, List, Optional

import strawberry
from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload, selectinload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotationConfig import (
    AnnotationConfig,
    AnnotationType,
    CategoricalAnnotationConfig,
    ContinuousAnnotationConfig,
    FreeformAnnotationConfig,
    OptimizationDirection,
    to_gql_annotation_config,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project

ANNOTATION_TYPE_NAMES = (
    CategoricalAnnotationConfig.__name__,
    ContinuousAnnotationConfig.__name__,
    FreeformAnnotationConfig.__name__,
)


@strawberry.input
class CreateContinuousAnnotationConfigInput:
    name: str
    optimization_direction: OptimizationDirection
    description: Optional[str] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


@strawberry.type
class CreateContinuousAnnotationConfigPayload:
    query: Query
    annotation_config: ContinuousAnnotationConfig


@strawberry.input
class CategoricalAnnotationValueInput:
    label: str
    numeric_score: Optional[float] = None


@strawberry.input
class CreateCategoricalAnnotationConfigInput:
    name: str
    optimization_direction: OptimizationDirection
    description: Optional[str] = None
    values: List[CategoricalAnnotationValueInput]


@strawberry.type
class CreateCategoricalAnnotationConfigPayload:
    query: Query
    annotation_config: CategoricalAnnotationConfig


@strawberry.input
class CreateFreeformAnnotationConfigInput:
    name: str
    optimization_direction: OptimizationDirection
    description: Optional[str] = None


@strawberry.type
class CreateFreeformAnnotationConfigPayload:
    query: Query
    annotation_config: FreeformAnnotationConfig


@strawberry.input
class UpdateCategoricalAnnotationConfigInput:
    config_id: GlobalID
    name: str
    optimization_direction: OptimizationDirection
    description: Optional[str] = None
    values: List[CategoricalAnnotationValueInput]


@strawberry.type
class UpdateCategoricalAnnotationConfigPayload:
    query: Query
    annotation_config: CategoricalAnnotationConfig


@strawberry.input
class PatchAnnotationConfigInput:
    config_id: GlobalID
    name: Optional[str] = None
    description: Optional[str] = None
    optimization_direction: Optional[OptimizationDirection] = None


@strawberry.type
class PatchAnnotationConfigPayload:
    query: Query
    annotation_config: AnnotationConfig


@strawberry.input
class PatchContinuousAnnotationConfigInput:
    config_id: GlobalID
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


@strawberry.type
class PatchContinuousAnnotationConfigPayload:
    query: Query
    annotation_config: ContinuousAnnotationConfig


@strawberry.type
class PatchCategoricalAnnotationConfigPayload:
    query: Query
    annotation_config: CategoricalAnnotationConfig


@strawberry.input
class PatchCategoricalAnnotationValuesInput:
    config_id: GlobalID
    values: List[CategoricalAnnotationValueInput]


@strawberry.type
class PatchCategoricalAnnotationValuesPayload:
    query: Query
    annotation_config: CategoricalAnnotationConfig


@strawberry.input
class PatchCategoricalAnnotationValueInput:
    value_id: GlobalID
    label: Optional[str] = None
    numeric_score: Optional[float] = None


@strawberry.type
class PatchCategoricalAnnotationValuePayload:
    query: Query
    annotation_config: CategoricalAnnotationConfig


@strawberry.input
class DeleteAnnotationConfigInput:
    config_id: GlobalID


@strawberry.type
class DeleteAnnotationConfigPayload:
    query: Query
    annotation_config: AnnotationConfig


@strawberry.input
class AddAnnotationConfigToProjectInput:
    project_id: GlobalID
    annotation_config_id: GlobalID


@strawberry.type
class AddAnnotationConfigToProjectPayload:
    query: Query
    project: Project


@strawberry.input
class UpdateContinuousAnnotationConfigInput:
    config_id: GlobalID
    name: str
    optimization_direction: OptimizationDirection
    description: Optional[str] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


@strawberry.type
class UpdateContinuousAnnotationConfigPayload:
    query: Query
    annotation_config: ContinuousAnnotationConfig


@strawberry.type
class AnnotationConfigMutationMixin:
    @strawberry.mutation
    async def create_continuous_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateContinuousAnnotationConfigInput,
    ) -> CreateContinuousAnnotationConfigPayload:
        async with info.context.db() as session:
            config = models.AnnotationConfig(
                name=input.name,
                annotation_type=AnnotationType.CONTINUOUS,
                optimization_direction=input.optimization_direction.upper(),
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
            continuous_config = to_gql_annotation_config(config)
            assert isinstance(continuous_config, ContinuousAnnotationConfig)
            return CreateContinuousAnnotationConfigPayload(
                query=Query(),
                annotation_config=continuous_config,
            )

    @strawberry.mutation
    async def create_categorical_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateCategoricalAnnotationConfigInput,
    ) -> CreateCategoricalAnnotationConfigPayload:
        async with info.context.db() as session:
            config = models.AnnotationConfig(
                name=input.name,
                annotation_type=AnnotationType.CATEGORICAL,
                optimization_direction=input.optimization_direction.upper(),
                description=input.description,
            )
            cat = models.CategoricalAnnotationConfig()
            for val in input.values:
                allowed_value = models.CategoricalAnnotationValue(
                    label=val.label,
                    numeric_score=val.numeric_score,
                )
                cat.values.append(allowed_value)
            config.categorical_config = cat
            session.add(config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")
        categorical_config = to_gql_annotation_config(config)
        assert isinstance(categorical_config, CategoricalAnnotationConfig)
        return CreateCategoricalAnnotationConfigPayload(
            query=Query(),
            annotation_config=categorical_config,
        )

    @strawberry.mutation
    async def create_freeform_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateFreeformAnnotationConfigInput,
    ) -> CreateFreeformAnnotationConfigPayload:
        async with info.context.db() as session:
            config = models.AnnotationConfig(
                name=input.name,
                annotation_type="FREEFORM",
                optimization_direction=input.optimization_direction.upper(),
                description=input.description,
            )
            session.add(config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")
            freeform_config = to_gql_annotation_config(config)
            assert isinstance(freeform_config, FreeformAnnotationConfig)
            return CreateFreeformAnnotationConfigPayload(
                query=Query(),
                annotation_config=freeform_config,
            )

    @strawberry.mutation
    async def update_continuous_annotation_config(
        self,
        info: Info[Context, None],
        input: UpdateContinuousAnnotationConfigInput,
    ) -> UpdateContinuousAnnotationConfigPayload:
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name=ContinuousAnnotationConfig.__name__
        )
        async with info.context.db() as session:
            existing_config = await session.scalar(
                select(models.AnnotationConfig)
                .options(joinedload(models.AnnotationConfig.continuous_config))
                .where(models.AnnotationConfig.id == config_id)
            )
            if not existing_config:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")

            existing_config.name = input.name
            existing_config.description = input.description
            existing_config.optimization_direction = input.optimization_direction.value

            assert existing_config.continuous_config is not None
            existing_config.continuous_config.lower_bound = input.lower_bound
            existing_config.continuous_config.upper_bound = input.upper_bound

            session.add(existing_config)
            await session.commit()

        continuous_config = to_gql_annotation_config(existing_config)
        assert isinstance(continuous_config, ContinuousAnnotationConfig)
        return UpdateContinuousAnnotationConfigPayload(
            query=Query(),
            annotation_config=continuous_config,
        )

    @strawberry.mutation
    async def update_categorical_annotation_config(
        self,
        info: Info[Context, None],
        input: UpdateCategoricalAnnotationConfigInput,
    ) -> UpdateCategoricalAnnotationConfigPayload:
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name=CategoricalAnnotationConfig.__name__
        )
        async with info.context.db() as session:
            update_stmt = (
                update(models.AnnotationConfig)
                .where(models.AnnotationConfig.id == config_id)
                .values(
                    name=input.name,
                    description=input.description,
                    optimization_direction=input.optimization_direction.value,
                )
                .returning(models.AnnotationConfig)
                .options(selectinload(models.AnnotationConfig.categorical_config))
            )
            config = await session.scalar(update_stmt)
            if config is None:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")

            categorical_config_id = config.categorical_config.id
            await session.execute(
                delete(models.CategoricalAnnotationValue).where(
                    models.CategoricalAnnotationValue.categorical_annotation_config_id
                    == categorical_config_id
                )
            )
            await session.execute(
                insert(models.CategoricalAnnotationValue).values(
                    [
                        {
                            "categorical_annotation_config_id": categorical_config_id,
                            "label": value.label,
                            "numeric_score": value.numeric_score,
                        }
                        for value in input.values
                    ]
                )
            )
            config = await session.scalar(
                select(models.AnnotationConfig)
                .options(
                    joinedload(models.AnnotationConfig.categorical_config).joinedload(
                        models.CategoricalAnnotationConfig.values
                    )
                )
                .where(models.AnnotationConfig.id == config_id)
            )
            assert config is not None
            categorical_config = to_gql_annotation_config(config)
            assert isinstance(categorical_config, CategoricalAnnotationConfig)
            return UpdateCategoricalAnnotationConfigPayload(
                query=Query(),
                annotation_config=categorical_config,
            )

    @strawberry.mutation
    async def patch_annotation_config(
        self,
        info: Info[Context, None],
        input: PatchAnnotationConfigInput,
    ) -> PatchAnnotationConfigPayload:
        config_id = int(input.config_id.node_id)
        if (type_name := input.config_id.type_name) not in ANNOTATION_TYPE_NAMES:
            raise BadRequest(f"Unexpected type name in Relay ID: {type_name}")
        async with info.context.db() as session:
            stmt = (
                select(models.AnnotationConfig)
                .options(
                    joinedload(models.AnnotationConfig.continuous_config),
                    joinedload(models.AnnotationConfig.categorical_config).joinedload(
                        models.CategoricalAnnotationConfig.values
                    ),
                )
                .where(models.AnnotationConfig.id == config_id)
            )
            config = await session.scalar(stmt)
            if not config:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")
            values = {}
            if input.name is not None:
                values["name"] = input.name
            if input.description is not None:
                values["description"] = input.description
            if input.optimization_direction is not None:
                values["optimization_direction"] = input.optimization_direction.upper()
            if values:
                update_stmt = (
                    update(models.AnnotationConfig)
                    .where(models.AnnotationConfig.id == config_id)
                    .values(**values)
                    .returning(models.AnnotationConfig)
                )
                result = await session.execute(update_stmt)
                config = result.scalar_one_or_none()
                if config is None:
                    raise NotFound(
                        f"Annotation configuration with ID '{input.config_id}' not found"
                    )
                await session.commit()
            return PatchAnnotationConfigPayload(
                query=Query(),
                annotation_config=to_gql_annotation_config(config),
            )

    @strawberry.mutation
    async def patch_continuous_annotation_config(
        self,
        info: Info[Context, None],
        input: PatchContinuousAnnotationConfigInput,
    ) -> PatchContinuousAnnotationConfigPayload:
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name="ContinuousAnnotationConfig"
        )
        async with info.context.db() as session:
            stmt = (
                select(models.AnnotationConfig)
                .options(
                    joinedload(models.AnnotationConfig.continuous_config),
                    joinedload(models.AnnotationConfig.categorical_config).joinedload(
                        models.CategoricalAnnotationConfig.values
                    ),
                )
                .where(models.AnnotationConfig.id == config_id)
            )
            config = await session.scalar(stmt)
            if not config or config.annotation_type.upper() != "CONTINUOUS":
                raise NotFound(
                    f"Continuous annotation configuration with ID '{input.config_id}' not found"
                )
            values = {}
            if input.lower_bound is not None:
                values["lower_bound"] = input.lower_bound
            if input.upper_bound is not None:
                values["upper_bound"] = input.upper_bound
            if values:
                update_stmt = (
                    update(models.ContinuousAnnotationConfig)
                    .where(models.ContinuousAnnotationConfig.annotation_config_id == config_id)
                    .values(**values)
                    .returning(models.ContinuousAnnotationConfig)
                )
                await session.execute(update_stmt)
                await session.refresh(config)
            patched_config = to_gql_annotation_config(config)
            assert isinstance(patched_config, ContinuousAnnotationConfig)
            return PatchContinuousAnnotationConfigPayload(
                query=Query(),
                annotation_config=patched_config,
            )

    @strawberry.mutation
    async def patch_categorical_annotation_values(
        self,
        info: Info[Context, None],
        input: PatchCategoricalAnnotationValuesInput,
    ) -> PatchCategoricalAnnotationValuesPayload:
        """
        Replace the entire list of allowed values for a categorical annotation
        configuration.
        """
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name="CategoricalAnnotationConfig"
        )
        async with info.context.db() as session:
            stmt = (
                select(models.AnnotationConfig)
                .options(
                    joinedload(models.AnnotationConfig.categorical_config).joinedload(
                        models.CategoricalAnnotationConfig.values
                    ),
                    joinedload(models.AnnotationConfig.continuous_config),
                )
                .where(models.AnnotationConfig.id == config_id)
            )
            config = await session.scalar(stmt)
            if not config or not config.categorical_config:
                raise NotFound(
                    f"Categorical annotation configuration with ID '{input.config_id}' not found"
                )
            cat = config.categorical_config

            for old_value in list(cat.values):
                await session.delete(old_value)
            new_values = []
            for val in input.values:
                new_val = models.CategoricalAnnotationValue(
                    label=val.label,
                    numeric_score=val.numeric_score,
                )
                new_values.append(new_val)
            cat.values = new_values
            categorical_config = to_gql_annotation_config(config)
            assert isinstance(categorical_config, CategoricalAnnotationConfig)
            return PatchCategoricalAnnotationValuesPayload(
                query=Query(),
                annotation_config=categorical_config,
            )

    @strawberry.mutation
    async def patch_categorical_annotation_value(
        self,
        info: Info[Context, None],
        input: PatchCategoricalAnnotationValueInput,
    ) -> PatchCategoricalAnnotationValuePayload:
        """
        Patch an individual allowed categorical annotation value without replacing the entire list.
        """
        value_id = from_global_id_with_expected_type(
            global_id=input.value_id, expected_type_name="CategoricalAnnotationValue"
        )
        async with info.context.db() as session:
            allowed_value = await session.scalar(
                select(models.CategoricalAnnotationValue)
                .where(models.CategoricalAnnotationValue.id == value_id)
                .options(
                    joinedload(models.CategoricalAnnotationValue.categorical_config).joinedload(
                        models.CategoricalAnnotationConfig.annotation_config
                    )
                )
            )
            if not allowed_value:
                raise NotFound(f"Categorical annotation value with ID '{input.value_id}' not found")
            if not allowed_value:
                raise NotFound(f"Categorical annotation value with ID '{input.value_id}' not found")
            update_values: dict[str, Any] = {}
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
            update_stmt = (
                select(models.AnnotationConfig)
                .options(
                    joinedload(models.AnnotationConfig.categorical_config).joinedload(
                        models.CategoricalAnnotationConfig.values
                    ),
                    joinedload(models.AnnotationConfig.continuous_config),
                )
                .where(
                    models.AnnotationConfig.id
                    == allowed_value.categorical_config.annotation_config.id
                )
            )
            config = await session.scalar(update_stmt)
            if not config:
                raise NotFound(f"Unable to update annotation value with ID '{input.value_id}'")
            patched_config = to_gql_annotation_config(config)
            assert isinstance(patched_config, CategoricalAnnotationConfig)
            return PatchCategoricalAnnotationValuePayload(
                query=Query(),
                annotation_config=patched_config,
            )

    @strawberry.mutation
    async def delete_annotation_config(
        self,
        info: Info[Context, None],
        input: DeleteAnnotationConfigInput,
    ) -> DeleteAnnotationConfigPayload:
        if (type_name := input.config_id.type_name) not in ANNOTATION_TYPE_NAMES:
            raise BadRequest(f"Unexpected type name in Relay ID: {type_name}")
        config_id = int(input.config_id.node_id)
        async with info.context.db() as session:
            annotation_config = await session.scalar(
                select(models.AnnotationConfig)
                .where(models.AnnotationConfig.id == config_id)
                .options(
                    joinedload(models.AnnotationConfig.continuous_config),
                    joinedload(models.AnnotationConfig.categorical_config).joinedload(
                        models.CategoricalAnnotationConfig.values
                    ),
                )
            )
            if annotation_config is None:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")
            await session.execute(
                delete(models.AnnotationConfig).where(models.AnnotationConfig.id == config_id)
            )
        return DeleteAnnotationConfigPayload(
            query=Query(),
            annotation_config=to_gql_annotation_config(annotation_config),
        )

    @strawberry.mutation
    async def add_annotation_config_to_project(
        self,
        info: Info[Context, None],
        input: list[AddAnnotationConfigToProjectInput],
    ) -> AddAnnotationConfigToProjectPayload:
        async with info.context.db() as session:
            for item in input:
                project_id = from_global_id_with_expected_type(
                    global_id=item.project_id, expected_type_name="Project"
                )
                if (type_name := item.annotation_config_id.type_name) not in ANNOTATION_TYPE_NAMES:
                    raise BadRequest(f"Unexpected type name in Relay ID: {type_name}")
                annotation_config_id = int(item.annotation_config_id.node_id)
                project_annotation_config = models.ProjectAnnotationConfig(
                    project_id=project_id,
                    annotation_config_id=annotation_config_id,
                )
                session.add(project_annotation_config)
            await session.commit()
            return AddAnnotationConfigToProjectPayload(
                query=Query(),
                project=Project(project_rowid=project_id),
            )
