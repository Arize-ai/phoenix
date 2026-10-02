from typing import Optional

import strawberry


@strawberry.type
class ServerStatus:
    insufficient_storage: bool
    database_encryption_key_is_public: Optional[bool] = strawberry.field(
        description=(
            "Whether data encrypted at rest in the database (workspace secrets, "
            "custom provider configs) uses a publicly known key because "
            "PHOENIX_SECRET is not set. Null for viewers who are not admins."
        ),
    )
