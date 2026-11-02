import json
import math
from typing import Union

import strawberry
from sqlalchemy import ColumnElement, and_, func, literal
from sqlalchemy.dialects.postgresql import JSONB
from strawberry.scalars import JSON
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.exceptions import BadRequest

MetadataScalar = Union[str, int, float, bool]

_INT64_MIN = -(2**63)
_INT64_MAX = 2**63 - 1


@strawberry.input(
    description="Matches experiments whose metadata holds a value at a key path. "
    "For example, path ['model', 'name'] and value 'gpt-5' match "
    'metadata {"model": {"name": "gpt-5"}}.'
)
class ExperimentMetadataFilter:
    path: list[str] = strawberry.field(
        description="The keys to follow from the top of the metadata object, outermost first. "
        "Each key names an object key. On PostgreSQL, an integer key such as '0' also "
        "indexes into an array; on SQLite, it doesn't."
    )
    value: JSON = strawberry.field(
        description="The value to match: a string, number, or boolean. "
        "Strings match only strings, so 1 and '1' are different values."
    )

    def to_sql(self, dialect: SupportedSQLDialect) -> ColumnElement[bool]:
        """
        Returns a condition on `models.Experiment` that is true when the
        metadata value at `path` equals `value` in both type and value.

        Raises:
            BadRequest: If `path` is empty, `value` isn't a string, finite number
                within the 64-bit integer range, or boolean, or a key or value
                contains a NUL character.
        """
        if not self.path:
            raise BadRequest("Metadata filter path must contain at least one key")
        value = self.value
        if not isinstance(value, (str, int, float, bool)):
            raise BadRequest("Metadata filter value must be a string, number, or boolean")
        if isinstance(value, float) and not math.isfinite(value):
            raise BadRequest("Metadata filter value must be a finite number")
        if (
            isinstance(value, int)
            and not isinstance(value, bool)
            and not _INT64_MIN <= value <= _INT64_MAX
        ):
            raise BadRequest("Metadata filter value must fit in a 64-bit integer")
        if any("\x00" in key for key in self.path) or (isinstance(value, str) and "\x00" in value):
            raise BadRequest("Metadata filter keys and values must not contain NUL characters")
        if dialect is SupportedSQLDialect.POSTGRESQL:
            return _postgresql_condition(self.path, value)
        elif dialect is SupportedSQLDialect.SQLITE:
            return _sqlite_condition(self.path, value)
        else:
            assert_never(dialect)


def _postgresql_condition(path: list[str], value: MetadataScalar) -> ColumnElement[bool]:
    # `jsonb` equality compares by type, and compares numbers by value, so 1
    # matches 1.0 but not "1".
    extracted = func.jsonb_extract_path(models.Experiment.metadata_, *path)
    return extracted == literal(value, JSONB)


def _sqlite_condition(path: list[str], value: MetadataScalar) -> ColumnElement[bool]:
    # SQLite's `json_extract` returns booleans as 1 and 0 and numbers as SQL
    # numbers, so `json_type` keeps `true`, `1`, and `"1"` apart.
    json_path = "$" + "".join("." + json.dumps(key, ensure_ascii=False) for key in path)
    metadata = models.Experiment.metadata_
    json_type: ColumnElement[str] = func.json_type(metadata, json_path)
    if isinstance(value, bool):
        return json_type == ("true" if value else "false")
    extracted = func.json_extract(metadata, json_path)
    if isinstance(value, str):
        return and_(json_type == "text", extracted == value)
    return and_(json_type.in_(("integer", "real")), extracted == value)
