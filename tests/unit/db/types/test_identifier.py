import string

import pytest
from pydantic import ValidationError

from phoenix.db.types.identifier import Identifier


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
    with pytest.raises(ValidationError):
        Identifier.model_validate(name)
