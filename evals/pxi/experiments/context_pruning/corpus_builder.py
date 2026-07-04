from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[4]
DATASETS_DIR = ROOT / "evals" / "pxi" / "datasets"
ARTIFACT_DIR = ROOT / "evals" / "pxi" / "experiments" / "context-pruning"
CORPUS_SEED = 20260703
RUN_ORDER_SEED = 20260704


def _tool_turn(index: int, content: str) -> list[dict[str, Any]]:
    tool_call_id = f"seeded-tool-{index}"
    return [
        {
            "role": "assistant",
            "tool_calls": [
                {
                    "id": tool_call_id,
                    "name": "bash",
                    "args": {"command": f"cat /phoenix/context-pruning/{index}.json"},
                }
            ],
        },
        {
            "role": "tool",
            "tool_call_id": tool_call_id,
            "name": "bash",
            "content": content,
        },
    ]


def _prefix(
    depth_tokens: int, *, needle: str | None = None, carrier: str = "tool_result"
) -> list[dict[str, Any]]:
    target_chars = depth_tokens * 4
    messages: list[dict[str, Any]] = []
    chunk_index = 0
    total_chars = 0
    while total_chars < target_chars:
        base = (
            f"seed={CORPUS_SEED}; chunk={chunk_index}; "
            "historical Phoenix trace context with span ids, project notes, and tool output. "
        )
        repeated = (base * 30)[:1800]
        if needle and chunk_index == 1 and carrier == "tool_result":
            repeated += f"\nimportant earlier filter token: {needle}\n"
        if needle and chunk_index == 1 and carrier == "user_text":
            messages.append({"role": "user", "content": f"Remember cohort token {needle}."})
        if needle and chunk_index == 1 and carrier == "assistant_text":
            messages.append({"role": "assistant", "content": f"Noted: cohort token {needle}."})
        messages.extend(_tool_turn(chunk_index, repeated))
        total_chars += len(repeated)
        chunk_index += 1
    return messages


def _set_filter_example(
    example_id: str,
    *,
    depth_tokens: int,
    prompt: str,
    condition: Any,
    split: str,
) -> dict[str, Any]:
    return {
        "id": example_id,
        "splits": [split],
        "input": {"messages": [*_prefix(depth_tokens), {"role": "user", "content": prompt}]},
        "expected": {
            "tools": {"required": ["set_spans_filter"]},
            "tool_call_args": {"set_spans_filter": {"condition": condition}},
            "budgets": {"max_tool_calls": 1},
        },
        "metadata": {
            "context_pruning": {
                "task_type": "A",
                "depth_tokens": depth_tokens,
                "seed": CORPUS_SEED,
            }
        },
    }


def _needle_example(
    example_id: str,
    *,
    depth_tokens: int,
    carrier: str,
    position: str,
    split: str,
) -> dict[str, Any]:
    needle = f"cohort-{carrier.replace('_', '-')}-{position}-{depth_tokens}"
    prompt = "Re-apply the cohort filter token we established earlier."
    return {
        "id": example_id,
        "splits": [split],
        "input": {
            "messages": [
                *_prefix(depth_tokens, needle=needle, carrier=carrier),
                {"role": "user", "content": prompt},
            ]
        },
        "expected": {
            "tools": {"required": ["set_spans_filter"]},
            "tool_call_args": {
                "set_spans_filter": {
                    "condition": {
                        "contains_all": [needle],
                    }
                }
            },
            "budgets": {"max_tool_calls": 1},
        },
        "metadata": {
            "context_pruning": {
                "task_type": "B",
                "depth_tokens": depth_tokens,
                "carrier": carrier,
                "position": position,
                "needle": needle,
                "seed": CORPUS_SEED,
            }
        },
    }


def cache_smoke_dataset() -> dict[str, Any]:
    prompt = "Show only LLM spans."
    expected = {
        "tools": {"required": ["set_spans_filter"]},
        "tool_call_args": {
            "set_spans_filter": {
                "condition": "span_kind == 'LLM'",
                "rootSpansOnly": False,
            }
        },
        "budgets": {"max_tool_calls": 1},
    }
    messages = [*_prefix(5_000), {"role": "user", "content": prompt}]
    examples = [
        {
            "id": f"cache-smoke-{index}",
            "splits": ["dev"],
            "input": {"messages": messages},
            "expected": expected,
            "metadata": {
                "context_pruning": {
                    "task_type": "cache_smoke",
                    "depth_tokens": 5_000,
                    "seed": CORPUS_SEED,
                }
            },
        }
        for index in (1, 2)
    ]
    return {
        "dataset_name": "context_pruning_cache_smoke",
        "description": "Two identical dev examples for validating prompt-cache usage capture.",
        "evaluators": [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ],
        "examples": examples,
    }


def pilot_dataset() -> dict[str, Any]:
    examples: list[dict[str, Any]] = []
    type_a_specs = [
        ("llm", "Show only LLM spans.", "span_kind == 'LLM'"),
        ("tool", "Show only tool spans.", "span_kind == 'TOOL'"),
        ("errors", "Show errored spans.", "status_code == 'ERROR'"),
        (
            "slow",
            "Show spans taking at least five seconds.",
            {"contains_all": ["latency_ms", "5000"], "not_contains": ["latency_ms < "]},
        ),
    ]
    for depth in (5_000, 25_000):
        for slug, prompt, condition in type_a_specs:
            examples.append(
                _set_filter_example(
                    f"type-a-{slug}-{depth}",
                    depth_tokens=depth,
                    prompt=prompt,
                    condition=condition,
                    split="dev",
                )
            )
    for depth in (5_000, 25_000):
        for carrier in ("tool_result", "user_text", "assistant_text"):
            examples.append(
                _needle_example(
                    f"type-b-{carrier}-{depth}",
                    depth_tokens=depth,
                    carrier=carrier,
                    position="middle",
                    split="dev",
                )
            )
    return {
        "dataset_name": "context_pruning_pilot",
        "description": "Seeded context-pruning pilot tasks for P0/P1 policy checks.",
        "evaluators": [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ],
        "examples": examples,
    }


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def task_hashes(dataset: dict[str, Any]) -> list[dict[str, str]]:
    hashes: list[dict[str, str]] = []
    for example in dataset["examples"]:
        digest = hashlib.sha256(_stable_json(example).encode("utf-8")).hexdigest()
        hashes.append({"id": example["id"], "sha256": digest})
    return hashes


def write_artifacts() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    datasets = [cache_smoke_dataset(), pilot_dataset()]
    for dataset in datasets:
        path = DATASETS_DIR / f"{dataset['dataset_name']}.yaml"
        path.write_text(yaml.safe_dump(dataset, sort_keys=False), encoding="utf-8")
    hashes = {
        "corpus_seed": CORPUS_SEED,
        "run_order_seed": RUN_ORDER_SEED,
        "datasets": {dataset["dataset_name"]: task_hashes(dataset) for dataset in datasets},
    }
    (ARTIFACT_DIR / "TASK_HASHES.json").write_text(
        json.dumps(hashes, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Build context-pruning PXI eval artifacts.")
    parser.parse_args()
    write_artifacts()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
