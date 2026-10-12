from typing import Optional

import strawberry


@strawberry.type
class ServerStatus:
    insufficient_storage: bool
    database_encryption_key_is_public: Optional[bool] = strawberry.field(
        description=(
            "Whether PHOENIX_SECRET is unset for stored credential encryption. "
            "Null for non-admin viewers when authentication is enabled."
        ),
    )
