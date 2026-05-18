import strawberry

from phoenix.db.types.identifier import Identifier


def _parse_value(value: str) -> Identifier:
    return Identifier.model_validate(value)


identifier_scalar_definition = strawberry.scalar(
    name="Identifier",
    parse_value=_parse_value,
    serialize=lambda v: v.root,
)
