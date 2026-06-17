import enum

import strawberry

from phoenix.server.access import SubjectKind


@strawberry.enum
class AccessSubjectKind(enum.Enum):
    """The subject kinds a grant can be authored for through the API. ``EVERYONE``
    (all authenticated users) carries no subject id; roles are seeded, not authored here."""

    USER = SubjectKind.USER.value
    GROUP = SubjectKind.GROUP.value
    EVERYONE = SubjectKind.EVERYONE.value
