"""Filter assertions compare decoded predicates, including their boolean structure."""

import json

import pytest

from evals.pxi.evaluators.tools import evaluate_tool_call_args
from evals.pxi.harness.datasets import load_dataset


def _score(example_id: str, script: str) -> float:
    example = next(e for e in load_dataset("set_spans_filter").examples if e["id"] == example_id)
    output = {
        "messages": [
            {
                "parts": [
                    {
                        "part_kind": "tool-call",
                        "tool_name": "execute_browser_action",
                        "args": {"script": script},
                    }
                ]
            }
        ]
    }
    return evaluate_tool_call_args(output, example["expected"])["score"]


def _script(condition: str) -> str:
    return f"return await ui.spansFilter.set({{condition: {json.dumps(condition)}}});"


@pytest.mark.parametrize(
    "condition",
    [
        "metadata['environment'] == 'prod'",
        'metadata["environment"] == "prod"',
    ],
)
def test_equivalent_quotes(condition: str) -> None:
    assert _score("metadata-access", _script(condition)) == 1


@pytest.mark.parametrize(
    "condition, score",
    [
        ("span_kind == 'LLM' or span_kind == 'TOOL'", 1),
        ("span_kind == 'TOOL' or span_kind == 'LLM'", 1),
        ("span_kind in ('LLM', 'TOOL')", 1),
        ("span_kind in ['TOOL', 'LLM']", 1),
        ("span_kind == 'LLM' and span_kind == 'TOOL'", 0),
        ("span_kind == 'LLM'", 0),
        ("span_kind in ['LLM', 'TOOL', 'CHAIN']", 0),
        ("span_kind == 'LLM' or name == 'TOOL'", 0),
    ],
)
def test_or_semantics(condition: str, score: int) -> None:
    assert _score("llm-or-tool-spans", _script(condition)) == score


@pytest.mark.parametrize(
    "condition, score",
    [
        ("parent_id is None and cumulative_token_count.total > 50000", 1),
        ("cumulative_token_count.total > 50000 and parent_id is None", 1),
        ("cumulative_token_count.total > 50000", 0),
        ("parent_id is None or cumulative_token_count.total > 50000", 0),
    ],
)
def test_root_scope(condition: str, score: int) -> None:
    assert _score("cumulative-tokens-roots", _script(condition)) == score


@pytest.mark.parametrize(
    "script",
    [
        """const condition = "metadata['environment'] == 'prod'"; return await ui.spansFilter.set({condition});""",
        """// prepare the filter
    const filter = `metadata["environment"] == "prod"`;
    const result = await ui.spansFilter.set({ condition: filter }); return result;""",
        r"""return await ui.spansFilter.set({condition: 'metadata[\'environment\'] == \'prod\''});""",
        r"""return await ui.spansFilter.set({condition: "metadata['environment'] == '\u0070rod'"});""",
    ],
)
def test_static_script_forms(script: str) -> None:
    assert _score("metadata-access", script) == 1


@pytest.mark.parametrize(
    "script",
    [
        """// ui.spansFilter.set({condition: "metadata['environment'] == 'prod'"});""",
        """return "ui.spansFilter.set({condition: metadata['environment'] == 'prod'})";""",
        """if (false) { return await ui.spansFilter.set({condition: "metadata['environment'] == 'prod'"}); }""",
        """const condition = "metadata['environment'] == 'prod'"; condition = ""; return await ui.spansFilter.set({condition});""",
        """const condition = "metadata['environment'] == 'prod'"; return await ui.spansFilter.set({condition: ""});""",
        """return await ui.spansFilter.set({condition: `${condition}`});""",
        """const condition = "metadata['environment'] == 'prod'"; return await ui.spansFilter.set({'condition'});""",
        """const ui = "fake"; return await ui.spansFilter.set({condition: "metadata['environment'] == 'prod'"});""",
        """return await ui.spansFilter.set({condition: "metadata['environment'] == 'prod'"}); ui.spansFilter.set({condition: ''});""",
    ],
)
def test_unresolved_or_misleading_source_fails_closed(script: str) -> None:
    assert _score("metadata-access", script) == 0


def test_invalid_filter_syntax_fails() -> None:
    assert _score("metadata-access", _script("metadata['environment'] == 'prod' ???")) == 0


def test_result_guard_after_unconditional_call() -> None:
    script = """const result = await ui.spansFilter.set({condition: "status_code == 'UNSET'"});
    if (!result.ok) return result;
    return {condition: "status_code == 'UNSET'"};"""
    assert _score("status-unset-spans", script) == 1


def test_unrequested_root_scope_fails() -> None:
    assert _score("chain-spans", _script("parent_id is None and span_kind == 'CHAIN'")) == 0
