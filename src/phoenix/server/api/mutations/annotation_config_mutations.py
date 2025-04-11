from typing import Optional

import strawberry
from sqlalchemy import delete, select, tuple_
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.orm import joinedload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.auth import IsNotReadOnly
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
    ProjectAnnotationConfigAssociation,
    to_gql_annotation_config,
    to_gql_categorical_annotation_config,
    to_gql_continuous_annotation_config,
    to_gql_freeform_annotation_config,
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
    score: Optional[float] = None


@strawberry.input
class CreateCategoricalAnnotationConfigInput:
    name: str
    optimization_direction: OptimizationDirection
    description: Optional[str] = None
    values: list[CategoricalAnnotationValueInput]


@strawberry.type
class CreateCategoricalAnnotationConfigPayload:
    query: Query
    annotation_config: CategoricalAnnotationConfig


@strawberry.input
class CreateFreeformAnnotationConfigInput:
    name: str
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
    values: list[CategoricalAnnotationValueInput]


@strawberry.type
class UpdateCategoricalAnnotationConfigPayload:
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
class RemoveAnnotationConfigFromProjectInput:
    project_id: GlobalID
    annotation_config_id: GlobalID


@strawberry.type
class RemoveAnnotationConfigFromProjectPayload:
    query: Query
    project: Project
    project_annotation_config_associations: list[ProjectAnnotationConfigAssociation]


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


@strawberry.input
class UpdateFreeformAnnotationConfigInput:
    config_id: GlobalID
    name: str
    description: Optional[str] = None


@strawberry.type
class UpdateFreeformAnnotationConfigPayload:
    query: Query
    annotation_config: FreeformAnnotationConfig


