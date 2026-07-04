from __future__ import annotations

import json
from pathlib import Path

from evals.pxi.experiments.context_pruning.cost_model import (
    anthropic_cost_usd,
    summarize_outputs,
    usage_from_output,
)
from evals.pxi.harness.datasets import load_dataset


def test_context_pruning_generated_datasets_load() -> None:
    smoke = load_dataset("context_pruning_cache_smoke")
    pilot = load_dataset("context_pruning_pilot")

    assert smoke.dataset_name == "context_pruning_cache_smoke"
    assert len(smoke.examples) == 2
    assert {example["splits"][0] for example in smoke.examples} == {"dev"}
    assert pilot.dataset_name == "context_pruning_pilot"
    assert len(pilot.examples) == 14


def test_context_pruning_task_hashes_exist() -> None:
    path = Path("evals/pxi/experiments/context-pruning/TASK_HASHES.json")
    hashes = json.loads(path.read_text())

    assert hashes["corpus_seed"] == 20260703
    assert "context_pruning_cache_smoke" in hashes["datasets"]
    assert "context_pruning_pilot" in hashes["datasets"]


def test_usage_from_output_defaults_missing_values_to_zero() -> None:
    assert usage_from_output({"usage": {"input_tokens": 10}}) == {
        "input_tokens": 10,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
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
