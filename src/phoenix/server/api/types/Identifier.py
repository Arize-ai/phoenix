from typing import NewType

import strawberry

from phoenix.db.types.identifier import Identifier as IdentifierModel


def parse_value(value: str) -> str:
    return IdentifierModel.model_validate(value).root


Identifier = strawberry.scalar(
    NewType("Identifier", str),  # ty: ignore[invalid-newtype]
    parse_value=parse_value,
)
