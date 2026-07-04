from __future__ import annotations

import argparse
import hashlib
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[4]
DATASETS_DIR = ROOT / "evals" / "pxi" / "datasets"
ARTIFACT_DIR = ROOT / "evals" / "pxi" / "experiments" / "context-pruning"
CORPUS_DIR = ARTIFACT_DIR / "corpus"
BLOCKS_DIR = CORPUS_DIR / "blocks"
CORPUS_SEED = 20260703
RUN_ORDER_SEED = 20260704
DEPTHS = (5_000, 25_000, 50_000, 100_000, 150_000)
TYPE_A_TASKS = 40
TYPE_B_GATE_DEPTH = 5_000
CARRIERS = ("tool_result", "user_text", "assistant_text")
POSITIONS = ("p10", "p50", "p90")
ARCHETYPES = ("filter", "time_window", "trace_id", "model_constraint")


def _token_estimate(text: str) -> int:
    return max(1, len(text) // 4) if text else 0


def _message_text(message: dict[str, Any]) -> str:
    chunks: list[str] = []
    content = message.get("content")
    if isinstance(content, str):
        chunks.append(content)
    for call in message.get("tool_calls") or []:
        chunks.append(json.dumps(call, sort_keys=True))
    return "\n".join(chunks)


def _prefix_tokens(messages: list[dict[str, Any]]) -> int:
    return sum(_token_estimate(_message_text(message)) for message in messages)


def _trim_to_depth(messages: list[dict[str, Any]], depth_tokens: int) -> None:
    realized = _prefix_tokens(messages)
    if realized <= depth_tokens:
        return
    excess_chars = (realized - depth_tokens) * 4
    for message in reversed(messages):
        if message.get("role") != "tool":
            continue
        content = message.get("content")
        if not isinstance(content, str) or len(content) <= excess_chars + 200:
            continue
        message["content"] = content[:-excess_chars].rstrip()
        return


def _tool_turn(index: int, content: str) -> list[dict[str, Any]]:
    tool_call_id = f"context-pruning-tool-{index}"
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


def _base_tool_content(index: int) -> str:
    base = (
        f"seed={CORPUS_SEED}; block={index}; source=synthetic-calibration; "
        "phoenix trace rows with span ids, timestamps, statuses, model names, "
        "latency metrics, token counts, and tool output excerpts. "
    )
    return (base * 120)[:4_000]


def _needle_text(needle: str, archetype: str) -> str:
    if archetype == "filter":
        return f"Project note: the established cohort filter expression is `{needle}`."
    if archetype == "time_window":
        return f"Project note: the established investigation start time is `{needle}`."
    if archetype == "trace_id":
        return f"Project note: the established outlier trace filter expression is `{needle}`."
    return f"Project note: the established model constraint filter expression is `{needle}`."


def materialize_prefix(spec: dict[str, Any]) -> list[dict[str, Any]]:
    depth_tokens = int(spec["depth_tokens"])
    needle = spec.get("needle")
    carrier = str(spec.get("carrier", "tool_result"))
    position = str(spec.get("position", "p50"))
    archetype = str(spec.get("archetype", "filter"))
    position_ratio = {"p10": 0.10, "p50": 0.50, "p90": 0.90}.get(position, 0.50)
    target_needle_tokens = int(depth_tokens * position_ratio)

    messages: list[dict[str, Any]] = [
        {
            "role": "user",
            "content": "We are investigating Phoenix traces in the context-pruning corpus.",
        }
    ]
    inserted_needle = needle is None
    block_index = 0
    while _prefix_tokens(messages) < depth_tokens:
        current_tokens = _prefix_tokens(messages)
        should_insert = not inserted_needle and current_tokens >= target_needle_tokens
        content = _base_tool_content(block_index)
        if should_insert and carrier == "tool_result":
            content += "\n" + _needle_text(str(needle), archetype) + "\n"
            inserted_needle = True
        if should_insert and carrier == "user_text":
            messages.append({"role": "user", "content": _needle_text(str(needle), archetype)})
            inserted_needle = True
        if should_insert and carrier == "assistant_text":
            messages.append({"role": "assistant", "content": _needle_text(str(needle), archetype)})
            inserted_needle = True
        messages.extend(_tool_turn(block_index, content))
        block_index += 1
    if not inserted_needle and needle is not None:
        messages.append({"role": "user", "content": _needle_text(str(needle), archetype)})
    _trim_to_depth(messages, depth_tokens)
    return messages


def expand_context_pruning_prefix(input_value: dict[str, Any]) -> dict[str, Any]:
    spec = input_value.get("context_pruning_prefix")
    if not isinstance(spec, dict):
        return input_value
    raw_messages = input_value.get("messages")
    if not isinstance(raw_messages, list):
        raise ValueError("context_pruning_prefix inputs must also define messages")
    expanded = dict(input_value)
    expanded["messages"] = [*materialize_prefix(spec), *raw_messages]
    return expanded


def _load_dataset(stem: str) -> dict[str, Any]:
    dataset = yaml.safe_load((DATASETS_DIR / f"{stem}.yaml").read_text())
    if not isinstance(dataset, dict):
        raise ValueError(f"dataset {stem} must load as an object")
    return dataset


def _source_type_a_examples() -> list[dict[str, Any]]:
    examples: list[dict[str, Any]] = []
    for stem in ("set_spans_filter", "set_time_range", "save_prompt"):
        dataset = _load_dataset(stem)
        for example in dataset["examples"]:
            copied = deepcopy(example)
            copied["id"] = f"{stem}--{copied['id']}"
            examples.append(copied)
    if len(examples) < TYPE_A_TASKS:
        raise RuntimeError(f"need {TYPE_A_TASKS} Type A examples, found {len(examples)}")
    return examples[:TYPE_A_TASKS]


def _prefix_spec(depth: int, **overrides: Any) -> dict[str, Any]:
    spec: dict[str, Any] = {
        "seed": CORPUS_SEED,
        "depth_tokens": depth,
        "composition": "fallback-60-tool-25-assistant-15-user",
    }
    spec.update(overrides)
    return spec


def _with_prefix(example: dict[str, Any], depth: int, task_index: int) -> dict[str, Any]:
    messages = example["input"]["messages"]
    return {
        "id": f"type-a-{task_index:02d}-{example['id']}-{depth}",
        "splits": ["dev"],
        "input": {
            "context_pruning_prefix": _prefix_spec(depth),
            "messages": messages,
        },
        "expected": deepcopy(example["expected"]),
        "metadata": {
            "context_pruning": {
                "task_type": "A",
                "source_id": example["id"],
                "depth_tokens": depth,
                "seed": CORPUS_SEED,
            }
        },
    }


def type_a_dataset() -> dict[str, Any]:
    examples: list[dict[str, Any]] = []
    for task_index, source in enumerate(_source_type_a_examples(), start=1):
        for depth in DEPTHS:
            examples.append(_with_prefix(source, depth, task_index))
    return {
        "dataset_name": "context_pruning_type_a",
        "description": "Context-pruning Type A history-independent tasks across nested depths.",
        "evaluators": [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ],
        "examples": examples,
    }


def _needle(archetype: str, carrier: str, position: str, index: int) -> str:
    token = f"{archetype}-{carrier.replace('_', '-')}-{position}-{index:02d}"
    if archetype == "filter":
        return f"attributes['experiment.cohort'] == 'cohort-{token}'"
    if archetype == "time_window":
        day = (index - 1) % 28 + 1
        return f"2026-07-{day:02d}T09:30:00Z"
    if archetype == "trace_id":
        return f"trace_id == 'trace-{token}'"
    return f"llm.model_name == 'model-{token}'"


def _type_b_expected(archetype: str, needle: str) -> dict[str, Any]:
    if archetype in {"filter", "trace_id", "model_constraint"}:
        return {
            "tools": {"required": ["set_spans_filter"]},
            "tool_call_args": {"set_spans_filter": {"condition": {"contains_all": [needle]}}},
            "budgets": {"max_tool_calls": 1},
        }
    return {
        "tools": {"required": ["set_time_range"]},
        "tool_call_args": {"set_time_range": {"startTime": {"contains_all": [needle]}}},
        "budgets": {"max_tool_calls": 1},
    }


def _type_b_prompt(archetype: str) -> str:
    if archetype == "filter":
        return "Use the earlier established cohort filter expression now."
    if archetype == "time_window":
        return "Use the earlier established investigation start time now."
    if archetype == "trace_id":
        return "Use the earlier established outlier trace filter expression now."
    return "Use the earlier established model constraint filter expression now."


def type_b_dataset() -> dict[str, Any]:
    examples: list[dict[str, Any]] = []
    task_index = 1
    for archetype in ARCHETYPES:
        for carrier in CARRIERS:
            for position in POSITIONS:
                needle = _needle(archetype, carrier, position, task_index)
                for depth in DEPTHS:
                    examples.append(
                        {
                            "id": (
                                f"type-b-{task_index:02d}-{archetype}-{carrier}-{position}-{depth}"
                            ),
                            "splits": ["dev"],
                            "input": {
                                "context_pruning_prefix": _prefix_spec(
                                    depth,
                                    needle=needle,
                                    carrier=carrier,
                                    position=position,
                                    archetype=archetype,
                                ),
                                "messages": [
                                    {"role": "user", "content": _type_b_prompt(archetype)}
                                ],
                            },
                            "expected": _type_b_expected(archetype, needle),
                            "metadata": {
                                "context_pruning": {
                                    "task_type": "B",
                                    "carrier": carrier,
                                    "position": position,
                                    "archetype": archetype,
                                    "needle": needle,
                                    "depth_tokens": depth,
                                    "seed": CORPUS_SEED,
                                }
                            },
                        }
                    )
                task_index += 1
    return {
        "dataset_name": "context_pruning_type_b",
        "description": "Context-pruning Type B needle tasks across carriers, positions, and depths.",
        "evaluators": [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ],
        "examples": examples,
    }


def gate_type_a_zero_dataset() -> dict[str, Any]:
    examples: list[dict[str, Any]] = []
    for task_index, source in enumerate(_source_type_a_examples(), start=1):
        copied = deepcopy(source)
        copied["id"] = f"gate-type-a-zero-{task_index:02d}-{source['id']}"
        copied["splits"] = ["dev"]
        copied["metadata"] = {
            **dict(copied.get("metadata") or {}),
            "context_pruning": {
                "task_type": "A",
                "source_id": source["id"],
                "depth_tokens": 0,
                "gate": "type_a_zero",
                "seed": CORPUS_SEED,
            },
        }
        examples.append(copied)
    return {
        "dataset_name": "context_pruning_gate_type_a_zero",
        "description": "Admission gate: Type A source tasks without primed history.",
        "evaluators": [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ],
        "examples": examples,
    }


def _zero_history_type_b_example(example: dict[str, Any]) -> dict[str, Any]:
    copied = deepcopy(example)
    copied["id"] = (
        copied["id"].replace("type-b-", "gate-type-b-zero-").removesuffix(f"-{TYPE_B_GATE_DEPTH}")
    )
    copied["input"] = {"messages": deepcopy(example["input"]["messages"])}
    metadata = deepcopy(example.get("metadata") or {})
    context = dict(metadata.get("context_pruning") or {})
    context["depth_tokens"] = 0
    context["gate"] = "type_b_zero"
    metadata["context_pruning"] = context
    copied["metadata"] = metadata
    return copied


def gate_type_b_zero_dataset() -> dict[str, Any]:
    examples = [
        _zero_history_type_b_example(example)
        for example in type_b_dataset()["examples"]
        if example["metadata"]["context_pruning"]["depth_tokens"] == TYPE_B_GATE_DEPTH
    ]
    return {
        "dataset_name": "context_pruning_gate_type_b_zero",
        "description": "Admission gate: Type B tasks without the required recalled history.",
        "evaluators": [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ],
        "examples": examples,
    }


def gate_type_b_5k_dataset() -> dict[str, Any]:
    examples = [
        deepcopy(example)
        for example in type_b_dataset()["examples"]
        if example["metadata"]["context_pruning"]["depth_tokens"] == TYPE_B_GATE_DEPTH
    ]
    for example in examples:
        example["id"] = example["id"].replace("type-b-", "gate-type-b-5k-")
        example["metadata"]["context_pruning"]["gate"] = "type_b_5k"
    return {
        "dataset_name": "context_pruning_gate_type_b_5k",
        "description": "Admission gate: Type B tasks at the 5K recalled-history depth.",
        "evaluators": [
            "correct_tools_called",
            "tool_call_args_match",
            "tool_call_count_within_limit",
        ],
        "examples": examples,
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
    examples = [
        {
            "id": f"cache-smoke-{index}",
            "splits": ["dev"],
            "input": {
                "context_pruning_prefix": _prefix_spec(5_000),
                "messages": [{"role": "user", "content": prompt}],
            },
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
    examples = type_a_dataset()["examples"][:8] + type_b_dataset()["examples"][:6]
    for example in examples:
        example["id"] = (
            example["id"].replace("type-a-", "pilot-type-a-").replace("type-b-", "pilot-type-b-")
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


def _write_blocks() -> None:
    BLOCKS_DIR.mkdir(parents=True, exist_ok=True)
    for index in range(8):
        (BLOCKS_DIR / f"synthetic-block-{index:02d}.txt").write_text(
            _base_tool_content(index), encoding="utf-8"
        )


def _corpus_stats() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for depth in DEPTHS:
        messages = materialize_prefix(_prefix_spec(depth))
        realized = _prefix_tokens(messages)
        rows.append(
            {
                "target_tokens": depth,
                "realized_estimated_tokens": realized,
                "delta_pct": round((realized - depth) / depth * 100, 2),
                "messages": len(messages),
            }
        )
    return rows


def _write_report(datasets: list[dict[str, Any]]) -> None:
    stats = _corpus_stats()
    lines = [
        "# Context Pruning Corpus Report",
        "",
        f"Seed: `{CORPUS_SEED}`",
        "",
        "The repository artifact uses compact `input.context_pruning_prefix` specs.",
        "The PXI harness expands those specs into deterministic primed histories at runtime.",
        "",
        "## Datasets",
        "",
        "| Dataset | Examples |",
        "|---|---:|",
    ]
    lines.extend(
        f"| {dataset['dataset_name']} | {len(dataset['examples'])} |" for dataset in datasets
    )
    lines.extend(
        [
            "",
            "## Prefix Depth Check",
            "",
            "| Target tokens | Realized estimated tokens | Delta pct | Messages |",
            "|---:|---:|---:|---:|",
        ]
    )
    lines.extend(
        (
            f"| {row['target_tokens']} | {row['realized_estimated_tokens']} | "
            f"{row['delta_pct']} | {row['messages']} |"
        )
        for row in stats
    )
    lines.extend(
        [
            "",
            "Calibration status: fallback synthetic blocks are primary until Playwright-generated",
            "PXI calibration sessions are recorded. All blocks are generated from the pinned seed",
            "and contain no real user data.",
        ]
    )
    (CORPUS_DIR / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_artifacts() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    _write_blocks()
    datasets = [
        cache_smoke_dataset(),
        pilot_dataset(),
        type_a_dataset(),
        type_b_dataset(),
        gate_type_a_zero_dataset(),
        gate_type_b_zero_dataset(),
        gate_type_b_5k_dataset(),
    ]
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
    _write_report(datasets)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build context-pruning PXI eval artifacts.")
    parser.parse_args()
    write_artifacts()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
