"""Request-shape rules shared by the evaluator binding routes."""

import pytest
from pydantic import ValidationError

from phoenix.server.api.routers.v1.evaluator_common import NewCodeEvaluator, NewLLMEvaluator

_PROMPT = {
    "model_provider": "OPENAI",
    "model_name": "gpt-4o-mini",
    "template_type": "CHAT",
    "template_format": "MUSTACHE",
    "template": {"type": "chat", "messages": [{"role": "user", "content": "Judge {{output}}"}]},
    "invocation_parameters": {"type": "openai", "openai": {}},
}
_OUTPUTS = [
    {
        "type": "CATEGORICAL",
        "name": "correctness",
        "optimization_direction": "MAXIMIZE",
        "values": [{"label": "correct", "score": 1}, {"label": "incorrect", "score": 0}],
    }
]


def test_new_llm_evaluator_takes_content_or_a_version_id() -> None:
    NewLLMEvaluator.model_validate(
        {"type": "llm", "prompt_version": _PROMPT, "output_configs": _OUTPUTS}
    )
    NewLLMEvaluator.model_validate(
        {"type": "llm", "prompt_version_id": "UHJvbXB0VmVyc2lvbjox", "output_configs": _OUTPUTS}
    )


@pytest.mark.parametrize(
    "extra",
    [{}, {"prompt_version": _PROMPT, "prompt_version_id": "UHJvbXB0VmVyc2lvbjox"}],
    ids=["neither", "both"],
)
def test_new_llm_evaluator_rejects_neither_or_both_prompt_sources(extra: dict[str, object]) -> None:
    with pytest.raises(
        ValidationError, match="Exactly one of prompt_version and prompt_version_id"
    ):
        NewLLMEvaluator.model_validate({"type": "llm", "output_configs": _OUTPUTS, **extra})


@pytest.mark.parametrize("outputs", [{}, {"output_configs": []}], ids=["omitted", "empty"])
def test_new_code_evaluator_requires_an_output_config(outputs: dict[str, object]) -> None:
    code = {
        "type": "code",
        "source_code": "def evaluate(output):\n    return {'score': 1.0}",
        "language": "PYTHON",
        "sandbox_config_id": "U2FuZGJveENvbmZpZzox",
        "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
    }
    with pytest.raises(ValidationError, match="output_configs"):
        NewCodeEvaluator.model_validate({**code, **outputs})
