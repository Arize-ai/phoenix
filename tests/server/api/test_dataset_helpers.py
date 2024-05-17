from dataclasses import dataclass
from typing import Any, Optional

from phoenix.server.api.datasets_helpers import (
    get_dataset_example_input,
)


def test_get_dataset_example_input():
    span = MockSpan(
        span_kind="LLM",
        input_value="plain-text-input",
        input_mime_type="text/plain",
        output_value="plain-text-output",
        output_mime_type="text/plain",
        prompt_template_variables={"variable_name": "variable-value"},
        llm_input_messages=[{"content": "user-message", "role": "user"}],
        llm_output_messages=[{"content": "assistant-message", "role": "assistant"}],
        retrieval_documents=None,
    )
    expected_input_value = {
        "input_messages": [{"content": "user-message", "role": "user"}],
        "prompt_template_variables": {"variable_name": "variable-value"},
    }
    input_value = get_dataset_example_input(span)
    assert expected_input_value == input_value


@dataclass(frozen=True)
class MockSpan:
    span_kind: Optional[str]
    input_value: Any
    input_mime_type: Optional[str]
    output_value: Any
    output_mime_type: Optional[str]
    prompt_template_variables: Any
    llm_input_messages: Any
    llm_output_messages: Any
    retrieval_documents: Any
