from typing import Optional

import strawberry


@strawberry.input(description="A filter for users")
class UserFilter:
    value: Optional[str] = None
