from collections.abc import Mapping
from enum import Enum
from types import UnionType
from typing import Literal, TypeAlias

from sqlalchemy.orm import InstrumentedAttribute

from phoenix.db import models

__all__ = ["UserRole", "COLUMN_ENUMS"]

UserRoleName: TypeAlias = Literal["SYSTEM", "ADMIN", "MEMBER"]

class UserRole(Enum):
    SYSTEM = "SYSTEM"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


COLUMN_ENUMS: Mapping[InstrumentedAttribute[str], UnionType] = {
    models.UserRole.name: UserRoleName,
}
