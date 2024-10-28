from collections.abc import Mapping
from enum import Enum

from sqlalchemy.orm import InstrumentedAttribute

from phoenix.db import models
from phoenix.db.models import AuthMethod

__all__ = ["AuthMethod", "UserRole", "COLUMN_ENUMS"]


class UserRole(Enum):
    SYSTEM = "SYSTEM"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


COLUMN_ENUMS: Mapping[InstrumentedAttribute[str], type[Enum]] = {
    models.UserRole.name: UserRole,
}
