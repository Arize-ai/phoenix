"""
Example: Retrieve examples from a dataset, mutate them, and upsert.

Demonstrates the round-trip workflow:
1. Upsert an initial dataset
2. Retrieve the returned examples (which now include external_id)
3. Mutate the list — patch, delete, add — using the retrieved examples directly
4. Upsert the mutated list as a new version

The dataset has two versions:

  Version 1 (initial upsert):
    1. "capital-france"   (external_id) — will be DELETED in v2
    2. "capital-germany"  (external_id) — will be PATCHED in v2
    3. "capital-japan"    (external_id) — will be UNCHANGED in v2
    4. no external_id, content: "largest ocean" — will be DELETED in v2
    5. no external_id, content: "fastest land animal" — will be DELETED and RE-CREATED in v2
       (metadata change → different content hash → not matchable, so old is deleted, new is created)
    6. no external_id, content: "boiling point of water" — will be UNCHANGED in v2

  Version 2 (mutated from v1 examples):
    - "capital-germany"  — PATCHED (answer corrected)
    - "capital-japan"    — UNCHANGED (same content)
    - "capital-italy"    — NEW example added to the list
    - "fastest land animal" now has updated metadata — DELETED + RE-CREATED
    - "boiling point of water" — UNCHANGED (same content)
    - "largest planet"   — NEW example added to the list

Prerequisites:
    - Phoenix server running (default: http://localhost:6006)
    - Install: pip install phoenix-client

Usage:
    python retrieve_mutate_upsert_example.py
"""

from datetime import datetime
from typing import Any, Mapping

from phoenix.client import Client
from phoenix.client.experiments import run_experiment

PHOENIX_BASE_URL = "http://localhost:6006"
DATASET_NAME = f"retrieve-mutate-demo-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

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
    dataset_description="Trivia Q&A dataset for retrieve-mutate-upsert demo",
)

print(f"Dataset: {dataset_v1.name}")
print(f"Version ID: {dataset_v1.version_id}")
print(f"Examples: {len(dataset_v1)}")

# =============================================================================
# Retrieve and inspect examples from v1
# =============================================================================

print("\n" + "=" * 60)
print("Retrieved examples from v1 (with external_id)")
print("=" * 60)

retrieved = list(dataset_v1.examples)
for retrieved_ex in retrieved:
    ext_id = retrieved_ex.get("external_id", None)
    question = retrieved_ex["input"]["question"]
    print(f"  external_id={ext_id!r:20s}  question={question!r}")

# =============================================================================
# Version 2: Mutate the retrieved list and upsert again
# =============================================================================

# Start from a mutable copy of the retrieved examples.
# We convert each TypedDict to a plain dict so we can mutate freely.
# DELETE "capital-france" and "largest ocean" by filtering them out.
v2_examples: list[dict[str, Any]] = [
    dict(orig)
    for orig in retrieved
    if not (
        orig.get("external_id") == "capital-france"
        or orig["input"]["question"] == "What is the largest ocean?"
    )
]

# PATCH: fix the answer for "capital-germany"
for mutated in v2_examples:
    if mutated.get("external_id") == "capital-germany":
        mutated["output"] = {"answer": "Berlin"}
    # MUTATE metadata on "fastest land animal" → different content hash → delete + re-create
    if mutated["input"]["question"] == "What is the fastest land animal?":
        mutated["metadata"] = {
            "category": "biology",
            "difficulty": "easy",
            "fun_fact": "Up to 70 mph",
        }

# ADD: new examples
v2_examples.append(
    {
        "input": {"question": "What is the capital of Italy?"},
        "output": {"answer": "Rome"},
        "metadata": {"category": "geography", "difficulty": "easy"},
        "external_id": "capital-italy",
    }
)
v2_examples.append(
    {
        "input": {"question": "What is the largest planet in our solar system?"},
        "output": {"answer": "Jupiter"},
        "metadata": {"category": "astronomy", "difficulty": "easy"},
    }
)

print("\n" + "=" * 60)
print("Version 2: Upserting mutated examples")
print("=" * 60)

dataset_v2 = client.datasets.upsert_dataset(
    name=DATASET_NAME,
    examples=v2_examples,
    dataset_description="Trivia Q&A dataset for retrieve-mutate-upsert demo",
)

print(f"Dataset: {dataset_v2.name}")
print(f"Version ID: {dataset_v2.version_id}")
print(f"Examples: {len(dataset_v2)}")

# =============================================================================
# Experiment: Run against both versions
# =============================================================================


def trivia_task(input: dict[str, Any]) -> str:
    """Simulate an LLM answering trivia questions."""
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


print("\n" + "=" * 60)
print("Experiment 1: Running against dataset version 1")
print("=" * 60)

experiment_v1 = run_experiment(
    client=client,
    dataset=dataset_v1,
    task=trivia_task,
    evaluators=[exact_match],
    experiment_name=f"trivia-v1-{datetime.now().strftime('%H%M%S')}",
    experiment_description="Experiment against initial dataset version",
)

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
print("\nChanges from v1 → v2 (via retrieve-mutate-upsert):")
print("  Deleted:   capital-france, largest ocean")
print("  Patched:   capital-germany (answer fixed)")
print("  Del+New:   fastest land animal (metadata changed → new content hash)")
print("  Unchanged: capital-japan, boiling point of water")
print("  Created:   capital-italy, largest planet")
print(f"\nView results at: {PHOENIX_BASE_URL}/datasets")
