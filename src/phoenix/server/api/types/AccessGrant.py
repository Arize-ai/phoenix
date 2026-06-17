from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from phoenix.server.api.types.AccessSubjectKind import AccessSubjectKind


@strawberry.type
class AccessGrant:
    """One object access grant: a subject and the permission set it confers."""

    subject_kind: AccessSubjectKind
    subject_id: Optional[GlobalID]
    subject_name: str
    role_id: Optional[GlobalID]
    role_name: str
