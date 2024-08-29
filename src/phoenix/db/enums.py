from enum import Enum
from typing import Dict, Type

from sqlalchemy.orm import InstrumentedAttribute

from phoenix.config import ENABLE_AUTH
from phoenix.db import models


class UserRole(Enum):
    SYSTEM = "SYSTEM"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


ENUM_TABLE_PAIRS: Dict[InstrumentedAttribute[str], Type[Enum]] = {}

if ENABLE_AUTH:
    ENUM_TABLE_PAIRS[models.UserRole.name] = UserRole

assert len(ENUM_TABLE_PAIRS) == len({column.class_ for column in ENUM_TABLE_PAIRS})
