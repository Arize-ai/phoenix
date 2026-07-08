from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.access import SubjectKind
from phoenix.server.api.types.AccessObjectType import AccessObjectType
from phoenix.server.api.types.AccessSubjectKind import AccessSubjectKind

# The Relay type tag for each grantable object kind, so a stored row id can be re-encoded as the
# GlobalID a client sent in.
_SUBJECT_TYPE_NAME = {
    SubjectKind.USER.value: "User",
    SubjectKind.GROUP.value: "UserGroup",
}


@strawberry.type
class ResourceTag:
    """A curated ``key=value`` tag on an access-controlled object. Tags are policy inputs a
    tag grant reads, not user data — which is why setting one takes the same authority as
    granting access. This is the read-back for ``setResourceTag`` / ``removeResourceTag``."""

    key: str
    value: str


@strawberry.type
class TagAccessGrant:
    """A tag grant: a subject given a permission set over every object of ``object_type``
    carrying ``tag_key=tag_value``. The read-back for ``grantTagAccess`` / ``revokeTagAccess``.
    ``role_name`` is null when the grant confers the view-only default."""

    id: GlobalID
    subject_kind: AccessSubjectKind
    subject_id: Optional[GlobalID]
    subject_name: str
    object_type: AccessObjectType
    tag_key: str
    tag_value: str
    role_name: Optional[str]


def to_gql_tag_grant(
    row: models.AccessGrant,
    role_names: dict[int, str],
    subject_names: dict[tuple[str, int], str],
) -> TagAccessGrant:
    # EVERYONE carries no subject id; every other kind re-encodes its row id as a GlobalID.
    subject_id: Optional[GlobalID] = None
    subject_name = "All users"
    if row.subject_id is not None and row.subject_kind in _SUBJECT_TYPE_NAME:
        subject_id = GlobalID(_SUBJECT_TYPE_NAME[row.subject_kind], str(row.subject_id))
        subject_name = subject_names.get(
            (row.subject_kind, row.subject_id), f"{row.subject_kind.lower()}:{row.subject_id}"
        )
    return TagAccessGrant(
        id=GlobalID("AccessGrant", str(row.id)),
        subject_kind=AccessSubjectKind(row.subject_kind),
        subject_id=subject_id,
        subject_name=subject_name,
        object_type=AccessObjectType(row.object_type),
        tag_key=row.tag_key or "",
        tag_value=row.tag_value or "",
        role_name=role_names.get(row.role_id) if row.role_id is not None else None,
    )
