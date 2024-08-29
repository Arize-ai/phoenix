from enum import Enum
from typing import Mapping, Type

from sqlalchemy.orm import InstrumentedAttribute

from phoenix.db import models


class UserRole(Enum):
    SYSTEM = "SYSTEM"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class AuthMethod(Enum):
    LOCAL = "LOCAL"


COLUMN_ENUMS: Mapping[InstrumentedAttribute[str], Type[Enum]] = {
    models.UserRole.name: UserRole,
}
