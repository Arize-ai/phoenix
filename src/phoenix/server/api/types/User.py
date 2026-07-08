from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.config import get_env_access_control_enabled, get_env_admins
from phoenix.db import models
from phoenix.server.access import (
    OBJECT_TYPE_DATASET,
    OBJECT_TYPE_PROJECT,
    OBJECT_TYPE_PROMPT,
    Permission,
    accessible_scope,
    permissions_for_user_id,
)
from phoenix.server.api.auth import IsAdmin
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.AuthMethod import AuthMethod
from phoenix.server.api.types.UserApiKey import UserApiKey

from .UserRole import UserRole, to_gql_user_role


@strawberry.type
class AccessibleObjectRef:
    """One object a user can access, for the admin "what can this person see" view."""

    kind: str
    id: GlobalID
    name: str


@strawberry.type
class UserAccessSummary:
    """Everything a user can currently view across the access roots (projects, datasets,
    prompts). A type is reported as "all" when the user can see every object of that type —
    because they are an administrator, because enforcement is off, or because of a type-wide
    or everyone grant — in which case its per-object list is omitted."""

    enforced: bool
    is_admin: bool
    all_projects: bool
    all_datasets: bool
    all_prompts: bool
    objects: list[AccessibleObjectRef]


@strawberry.type
class User(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.User]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("User ID mismatch")

    @strawberry.field
    async def password_needs_reset(
        self,
        info: Info[Context, None],
    ) -> bool:
        if self.db_record:
            val = self.db_record.reset_password
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.reset_password),
            )
        return val

    @strawberry.field
    async def email(
        self,
        info: Info[Context, None],
    ) -> str | None:
        if self.db_record:
            return self.db_record.email
        email: str | None = await info.context.data_loaders.user_fields.load(
            (self.id, models.User.email),
        )
        return email

    @strawberry.field
    async def username(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.username
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.username),
            )
        return val

    @strawberry.field
    async def profile_picture_url(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.profile_picture_url
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.profile_picture_url),
            )
        return val

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.created_at),
            )
        return val

    @strawberry.field
    async def auth_method(
        self,
        info: Info[Context, None],
    ) -> AuthMethod:
        """Return the user's authentication method."""
        if self.db_record:
            auth_method_val = self.db_record.auth_method
        else:
            auth_method_val = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.auth_method),
            )
        return AuthMethod(auth_method_val)

    @strawberry.field
    async def role(self, info: Info[Context, None]) -> UserRole:
        if self.db_record:
            user_role_id = self.db_record.user_role_id
        else:
            user_role_id = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.user_role_id),
            )
        role = await info.context.data_loaders.user_roles.load(user_role_id)
        if role is None:
            raise NotFound(f"User role with id {user_role_id} not found")
        return to_gql_user_role(role)

    @strawberry.field
    async def api_keys(self, info: Info[Context, None]) -> list[UserApiKey]:
        async with info.context.db.read() as session:
            api_keys = await session.scalars(
                select(models.ApiKey).where(models.ApiKey.user_id == self.id)
            )
        return [UserApiKey(id=api_key.id, db_record=api_key) for api_key in api_keys]

    @strawberry.field
    async def is_management_user(self, info: Info[Context, None]) -> bool:
        initial_admins = get_env_admins()
        # this field is only visible to initial admins as they are the ones likely to have access to
        # a management interface / the phoenix environment.
        if self.db_record:
            email = self.db_record.email
        else:
            email = await info.context.data_loaders.user_fields.load(
                (self.id, models.User.email),
            )
        if email in initial_admins or email == "admin@localhost":
            return True
        return False

    @strawberry.field(permission_classes=[IsAdmin])  # type: ignore
    async def access_summary(self, info: Info[Context, None]) -> UserAccessSummary:
        """The objects this user can currently view, for the admin People view. Mirrors the
        oracle's visibility decision per access root; a type marked "all" lists no individual
        objects (the user can see every object of that type)."""
        kinds = (
            ("project", OBJECT_TYPE_PROJECT, models.Project, "Project"),
            ("dataset", OBJECT_TYPE_DATASET, models.Dataset, "Dataset"),
            ("prompt", OBJECT_TYPE_PROMPT, models.Prompt, "Prompt"),
        )
        all_flags: dict[str, bool] = {}
        objects: list[AccessibleObjectRef] = []
        async with info.context.db.read() as session:
            enforced = get_env_access_control_enabled()
            is_admin = Permission.ADMINISTER in await permissions_for_user_id(session, self.id)
            for label, object_type, model, type_name in kinds:
                scope = await accessible_scope(
                    session,
                    user_id=self.id,
                    object_type=object_type,
                    enabled=enforced,
                    permission=Permission.OBJ_VIEW,
                )
                is_all = scope.everything or scope.type_allows
                all_flags[label] = is_all
                if is_all or not scope.allowed_ids:
                    continue
                rows = (
                    await session.execute(
                        select(model.id, model.name)
                        .where(model.id.in_(scope.allowed_ids))
                        .order_by(model.name)
                    )
                ).all()
                objects.extend(
                    AccessibleObjectRef(
                        kind=label, id=GlobalID(type_name, str(oid)), name=str(name)
                    )
                    for oid, name in rows
                )
        return UserAccessSummary(
            enforced=enforced,
            is_admin=is_admin,
            all_projects=all_flags["project"],
            all_datasets=all_flags["dataset"],
            all_prompts=all_flags["prompt"],
            objects=objects,
        )
