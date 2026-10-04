import string

import pytest
from pydantic import ValidationError

from phoenix.db.types.identifier import Identifier


def test_identifier_schema_keeps_the_pattern() -> None:
    assert Identifier.model_json_schema()["pattern"] == r"^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$"


@pytest.mark.parametrize(
    "name",
    [
        "a b c",
        "αβγ",
        *string.punctuation,
        *(f"x{p}y" for p in string.punctuation if p not in ("_", "-")),
    ],
)
def test_invalid_identifier(name: str) -> None:
    with pytest.raises(ValidationError) as exc_info:
        Identifier.model_validate(name)
    message = exc_info.value.errors()[0]["msg"]
    assert message == (
        "must start and end with a lowercase letter or digit, and otherwise contain only "
        "lowercase letters, digits, hyphens, and underscores"
    )
    assert "^[a-z0-9]" not in message
