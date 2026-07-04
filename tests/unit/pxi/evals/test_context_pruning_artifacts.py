from __future__ import annotations

import json
from pathlib import Path

from evals.pxi.experiments.context_pruning.corpus_builder import (
    DEPTHS,
    depth_slug,
    expand_context_pruning_prefix,
    materialize_prefix,
)
from evals.pxi.experiments.context_pruning.cost_model import (
    anthropic_cost_usd,
    summarize_outputs,
    usage_from_output,
)
from evals.pxi.harness.datasets import load_dataset


def test_context_pruning_generated_datasets_load() -> None:
    smoke = load_dataset("context_pruning_cache_smoke")
    pilot = load_dataset("context_pruning_pilot")
    type_a = load_dataset("context_pruning_type_a")
    type_b = load_dataset("context_pruning_type_b")

    assert smoke.dataset_name == "context_pruning_cache_smoke"
    assert len(smoke.examples) == 2
    assert {example["splits"][0] for example in smoke.examples} == {"dev"}
    assert pilot.dataset_name == "context_pruning_pilot"
    assert len(pilot.examples) == 14
    assert type_a.dataset_name == "context_pruning_type_a"
    assert len(type_a.examples) == 40 * len(DEPTHS)
    assert type_b.dataset_name == "context_pruning_type_b"
    assert len(type_b.examples) == 3 * 3 * 4 * len(DEPTHS)
    for depth in DEPTHS:
        slug = depth_slug(depth)
        type_a_depth = load_dataset(f"context_pruning_type_a_{slug}")
        type_b_depth = load_dataset(f"context_pruning_type_b_{slug}")
        assert len(type_a_depth.examples) == 40
        assert len(type_b_depth.examples) == 3 * 3 * 4
        assert {
            example["metadata"]["context_pruning"]["depth_tokens"]
            for example in type_a_depth.examples
        } == {depth}
        assert {
            example["metadata"]["context_pruning"]["depth_tokens"]
            for example in type_b_depth.examples
        } == {depth}


def test_context_pruning_prefix_expands_and_preserves_unique_needle() -> None:
    spec = {
        "seed": 20260703,
        "depth_tokens": 5_000,
        "needle": "cohort-filter-tool-result-p50-01",
        "carrier": "tool_result",
        "position": "p50",
        "archetype": "filter",
    }
    messages = materialize_prefix(spec)
    text = "\n".join(str(message) for message in messages)

    assert text.count("cohort-filter-tool-result-p50-01") == 1

    expanded = expand_context_pruning_prefix(
        {
            "context_pruning_prefix": spec,
            "messages": [{"role": "user", "content": "final prompt"}],
        }
    )

    assert len(expanded["messages"]) == len(messages) + 1


def test_context_pruning_task_hashes_exist() -> None:
    path = Path("evals/pxi/experiments/context-pruning/TASK_HASHES.json")
    hashes = json.loads(path.read_text())

    assert hashes["corpus_seed"] == 20260703
    assert "context_pruning_cache_smoke" in hashes["datasets"]
    assert "context_pruning_pilot" in hashes["datasets"]
    assert "context_pruning_type_a_150k" in hashes["datasets"]
    assert "context_pruning_type_b_150k" in hashes["datasets"]


def test_usage_from_output_defaults_missing_values_to_zero() -> None:
    assert usage_from_output({"usage": {"input_tokens": 10}}) == {
        "input_tokens": 10,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
    }


def test_usage_from_output_includes_policy_usage() -> None:
    assert usage_from_output(
        {
            "usage": {"input_tokens": 10, "output_tokens": 2},
            "policy_usage": {
                "input_tokens": 3,
                "output_tokens": 1,
                "cache_write_tokens": 3,
            },
        }
    ) == {
        "input_tokens": 13,
        "output_tokens": 3,
        "cache_read_tokens": 0,
        "cache_write_tokens": 3,
    }


def test_anthropic_cost_uses_cache_read_and_write_rates() -> None:
    usage = {
        "input_tokens": 100,
        "output_tokens": 10,
        "cache_read_tokens": 20,
        "cache_write_tokens": 40,
    }

    assert anthropic_cost_usd(usage) == 0.00071


def test_summarize_outputs_accumulates_usage_and_latency() -> None:
    summary = summarize_outputs(
        [
            {"usage": {"input_tokens": 10, "output_tokens": 2}, "latency_ms": 200},
            {"usage": {"input_tokens": 5, "cache_read_tokens": 3}, "latency_ms": 100},
        ]
    )

    assert summary["runs"] == 2
    assert summary["usage"]["input_tokens"] == 15
    assert summary["usage"]["cache_read_tokens"] == 3
    assert summary["median_latency_ms"] == 200
