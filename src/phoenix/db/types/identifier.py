import re
from typing import Annotated

from pydantic import Field, RootModel, field_validator
from pydantic_core import PydanticCustomError

_IDENTIFIER_PATTERN = re.compile(r"^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$")
_IDENTIFIER_MESSAGE = (
    "must start and end with a lowercase letter or digit, and otherwise contain only "
    "lowercase letters, digits, hyphens, and underscores"
)


class Identifier(RootModel[str]):
    # The pattern stays on the field so OpenAPI keeps it. The validator runs first and
    # raises a sentence instead of the regex, which is what REST field errors show.
    root: Annotated[str, Field(pattern=r"^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$")]

    @field_validator("root", mode="before")
    @classmethod
    def _readable_pattern(cls, value: object) -> object:
        if isinstance(value, str) and _IDENTIFIER_PATTERN.fullmatch(value):
            return value
        raise PydanticCustomError("identifier", _IDENTIFIER_MESSAGE)

    def __str__(self) -> str:
        return self.root

    def __hash__(self) -> int:
        return hash(self.root)
