import zlib
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Optional

import sqlalchemy as sa
import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigModel,
)
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import get_builtin_evaluator_by_id
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.AnnotationConfig import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
)

from .Identifier import Identifier

if TYPE_CHECKING:
    from .Dataset import Dataset
    from .Prompt import Prompt
    from .PromptVersion import PromptVersion
    from .PromptVersionTag import PromptVersionTag
    from .User import User


@strawberry.enum
class EvaluatorKind(Enum):
    LLM = "LLM"
    CODE = "CODE"


@strawberry.type
class EvaluatorInputMapping:
    literal_mapping: JSON = strawberry.field(default_factory=dict)
    """Direct key-value mappings to evaluator inputs."""
    path_mapping: JSON = strawberry.field(default_factory=dict)
    """JSONPath expressions to extract values from the evaluation context."""


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
    async def output_config(
        self,
        info: Info[Context, None],
    ) -> CategoricalAnnotationConfig:
        config: CategoricalAnnotationConfigModel
        if self.db_record:
            assert isinstance(self.db_record.output_config, CategoricalAnnotationConfigModel)
            config = self.db_record.output_config
        else:
            config = await info.context.data_loaders.llm_evaluator_fields.load(
                (self.id, models.LLMEvaluator.output_config),
            )
        return _to_gql_categorical_annotation_config(
            config=config,
            annotation_name=config.name or "",
            evaluator_id=self.id,
        )

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

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        evaluator_class = get_builtin_evaluator_by_id(self.id)
        if evaluator_class is None:
            raise NotFound(f"Built-in evaluator not found: {self.id}")
        return evaluator_class.name

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        evaluator_class = get_builtin_evaluator_by_id(self.id)
        if evaluator_class is None:
            raise NotFound(f"Built-in evaluator not found: {self.id}")
        return evaluator_class.description

    @strawberry.field
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        evaluator_class = get_builtin_evaluator_by_id(self.id)
        if evaluator_class is None:
            raise NotFound(f"Built-in evaluator not found: {self.id}")
        return evaluator_class.metadata

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
        return datetime.fromtimestamp(0)

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        return datetime.fromtimestamp(0)

    @strawberry.field
    async def input_schema(
        self,
        info: Info[Context, None],
    ) -> Optional[JSON]:
        evaluator_class = get_builtin_evaluator_by_id(self.id)
        if evaluator_class is None:
            raise NotFound(f"Built-in evaluator not found: {self.id}")
        return evaluator_class.input_schema

    @strawberry.field
    async def user(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        return None


def _generate_categorical_annotation_config_id(evaluator_id: int) -> int:
    """Generate a stable negative ID using CRC32 checksum."""
    return -abs(zlib.crc32(str(evaluator_id).encode("utf-8")))


def _to_gql_categorical_annotation_config(
    config: CategoricalAnnotationConfigModel,
    annotation_name: str,
    evaluator_id: int,
) -> CategoricalAnnotationConfig:
    values = [
        CategoricalAnnotationValue(
            label=val.label,
            score=val.score,
        )
        for val in config.values
    ]
    return CategoricalAnnotationConfig(
        id_attr=_generate_categorical_annotation_config_id(evaluator_id),
        name=annotation_name,
        annotation_type=config.type,
        optimization_direction=config.optimization_direction,
        description=config.description,
        values=values,
    )


@strawberry.type
class DatasetEvaluator(Node):
    """
    Represents an evaluator assigned to a dataset.
    """

    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.DatasetEvaluators]] = None

    @strawberry.field
    async def display_name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        record = await self._get_record(info)
        return record.display_name.root

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
        if record.builtin_evaluator_id is not None:
            return BuiltInEvaluator(id=record.builtin_evaluator_id)
        elif record.evaluator_id is not None:
            async with info.context.db() as session:
                evaluator = await session.get(models.Evaluator, record.evaluator_id)
                if evaluator is None:
                    raise NotFound(f"Evaluator not found: {record.evaluator_id}")
                if isinstance(evaluator, models.LLMEvaluator):
                    return LLMEvaluator(id=evaluator.id)
                elif isinstance(evaluator, models.CodeEvaluator):
                    return CodeEvaluator(id=evaluator.id)
                else:
                    raise ValueError(f"Unknown evaluator type: {type(evaluator)}")
        else:
            raise ValueError("DatasetEvaluator has no evaluator_id or builtin_evaluator_id")

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
        record = await self._get_record(info)
        if record.description is not None:
            return record.description
        if record.builtin_evaluator_id is not None:
            builtin = get_builtin_evaluator_by_id(record.builtin_evaluator_id)
            return builtin.description if builtin else None
        if record.evaluator_id is not None:
            base_description = await info.context.data_loaders.llm_evaluator_fields.load(
                (record.evaluator_id, models.LLMEvaluator.description)
            )
            return base_description
        return None

    @strawberry.field
    async def output_config(
        self,
        info: Info[Context, None],
    ) -> Optional[CategoricalAnnotationConfig]:
        """
        Returns the effective output_config for this dataset evaluator.
        If an override is set, it's merged with the base config from the LLM evaluator.
        Otherwise, returns the base config from the LLM evaluator.
        For builtin evaluators, returns None as they don't have output configs.
        """
        from phoenix.server.api.evaluators import merge_output_config

        record = await self._get_record(info)
        if record.builtin_evaluator_id is not None:
            return None
        if record.evaluator_id is None:
            return None
        base_config = await info.context.data_loaders.llm_evaluator_fields.load(
            (record.evaluator_id, models.LLMEvaluator.output_config)
        )
        if base_config is None:
            return None
        effective_config = merge_output_config(
            base=base_config,
            override=record.output_config_override,
            display_name=record.display_name.root,
            description_override=record.description,
        )
        return _to_gql_categorical_annotation_config(
            config=effective_config,
            evaluator_id=record.evaluator_id,
            annotation_name=record.display_name.root,
        )

    @strawberry.field
    async def input_mapping(
        self,
        info: Info[Context, None],
    ) -> EvaluatorInputMapping:
        record = await self._get_record(info)
        input_mapping = record.input_mapping or {}
        return EvaluatorInputMapping(
            literal_mapping=input_mapping.get("literal_mapping", {}),
            path_mapping=input_mapping.get("path_mapping", {}),
        )

    async def _get_record(self, info: Info[Context, None]) -> models.DatasetEvaluators:
        if self.db_record is not None:
            return self.db_record
        record = await info.context.data_loaders.dataset_evaluators_by_id.load(self.id)
        if record is None:
            raise NotFound(f"DatasetEvaluator not found: {self.id}")
        self.db_record = record
        return record
