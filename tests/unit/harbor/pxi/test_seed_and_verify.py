from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from evals.harbor.pxi.dataset import DATASETS_DIR
from evals.harbor.pxi.examples import load_example_records, step_name, user_instruction
from evals.harbor.pxi.generate_tasks import generate
from evals.harbor.pxi.seed import plan_seed
from evals.harbor.pxi.verify import (
    evaluator_output,
    reward_from_results,
    run_evaluators,
    scored_messages,
)

DATASETS = sorted(path.stem for path in DATASETS_DIR.glob("*.yaml"))
NOW = datetime(2026, 9, 21, tzinfo=timezone.utc)

CATALOG = "ui.spansFilter.set(input: { condition: string }): Promise<UIResult>;"


def _resume_example() -> dict[str, Any]:
    return {
        "dataset": "set_spans_filter",
        "id": "llm-spans",
        "splits": ["regression"],
        "evaluators": ["correct_tools_called", "tool_call_args_match"],
        "input": {
            "contexts": [
                {"type": "project", "projectNodeId": "UHJvamVjdDoxMg==", "spanFilter": ""}
            ],
            "messages": [
                {"role": "user", "content": "Show me only LLM spans."},
                {
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": "search-ops",
                            "name": "search_browser_actions",
                            "args": {"query": "filter the spans table"},
                        }
                    ],
                },
                {
                    "role": "tool",
                    "tool_call_id": "search-ops",
                    "name": "search_browser_actions",
                    "content": CATALOG,
                },
            ],
        },
        "expected": {
            "ui_operations": {"required": ["spansFilter.set"]},
            "ui_operation_args": {
                "spansFilter.set": {"condition": {"filter_equals": "span_kind == 'LLM'"}}
            },
        },
        "metadata": {},
    }


def _message_example() -> dict[str, Any]:
    return {
        "dataset": "product_knowledge",
        "id": "what-is-a-trace",
        "splits": ["regression"],
        "evaluators": ["assistant_text_substrings_match", "correct_tools_called"],
        "input": {"messages": [{"role": "user", "content": "What is a trace?"}]},
        "expected": {
            "assistant_text": {"contains_all": ["trace"]},
            "tools": {"forbidden": ["bash"]},
        },
        "metadata": {},
    }


def test_resume_plan_stores_pending_call_and_submits_its_output() -> None:
    plan = plan_seed(_resume_example(), model="openai/gpt-5.4", now=NOW)
    stored = plan["stored_messages"]
    assert [m["role"] for m in stored] == ["user", "assistant"]
    user_metadata = stored[0]["metadata"]["phoenix"]
    assert user_metadata["type"] == "user"
    assert user_metadata["uiContexts"]["project"]["projectNodeId"] == "UHJvamVjdDoxMg=="
    assert user_metadata["editPermission"] == "manual"
    pending = stored[1]["parts"][0]
    assert pending["state"] == "input-available"
    assert pending["type"] == "tool-search_browser_actions"
    assert "output" not in pending
    client = plan["client"]
    assert client["message"] is None
    assert client["last_message_id"] == stored[1]["id"]
    assert client["tool_outputs"][0]["state"] == "output-available"
    assert client["tool_outputs"][0]["output"] == CATALOG
    assert {c["type"] for c in client["contexts"]} == {
        "project",
        "app",
        "graphql",
        "web_access",
        "subagents",
    }
    assert plan["scoring"]["resumed_message_id"] == stored[1]["id"]
    assert plan["scoring"]["seeded_part_count"] == 1
    assert plan["session"] == {
        "project_name": "assistant_agent",
        "title": "set_spans_filter/llm-spans",
        "model_provider": "OPENAI",
        "model_name": "gpt-5.4",
    }


def test_message_plan_posts_the_user_turn() -> None:
    plan = plan_seed(_message_example(), model="anthropic/claude-x", now=NOW)
    assert plan["stored_messages"] == []
    client = plan["client"]
    assert client["last_message_id"] is None
    assert client["tool_outputs"] == []
    assert client["message"]["parts"] == [{"type": "text", "text": "What is a trace?"}]
    assert client["message"]["metadata"]["phoenix"]["type"] == "user"
    assert plan["scoring"]["client_message_id"] == client["message"]["id"]
    assert plan["session"]["model_provider"] == "ANTHROPIC"


