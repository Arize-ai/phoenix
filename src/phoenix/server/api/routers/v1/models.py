from datetime import datetime
from enum import Enum
from importlib.metadata import PackageNotFoundError, version

from pydantic import BaseModel
from typing_extensions import assert_never


def datetime_encoder(dt: datetime) -> str:
    """
    Encodes a `datetime` object to an ISO-formatted timestamp string.

    By default, Pydantic v2 serializes `datetime` objects in a format that
    cannot be parsed by `datetime.fromisoformat`. Adding this encoder to the
    `json_encoders` config for a Pydantic model ensures that the serialized
    `datetime` objects are parseable.
    """
    return dt.isoformat()


class PydanticMajorVersion(Enum):
    """
    The major version of `pydantic`.
    """

    V1 = "v1"
    V2 = "v2"


def get_pydantic_major_version() -> PydanticMajorVersion:
    """
    Returns the major version of `pydantic` or raises an error if `pydantic` is
    not installed.
    """
    try:
        pydantic_version = version("pydantic")
    except PackageNotFoundError:
        raise RuntimeError("Please install pydantic with `pip install pydantic`.")
    if pydantic_version.startswith("1"):
        return PydanticMajorVersion.V1
    elif pydantic_version.startswith("2"):
        return PydanticMajorVersion.V2
    raise ValueError(f"Unsupported Pydantic version: {pydantic_version}")


if (pydantic_major_version := get_pydantic_major_version()) is PydanticMajorVersion.V1:

    class V1RoutesBaseModel(BaseModel):
        class Config:
            json_encoders = {datetime: datetime_encoder}

elif pydantic_major_version is PydanticMajorVersion.V2:
    from pydantic import ConfigDict

    # `json_encoders` is a configuration setting from Pydantic v1 that was
    # removed in Pydantic v2.0.* but restored in Pydantic v2.1.0 with a
    # deprecation warning. At this time, it remains the simplest way to
    # configure custom JSON serialization for specific data types in a manner
    # that is consistent between Pydantic v1 and v2.
    #
    # For details, see:
    # - https://github.com/pydantic/pydantic/pull/6811
    # - https://github.com/pydantic/pydantic/releases/tag/v2.1.0
    #
    # The assertion below is added in case a future release of Pydantic v2 fully
    # removes the `json_encoders` parameter.
    assert "json_encoders" in ConfigDict.__annotations__, (
        "If you encounter this error with `pydantic==2.0.*`, "
        "please upgrade `pydantic` with `pip install -U pydantic>=2.1.0`. "
        "If you encounter this error with `pydantic>=2.1.0`, "
        "please upgrade `arize-phoenix` with `pip install -U arize-phoenix`, "
        "or downgrade `pydantic` to a version that supports the `json_encoders` config setting."
    )

    class V1RoutesBaseModel(BaseModel):  # type: ignore[no-redef]
        model_config = ConfigDict({"json_encoders": {datetime: datetime_encoder}})
else:
    assert_never(pydantic_major_version)
