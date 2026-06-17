import enum

import strawberry

from phoenix.server.access import (
    OBJECT_TYPE_DATASET,
    OBJECT_TYPE_PROJECT,
    OBJECT_TYPE_PROMPT,
)


@strawberry.enum
class AccessObjectType(enum.Enum):
    """The access-controlled resource types a tag grant can be scoped to. A tag
    grant names a type (never a concrete object) plus a key=value, and reaches every
    object of that type currently carrying the tag."""

    PROJECT = OBJECT_TYPE_PROJECT
    DATASET = OBJECT_TYPE_DATASET
    PROMPT = OBJECT_TYPE_PROMPT
