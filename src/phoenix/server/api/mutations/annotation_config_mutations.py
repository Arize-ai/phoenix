from typing import Optional

import strawberry
from sqlalchemy import delete, select, tuple_
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    AnnotationType,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    ContinuousAnnotationConfig as ContinuousAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    FreeformAnnotationConfig as FreeformAnnotationConfigModel,
)
from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotationConfig import (
    AnnotationConfig,
    CategoricalAnnotationConfig,
    ContinuousAnnotationConfig,
    FreeformAnnotationConfig,
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
class CategoricalAnnotationConfigValueInput:
    label: str
    score: Optional[float] = None


@strawberry.input
class CategoricalAnnotationConfigInput:
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    values: list[CategoricalAnnotationConfigValueInput]


@strawberry.input
class ContinuousAnnotationConfigInput:
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


@strawberry.input
class FreeformAnnotationConfigInput:
    name: str
    description: Optional[str] = None


@strawberry.input(one_of=True)
class AnnotationConfigInput:
    categorical: Optional[CategoricalAnnotationConfigInput] = strawberry.UNSET
    continuous: Optional[ContinuousAnnotationConfigInput] = strawberry.UNSET
    freeform: Optional[FreeformAnnotationConfigInput] = strawberry.UNSET

    def __post_init__(self) -> None:
        if (
            sum(
                [
                    self.categorical is not strawberry.UNSET,
                    self.continuous is not strawberry.UNSET,
                    self.freeform is not strawberry.UNSET,
                ]
            )
            != 1
        ):
            raise BadRequest("Exactly one of categorical, continuous, or freeform must be set")


@strawberry.input
class CreateAnnotationConfigInput:
    annotation_config: AnnotationConfigInput


@strawberry.type
class CreateAnnotationConfigPayload:
    query: Query
    annotation_config: AnnotationConfig


@strawberry.input
class UpdateAnnotationConfigInput:
    id: GlobalID
    annotation_config: AnnotationConfigInput


@strawberry.type
class UpdateAnnotationConfigPayload:
    query: Query
    annotation_config: AnnotationConfig


@strawberry.input
class DeleteAnnotationConfigsInput:
    ids: list[GlobalID]


@strawberry.type
class DeleteAnnotationConfigsPayload:
    query: Query
    annotation_configs: list[AnnotationConfig]


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


def _to_pydantic_categorical_annotation_config(
    input: CategoricalAnnotationConfigInput,
) -> CategoricalAnnotationConfigModel:
    try:
        return CategoricalAnnotationConfigModel(
            type=AnnotationType.CATEGORICAL.value,
            description=input.description,
            optimization_direction=input.optimization_direction,
            values=[
                CategoricalAnnotationValue(label=value.label, score=value.score)
                for value in input.values
            ],
        )
    except ValueError as error:
        raise BadRequest(str(error))


def _to_pydantic_continuous_annotation_config(
    input: ContinuousAnnotationConfigInput,
) -> ContinuousAnnotationConfigModel:
    try:
        return ContinuousAnnotationConfigModel(
            type=AnnotationType.CONTINUOUS.value,
            description=input.description,
            optimization_direction=input.optimization_direction,
            lower_bound=input.lower_bound,
            upper_bound=input.upper_bound,
        )
    except ValueError as error:
        raise BadRequest(str(error))


def _to_pydantic_freeform_annotation_config(
    input: FreeformAnnotationConfigInput,
) -> FreeformAnnotationConfigModel:
    try:
        return FreeformAnnotationConfigModel(
            type=AnnotationType.FREEFORM.value,
            description=input.description,
        )
    except ValueError as error:
        raise BadRequest(str(error))


@strawberry.type
class AnnotationConfigMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def create_annotation_config(
        self,
        info: Info[Context, None],
        input: CreateAnnotationConfigInput,
    ) -> CreateAnnotationConfigPayload:
        input_annotation_config = input.annotation_config
        config: AnnotationConfigType
        name: str
        if categorical_input := input_annotation_config.categorical:
            name = categorical_input.name
            config = _to_pydantic_categorical_annotation_config(categorical_input)
        elif continuous_input := input_annotation_config.continuous:
            name = input_annotation_config.continuous.name
            config = _to_pydantic_continuous_annotation_config(continuous_input)
        elif freeform_input := input_annotation_config.freeform:
            name = freeform_input.name
            config = _to_pydantic_freeform_annotation_config(freeform_input)
        else:
            raise BadRequest("No annotation config provided")

        if name == "note":
            raise BadRequest("The name 'note' is reserved for span notes")

        async with info.context.db() as session:
            annotation_config = models.AnnotationConfig(
                name=name,
                config=config,
            )
            session.add(annotation_config)
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{name}' already exists")
        return CreateAnnotationConfigPayload(
            query=Query(),
            annotation_config=to_gql_annotation_config(annotation_config),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def update_annotation_config(
        self,
        info: Info[Context, None],
        input: UpdateAnnotationConfigInput,
    ) -> UpdateAnnotationConfigPayload:
        try:
            config_id = int(input.id.node_id)
        except ValueError:
            raise BadRequest("Invalid annotation config ID")

        if input.id.type_name not in ANNOTATION_TYPE_NAMES:
            raise BadRequest("Invalid annotation config ID")

        input_annotation_config = input.annotation_config
        config: AnnotationConfigType
        name: str
        if categorical_input := input_annotation_config.categorical:
            name = categorical_input.name
            config = _to_pydantic_categorical_annotation_config(categorical_input)
        elif continuous_input := input_annotation_config.continuous:
            name = input_annotation_config.continuous.name
            config = _to_pydantic_continuous_annotation_config(continuous_input)
        elif freeform_input := input_annotation_config.freeform:
            name = freeform_input.name
            config = _to_pydantic_freeform_annotation_config(freeform_input)
        else:
            raise BadRequest("No annotation config provided")

        if name == "note":
            raise BadRequest("The name 'note' is reserved for span notes")

        async with info.context.db() as session:
            annotation_config = await session.get(models.AnnotationConfig, config_id)
            if not annotation_config:
                raise NotFound("Annotation config not found")

            annotation_config.name = name
            annotation_config.config = config
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict(f"Annotation configuration with name '{name}' already exists")

        return UpdateAnnotationConfigPayload(
            query=Query(),
            annotation_config=to_gql_annotation_config(annotation_config),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def delete_annotation_configs(
        self,
        info: Info[Context, None],
        input: DeleteAnnotationConfigsInput,
    ) -> DeleteAnnotationConfigsPayload:
        config_ids = set()
        for config_gid in input.ids:
            if (type_name := config_gid.type_name) not in ANNOTATION_TYPE_NAMES:
                raise BadRequest(f"Unexpected type name in Relay ID: {type_name}")
            config_ids.add(int(config_gid.node_id))

        async with info.context.db() as session:
            result = await session.scalars(
                delete(models.AnnotationConfig)
                .where(models.AnnotationConfig.id.in_(config_ids))
                .returning(models.AnnotationConfig)
            )
            deleted_annotation_configs = result.all()
            if len(deleted_annotation_configs) < len(config_ids):
                await session.rollback()
                raise NotFound(
                    "Could not find one or more annotation configs to delete, deletion aborted."
                )
        return DeleteAnnotationConfigsPayload(
            query=Query(),
            annotation_configs=[
                to_gql_annotation_config(annotation_config)
                for annotation_config in deleted_annotation_configs
            ],
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore[misc]
    async def add_annotation_config_to_project(
        self,
        info: Info[Context, None],
        input: list[AddAnnotationConfigToProjectInput],
    ) -> AddAnnotationConfigToProjectPayload:
        if not input:
            raise BadRequest("No project annotation config associations provided")
        project_annotation_config_ids: set[tuple[int, int]] = set()
        for item in input:
            project_id = from_global_id_with_expected_type(
                global_id=item.project_id, expected_type_name="Project"
            )
            if (item.annotation_config_id.type_name) not in ANNOTATION_TYPE_NAMES:
                raise BadRequest(
                    f"Invalidation ID for annotation config: {str(item.annotation_config_id)}"
                )
            annotation_config_id = int(item.annotation_config_id.node_id)
            project_annotation_config_ids.add((project_id, annotation_config_id))
        project_ids = [project_id for project_id, _ in project_annotation_config_ids]
        annotation_config_ids = [
            annotation_config_id for _, annotation_config_id in project_annotation_config_ids
        ]

        async with info.context.db() as session:
            result = await session.scalars(
                select(models.Project.id).where(models.Project.id.in_(project_ids))
            )
            resolved_project_ids = result.all()
            if set(project_ids) - set(resolved_project_ids):
                raise NotFound("One or more projects were not found")

            result = await session.scalars(
                select(models.AnnotationConfig.id).where(
                    models.AnnotationConfig.id.in_(annotation_config_ids)
                )
            )
            resolved_annotation_config_ids = result.all()
            if set(annotation_config_ids) - set(resolved_annotation_config_ids):
                raise NotFound("One or more annotation configs were not found")

            for project_id, annotation_config_id in project_annotation_config_ids:
                project_annotation_config = models.ProjectAnnotationConfig(
                    project_id=project_id,
                    annotation_config_id=annotation_config_id,
                )
                session.add(project_annotation_config)

            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                await session.rollback()
                raise Conflict(
                    "One or more annotation configs have already been added to the project"
                )
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
            annotation_config_id = int(item.annotation_config_id.node_id)
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
        )
