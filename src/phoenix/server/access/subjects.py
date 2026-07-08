"""The subject union — *who* access is granted to.

A subject is a user, a group, or a service account (a machine identity). Grants
reference a subject by ``(kind, id)``; resolving a request's access means
gathering every subject the actor stands in for — themselves plus their groups —
and unioning the grants attached to each.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models


class SubjectKind(Enum):
    USER = "user"
    GROUP = "group"
    SERVICE_ACCOUNT = "service_account"
    # Grants may also target a role (everyone holding it) or everyone. These are
    # what the seeded admin grant and the everyone-allow default are attached to.
    ROLE = "role"
    EVERYONE = "everyone"


@dataclass(frozen=True)
class Subject:
    """A reference to something access can be granted to. ``id`` is the row id in
    the table named by ``kind`` (users / user_groups)."""

    kind: SubjectKind
    id: int


async def subjects_for_user(session: AsyncSession, user_id: int) -> List[Subject]:
    """Every subject a user's request stands in for: the user, plus each group
    they belong to. Access is the union of the grants attached to these."""
    subjects: List[Subject] = [Subject(SubjectKind.USER, user_id)]
    group_ids = await session.scalars(
        select(models.UserGroupMembership.user_group_id).where(
            models.UserGroupMembership.user_id == user_id
        )
    )
    subjects.extend(Subject(SubjectKind.GROUP, group_id) for group_id in group_ids)
    return subjects
