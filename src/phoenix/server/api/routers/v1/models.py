from datetime import datetime

from pydantic import BaseModel, ConfigDict


def datetime_encoder(dt: datetime) -> str:
    """
    Encodes a `datetime` object to an ISO-formatted timestamp string.

    By default, Pydantic v2 serializes `datetime` objects in a format that
    cannot be parsed by `datetime.fromisoformat`. Adding this encoder to the
    `json_encoders` config for a Pydantic model ensures that the serialized
    `datetime` objects are parseable.
    """
    return dt.isoformat()


# `json_encoders` is a configuration setting from Pydantic v1 that was
# removed in Pydantic v2.0.* but restored in Pydantic v2.1.0 with a
# deprecation warning. At this time, it remains the simplest way to
# configure custom JSON serialization for specific data types.
#
# For details, see:
# - https://github.com/pydantic/pydantic/pull/6811
# - https://github.com/pydantic/pydantic/releases/tag/v2.1.0
#
# The assertion below is added in case a future release of Pydantic v2 fully
# removes the `json_encoders` parameter.
assert "json_encoders" in ConfigDict.__annotations__, (
    "If you encounter this error with `pydantic<2.1.0`, "
    "please upgrade `pydantic` with `pip install -U pydantic>=2.1.0`. "
    "If you encounter this error with `pydantic>=2.1.0`, "
    "please upgrade `arize-phoenix` with `pip install -U arize-phoenix`, "
    "or downgrade `pydantic` to a version that supports the `json_encoders` config setting."
)


class V1RoutesBaseModel(BaseModel):
    model_config = ConfigDict(
        json_encoders={datetime: datetime_encoder},
        validate_assignment=True,
        protected_namespaces=tuple(
            []
        ),  # suppress warnings about protected namespaces starting with `model_` on pydantic 2.9
    )
