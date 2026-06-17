import enum

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models
from phoenix.server.access import Permission


@strawberry.enum
class ObjectPermission(enum.Enum):
    """What an permission set lets a subject do on a granted resource."""

    VIEW = Permission.OBJ_VIEW.value
    EDIT = Permission.OBJ_EDIT.value
    MANAGE_ACCESS = Permission.OBJ_MANAGE_ACCESS.value


@strawberry.type
class PermissionSet(Node):
    """A named bundle of object-level permissions, attachable to a grant. Built-in
    presets are immutable; custom permission sets are editable."""

    id: NodeID[int]
    name: str
    is_built_in: bool
    permissions: list[ObjectPermission]


def to_gql_permission_set(role: models.PermissionSet) -> PermissionSet:
    permissions = []
    for row in role.permissions:
        try:
            permissions.append(ObjectPermission(row.permission))
        except ValueError:
            continue
    return PermissionSet(
        id=role.id,
        name=role.name,
        is_built_in=role.is_built_in,
        permissions=sorted(permissions, key=lambda p: p.value),
    )
