import json
from copy import deepcopy
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest
from phoenix.client.types.prompts import PromptVersion

from phoenix.experimental.datagen.datasets import DatasetError
from phoenix.experimental.datagen.prompts import build_workflow_prompt, seed_workflow_prompts
from phoenix.utilities.template_formatters import FStringTemplateFormatter


def _questions() -> dict[str, Any]:
    return {
        "action": {
            "type": "choice",
            "instructions": "What should happen next?",
            "criteria": {"continue": "Proceed.", "stop": "Halt."},
        },
        "needs_review": {
            "type": "noul",
            "instructions": "Does this need review?",
            "criteria": {"true": "Needs attention.", "false": "No attention needed."},
        },
        **{
            name: {"type": "score", "instructions": f"Rate {name}.", "criteria": ["Low", "High"]}
            for name in ("risk", "urgency", "severity")
        },
    }


def _dataset(workflow: str) -> MagicMock:
    dataset = MagicMock()
    dataset.name = f"phoenix-datagen-typed-decisions-{workflow}"
    dataset.examples = [
        {
            "input": {"state": {"id": index}, "questions": _questions()},
            "metadata": {"workflow": workflow, "source_revision": "pinned"},
        }
        for index in range(2)
    ]
    return dataset


def test_workflow_tool_uses_exact_criteria_and_one_forced_call() -> None:
    questions = _questions()
    version = build_workflow_prompt("agent_trace_observability", questions, source_metadata={})
    request = dict(version.format(variables={"state": "{}"}, sdk="openai"))
    assert request["model"] == "gpt-6-luna"
    assert request["reasoning_effort"] == "none"
    assert request["parallel_tool_calls"] is False
    assert request["tool_choice"] == {"type": "function", "function": {"name": "record_decisions"}}
    assert len(request["tools"]) == 1
    function = request["tools"][0]["function"]
    assert function["strict"] is True
    schema = function["parameters"]
    assert schema["additionalProperties"] is False
    assert schema["required"] == list(questions)
    assert schema["properties"]["action"]["enum"] == ["continue", "stop"]
    assert schema["properties"]["needs_review"]["type"] == "boolean"
    assert schema["properties"]["risk"]["type"] == "integer"
    assert schema["properties"]["risk"]["enum"] == [0, 1]
    for name, question in questions.items():
        assert json.loads(schema["properties"][name]["description"]) == question


def test_prompt_state_renders_as_json_in_playground_and_sdk() -> None:
    state = {"approved": False, "balance": None, "items": ["one", "two"]}
    version = build_workflow_prompt("customer_service", _questions(), source_metadata={})
    sdk = dict(version.format(variables={"state": json.dumps(state)}, sdk="openai"))
    # Playground passes structured dataset values to the server's formatter.
    server = FStringTemplateFormatter().format("Evaluate this state:\n{state}", state=state)
    assert sdk["messages"][1]["content"] == server
    assert json.loads(server.split("\n", 1)[1]) == state


def test_seed_creates_only_workflow_prompts_and_skips_unchanged_versions() -> None:
    workflows = [
        "agent_trace_observability",
        "customer_service",
        "invoice_processing",
        "security_incidents",
    ]
    datasets = [_dataset(workflow) for workflow in workflows]
    combined = MagicMock()
    combined.name = "phoenix-datagen-typed-decisions"
    unrelated = MagicMock()
    unrelated.name = "phoenix-datagen-boolq"
    stored: dict[str, PromptVersion] = {}

    def get(*, prompt_identifier: str) -> PromptVersion:
        if prompt_identifier not in stored:
            try:
                httpx.Response(404, request=httpx.Request("GET", "http://local")).raise_for_status()
            except httpx.HTTPStatusError:
                raise ValueError("Prompt not found")
        return stored[prompt_identifier]

    def create(*, name: str, version: PromptVersion, **kwargs: Any) -> PromptVersion:
        stored[name] = version
        return version

    client = MagicMock()
    client.prompts.get.side_effect = get
    client.prompts.create.side_effect = create
    results = seed_workflow_prompts(client, [combined, *datasets, unrelated])
    assert [name for name, _ in results] == [dataset.name for dataset in datasets]
    assert client.prompts.create.call_count == 4
    seed_workflow_prompts(client, datasets)
    assert client.prompts.create.call_count == 4
    for example in datasets[0].examples:
        example["input"]["questions"]["action"]["instructions"] = "A revised question."
    seed_workflow_prompts(client, datasets)
    assert client.prompts.create.call_count == 5


@pytest.mark.parametrize("change", ["questions", "workflow", "empty"])
def test_invalid_workflow_definition_prevents_any_prompt_writes(change: str) -> None:
    valid = _dataset("customer_service")
    invalid = _dataset("security_incidents")
    if change == "questions":
        invalid.examples[1] = deepcopy(invalid.examples[1])
        invalid.examples[1]["input"]["questions"]["action"]["instructions"] = "Different."
    elif change == "workflow":
        invalid.examples[0]["metadata"]["workflow"] = "wrong"
    else:
        invalid.examples = []
    client = MagicMock()
    with pytest.raises(DatasetError):
        seed_workflow_prompts(client, [valid, invalid])
    client.prompts.get.assert_not_called()
    client.prompts.create.assert_not_called()


def test_prompt_read_errors_are_not_mistaken_for_missing_prompts() -> None:
    client = MagicMock()
    client.prompts.get.side_effect = ValueError("Invalid prompt response")
    with pytest.raises(ValueError, match="Invalid prompt response"):
        seed_workflow_prompts(client, [_dataset("customer_service")])
    client.prompts.create.assert_not_called()
