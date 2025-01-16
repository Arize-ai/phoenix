import string

import pytest
from pydantic import ValidationError

from phoenix.db.types.identifier import Identifier


@pytest.mark.parametrize(
    "value",
    [
        "a b c",
        "αβγ",
        *string.punctuation,
    ],
)
def test_invalid_identifier(value: str) -> None:
    with pytest.raises(ValidationError):
        Identifier.model_validate(value)
