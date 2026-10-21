"""Saved decisions: a decision, its immutable versions, and the tags apps follow.

They mirror Prompt, PromptVersion, and PromptVersionTag. Each node holds its row, so
fields read it directly; lists are loaded with one query per field.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from sqlalchemy import func, select
from strawberry import UNSET, Private
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.DecisionDefinition import (
    DecisionInputDefinition,
    DecisionQuestion,
    DecisionState,
    to_gql_decision_input,
    to_gql_decision_question,
    to_gql_decision_state,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list

if TYPE_CHECKING:
    from phoenix.server.api.types.GenerativeModelCustomProvider import (
        GenerativeModelCustomProvider,
    )
    from phoenix.server.api.types.User import User


def _user(user_id: Optional[int]) -> Optional["User"]:
    if user_id is None:
        return None
    from phoenix.server.api.types.User import User

    return User(id=user_id)


@strawberry.type
class DecisionLabel(Node):
    id: NodeID[int]
    db_record: Private[models.DecisionLabel]

    @strawberry.field
    def name(self) -> str:
        return self.db_record.name

    @strawberry.field
    def description(self) -> Optional[str]:
        return self.db_record.description

    @strawberry.field
    def color(self) -> Optional[str]:
        return self.db_record.color

    @strawberry.field
    async def usage_count(self, info: Info[Context, None]) -> int:
        async with info.context.db.read() as session:
            count = await session.scalar(
                select(func.count(models.DecisionDecisionLabel.id)).where(
                    models.DecisionDecisionLabel.decision_label_id == self.id
                )
            )
        return int(count or 0)


@strawberry.type(description="A movable name for one of a decision's versions.")
class DecisionVersionTag(Node):
    id: NodeID[int]
    db_record: Private[models.DecisionVersionTag]

    @strawberry.field
    def name(self) -> Identifier:
        return self.db_record.name

    @strawberry.field
    def description(self) -> Optional[str]:
        return self.db_record.description

    @strawberry.field
    def decision_version_id(self) -> GlobalID:
        return GlobalID(DecisionVersion.__name__, str(self.db_record.decision_version_id))

    @strawberry.field
    def user(self) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        return _user(self.db_record.user_id)


@strawberry.type(
    description="An immutable version of a decision: its inputs, how the state is built from "
    "them, its questions, and the model that answers."
)
class DecisionVersion(Node):
    id: NodeID[int]
    db_record: Private[models.DecisionVersion]
    cached_sequence_number: Private[Optional[int]] = None

    @strawberry.field
    def decision_id(self) -> GlobalID:
        return GlobalID(Decision.__name__, str(self.db_record.decision_id))

    @strawberry.field(description="The decision this version belongs to.")  # type: ignore[untyped-decorator]
    async def decision(self, info: Info[Context, None]) -> "Decision":
        async with info.context.db.read() as session:
            decision = await session.get(models.Decision, self.db_record.decision_id)
        if decision is None:
            raise NotFound(f"Decision not found: {self.db_record.decision_id}")
        return Decision(id=decision.id, db_record=decision)

    @strawberry.field
    def description(self) -> Optional[str]:
        return self.db_record.description

    @strawberry.field
    def inputs(self) -> list[DecisionInputDefinition]:
        return [to_gql_decision_input(input) for input in self.db_record.inputs]

    @strawberry.field
    def state(self) -> DecisionState:
        return to_gql_decision_state(self.db_record.state)

    @strawberry.field
    def questions(self) -> list[DecisionQuestion]:
        return [to_gql_decision_question(question) for question in self.db_record.questions]

    @strawberry.field
    def model_provider(self) -> GenerativeProviderKey:
        return GenerativeProviderKey.from_model_provider(self.db_record.model_provider)

    @strawberry.field
    def model_name(self) -> str:
        return self.db_record.model_name

    @strawberry.field
    def metadata(self) -> JSON:
        return JSON(self.db_record.metadata_)

    @strawberry.field
    def created_at(self) -> datetime:
        return self.db_record.created_at

    @strawberry.field
    def user(self) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        return _user(self.db_record.user_id)

    @strawberry.field(description="The custom provider this version runs on, if any.")  # type: ignore
    async def custom_provider(
        self, info: Info[Context, None]
    ) -> Optional[
        Annotated[
            "GenerativeModelCustomProvider",
            strawberry.lazy(".GenerativeModelCustomProvider"),
        ]
    ]:
        if self.db_record.custom_provider_id is None:
            return None
        from phoenix.server.api.types.GenerativeModelCustomProvider import (
            GenerativeModelCustomProvider,
        )

        async with info.context.db.read() as session:
            provider = await session.get(
                models.GenerativeModelCustomProvider, self.db_record.custom_provider_id
            )
        if provider is None:
            return None
        return GenerativeModelCustomProvider(id=provider.id, db_record=provider)

    @strawberry.field
    async def sequence_number(self, info: Info[Context, None]) -> int:
        if self.cached_sequence_number is None:
            async with info.context.db.read() as session:
                count = await session.scalar(
                    select(func.count(models.DecisionVersion.id)).where(
                        models.DecisionVersion.decision_id == self.db_record.decision_id,
                        models.DecisionVersion.id <= self.id,
                    )
                )
            self.cached_sequence_number = int(count or 0)
        return self.cached_sequence_number

    @strawberry.field
    async def previous_version(self, info: Info[Context, None]) -> Optional["DecisionVersion"]:
        async with info.context.db.read() as session:
            version = await session.scalar(
                select(models.DecisionVersion)
                .where(
                    models.DecisionVersion.decision_id == self.db_record.decision_id,
                    models.DecisionVersion.id < self.id,
                )
                .order_by(models.DecisionVersion.id.desc())
                .limit(1)
            )
        return DecisionVersion(id=version.id, db_record=version) if version else None

    @strawberry.field(description="The tags pointing at this version.")  # type: ignore
    async def tags(self, info: Info[Context, None]) -> list[DecisionVersionTag]:
        async with info.context.db.read() as session:
            tags = (
                await session.scalars(
                    select(models.DecisionVersionTag)
                    .where(models.DecisionVersionTag.decision_version_id == self.id)
                    .order_by(models.DecisionVersionTag.name)
                )
            ).all()
        return [DecisionVersionTag(id=tag.id, db_record=tag) for tag in tags]


@strawberry.type(
    description="A saved decision: a named typed function, versioned, that apps fetch by tag."
)
class Decision(Node):
    id: NodeID[int]
    db_record: Private[models.Decision]

    @strawberry.field
    def name(self) -> Identifier:
        return self.db_record.name

    @strawberry.field
    def description(self) -> Optional[str]:
        return self.db_record.description

    @strawberry.field
    def metadata(self) -> JSON:
        return JSON(self.db_record.metadata_)

    @strawberry.field
    def created_at(self) -> datetime:
        return self.db_record.created_at

    @strawberry.field
    def updated_at(self) -> datetime:
        return self.db_record.updated_at

    @strawberry.field
    def user(self) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        return _user(self.db_record.user_id)

    @strawberry.field
    def created_by(self) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        return _user(self.db_record.user_id)

    @strawberry.field
    async def updated_by(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["User", strawberry.lazy(".User")]]:
        version = await self.version(info)
        return _user(version.db_record.user_id) if version else _user(self.db_record.user_id)

    @strawberry.field
    async def source_decision(self, info: Info[Context, None]) -> Optional["Decision"]:
        if self.db_record.source_decision_id is None:
            return None
        async with info.context.db.read() as session:
            decision = await session.get(models.Decision, self.db_record.source_decision_id)
        return Decision(id=decision.id, db_record=decision) if decision else None

    @strawberry.field
    async def labels(self, info: Info[Context, None]) -> list[DecisionLabel]:
        async with info.context.db.read() as session:
            labels = (
                await session.scalars(
                    select(models.DecisionLabel)
                    .join(
                        models.DecisionDecisionLabel,
                        models.DecisionLabel.id == models.DecisionDecisionLabel.decision_label_id,
                    )
                    .where(
                        models.DecisionDecisionLabel.decision_id == self.id,
                    )
                    .order_by(models.DecisionLabel.name)
                )
            ).all()
        return [DecisionLabel(id=label.id, db_record=label) for label in labels]

    @strawberry.field(
        description="A version by ID or by tag; the latest version when neither is given. "
        "Null when there is no such version, so asking for one tag never loses the rest of "
        "the query."
    )  # type: ignore
    async def version(
        self,
        info: Info[Context, None],
        version_id: Optional[GlobalID] = None,
        tag_name: Optional[Identifier] = None,
    ) -> Optional[DecisionVersion]:
        stmt = select(models.DecisionVersion).where(models.DecisionVersion.decision_id == self.id)
        if version_id:
            try:
                version_rowid = from_global_id_with_expected_type(
                    version_id, DecisionVersion.__name__
                )
            except ValueError:
                return None
            stmt = stmt.where(models.DecisionVersion.id == version_rowid)
        elif tag_name:
            stmt = stmt.join(
                models.DecisionVersionTag,
                models.DecisionVersionTag.decision_version_id == models.DecisionVersion.id,
            ).where(models.DecisionVersionTag.name == tag_name)
        else:
            stmt = stmt.order_by(models.DecisionVersion.id.desc()).limit(1)
        async with info.context.db.read() as session:
            version = await session.scalar(stmt)
        if version is None:
            return None
        return DecisionVersion(id=version.id, db_record=version)

    @strawberry.field
    async def version_count(self, info: Info[Context, None]) -> int:
        async with info.context.db.read() as session:
            count = await session.scalar(
                select(func.count(models.DecisionVersion.id)).where(
                    models.DecisionVersion.decision_id == self.id
                )
            )
        return int(count or 0)

    @strawberry.field
    async def version_tags(self, info: Info[Context, None]) -> list[DecisionVersionTag]:
        async with info.context.db.read() as session:
            tags = (
                await session.scalars(
                    select(models.DecisionVersionTag)
                    .where(models.DecisionVersionTag.decision_id == self.id)
                    .order_by(models.DecisionVersionTag.name)
                )
            ).all()
        return [DecisionVersionTag(id=tag.id, db_record=tag) for tag in tags]

    @strawberry.field(description="The decision's versions, newest first.")  # type: ignore
    async def versions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[DecisionVersion]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        row_number = func.row_number().over(order_by=models.DecisionVersion.id).label("row_number")
        stmt = (
            select(models.DecisionVersion, row_number)
            .where(models.DecisionVersion.decision_id == self.id)
            .order_by(models.DecisionVersion.id.desc())
        )
        async with info.context.db.read() as session:
            data = [
                DecisionVersion(
                    id=version.id,
                    db_record=version,
                    cached_sequence_number=sequence_number,
                )
                async for version, sequence_number in await session.stream(stmt)
            ]
        return connection_from_list(
            data=data,
            args=args,
        )
