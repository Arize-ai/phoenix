from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Optional, Union

import sqlalchemy as sa
import strawberry
from strawberry import UNSET
from strawberry.relay import Connection, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    AnnotationType,
    OptimizationDirection,
)
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigModel,
)
from phoenix.db.types.annotation_configs import (
    ContinuousAnnotationConfig as ContinuousAnnotationConfigModel,
)
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.AnnotationConfig import (
    CategoricalAnnotationValue,
)
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)

from .Identifier import Identifier

if TYPE_CHECKING:
    from .Dataset import Dataset
    from .Project import Project
    from .Prompt import Prompt
    from .PromptVersion import PromptVersion
    from .PromptVersionTag import PromptVersionTag
    from .User import User


@strawberry.enum
class EvaluatorKind(Enum):
    LLM = "LLM"
    CODE = "CODE"
    BUILTIN = "BUILTIN"


@strawberry.type
class EvaluatorInputMapping:
    literal_mapping: JSON = strawberry.field(default_factory=dict)
    """Direct key-value mappings to evaluator inputs."""
    path_mapping: JSON = strawberry.field(default_factory=dict)
    """JSONPath expressions to extract values from the evaluation context."""


@strawberry.type
class EmbeddedCategoricalAnnotationConfig:
    """Lightweight categorical annotation config for inline embedding (no Node interface)."""

    name: str
    description: Optional[str]
    annotation_type: AnnotationType
    optimization_direction: OptimizationDirection
    values: list[CategoricalAnnotationValue]


@strawberry.type
class EmbeddedContinuousAnnotationConfig:
    """Lightweight continuous annotation config for inline embedding (no Node interface)."""

    name: str
    description: Optional[str]
    annotation_type: AnnotationType
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float]
    upper_bound: Optional[float]


BuiltInEvaluatorOutputConfig: TypeAlias = Annotated[
    Union[EmbeddedCategoricalAnnotationConfig, EmbeddedContinuousAnnotationConfig],
    strawberry.union("BuiltInEvaluatorOutputConfig"),
]


@strawberry.interface
class Evaluator(Node):
    id: NodeID[int]

    @strawberry.field
    async def name(self) -> Identifier:
        raise NotImplementedError

    @strawberry.field
    async def description(self) -> Optional[str]:
        raise NotImplementedError

    @strawberry.field
    async def metadata(self) -> JSON:
        raise NotImplementedError

    @strawberry.field
    async def kind(self) -> EvaluatorKind:
        raise NotImplementedError

    @strawberry.field
    async def created_at(self) -> datetime:
        raise NotImplementedError

    @strawberry.field
    async def updated_at(self) -> datetime:
        raise NotImplementedError

    @strawberry.field
    async def input_schema(self) -> Optional[JSON]:
        raise NotImplementedError

    @strawberry.field
    async def is_builtin(self) -> bool:
        return self.id < 0

    @strawberry.field
    async def datasets(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        after: Optional[CursorString] = UNSET,
    ) -> Connection[Annotated["Dataset", strawberry.lazy(".Dataset")]]:
        args = ConnectionArgs(first=first, after=after if isinstance(after, CursorString) else None)
        dataset_records = await info.context.data_loaders.datasets_by_evaluator.load(self.id)
        from .Dataset import Dataset

        return connection_from_list([Dataset(id=d.id, db_record=d) for d in dataset_records], args)

    @strawberry.field
    async def dataset_evaluators(
        self,
        info: Info[Context, None],
    ) -> list["DatasetEvaluator"]:
        dataset_evaluator_records = (
            await info.context.data_loaders.dataset_evaluators_by_evaluator.load(self.id)
        )
        return [DatasetEvaluator(id=de.id, db_record=de) for de in dataset_evaluator_records]


