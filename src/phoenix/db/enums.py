from sqlalchemy.orm import InstrumentedAttribute

from phoenix.db import models

__all__ = ["ENUM_COLUMNS"]


ENUM_COLUMNS: set[InstrumentedAttribute[str]] = {
    models.UserRole.name,
}
