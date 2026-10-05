from typing import Optional

import strawberry


@strawberry.type
class ServerStatus:
    insufficient_storage: bool
    database_encryption_key_is_public: Optional[bool] = strawberry.field(
        description=(
            "Whether stored credentials use a publicly known encryption key because "
            "PHOENIX_SECRET is unset. Null for non-admin viewers when authentication is enabled."
        ),
    )
