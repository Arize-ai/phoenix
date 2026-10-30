import json
from typing import Union

import strawberry
from sqlalchemy import ColumnElement, and_, func, literal
from sqlalchemy.dialects.postgresql import JSONB
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.exceptions import BadRequest

MetadataScalar = Union[str, int, float, bool]


@strawberry.input(
    description="Matches experiments whose metadata holds a value at a key path. "
    "For example, path ['model', 'name'] and value 'gpt-5' match "
    'metadata {"model": {"name": "gpt-5"}}.'
)
class ExperimentMetadataFilter:
    path: list[str] = strawberry.field(
        description="The keys to follow from the top of the metadata object, outermost first."
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
            BadRequest: If `path` is empty or `value` isn't a string, number, or boolean.
        """
        if not self.path:
            raise BadRequest("Metadata filter path must contain at least one key")
        value = self.value
        if not isinstance(value, (str, int, float, bool)):
            raise BadRequest("Metadata filter value must be a string, number, or boolean")
        if dialect is SupportedSQLDialect.POSTGRESQL:
            return _postgresql_condition(self.path, value)
        return _sqlite_condition(self.path, value)


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
