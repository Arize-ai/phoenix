from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Optional

import sqlalchemy as sa
import strawberry
from strawberry import UNSET
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.Identifier import Identifier

if TYPE_CHECKING:
    from .Prompt import Prompt
    from .PromptVersion import PromptVersion
    from .PromptVersionTag import PromptVersionTag
    from .User import User


@strawberry.enum
class EvaluatorKind(Enum):
    LLM = "LLM"
    CODE = "CODE"
    REMOTE = "REMOTE"


@strawberry.interface
class Evaluator(Node):
    id: NodeID[int]

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        raise NotImplementedError("Subclasses must implement this method")

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        raise NotImplementedError("Subclasses must implement this method")

    @strawberry.field
    async def kind(
        self,
        info: Info[Context, None],
    ) -> EvaluatorKind:
        raise NotImplementedError("Subclasses must implement this method")

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        raise NotImplementedError("Subclasses must implement this method")

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        raise NotImplementedError("Subclasses must implement this method")


@strawberry.type
class LLMEvaluator(Evaluator, Node):
    id: NodeID[int]
    db_record: strawberry.Private[models.LLMEvaluator] = UNSET

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
        return Identifier(val.root)

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
