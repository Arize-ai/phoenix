from enum import Enum
from typing import Mapping, Type

from sqlalchemy.orm import InstrumentedAttribute

from phoenix.db import models
from phoenix.db.models import AuthMethod

__all__ = ["AuthMethod", "UserRole", "COLUMN_ENUMS"]


class UserRole(Enum):
    SYSTEM = "SYSTEM"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


COLUMN_ENUMS: Mapping[InstrumentedAttribute[str], Type[Enum]] = {
    models.UserRole.name: UserRole,
}
