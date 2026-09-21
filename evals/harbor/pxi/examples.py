"""Per-example records derived from the PXI dataset YAML files.

The YAML under ``evals/pxi/datasets`` stays the source of truth. Each example becomes one
Harbor step whose ``workdir/example.json`` holds this record.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from evals.pxi.harness.datasets import EvalDataset, load_dataset

_STEP_NAME_CHARS = re.compile(r"[^A-Za-z0-9_-]+")


def example_records(dataset: EvalDataset) -> list[dict[str, Any]]:
    return [
        {
            "dataset": dataset.dataset_name,
            "id": example["id"],
            "splits": example["splits"],
            "evaluators": list(dataset.evaluators),
            "input": example["input"],
            "expected": example["expected"],
            "metadata": example.get("metadata", {}),
        }
        for example in dataset.examples
    ]


def load_example_records(dataset: str | Path) -> list[dict[str, Any]]:
    return example_records(load_dataset(dataset))


def step_name(example_id: str) -> str:
    return _STEP_NAME_CHARS.sub("-", example_id).strip("-") or "example"


def user_instruction(example: dict[str, Any]) -> str:
    """The newest user text in the example, for the step's ``instruction.md``."""
    messages = example["input"].get("messages") or []
    for message in reversed(messages):
        if message.get("role") != "user":
            continue
        if isinstance(content := message.get("content"), str):
            return content
        texts = [
            part.get("text", "")
            for part in message.get("parts") or []
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        if texts:
            return "".join(texts)
    return ""
