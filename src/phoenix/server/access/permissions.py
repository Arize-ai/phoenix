"""Permission vocabulary and built-in role bundles.

Two kinds of role, two kinds of permission:

- **Global roles** (``users.user_role_id``) grant account-wide capabilities. The
  three coarse permissions — ``READ`` / ``WRITE`` / ``ADMINISTER`` — back the
  long-standing ``is_viewer`` / ``is_admin`` gates. Global roles are the built-in
  set (SYSTEM/ADMIN/MEMBER/VIEWER); custom *global* roles require freeing the
  ``user_roles.name`` enum and are deferred.

- **Permission sets** (``acls.role_id`` → ``permission_sets``) say what a subject may do
  *on the granted object* — view it, edit it, or manage who else can access it
  (the ``OBJ_*`` set). These ship with built-in presets and support custom roles,
  since permission sets live in their own table with free-form names.
"""

from __future__ import annotations

from enum import Enum
from typing import FrozenSet, Mapping


class Permission(Enum):
    # Global capabilities — back is_viewer / is_admin and the base gates.
    READ = "read"
    WRITE = "write"
    ADMINISTER = "administer"
    # Object capabilities — what a grant's role confers on its object.
    OBJ_VIEW = "obj_view"
    OBJ_EDIT = "obj_edit"
    OBJ_MANAGE_ACCESS = "obj_manage_access"


# The source of truth for built-in global roles. Seeded into role_permissions so
# resolution can read a role from the database.
BUILTIN_ROLE_PERMISSIONS: Mapping[str, FrozenSet[Permission]] = {
    "SYSTEM": frozenset({Permission.READ, Permission.WRITE, Permission.ADMINISTER}),
    "ADMIN": frozenset({Permission.READ, Permission.WRITE, Permission.ADMINISTER}),
    "MEMBER": frozenset({Permission.READ, Permission.WRITE}),
    "VIEWER": frozenset({Permission.READ}),
}

# Built-in permission sets — the presets offered when granting access to a resource.
# "Resource Viewer" is the back-compatible default: a plain grant = visibility.
BUILTIN_PERMISSION_SETS: Mapping[str, FrozenSet[Permission]] = {
    "Resource Viewer": frozenset({Permission.OBJ_VIEW}),
    "Resource Editor": frozenset({Permission.OBJ_VIEW, Permission.OBJ_EDIT}),
    "Resource Manager": frozenset(
        {Permission.OBJ_VIEW, Permission.OBJ_EDIT, Permission.OBJ_MANAGE_ACCESS}
    ),
}

# What a grant confers when it names no permission set (legacy grants and the
# everyone-allow default): visibility only.
DEFAULT_PERMISSION_SET = "Resource Viewer"
DEFAULT_OBJECT_PERMISSIONS: FrozenSet[Permission] = frozenset({Permission.OBJ_VIEW})

# Every object permission is a visibility-implying capability — an permission set
# that lets you edit a project also lets you see it.
OBJECT_PERMISSIONS: FrozenSet[Permission] = frozenset(
    {Permission.OBJ_VIEW, Permission.OBJ_EDIT, Permission.OBJ_MANAGE_ACCESS}
)


def permissions_for_role(role_name: str) -> FrozenSet[Permission]:
    """The permissions held by a built-in role (global or object).

    Unknown roles resolve to the empty set — the oracle fails closed. Custom object
    roles are resolved from the database (see resolution.py), not this constant.
    """
    for name, permissions in BUILTIN_ROLE_PERMISSIONS.items():
        if name == role_name:
            return permissions
    for name, permissions in BUILTIN_PERMISSION_SETS.items():
        if name == role_name:
            return permissions
    return frozenset()


def can(role_name: str, permission: Permission) -> bool:
    """Whether a built-in role holds a permission. The single role-level check."""
    return permission in permissions_for_role(role_name)