@strawberry.type
class CodeEvaluator(Evaluator, Node):
    # TODO: This is a stub for development purposes; remove before product release
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.CodeEvaluator]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Evaluator ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.code_evaluator_fields.load(
                (self.id, models.CodeEvaluator.name),
            )
        return val.root if val else ""

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.code_evaluator_fields.load(
                (self.id, models.CodeEvaluator.description),
            )
        return val

    @strawberry.field
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        if self.db_record:
            val = self.db_record.metadata_
        else:
            val = await info.context.data_loaders.code_evaluator_fields.load(
                (self.id, models.CodeEvaluator.metadata_),
            )
        return val

    @strawberry.field
    async def kind(
        self,
        info: Info[Context, None],
    ) -> EvaluatorKind:
        return EvaluatorKind.CODE

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.code_evaluator_fields.load(
                (self.id, models.CodeEvaluator.created_at),
            )
        return val

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.code_evaluator_fields.load(
                (self.id, models.CodeEvaluator.updated_at),
            )
        return val

    @strawberry.field
    async def input_schema(
        self,
        info: Info[Context, None],
    ) -> Optional[JSON]: ...  # TODO: Implement

    @strawberry.field
    async def user(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.code_evaluator_fields.load(
                (self.id, models.Evaluator.user_id),
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)


@strawberry.type
class LLMEvaluator(Evaluator, Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.LLMEvaluator]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Evaluator ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.name),
            )
        return val.root if val else ""

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.description),
            )
        return val

    @strawberry.field
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        if self.db_record:
            val = self.db_record.metadata_
        else:
            val = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.metadata_),
            )
        return val

    @strawberry.field
    async def kind(
        self,
        info: Info[Context, None],
    ) -> EvaluatorKind:
        if self.db_record:
            val = self.db_record.kind
        else:
            val = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.kind),
            )
        return EvaluatorKind(val)

    @strawberry.field
    async def output_configs(
        self,
        info: Info[Context, None],
    ) -> list[EmbeddedCategoricalAnnotationConfig]:
        if self.db_record:
            configs = self.db_record.output_configs
        else:
            configs = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.output_configs),
            )
        return [
            _to_gql_embedded_categorical_config(
                config=config,
                annotation_name=config.name or "",
            )
            for config in configs
            if isinstance(config, CategoricalAnnotationConfigModel)
        ]

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.created_at),
            )
        return val

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.updated_at),
            )
        return val

    @strawberry.field
    async def prompt(
        self, info: Info[Context, None]
    ) -> Annotated["Prompt", strawberry.lazy(".Prompt")]:
        if self.db_record:
            prompt_id = self.db_record.prompt_id
        else:
            prompt_id = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.prompt_id),
            )
        from .Prompt import Prompt

        return Prompt(id=prompt_id)

    @strawberry.field
    async def prompt_version_tag(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["PromptVersionTag", strawberry.lazy(".PromptVersionTag")]]:
        if self.db_record:
            prompt_version_tag_id = self.db_record.prompt_version_tag_id
        else:
            prompt_version_tag_id = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.prompt_version_tag_id),
            )
        if prompt_version_tag_id is None:
            return None
        from .PromptVersionTag import PromptVersionTag

        return PromptVersionTag(id=prompt_version_tag_id)

    @strawberry.field
    async def input_schema(
        self,
        info: Info[Context, None],
    ) -> Optional[JSON]: ...  # TODO: Implement

    @strawberry.field
    async def user(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        if self.db_record:
            user_id = self.db_record.user_id
        else:
            user_id = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.user_id),
            )
        if user_id is None:
            return None
        from .User import User

        return User(id=user_id)

    @strawberry.field
    async def prompt_version(
        self,
        info: Info[Context, None],
    ) -> Annotated["PromptVersion", strawberry.lazy(".PromptVersion")]:
        if self.db_record:
            prompt_id = self.db_record.prompt_id
            prompt_version_tag_id = self.db_record.prompt_version_tag_id
        else:
            (
                prompt_id,
                prompt_version_tag_id,
            ) = await info.context.data_loaders.llm_evaluator_fields.load_many(
                [
                    (self.id, models.LLMEvaluator.prompt_id),
                    (self.id, models.LLMEvaluator.prompt_version_tag_id),
                ]
            )
        if prompt_version_tag_id is not None:
            stmt = (
                sa.select(models.PromptVersion)
                .join(models.PromptVersionTag)
                .where(models.PromptVersionTag.prompt_id == prompt_id)
                .where(models.PromptVersionTag.id == prompt_version_tag_id)
            )
        else:
            stmt = (
                sa.select(models.PromptVersion)
                .where(models.PromptVersion.prompt_id == prompt_id)
                .order_by(models.PromptVersion.id.desc())
                .limit(1)
            )
        async with info.context.db() as session:
            prompt_version = await session.scalar(stmt)
            if prompt_version is None:
                raise NotFound(f"Prompt version not found for prompt {prompt_id}")
        from .PromptVersion import to_gql_prompt_version

        return to_gql_prompt_version(prompt_version)


