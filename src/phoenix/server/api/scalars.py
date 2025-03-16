import strawberry
from strawberry.relay.types import GlobalID

RelayID = strawberry.scalar(
    strawberry.ID,
    serialize=lambda value: str(value),
    parse_value=lambda value: GlobalID.from_id(value=value),
)
