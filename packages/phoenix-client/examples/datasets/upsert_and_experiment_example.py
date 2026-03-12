"""
Example: Upsert a dataset, run an experiment, upsert again, and re-run the experiment.

Demonstrates the full lifecycle of dataset upsert semantics:
- Creating examples with and without external IDs
- Deleting, patching, carrying over, and adding examples across versions
- Running experiments against each dataset version

The dataset has two versions:

  Version 1 (initial upsert):
    1. "capital-france"   (external_id) — will be DELETED in v2
    2. "capital-germany"  (external_id) — will be PATCHED in v2
    3. "capital-japan"    (external_id) — will be UNCHANGED in v2
    4. no external_id, content: "largest ocean" — will be DELETED in v2
    5. no external_id, content: "fastest land animal" — will be DELETED and RE-CREATED in v2
       (metadata change → different content hash → not matchable, so old is deleted, new is created)
    6. no external_id, content: "boiling point of water" — will be UNCHANGED in v2

  Version 2 (second upsert):
    - "capital-germany"  (external_id) — PATCHED (answer corrected)
    - "capital-japan"    (external_id) — UNCHANGED (same content)
    - "capital-italy"    (external_id) — NEW example
    - no external_id, content: "fastest land animal" now has updated metadata — DELETED + RE-CREATED
    - no external_id, content: "boiling point of water" — UNCHANGED (same content)
    - no external_id, content: "largest planet" — NEW example

Prerequisites:
    - Phoenix server running (default: http://localhost:6006)
    - Install: pip install phoenix-client

Usage:
    python upsert_and_experiment_example.py
"""

from datetime import datetime
from typing import Any, Mapping

from phoenix.client import Client
from phoenix.client.experiments import run_experiment

PHOENIX_BASE_URL = "http://localhost:6006"
DATASET_NAME = f"upsert-demo-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

client = Client(base_url=PHOENIX_BASE_URL)

# =============================================================================
# Version 1: Initial dataset upsert
# =============================================================================

v1_examples: list[Mapping[str, Any]] = [
    # --- Examples WITH external IDs ---
    {
        # Will be DELETED in v2 (absent from next upsert)
        "input": {"question": "What is the capital of France?"},
        "output": {"answer": "Paris"},
        "metadata": {"category": "geography", "difficulty": "easy"},
        "external_id": "capital-france",
    },
    {
        # Will be PATCHED in v2 (answer corrected)
        "input": {"question": "What is the capital of Germany?"},
        "output": {"answer": "Munich"},  # intentionally wrong — will be fixed in v2
        "metadata": {"category": "geography", "difficulty": "easy"},
        "external_id": "capital-germany",
    },
    {
        # Will be UNCHANGED in v2 (same content)
        "input": {"question": "What is the capital of Japan?"},
        "output": {"answer": "Tokyo"},
        "metadata": {"category": "geography", "difficulty": "easy"},
        "external_id": "capital-japan",
    },
    # --- Examples WITHOUT external IDs (matched by content hash) ---
    {
        # Will be DELETED in v2 (absent from next upsert)
        "input": {"question": "What is the largest ocean?"},
        "output": {"answer": "Pacific Ocean"},
        "metadata": {"category": "geography", "difficulty": "easy"},
    },
    {
        # Will be DELETED and RE-CREATED in v2
        # (metadata change → different content hash → unmatchable)
        "input": {"question": "What is the fastest land animal?"},
        "output": {"answer": "Cheetah"},
        "metadata": {"category": "biology", "difficulty": "easy"},
    },
    {
        # Will be UNCHANGED in v2 (identical content → same content hash)
        "input": {"question": "What is the boiling point of water?"},
        "output": {"answer": "100°C at standard atmospheric pressure"},
        "metadata": {"category": "science", "difficulty": "easy"},
    },
]

print("=" * 60)
print("Version 1: Upserting initial dataset")
print("=" * 60)

dataset_v1 = client.datasets.upsert_dataset(
    name=DATASET_NAME,
    examples=v1_examples,
    dataset_description="Trivia Q&A dataset for upsert demo",
)

print(f"Dataset: {dataset_v1.name}")
print(f"Version ID: {dataset_v1.version_id}")
print(f"Examples: {len(dataset_v1)}")

# =============================================================================
# Experiment 1: Run against version 1
# =============================================================================

print("\n" + "=" * 60)
print("Experiment 1: Running against dataset version 1")
print("=" * 60)