@strawberry.type
class BuiltInEvaluator(Evaluator, Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.BuiltinEvaluator]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Evaluator ID mismatch")

    async def _get_db_record(self, info: Info[Context, None]) -> models.BuiltinEvaluator:
        """Helper to fetch the builtin evaluator record from DB, with caching."""
        if self.db_record is not None:
            return self.db_record
        async with info.context.db() as session:
            builtin = await session.get(models.BuiltinEvaluator, self.id)
            if builtin is None:
                raise NotFound(f"Built-in evaluator not found: {self.id}")
            return builtin

    async def _get_evaluator_class(self, info: Info[Context, None]) -> object:
        """Helper to fetch builtin evaluator class from DB key."""
        from phoenix.server.api.evaluators import (
            get_builtin_evaluator_by_key,
            get_builtin_evaluator_from_orm,
        )

        if self.db_record is not None:
            # Use cached record to avoid extra DB call
            evaluator_class = get_builtin_evaluator_by_key(self.db_record.key)
            if evaluator_class is None:
                raise NotFound(f"Built-in evaluator class not found for key: {self.db_record.key}")
            return evaluator_class
        # Fall back to helper that fetches from DB
        async with info.context.db() as session:
            return await get_builtin_evaluator_from_orm(session, self.id)

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        evaluator_class = await self._get_evaluator_class(info)
        return evaluator_class.name  # type: ignore[attr-defined]

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        evaluator_class = await self._get_evaluator_class(info)
        return str(evaluator_class.description) if evaluator_class.description else None  # type: ignore[attr-defined]

    @strawberry.field
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        evaluator_class = await self._get_evaluator_class(info)
        return evaluator_class.metadata  # type: ignore[attr-defined]

    @strawberry.field
    async def kind(
        self,
        info: Info[Context, None],
    ) -> EvaluatorKind:
        return EvaluatorKind.BUILTIN

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        builtin = await self._get_db_record(info)
        return builtin.created_at

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        builtin = await self._get_db_record(info)
        return builtin.synced_at

    @strawberry.field
    async def input_schema(
        self,
        info: Info[Context, None],
    ) -> Optional[JSON]:
        evaluator_class = await self._get_evaluator_class(info)
        return evaluator_class().input_schema  # type: ignore[operator]

    @strawberry.field
    async def user(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        return None

    @strawberry.field
    async def output_configs(
        self,
        info: Info[Context, None],
    ) -> list["BuiltInEvaluatorOutputConfig"]:
        evaluator_class = await self._get_evaluator_class(info)
        base_configs = evaluator_class().output_configs  # type: ignore[operator]
        return [
            _to_gql_builtin_output_config(
                config,
                config.name or evaluator_class.name,  # type: ignore[attr-defined]
            )
            for config in base_configs
            if isinstance(
                config, (CategoricalAnnotationConfigModel, ContinuousAnnotationConfigModel)
            )
        ]


def _to_gql_embedded_categorical_config(
    config: CategoricalAnnotationConfigModel,
    annotation_name: str,
) -> EmbeddedCategoricalAnnotationConfig:
    values = [
        CategoricalAnnotationValue(
            label=val.label,
            score=val.score,
        )
        for val in config.values
    ]
    return EmbeddedCategoricalAnnotationConfig(
        name=annotation_name,
        annotation_type=config.type,
        optimization_direction=config.optimization_direction,
        description=config.description,
        values=values,
    )


def _to_gql_embedded_continuous_config(
    config: ContinuousAnnotationConfigModel,
    annotation_name: str,
) -> EmbeddedContinuousAnnotationConfig:
    return EmbeddedContinuousAnnotationConfig(
        name=annotation_name,
        annotation_type=config.type,
        optimization_direction=config.optimization_direction,
        description=config.description,
        lower_bound=config.lower_bound,
        upper_bound=config.upper_bound,
    )


def _to_gql_builtin_output_config(
    config: Union[CategoricalAnnotationConfigModel, ContinuousAnnotationConfigModel],
    annotation_name: str,
) -> BuiltInEvaluatorOutputConfig:
    if isinstance(config, CategoricalAnnotationConfigModel):
        return _to_gql_embedded_categorical_config(config, annotation_name)
    else:
        return _to_gql_embedded_continuous_config(config, annotation_name)


@strawberry.type
class DatasetEvaluator(Node):
    """
    Represents an evaluator assigned to a dataset.
    """

    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.DatasetEvaluators]] = None

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        record = await self._get_record(info)
        return record.name.root

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        record = await self._get_record(info)
        return record.updated_at

    @strawberry.field
    async def dataset(
        self,
        info: Info[Context, None],
    ) -> Annotated["Dataset", strawberry.lazy(".Dataset")]:
        record = await self._get_record(info)
        from .Dataset import Dataset

        return Dataset(id=record.dataset_id)

    @strawberry.field
    async def evaluator(
        self,
        info: Info[Context, None],
    ) -> Evaluator:
        record = await self._get_record(info)
        async with info.context.db() as session:
            evaluator = await session.get(models.Evaluator, record.evaluator_id)
            if evaluator is None:
                raise NotFound(f"Evaluator not found: {record.evaluator_id}")
            if isinstance(evaluator, models.LLMEvaluator):
                return LLMEvaluator(id=evaluator.id)
            elif isinstance(evaluator, models.CodeEvaluator):
                return CodeEvaluator(id=evaluator.id)
            elif isinstance(evaluator, models.BuiltinEvaluator):
                return BuiltInEvaluator(id=evaluator.id)
            else:
                raise ValueError(f"Unknown evaluator type: {type(evaluator)}")

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        """
        Returns the effective description for this dataset evaluator.
        If an override is set on the dataset evaluator, returns that.
        Otherwise, returns the base evaluator's description.
        """
        from phoenix.server.api.evaluators import get_builtin_evaluator_by_key

        record = await self._get_record(info)
        if record.description is not None:
            return record.description
        async with info.context.db() as session:
            evaluator = await session.get(models.Evaluator, record.evaluator_id)
            if evaluator is None:
                return None
            if isinstance(evaluator, models.BuiltinEvaluator):
                builtin = get_builtin_evaluator_by_key(evaluator.key)
                return builtin.description if builtin else None
            elif isinstance(evaluator, models.LLMEvaluator):
                return evaluator.description
            elif isinstance(evaluator, models.CodeEvaluator):
                return evaluator.description
            return None

    @strawberry.field
    async def output_configs(
        self,
        info: Info[Context, None],
    ) -> list[BuiltInEvaluatorOutputConfig]:
        """
        Returns the output_configs stored on this dataset evaluator.
        """
        record = await self._get_record(info)
        return [
            _to_gql_builtin_output_config(
                config,
                config.name or "",
            )
            for config in record.output_configs
            if isinstance(
                config, (CategoricalAnnotationConfigModel, ContinuousAnnotationConfigModel)
            )
        ]

    @strawberry.field
    async def input_mapping(
        self,
        info: Info[Context, None],
    ) -> EvaluatorInputMapping:
        record = await self._get_record(info)
        input_mapping = record.input_mapping
        return EvaluatorInputMapping(
            literal_mapping=input_mapping.literal_mapping,
            path_mapping=input_mapping.path_mapping,
        )

    @strawberry.field
    async def user(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        record = await self._get_record(info)
        if record.user_id is None:
            return None
        from .User import User

        return User(id=record.user_id)

    @strawberry.field
    async def project(
        self, info: Info[Context, None]
    ) -> Annotated["Project", strawberry.lazy(".Project")]:
        record = await self._get_record(info)
        from .Project import Project

        return Project(id=record.project_id)

    async def _get_record(self, info: Info[Context, None]) -> models.DatasetEvaluators:
        if self.db_record is not None:
            return self.db_record
        record = await info.context.data_loaders.dataset_evaluators_by_id.load(self.id)
        if record is None:
            raise NotFound(f"DatasetEvaluator not found: {self.id}")
        self.db_record = record
        return record
