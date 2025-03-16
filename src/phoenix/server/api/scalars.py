from typing import Union

import strawberry
from strawberry.relay.types import GlobalID, GlobalIDValueError


def _parse_value(value: str) -> Union[GlobalID, str]:
    try:
        return GlobalID.from_id(value=value)
    except GlobalIDValueError:
        return value


RelayID = strawberry.scalar(
    strawberry.ID,
    serialize=lambda value: str(value),
    parse_value=_parse_value,
)
