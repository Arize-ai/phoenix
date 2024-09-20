from enum import Enum
from typing import Mapping, Type

from sqlalchemy.orm import InstrumentedAttribute

from phoenix.db import models


class AuthMethod(Enum):
    LOCAL = "LOCAL"
    OAUTH2 = "OAUTH2"


class UserRole(Enum):
    SYSTEM = "SYSTEM"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


COLUMN_ENUMS: Mapping[InstrumentedAttribute[str], Type[Enum]] = {
    models.UserRole.name: UserRole,
}
