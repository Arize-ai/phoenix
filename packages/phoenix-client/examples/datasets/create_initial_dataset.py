"""
Script 1 of 2: Create the initial dataset.

Creates a dataset with 6 trivia examples — some with external IDs, some without.
Pass the dataset name as a CLI argument so the companion script
(fetch_and_mutate_dataset.py) can retrieve and mutate it.

Usage:
    python create_initial_dataset.py my-dataset-name
"""

import sys
from typing import Any, Mapping

from phoenix.client import Client

PHOENIX_BASE_URL = "http://localhost:6006"


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python create_initial_dataset.py <dataset-name>")
        sys.exit(1)

    dataset_name = sys.argv[1]
    client = Client(base_url=PHOENIX_BASE_URL)

    v1_examples: list[Mapping[str, Any]] = [
        # --- Examples WITH external IDs ---
        {
            "input": {"question": "What is the capital of France?"},
            "output": {"answer": "Paris"},
            "metadata": {"category": "geography", "difficulty": "easy"},
            "external_id": "capital-france",
        },
        {
            "input": {"question": "What is the capital of Germany?"},
            "output": {"answer": "Munich"},  # intentionally wrong — will be fixed later
            "metadata": {"category": "geography", "difficulty": "easy"},
            "external_id": "capital-germany",
        },
        {
            "input": {"question": "What is the capital of Japan?"},
            "output": {"answer": "Tokyo"},
            "metadata": {"category": "geography", "difficulty": "easy"},
            "external_id": "capital-japan",
        },
        # --- Examples WITHOUT external IDs (matched by content hash) ---
        {
            "input": {"question": "What is the largest ocean?"},
            "output": {"answer": "Pacific Ocean"},
            "metadata": {"category": "geography", "difficulty": "easy"},
        },
        {
            "input": {"question": "What is the fastest land animal?"},
            "output": {"answer": "Cheetah"},
            "metadata": {"category": "biology", "difficulty": "easy"},
        },
        {
            "input": {"question": "What is the boiling point of water?"},
            "output": {"answer": "100°C at standard atmospheric pressure"},
            "metadata": {"category": "science", "difficulty": "easy"},
        },
    ]

    print("=" * 60)
    print(f"Creating initial dataset: {dataset_name}")
    print("=" * 60)

    dataset = client.datasets.upsert_dataset(
        name=dataset_name,
        examples=v1_examples,
        dataset_description="Trivia Q&A dataset for retrieve-mutate-upsert demo",
    )

    print(f"Dataset: {dataset.name}")
    print(f"Version ID: {dataset.version_id}")
    print(f"Examples: {len(dataset)}")

    print("\nRetrieved examples:")
    for ex in dataset.examples:
        ext_id = ex.get("external_id", None)
        question = ex["input"]["question"]
        print(f"  external_id={ext_id!r:20s}  question={question!r}")


if __name__ == "__main__":
    main()