def trivia_task(input: dict[str, Any]) -> str:
    """Simulate an LLM answering trivia questions."""
    # A mock lookup — in practice this would call an LLM
    answers = {
        "What is the capital of France?": "Paris",
        "What is the capital of Germany?": "Berlin",
        "What is the capital of Japan?": "Tokyo",
        "What is the capital of Italy?": "Rome",
        "What is the largest ocean?": "Pacific Ocean",
        "What is the fastest land animal?": "Cheetah",
        "What is the boiling point of water?": "100°C at standard atmospheric pressure",
        "What is the largest planet in our solar system?": "Jupiter",
    }
    return answers.get(input["question"], "I don't know")


def exact_match(output: str, expected: dict[str, Any]) -> bool:
    """Check if the task output exactly matches the expected answer."""
    return bool(output == expected["answer"])


experiment_v1 = run_experiment(
    client=client,
    dataset=dataset_v1,
    task=trivia_task,
    evaluators=[exact_match],
    experiment_name=f"trivia-v1-{datetime.now().strftime('%H%M%S')}",
    experiment_description="Experiment against initial dataset version",
)

# =============================================================================
# Version 2: Upsert with changes
# =============================================================================

v2_examples: list[Mapping[str, Any]] = [
    # --- Examples WITH external IDs ---
    # "capital-france" is OMITTED → will be DELETED
    {
        # PATCHED: answer corrected from "Munich" to "Berlin"
        "input": {"question": "What is the capital of Germany?"},
        "output": {"answer": "Berlin"},
        "metadata": {"category": "geography", "difficulty": "easy"},
        "external_id": "capital-germany",
    },
    {
        # UNCHANGED: identical to v1
        "input": {"question": "What is the capital of Japan?"},
        "output": {"answer": "Tokyo"},
        "metadata": {"category": "geography", "difficulty": "easy"},
        "external_id": "capital-japan",
    },
    {
        # NEW: did not exist in v1
        "input": {"question": "What is the capital of Italy?"},
        "output": {"answer": "Rome"},
        "metadata": {"category": "geography", "difficulty": "easy"},
        "external_id": "capital-italy",
    },
    # --- Examples WITHOUT external IDs ---
    # "largest ocean" is OMITTED → will be DELETED
    {
        # NEW: same question but metadata changed → different content hash → new example
        "input": {"question": "What is the fastest land animal?"},
        "output": {"answer": "Cheetah"},
        "metadata": {"category": "biology", "difficulty": "easy", "fun_fact": "Up to 70 mph"},
    },
    {
        # UNCHANGED: identical to v1 → same content hash
        "input": {"question": "What is the boiling point of water?"},
        "output": {"answer": "100°C at standard atmospheric pressure"},
        "metadata": {"category": "science", "difficulty": "easy"},
    },
    {
        # NEW: did not exist in v1
        "input": {"question": "What is the largest planet in our solar system?"},
        "output": {"answer": "Jupiter"},
        "metadata": {"category": "astronomy", "difficulty": "easy"},
    },
]

print("\n" + "=" * 60)
print("Version 2: Upserting updated dataset")
print("=" * 60)

dataset_v2 = client.datasets.upsert_dataset(
    name=DATASET_NAME,
    examples=v2_examples,
    dataset_description="Trivia Q&A dataset for upsert demo",
)

print(f"Dataset: {dataset_v2.name}")
print(f"Version ID: {dataset_v2.version_id}")
print(f"Examples: {len(dataset_v2)}")

# =============================================================================
# Experiment 2: Run against version 2
# =============================================================================

print("\n" + "=" * 60)
print("Experiment 2: Running against dataset version 2")
print("=" * 60)

experiment_v2 = run_experiment(
    client=client,
    dataset=dataset_v2,
    task=trivia_task,
    evaluators=[exact_match],
    experiment_name=f"trivia-v2-{datetime.now().strftime('%H%M%S')}",
    experiment_description="Experiment against updated dataset version",
)

# =============================================================================
# Summary
# =============================================================================

print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"Dataset: {DATASET_NAME}")
print(f"  v1: {len(dataset_v1)} examples (version {dataset_v1.version_id})")
print(f"  v2: {len(dataset_v2)} examples (version {dataset_v2.version_id})")
print("\nChanges from v1 → v2:")
print("  Deleted:   capital-france, largest ocean")
print("  Patched:   capital-germany (answer fixed)")
print("  Del+New:   fastest land animal (metadata changed → new content hash)")
print("  Unchanged: capital-japan, boiling point of water")
print("  Created:   capital-italy, largest planet")
print(f"\nView results at: {PHOENIX_BASE_URL}/datasets")
