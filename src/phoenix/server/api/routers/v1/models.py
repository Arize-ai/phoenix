from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, PlainSerializer, WithJsonSchema

from phoenix.db.types.db_helper_types import UNDEFINED


def datetime_encoder(dt: datetime) -> str:
    """ISO 8601 with a numeric UTC offset.

    Pydantic's default JSON form of a UTC `datetime` ends in ``Z``, which
    `datetime.fromisoformat` rejects on Python 3.10.
    """
    return dt.isoformat()


#: A `datetime` serialized through `datetime_encoder` in JSON mode. Every
#: datetime field on a V1 route model uses it. The serialization-mode JSON
#: schema is pinned: inferred from the encoder's ``str`` return type, it would
#: lose the ``date-time`` format.
IsoDatetime = Annotated[
    datetime,
    PlainSerializer(datetime_encoder, when_used="json"),
    WithJsonSchema({"type": "string", "format": "date-time"}, mode="serialization"),
]


class V1RoutesBaseModel(BaseModel):
    model_config = ConfigDict(
        validate_assignment=True,
        protected_namespaces=tuple(
            []
        ),  # suppress warnings about protected namespaces starting with `model_` on pydantic 2.9
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs = {k: v for k, v in kwargs.items() if v is not UNDEFINED}
        super().__init__(*args, **kwargs)
