"""
Dataset upsert with experiments — iterative evaluation workflow.

Demonstrates how to:
  1. Create a dataset of QA examples
  2. Run an experiment (with a task and evaluator) on the dataset
  3. Upsert the dataset — fix incorrect answers, add new examples, remove obsolete ones
  4. Run a second experiment on the updated dataset
  5. Compare results across versions

This is the core loop for iterative dataset curation: build a dataset, evaluate
your system against it, improve the dataset, and evaluate again.

Prerequisites:
    - Phoenix server running (default: http://localhost:6006)
    - Install: pip install phoenix-client

Usage:
    python roundtrip_test.py
"""

from datetime import datetime
from typing import Any

from phoenix.client import Client

PHOENIX_BASE_URL = "http://localhost:6006"
DATASET_NAME = f"qa-eval-demo-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

client = Client(base_url=PHOENIX_BASE_URL)

# =============================================================================
# Step 1: Create the initial dataset
# =============================================================================

v1_examples: list[dict[str, Any]] = [
    {
        "input": {"question": "What is the capital of Japan?"},
        "output": {"answer": "Tokyo"},
        "metadata": {"category": "geography", "difficulty": "easy"},
        "id": "capital-japan",
    },
    {
        "input": {"question": "What is the capital of Germany?"},
        "output": {"answer": "Munich"},  # intentionally wrong — will be fixed in v2
        "metadata": {"category": "geography", "difficulty": "easy"},
        "id": "capital-germany",
    },
    {
        "input": {"question": "What is the capital of France?"},
        "output": {"answer": "Paris"},
        "metadata": {"category": "geography", "difficulty": "easy"},
        "id": "capital-france",
    },
    {
        "input": {"question": "What is the boiling point of water in Celsius?"},
        "output": {"answer": "100"},
        "metadata": {"category": "science", "difficulty": "easy"},
        "id": "boiling-point",
    },
]

print("=" * 60)
print("Step 1: Creating initial dataset (4 examples)")
print("=" * 60)

dataset_v1 = client.datasets.create_dataset(
    name=DATASET_NAME,
    examples=v1_examples,
    dataset_description="QA evaluation dataset — geography and science",
)

print(f"  Dataset:  {dataset_v1.name}")
print(f"  Version:  {dataset_v1.version_id}")
print(f"  Examples: {len(dataset_v1)}")

# =============================================================================
# Step 2: Run an experiment on v1
# =============================================================================

print("\n" + "=" * 60)
print("Step 2: Running experiment on v1 (simulated QA task)")
print("=" * 60)

# A simple task that simulates answering questions.
# In a real workflow this would call your LLM or retrieval pipeline.
SIMULATED_ANSWERS: dict[str, str] = {
    "What is the capital of Japan?": "Tokyo",
    "What is the capital of Germany?": "Berlin",  # correct — will expose the bad label
    "What is the capital of France?": "Paris",
    "What is the boiling point of water in Celsius?": "100",
    "What is the speed of light in m/s?": "299792458",
    "What is the largest planet in our solar system?": "Jupiter",
}


def qa_task(input: dict[str, Any]) -> dict[str, Any]:
    """Simulate answering a question."""
    question = input["question"]
    answer = SIMULATED_ANSWERS.get(question, "I don't know")
    return {"answer": answer}


def exact_match(output: dict[str, Any], expected: dict[str, Any]) -> bool:
    """Check if the task output matches the expected answer."""
    out_val: str = str(output.get("answer", "")).strip().lower()
    exp_val: str = str(expected.get("answer", "")).strip().lower()
    return out_val == exp_val


experiment_v1 = client.experiments.run_experiment(
    dataset=dataset_v1,
    task=qa_task,
    evaluators=[exact_match],
    experiment_name="qa-v1",
    experiment_description="Baseline evaluation on v1 dataset",
)

# Note: Germany is wrong in v1 (label says "Munich", task returns "Berlin")
# so exact_match will score 0 for that example — revealing the bad label.

# =============================================================================
# Step 3: Upsert the dataset (fix, add, remove)
# =============================================================================

print("\n" + "=" * 60)
print("Step 3: Upserting dataset — fix Germany, add 2 new, remove France")
print("=" * 60)

# Start from the retrieved v1 examples so IDs round-trip correctly.
retrieved = list(dataset_v1.examples)

# Build v2: keep Japan and boiling point unchanged, fix Germany, drop France, add two new.
v2_examples: list[dict[str, Any]] = []
for ex in retrieved:
    q = ex["input"]["question"]
    if q == "What is the capital of France?":
        continue  # remove this example
    entry = dict(ex)
    if q == "What is the capital of Germany?":
        entry["output"] = {"answer": "Berlin"}  # fix the incorrect answer
    v2_examples.append(entry)

# Add new examples
v2_examples.append(
    {
        "input": {"question": "What is the speed of light in m/s?"},
        "output": {"answer": "299792458"},
        "metadata": {"category": "physics", "difficulty": "medium"},
        "id": "speed-of-light",
    }
)
v2_examples.append(
    {
        "input": {"question": "What is the largest planet in our solar system?"},
        "output": {"answer": "Jupiter"},
        "metadata": {"category": "astronomy", "difficulty": "easy"},
        "id": "largest-planet",
    }
)

dataset_v2 = client.datasets.create_dataset(
    name=DATASET_NAME,
    examples=v2_examples,
)

print(f"  Dataset:  {dataset_v2.name}")
print(f"  Version:  {dataset_v2.version_id}")
print(f"  Examples: {len(dataset_v2)}")
print("  Changes:  1 fix (Germany), 1 removal (France), 2 additions")
assert dataset_v2.version_id != dataset_v1.version_id, "Expected a new version"

# =============================================================================
# Step 4: Run a second experiment on v2
# =============================================================================

print("\n" + "=" * 60)
print("Step 4: Running experiment on v2 (same task, corrected dataset)")
print("=" * 60)

experiment_v2 = client.experiments.run_experiment(
    dataset=dataset_v2,
    task=qa_task,
    evaluators=[exact_match],
    experiment_name="qa-v2",
    experiment_description="Re-evaluation after dataset corrections",
)

# Now Germany's label is "Berlin" and the task also returns "Berlin" → match!
# The two new examples should also pass since our simulated answers are correct.

# =============================================================================
# Step 5: Summary
# =============================================================================

print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"  Dataset: {DATASET_NAME}")
print(f"  v1: {len(dataset_v1)} examples → experiment 'qa-v1'")
print(f"  v2: {len(dataset_v2)} examples → experiment 'qa-v2'")
print()
print("  v1 had an incorrect label for Germany (Munich instead of Berlin),")
print("  causing exact_match to fail. After fixing the label in v2,")
print("  all examples should pass.")
print()
print(f"  Compare experiments at: {PHOENIX_BASE_URL}/datasets")
