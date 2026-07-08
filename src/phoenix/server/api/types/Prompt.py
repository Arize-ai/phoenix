# Part of the Phoenix PromptHub feature set
from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import func, select
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.access import DEFAULT_PERMISSION_SET, OBJECT_TYPE_PROMPT, SubjectKind
from phoenix.server.api.auth import IsAdmin
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.AccessSubjectKind import AccessSubjectKind
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)

from .AccessGrant import AccessGrant
from .PromptLabel import PromptLabel
from .PromptVersion import (
    PromptVersion,
    to_gql_prompt_version,
)
from .PromptVersionTag import PromptVersionTag


@strawberry.type
class Prompt(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.Prompt]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Prompt ID mismatch")

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore[untyped-decorator]
    async def access_grants(
        self,
        info: Info[Context, None],
    ) -> list[AccessGrant]:
        """The user/group grants on this prompt, with display names."""
        async with info.context.db.read() as session:
            rows = (
                await session.execute(
                    select(
                        models.AccessGrant.subject_kind,
                        models.AccessGrant.subject_id,
                        models.AccessGrant.role_id,
                    ).where(
                        models.AccessGrant.object_type == OBJECT_TYPE_PROMPT,
                        models.AccessGrant.object_id == self.id,
                        models.AccessGrant.selector_kind == "ids",
                        models.AccessGrant.effect == "allow",
                    )
                )
            ).all()
            user_ids = [
                sid for kind, sid, _ in rows if kind == SubjectKind.USER.value and sid is not None
            ]
            group_ids = [
                sid for kind, sid, _ in rows if kind == SubjectKind.GROUP.value and sid is not None
            ]
            user_names: dict[int, str] = {}
            if user_ids:
                for uid, username, email in (
                    await session.execute(
                        select(models.User.id, models.User.username, models.User.email).where(
                            models.User.id.in_(user_ids)
                        )
                    )
                ).all():
                    user_names[uid] = email or username
            group_names: dict[int, str] = {}
            if group_ids:
                for gid, display_name in (
                    await session.execute(
                        select(models.UserGroup.id, models.UserGroup.display_name).where(
                            models.UserGroup.id.in_(group_ids)
                        )
                    )
                ).all():
                    group_names[gid] = display_name or f"group:{gid}"
            role_names: dict[int, str] = {
                rid: name
                for rid, name in (
                    await session.execute(
                        select(models.PermissionSet.id, models.PermissionSet.name)
                    )
                ).all()
            }
        grants: list[AccessGrant] = []
        for kind, sid, role_id in rows:
            role_name = (
                role_names.get(role_id, DEFAULT_PERMISSION_SET)
                if role_id
                else DEFAULT_PERMISSION_SET
            )
            if kind == SubjectKind.EVERYONE.value:
                grants.append(
                    AccessGrant(
                        subject_kind=AccessSubjectKind.EVERYONE,
                        subject_id=None,
                        subject_name="All users",
                        role_id=GlobalID("PermissionSet", str(role_id)) if role_id else None,
                        role_name=role_name,
                    )
                )
            elif kind == SubjectKind.USER.value and sid is not None:
                grants.append(
                    AccessGrant(
                        subject_kind=AccessSubjectKind.USER,
                        subject_id=GlobalID("User", str(sid)),
                        subject_name=user_names.get(sid, f"user:{sid}"),
                        role_id=GlobalID("PermissionSet", str(role_id)) if role_id else None,
                        role_name=role_name,
                    )
                )
            elif kind == SubjectKind.GROUP.value and sid is not None:
                grants.append(
                    AccessGrant(
                        subject_kind=AccessSubjectKind.GROUP,
                        subject_id=GlobalID("UserGroup", str(sid)),
                        subject_name=group_names.get(sid, f"group:{sid}"),
                        role_id=GlobalID("PermissionSet", str(role_id)) if role_id else None,
                        role_name=role_name,
                    )
                )
        return grants

    @strawberry.field
    async def source_prompt_id(
        self,
        info: Info[Context, None],
    ) -> Optional[GlobalID]:
        if self.db_record:
            source_id = self.db_record.source_prompt_id
        else:
            source_id = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.source_prompt_id),
            )
        if not source_id:
            return None
        return GlobalID(Prompt.__name__, str(source_id))

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> Identifier:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.name),
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
            val = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.description),
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
            val = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.metadata_),
            )
        return JSON(val)

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.created_at),
            )
        return val

    @strawberry.field
    async def version(
        self,
        info: Info[Context, None],
        version_id: Optional[GlobalID] = None,
        tag_name: Optional[Identifier] = None,
    ) -> PromptVersion:
        if version_id:
            v_id = from_global_id_with_expected_type(version_id, PromptVersion.__name__)
            async with info.context.db.read() as session:
                version = await session.scalar(
                    select(models.PromptVersion).where(
                        models.PromptVersion.id == v_id,
                        models.PromptVersion.prompt_id == self.id,
                    )
                )
            if not version:
                raise NotFound(f"Prompt version not found: {version_id}")
            return to_gql_prompt_version(version)
        if tag_name:
            async with info.context.db.read() as session:
                version = await session.scalar(
                    select(models.PromptVersion)
                    .where(models.PromptVersion.prompt_id == self.id)
                    .join_from(models.PromptVersion, models.PromptVersionTag)
                    .where(models.PromptVersionTag.name == tag_name)
                )
            if not version:
                raise NotFound(f"This prompt has no associated versions by tag {tag_name}")
            return to_gql_prompt_version(version)
        latest_version_id = await info.context.data_loaders.latest_prompt_version_ids.load(self.id)
        if latest_version_id is None:
            raise NotFound("This prompt has no associated versions")
        version = await info.context.data_loaders.prompt_versions.load(latest_version_id)
        if not version:
            raise NotFound("This prompt has no associated versions")
        return to_gql_prompt_version(version)

    @strawberry.field
    async def version_count(self, info: Info[Context, None]) -> int:
        return await info.context.data_loaders.prompt_version_counts.load(self.id)

    @strawberry.field
    async def version_tags(self, info: Info[Context, None]) -> list[PromptVersionTag]:
        tags = await info.context.data_loaders.prompt_version_tags_by_prompt.load(self.id)
        return [PromptVersionTag(id=tag.id, db_record=tag) for tag in tags]

    @strawberry.field
    async def prompt_versions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[PromptVersion]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        row_number = func.row_number().over(order_by=models.PromptVersion.id).label("row_number")
        stmt = (
            select(models.PromptVersion, row_number)
            .where(models.PromptVersion.prompt_id == self.id)
            .order_by(models.PromptVersion.id.desc())
        )
        async with info.context.db.read() as session:
            data = [
                to_gql_prompt_version(prompt_version, sequence_number)
                async for prompt_version, sequence_number in await session.stream(stmt)
            ]
            return connection_from_list(data=data, args=args)

    @strawberry.field
    async def source_prompt(self, info: Info[Context, None]) -> Optional["Prompt"]:
        if self.db_record:
            id_ = self.db_record.source_prompt_id
        else:
            id_ = await info.context.data_loaders.prompt_fields.load(
                (self.id, models.Prompt.source_prompt_id),
            )
        if not id_:
            return None
        async with info.context.db.read() as session:
            source_prompt = await session.get(models.Prompt, id_)
        if not source_prompt:
            raise NotFound(f"Source prompt not found: {id_}")
        return Prompt(id=source_prompt.id, db_record=source_prompt)

    @strawberry.field
    async def labels(self, info: Info[Context, None]) -> list["PromptLabel"]:
        labels = await info.context.data_loaders.prompt_labels_by_prompt.load(self.id)
        return [PromptLabel(id=label.id, db_record=label) for label in labels]
