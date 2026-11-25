"""Read experiment metadata scalars consistently on SQLite and PostgreSQL."""

from typing import Any, cast

from sqlalchemy import ColumnElement, String, case, func
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.elements import BinaryExpression
from sqlalchemy.sql.functions import FunctionElement

from phoenix.db import models


class _MetadataType(FunctionElement[str]):
    type = String()
    inherit_cache = True


@compiles(_MetadataType)
def _metadata_type(element: _MetadataType, compiler: Any, **kwargs: Any) -> str:
    indexed = next(iter(element.clauses))
    return str(compiler.process(func.jsonb_typeof(indexed), **kwargs))


@compiles(_MetadataType, "sqlite")
def _sqlite_metadata_type(element: _MetadataType, compiler: Any, **kwargs: Any) -> str:
    indexed = cast(BinaryExpression[Any], next(iter(element.clauses)))
    # Inspect the original JSON: JSON_EXTRACT returns booleans as integers.
    kind = func.json_type(indexed.left, indexed.right)
    return str(
        compiler.process(case((kind.in_(["true", "false"]), "boolean"), else_=kind), **kwargs)
    )


def get_metadata_number(indexed: ColumnElement[Any]) -> ColumnElement[Any]:
    """Returns a numeric metadata scalar, excluding stored booleans."""
    return case(
        (_MetadataType(indexed) == "boolean", None),
        else_=models.SafeJsonFloat(indexed),
    )


def get_metadata_text(indexed: ColumnElement[Any]) -> ColumnElement[Any]:
    """Returns metadata text, spelling stored booleans as true or false."""
    return case(
        (
            _MetadataType(indexed) == "boolean",
            case((models.SafeJsonBoolean(indexed), "true"), else_="false"),
        ),
        else_=indexed.as_string().cast(String),
    )
