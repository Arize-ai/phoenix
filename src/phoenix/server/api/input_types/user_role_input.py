from enum import Enum

import strawberry


@strawberry.enum
class UserRoleInput(Enum):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
