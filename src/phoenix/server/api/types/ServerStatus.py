from typing import Optional

import strawberry

from phoenix.config import get_env_support_email


@strawberry.type
class ServerStatus:
    insufficient_storage: bool
    support_email: Optional[str] = strawberry.field(default_factory=get_env_support_email)
