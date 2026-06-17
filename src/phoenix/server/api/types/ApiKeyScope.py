from enum import Enum

import strawberry

from phoenix.server.api_key_scope import API_KEY_SCOPE_INGEST


@strawberry.enum
class ApiKeyScope(Enum):
    """
    Attenuation for an API key, signed into the key's JWT at creation.

    A key without a scope has full legacy access (it acts with its owner's
    role). A scoped key can only do less than its owner, never more. The
    scope cannot be changed after creation; to narrow or widen a key,
    create a new one and delete the old.
    """

    INGEST = API_KEY_SCOPE_INGEST
