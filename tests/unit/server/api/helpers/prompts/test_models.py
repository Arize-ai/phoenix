from typing import Any

import pytest

from phoenix.server.api.helpers.prompts.models import validate_prompt_template
from phoenix.server.api.types.PromptVersion import PromptTemplateType


@pytest.mark.parametrize(
    "template,expected_valid,error_substring",
    [
        pytest.param(
            {
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant"},
                    {"role": "user", "content": "Hello!"},
                ],
            },
            True,
            "",
            id="valid-chat-template-with-system-and-user",
        ),
        pytest.param(
            {
                "messages": [
                    {"role": "user", "content": {"key": "value", "nested": {"data": 123}}}
                ],
            },
            True,
            "",
            id="valid-chat-template-with-json-content",
        ),
        pytest.param(
            {
                "messages": [
                    {"role": "invalid_role", "content": "This role doesn't exist"},
                ],
            },
            False,
            "Input should be 'user', 'system', 'ai' or 'tool'",
            id="invalid-chat-template-wrong-role",
        ),
        pytest.param(
            {
                "messages": [{"role": "user", "content": "Hello"}],
                "extra_field": "not allowed",
            },
            False,
            "Extra inputs are not permitted",
            id="invalid-chat-template-extra-field",
        ),
    ],
)
def test_validate_prompt_template_returns_true_iff_valid(
    template: dict[str, Any],
    expected_valid: bool,
    error_substring: str,
) -> None:
    is_valid, error = validate_prompt_template(template, PromptTemplateType.CHAT)
    assert is_valid == expected_valid
    assert bool(error) == (not expected_valid)
    if expected_valid:
        assert error is None
        assert not error_substring
    else:
        assert error is not None
        assert error_substring in error
