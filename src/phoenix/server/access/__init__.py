"""The access-control seam.

This package is the single place authorization decisions are made. It answers
both the role-level question — *does this role hold this permission?*
(:func:`can`) — and the per-resource questions — *which objects may this actor
access?* (:func:`accessible_scope`) and *who can access this object?*
(:func:`subjects_for`) — so callers never branch on roles or grants directly.

Built-in roles resolve from :data:`BUILTIN_ROLE_PERMISSIONS`, a constant that is
both the runtime source of truth and the seed for the ``role_permissions``
table. A user's effective permissions are resolved from the database per request
(:func:`permissions_for_user_id`), so a role or membership change takes effect on
the next request without reissuing the user's token.
"""

from phoenix.server.access.cleanup import delete_object_grants, delete_object_tags
from phoenix.server.access.groups import sync_user_groups
from phoenix.server.access.manager_guard import (
    would_strand_last_manager,
    would_strand_manager_by_role,
)
from phoenix.server.access.oracle import (
    OBJECT_TYPE_ALL,
    OBJECT_TYPE_DATASET,
    OBJECT_TYPE_PROJECT,
    OBJECT_TYPE_PROMPT,
    AccessScope,
    access_predicate,
    accessible_scope,
    can_access,
    subjects_for,
)
from phoenix.server.access.permissions import (
    BUILTIN_PERMISSION_SETS,
    BUILTIN_ROLE_PERMISSIONS,
    DEFAULT_OBJECT_PERMISSIONS,
    DEFAULT_PERMISSION_SET,
    OBJECT_PERMISSIONS,
    Permission,
    can,
    permissions_for_role,
)
from phoenix.server.access.resolution import (
    object_permissions_for_grant_role,
    permissions_for_user_id,
)
from phoenix.server.access.subjects import Subject, SubjectKind, subjects_for_user

# The system_settings key for the access-control activation latch — reconciled with the
# env var once at startup by the facilitator's drift guard; the running app exposes no
# runtime enable/disable path. Runtime checks read the env directly via
# get_env_access_control_enabled().
ACCESS_CONTROL_ENABLED_KEY = "access_control.enabled"

__all__ = [
    "ACCESS_CONTROL_ENABLED_KEY",
    "BUILTIN_PERMISSION_SETS",
    "BUILTIN_ROLE_PERMISSIONS",
    "DEFAULT_OBJECT_PERMISSIONS",
    "DEFAULT_PERMISSION_SET",
    "OBJECT_PERMISSIONS",
    "OBJECT_TYPE_ALL",
    "OBJECT_TYPE_DATASET",
    "OBJECT_TYPE_PROJECT",
    "OBJECT_TYPE_PROMPT",
    "AccessScope",
    "Permission",
    "Subject",
    "SubjectKind",
    "access_predicate",
    "accessible_scope",
    "can",
    "can_access",
    "delete_object_grants",
    "delete_object_tags",
    "object_permissions_for_grant_role",
    "permissions_for_role",
    "permissions_for_user_id",
    "subjects_for",
    "subjects_for_user",
    "sync_user_groups",
    "would_strand_last_manager",
    "would_strand_manager_by_role",
]
