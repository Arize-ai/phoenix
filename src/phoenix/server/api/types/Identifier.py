from typing import NewType

import strawberry

from phoenix.db.types.identifier import Identifier as IdentifierModel

Identifier = NewType("Identifier", str)


def _parse_value(value: str) -> str:
    return IdentifierModel.model_validate(value).root


identifier_scalar_definition = strawberry.scalar(
    name="Identifier",
    parse_value=_parse_value,
)