def test_message_ids_are_uuids_so_the_database_accepts_them() -> None:
    plan = plan_seed(_resume_example(), model="openai/gpt-5.4", now=NOW)
    for message in plan["stored_messages"]:
        assert len(message["id"]) == 36 and message["id"].count("-") == 4


@pytest.mark.parametrize("dataset", DATASETS)
def test_every_dataset_example_plans(dataset: str) -> None:
    for example in load_example_records(dataset):
        plan = plan_seed(example, model="openai/gpt-5.4", now=NOW)
        assert plan["stored_messages"] or plan["client"]["message"] is not None
        assert step_name(example["id"])
        assert user_instruction(example)


def test_scored_messages_drop_the_seeded_prefix() -> None:
    plan = plan_seed(_resume_example(), model="openai/gpt-5.4", now=NOW)
    stored = plan["stored_messages"]
    resumed = {
        **stored[1],
        "parts": [
            plan["client"]["tool_outputs"][0],
            {
                "type": "tool-execute_browser_action",
                "toolCallId": "call-2",
                "state": "input-available",
                "input": {
                    "script": "await ui.spansFilter.set({ condition: \"span_kind == 'LLM'\" })"
                },
            },
        ],
    }
    turn = scored_messages([stored[0], resumed], plan["scoring"])
    assert len(turn) == 1
    assert [p["toolCallId"] for p in turn[0]["parts"]] == ["call-2"]
    output = evaluator_output(turn)
    results = run_evaluators(_resume_example(), output)
    assert {name: r["score"] for name, r in results.items()} == {
        "correct_tools_called": 1.0,
        "tool_call_args_match": 1.0,
    }
    assert reward_from_results(results) == 1.0


def test_scored_messages_keep_only_new_messages_after_a_posted_user_turn() -> None:
    plan = plan_seed(_message_example(), model="openai/gpt-5.4", now=NOW)
    posted = plan["client"]["message"]
    reply = {
        "id": "reply",
        "role": "assistant",
        "parts": [{"type": "text", "text": "A trace is a tree of spans."}],
    }
    output = evaluator_output(scored_messages([posted, reply], plan["scoring"]))
    assert output["assistant_text"] == "A trace is a tree of spans."
    results = run_evaluators(_message_example(), output)
    assert reward_from_results(results) == 1.0


def test_evaluator_output_reads_dynamic_tool_parts() -> None:
    output = evaluator_output(
        [
            {
                "role": "assistant",
                "parts": [
                    {
                        "type": "dynamic-tool",
                        "toolName": "execute",
                        "toolCallId": "c",
                        "state": "output-available",
                        "input": {"code": "1"},
                        "output": "1",
                    }
                ],
            }
        ]
    )
    assert output["messages"][0]["parts"] == [
        {
            "part_kind": "tool-call",
            "tool_name": "execute",
            "args": {"code": "1"},
            "tool_call_id": "c",
        }
    ]


def test_generate_writes_one_step_per_example(tmp_path: Path) -> None:
    written = generate(
        out_dir=tmp_path,
        datasets=["in_app_links"],
        splits=None,
        limit=2,
        agent_timeout_sec=600.0,
    )
    assert [task.name for task in written] == ["in_app_links"]
    task = written[0]
    steps = sorted(p.name for p in (task / "steps").iterdir())
    assert len(steps) == 2
    toml = (task / "task.toml").read_text()
    assert toml.count("[[steps]]") == 2
    assert 'fixture = "pxi"' in toml
    for step in steps:
        assert (task / "steps" / step / "workdir" / "example.json").exists()
        assert (task / "steps" / step / "instruction.md").read_text().strip()
    assert (task / "tests" / "test.sh").stat().st_mode & 0o111
    # A second run for another dataset removes the first task directory.
    generate(
        out_dir=tmp_path, datasets=["set_time_range"], splits=None, limit=1, agent_timeout_sec=1.0
    )
    assert sorted(p.name for p in tmp_path.iterdir()) == ["set_time_range"]
