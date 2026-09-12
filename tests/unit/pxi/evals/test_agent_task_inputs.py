"""Check fixture inputs against Phoenix's public transcript and tool contracts."""

from __future__ import annotations

import shlex
from pathlib import Path
from typing import Any

import pytest
import yaml
from graphql import build_schema, parse, validate
from pydantic import TypeAdapter
from pydantic_ai.messages import ToolReturnPart, UserPromptPart

from evals.pxi.harness.agent_task import (
    _build_contexts,
    _build_dependencies,
    _build_run_inputs,
    _prepare_transcript,
)
from evals.pxi.harness.backend import eval_graphql_schema
from evals.pxi.harness.transcript import fixture_messages
from phoenix.server.agents.capabilities.tools.internal.bash import BashToolResult

_DATASETS = Path(__file__).parents[4] / "evals" / "pxi" / "datasets"


def _user(id: str, text: str, project: str) -> dict[str, Any]:
    return {
        "id": id,
        "role": "user",
        "parts": [{"type": "text", "text": text}],
        "metadata": {
            "phoenix": {
                "type": "user",
                "currentDateTime": "2026-04-03T12:00:00-07:00",
                "timeZone": "America/Los_Angeles",
                "editPermission": "manual",
                "uiContexts": {"project": {"type": "project", "projectNodeId": project}},
            }
        },
    }


def test_omitted_contexts_do_not_invent_a_project() -> None:
    assert _build_contexts({"messages": [{"role": "user", "content": "hello"}]}).project is None


def test_per_turn_metadata_preserves_navigation_and_browser_clock() -> None:
    first, second = "UHJvamVjdDox", "UHJvamVjdDoy"
    inp = {
        "messages": [
            _user("u1", "Show this project", first),
            {"id": "a1", "role": "assistant", "parts": [{"type": "text", "text": "OK"}]},
            _user("u2", "Now show this project", second),
        ]
    }
    deps = _build_dependencies(inp)
    assert deps.contexts.project is not None
    assert deps.contexts.project.project_node_id == second
    assert deps.contexts.app is not None
    assert deps.contexts.app.time_zone == "America/Los_Angeles"
    _, history = _build_run_inputs(inp)
    users = [p.content for m in history for p in m.parts if isinstance(p, UserPromptPart)]
    assert first in str(users[0]) and second not in str(users[0])
    assert second in str(users[1]) and first not in str(users[1])
    assert inp["messages"][0]["parts"][0]["text"] == "Show this project"


def test_same_state_is_not_repeated_on_each_user_message() -> None:
    inp = {
        "messages": [_user("u1", "first", "UHJvamVjdDox"), _user("u2", "second", "UHJvamVjdDox")]
    }
    messages = _prepare_transcript(inp)
    assert "phoenix_ui_state" in messages[0].model_dump_json()
    assert "phoenix_ui_state" not in messages[1].model_dump_json()


def test_legacy_context_applies_to_active_turn_not_first_turn() -> None:
    inp = {
        "contexts": [{"type": "project", "projectNodeId": "UHJvamVjdDoy"}],
        "messages": [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "OK"},
            {"role": "user", "content": "second"},
        ],
    }
    messages = _prepare_transcript(inp)
    assert "phoenix_ui_state" not in messages[0].model_dump_json()
    assert "UHJvamVjdDoy" in messages[2].model_dump_json()


@pytest.mark.parametrize("dynamic", [False, True])
def test_public_tool_output_keeps_structured_result(dynamic: bool) -> None:
    part = {
        "type": "dynamic-tool" if dynamic else "tool-bash",
        "toolCallId": "c1",
        "state": "output-available",
        "input": {"command": "pwd"},
        "output": {"stdout": "/workspace", "stderr": "", "exitCode": 0},
    }
    if dynamic:
        part["toolName"] = "bash"
    inp = {
        "messages": [
            _user("u1", "where am I", "UHJvamVjdDox"),
            {"id": "a1", "role": "assistant", "parts": [part]},
        ]
    }
    prompt, history = _build_run_inputs(inp)
    assert prompt is None
    outputs = [p for m in history for p in m.parts if isinstance(p, ToolReturnPart)]
    assert len(outputs) == 1
    assert outputs[0].content == part["output"]


@pytest.mark.parametrize(
    "raw",
    [
        [],
        [{"role": "user", "content": ""}],
        [{"role": "assistant", "content": "done"}],
        [{"role": "tool", "tool_call_id": "unknown", "name": "bash", "content": "x"}],
        [{"role": "assistant", "tool_calls": [{"id": "t1", "name": "bash", "args": {}}]}],
        [{"role": "user", "content": "hello", "tool_calls": [{"id": "t1", "name": "bash"}]}],
    ],
)
def test_rejects_unresumable_or_invalid_prefixes(raw: Any) -> None:
    with pytest.raises(ValueError):
        fixture_messages(raw)


def test_rejects_conflicting_context_sources() -> None:
    with pytest.raises(ValueError, match="per-turn metadata"):
        _prepare_transcript({"contexts": [], "messages": [_user("u", "x", "UHJvamVjdDox")]})


def test_shorthand_pairs_parallel_outputs_and_rejects_duplicate_ids() -> None:
    calls = [{"id": "c1", "name": "first", "args": {}}, {"id": "c2", "name": "second", "args": {}}]
    raw = [
        {"role": "assistant", "tool_calls": calls},
        {"role": "tool", "tool_call_id": "c2", "name": "second", "content": "two"},
        {"role": "tool", "tool_call_id": "c1", "name": "first", "content": "one"},
    ]
    result = fixture_messages(raw)[0].model_dump(by_alias=True)
    assert [part["output"] for part in result["parts"]] == ["one", "two"]
    raw.append({"role": "assistant", "tool_calls": [calls[0]]})
    with pytest.raises(ValueError, match="Duplicate"):
        fixture_messages(raw)


@pytest.mark.parametrize("path", sorted(_DATASETS.glob("*.yaml")), ids=lambda p: p.stem)
def test_all_fixtures_use_current_transcript_and_bash_result_contracts(path: Path) -> None:
    for example in yaml.safe_load(path.read_text())["examples"]:
        inp = example["input"]
        # Public message validation and the same conversion production uses.
        _, history = _build_run_inputs(inp)
        assert history, example["id"]
        commands = {
            part["toolCallId"]: part["input"].get("command")
            for message in fixture_messages(inp["messages"])
            for part in message.model_dump(by_alias=True)["parts"]
            if part["type"] == "tool-bash"
        }
        for message in history:
            for part in message.parts:
                if isinstance(part, ToolReturnPart) and part.tool_name == "bash":
                    output = TypeAdapter(BashToolResult).validate_python(part.content)
                    assert output["command"] == commands[part.tool_call_id]
                    argv = shlex.split(output["command"])
                    if argv[0] == "phoenix-gql" and argv[1].startswith(("{", "query ")):
                        schema = build_schema(eval_graphql_schema().as_str())
                        assert not validate(schema, parse(argv[1])), example["id"]
                    assert output["stdoutBytes"] == len(output["stdout"].encode())
                    assert output["stderrBytes"] == len(output["stderr"].encode())