@strawberry.type
class AnnotationConfigMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def create_categorical_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateCategoricalAnnotationConfigInput,
    ) -> CreateCategoricalAnnotationConfigPayload:
        async with info.context.db() as session:
            annotation_config = models.AnnotationConfig(
                name=input.name,
                annotation_type=AnnotationType.CATEGORICAL.value,
                description=input.description,
            )
            categorical_annotation_config = models.CategoricalAnnotationConfig(
                optimization_direction=input.optimization_direction.value,
            )
            for value in input.values:
                categorical_annotation_config.values.append(
                    models.CategoricalAnnotationValue(
                        label=value.label,
                        score=value.score,
                    )
                )
            annotation_config.categorical_annotation_config = categorical_annotation_config
            session.add(annotation_config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")
        return CreateCategoricalAnnotationConfigPayload(
            query=Query(),
            annotation_config=to_gql_categorical_annotation_config(annotation_config),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def create_continuous_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateContinuousAnnotationConfigInput,
    ) -> CreateContinuousAnnotationConfigPayload:
        async with info.context.db() as session:
            annotation_config = models.AnnotationConfig(
                name=input.name,
                annotation_type=AnnotationType.CONTINUOUS.value,
                description=input.description,
            )
            continuous_annotation_config = models.ContinuousAnnotationConfig(
                optimization_direction=input.optimization_direction.value,
                lower_bound=input.lower_bound,
                upper_bound=input.upper_bound,
            )
            annotation_config.continuous_annotation_config = continuous_annotation_config
            session.add(annotation_config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("The annotation config has a conflict")
            return CreateContinuousAnnotationConfigPayload(
                query=Query(),
                annotation_config=to_gql_continuous_annotation_config(annotation_config),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def create_freeform_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateFreeformAnnotationConfigInput,
    ) -> CreateFreeformAnnotationConfigPayload:
        async with info.context.db() as session:
            config = models.AnnotationConfig(
                name=input.name,
                annotation_type="FREEFORM",
                description=input.description,
            )
            session.add(config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")
            return CreateFreeformAnnotationConfigPayload(
                query=Query(),
                annotation_config=to_gql_freeform_annotation_config(config),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def update_categorical_annotation_config(
        self,
        info: Info[Context, None],
        input: UpdateCategoricalAnnotationConfigInput,
    ) -> UpdateCategoricalAnnotationConfigPayload:
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name=CategoricalAnnotationConfig.__name__
        )
        async with info.context.db() as session:
            annotation_config = await session.scalar(
                select(models.AnnotationConfig)
                .options(
                    joinedload(models.AnnotationConfig.categorical_annotation_config).joinedload(
                        models.CategoricalAnnotationConfig.values
                    )
                )
                .where(models.AnnotationConfig.id == config_id)
            )
            if not annotation_config:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")

            annotation_config.name = input.name
            annotation_config.description = input.description

            assert annotation_config.categorical_annotation_config is not None
            annotation_config.categorical_annotation_config.optimization_direction = (
                input.optimization_direction.value
            )

            await session.execute(
                delete(models.CategoricalAnnotationValue).where(
                    models.CategoricalAnnotationValue.categorical_annotation_config_id
                    == annotation_config.categorical_annotation_config.id
                )
            )

            annotation_config.categorical_annotation_config.values.clear()
            for val in input.values:
                annotation_config.categorical_annotation_config.values.append(
                    models.CategoricalAnnotationValue(
                        label=val.label,
                        score=val.score,
                    )
                )

            session.add(annotation_config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("The annotation config has a conflict")

        return UpdateCategoricalAnnotationConfigPayload(
            query=Query(),
            annotation_config=to_gql_categorical_annotation_config(annotation_config),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def update_continuous_annotation_config(
        self,
        info: Info[Context, None],
        input: UpdateContinuousAnnotationConfigInput,
    ) -> UpdateContinuousAnnotationConfigPayload:
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name=ContinuousAnnotationConfig.__name__
        )
        async with info.context.db() as session:
            annotation_config = await session.scalar(
                select(models.AnnotationConfig)
                .options(joinedload(models.AnnotationConfig.continuous_annotation_config))
                .where(models.AnnotationConfig.id == config_id)
            )
            if not annotation_config:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")

            annotation_config.name = input.name
            annotation_config.description = input.description

            assert annotation_config.continuous_annotation_config is not None
            annotation_config.continuous_annotation_config.optimization_direction = (
                input.optimization_direction.value
            )
            annotation_config.continuous_annotation_config.lower_bound = input.lower_bound
            annotation_config.continuous_annotation_config.upper_bound = input.upper_bound

            session.add(annotation_config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")

        return UpdateContinuousAnnotationConfigPayload(
            query=Query(),
            annotation_config=to_gql_continuous_annotation_config(annotation_config),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def update_freeform_annotation_config(
        self,
        info: Info[Context, None],
        input: UpdateFreeformAnnotationConfigInput,
    ) -> UpdateFreeformAnnotationConfigPayload:
        config_id = from_global_id_with_expected_type(
            global_id=input.config_id, expected_type_name=FreeformAnnotationConfig.__name__
        )
        async with info.context.db() as session:
            annotation_config = await session.scalar(
                select(models.AnnotationConfig).where(models.AnnotationConfig.id == config_id)
            )
            if not annotation_config:
                raise NotFound(f"Annotation configuration with ID '{input.config_id}' not found")

            annotation_config.name = input.name
            annotation_config.description = input.description

            session.add(annotation_config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{input.name}' already exists")

        return UpdateFreeformAnnotationConfigPayload(
            query=Query(),
            annotation_config=to_gql_freeform_annotation_config(annotation_config),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
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
                    joinedload(models.AnnotationConfig.continuous_annotation_config),
                    joinedload(models.AnnotationConfig.categorical_annotation_config).joinedload(
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

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
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
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                await session.rollback()
                raise Conflict("The annotation config has already been added to the project")
            return AddAnnotationConfigToProjectPayload(
                query=Query(),
                project=Project(project_rowid=project_id),
            )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def remove_annotation_config_from_project(
        self,
        info: Info[Context, None],
        input: list[RemoveAnnotationConfigFromProjectInput],
    ) -> RemoveAnnotationConfigFromProjectPayload:
        project_annotation_config_associations = set()
        for item in input:
            project_id = from_global_id_with_expected_type(
                global_id=item.project_id, expected_type_name="Project"
            )
            if (type_name := item.annotation_config_id.type_name) not in ANNOTATION_TYPE_NAMES:
                raise BadRequest(f"Unexpected type name in Relay ID: {type_name}")
            annotation_config_id = item.annotation_config_id.node_id
            project_annotation_config_associations.add((project_id, annotation_config_id))
        async with info.context.db() as session:
            result = await session.scalars(
                delete(models.ProjectAnnotationConfig)
                .where(
                    tuple_(
                        models.ProjectAnnotationConfig.project_id,
                        models.ProjectAnnotationConfig.annotation_config_id,
                    ).in_(project_annotation_config_associations)
                )
                .returning(models.ProjectAnnotationConfig)
            )
            annotation_configs = result.all()
            if len(annotation_configs) < len(project_annotation_config_associations):
                await session.rollback()
                raise NotFound("Could not find one or more input project annotation configs")
        return RemoveAnnotationConfigFromProjectPayload(
            query=Query(),
            project=Project(project_rowid=project_id),
            project_annotation_config_associations=[
                ProjectAnnotationConfigAssociation(
                    project_id=item.project_id,
                    annotation_config_id=item.annotation_config_id,
                )
                for item in input
            ],
        )
