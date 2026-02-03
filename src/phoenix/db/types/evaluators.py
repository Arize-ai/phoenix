from typing import Any

from .db_helper_types import DBBaseModel


class InputMapping(DBBaseModel):
    literal_mapping: dict[str, Any]
    path_mapping: dict[str, Any]
