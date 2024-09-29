from enum import Enum

import strawberry


@strawberry.enum
class AuthMethod(Enum):
    LOCAL = "LOCAL"
    OAUTH2 = "OAUTH2"
