"""
Script 2 of 2: Fetch an existing dataset, mutate it, and upsert a new version.

Retrieves the dataset created by create_initial_dataset.py, then:
  - Deletes "capital-france" and "largest ocean"
  - Patches "capital-germany" (fixes the answer to Berlin)
  - Mutates metadata on "fastest land animal" (different content hash → delete + re-create)
  - Adds "capital-italy" and "largest planet"

Usage:
    python fetch_and_mutate_dataset.py my-dataset-name
"""

import sys
from datetime import datetime
from typing import Any

from phoenix.client import Client
from phoenix.client.experiments import run_experiment

PHOENIX_BASE_URL = "http://localhost:6006"


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python fetch_and_mutate_dataset.py <dataset-name>")
        sys.exit(1)

    dataset_name = sys.argv[1]
    client = Client(base_url=PHOENIX_BASE_URL)

    # =========================================================================
    # Retrieve existing dataset
    # =========================================================================

    print("=" * 60)
    print(f"Fetching dataset: {dataset_name}")
    print("=" * 60)

    dataset = client.datasets.get_dataset(dataset=dataset_name)
    retrieved = list(dataset.examples)

    print(f"Dataset: {dataset.name}")
    print(f"Version ID: {dataset.version_id}")
    print(f"Examples: {len(retrieved)}")

    for ex in retrieved:
        ext_id = ex.get("external_id", None)
        question = ex["input"]["question"]
        print(f"  external_id={ext_id!r:20s}  question={question!r}")

    # =========================================================================
    # Shared task and evaluator definitions
    # =========================================================================

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

    # =========================================================================
    # Experiment 1: Run against retrieved dataset (version 1)
    # =========================================================================

    print("\n" + "=" * 60)
    print("Experiment 1: Running against dataset version 1")
    print("=" * 60)

    run_experiment(
        client=client,
        dataset=dataset,
        task=trivia_task,
        evaluators=[exact_match],
        experiment_name=f"trivia-v1-{datetime.now().strftime('%H%M%S')}",
        experiment_description="Experiment against initial dataset version",
    )

    # =========================================================================
    # Mutate the retrieved examples
    # =========================================================================

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

    # =========================================================================
    # Upsert mutated examples as a new version
    # =========================================================================

    print("\n" + "=" * 60)
    print("Upserting mutated examples as new version")
    print("=" * 60)

    dataset_v2 = client.datasets.upsert_dataset(
        name=dataset_name,
        examples=v2_examples,
        dataset_description="Trivia Q&A dataset for retrieve-mutate-upsert demo",
    )

    print(f"Dataset: {dataset_v2.name}")
    print(f"Version ID: {dataset_v2.version_id}")
    print(f"Examples: {len(dataset_v2)}")

    # =========================================================================
    # Summary
    # =========================================================================

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Dataset: {dataset_name}")
    print(f"  v2: {len(dataset_v2)} examples (version {dataset_v2.version_id})")
    print("\nChanges applied:")
    print("  Deleted:   capital-france, largest ocean")
    print("  Patched:   capital-germany (answer fixed)")
    print("  Del+New:   fastest land animal (metadata changed → new content hash)")
    print("  Unchanged: capital-japan, boiling point of water")
    print("  Created:   capital-italy, largest planet")

    # =========================================================================
    # Experiment 2: Run against version 2
    # =========================================================================

    print("\n" + "=" * 60)
    print("Experiment 2: Running against dataset version 2")
    print("=" * 60)

    run_experiment(
        client=client,
        dataset=dataset_v2,
        task=trivia_task,
        evaluators=[exact_match],
        experiment_name=f"trivia-v2-{datetime.now().strftime('%H%M%S')}",
        experiment_description="Experiment against updated dataset version",
    )

    print(f"\nView results at: {PHOENIX_BASE_URL}/datasets")


if __name__ == "__main__":
    main()
