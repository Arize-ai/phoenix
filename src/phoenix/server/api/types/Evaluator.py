from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Optional

import sqlalchemy as sa
import strawberry
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig as CategoricalAnnotationConfigModel,
)
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import get_builtin_evaluator_by_id
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.types.AnnotationConfig import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
)

from .Identifier import Identifier
from .node import from_global_id_with_expected_type

if TYPE_CHECKING:
    from .Prompt import Prompt
    from .PromptVersion import PromptVersion
    from .PromptVersionTag import PromptVersionTag
    from .User import User


@strawberry.enum
class EvaluatorKind(Enum):
    LLM = "LLM"
    CODE = "CODE"


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
    async def is_assigned_to_dataset(
        self,
        info: Info[Context, None],
        dataset_id: Optional[GlobalID] = None,
    ) -> bool:
        if dataset_id is None:
            return False

        from phoenix.server.api.types.Dataset import Dataset

        try:
            dataset_rowid = from_global_id_with_expected_type(
                global_id=dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset id: {dataset_id}")

        dataset_evaluator = await info.context.data_loaders.datasets_evaluators.load(
            (dataset_rowid, self.id)
        )
        return dataset_evaluator is not None


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
        annotation_name: str
        if self.db_record:
            assert isinstance(self.db_record.output_config, CategoricalAnnotationConfigModel)
            config = self.db_record.output_config
            annotation_name = self.db_record.annotation_name
        else:
            results = await info.context.data_loaders.llm_evaluator_fields.load_many(
                [
                    (self.id, models.LLMEvaluator.output_config),
                    (self.id, models.LLMEvaluator.annotation_name),
                ]
            )
            config, annotation_name = results
        return _to_gql_categorical_annotation_config(config=config, annotation_name=annotation_name)

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

    @strawberry.field
    async def is_assigned_to_dataset(
        self,
        info: Info[Context, None],
        dataset_id: Optional[GlobalID] = None,
    ) -> bool:
        # TODO: possibly set to false and implement somewhere on db
        return True


def _to_gql_categorical_annotation_config(
    config: CategoricalAnnotationConfigModel,
    annotation_name: str,
) -> CategoricalAnnotationConfig:
    values = [
        CategoricalAnnotationValue(
            label=val.label,
            score=val.score,
        )
        for val in config.values
    ]
    return CategoricalAnnotationConfig(
        id_attr=1,  # this id is fake for now
        name=annotation_name,
        annotation_type=config.type,
        optimization_direction=config.optimization_direction,
        description=config.description,
        values=values,
    )
