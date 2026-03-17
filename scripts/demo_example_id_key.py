"""
Demo script: exercise the example_id_key upload feature.

Uploads three datasets to Phoenix:
  1. "ids-explicit"  -- CSV with example_id_key, every row has an id
  2. "ids-none"      -- CSV without example_id_key, external_id is NULL for all rows
  3. "ids-mixed"     -- CSV with example_id_key, but some rows leave the id column blank

Then prints a summary so the caller can sanity-check the DB.
"""

import gzip

import httpx

BASE = "http://localhost:6006"


def upload(name: str, csv_bytes: bytes, extra_data: dict[str, str | list[str]]) -> None:
    file = gzip.compress(csv_bytes)
    data = {"action": "create", "name": name, **extra_data}
    resp = httpx.post(
        f"{BASE}/v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data=data,
    )
    resp.raise_for_status()
    body = resp.json()["data"]
    print(f"[{name}]  dataset_id={body['dataset_id']}  version_id={body['version_id']}")


# --- Dataset 1: explicit external IDs via example_id_key ---
csv_with_ids = (
    b"task_id,question,answer\n"
    b"task-001,What is 2+2?,4\n"
    b"task-002,What is the capital of France?,Paris\n"
    b"task-003,Who wrote Hamlet?,Shakespeare\n"
)
upload(
    "ids-explicit",
    csv_with_ids,
    {
        "input_keys[]": ["question"],
        "output_keys[]": ["answer"],
        "example_id_key": "task_id",
    },
)

# --- Dataset 2: no external IDs ---
csv_no_ids = b"question,answer\nWhat is 2+2?,4\nWhat is the capital of France?,Paris\n"
upload(
    "ids-none",
    csv_no_ids,
    {
        "input_keys[]": ["question"],
        "output_keys[]": ["answer"],
        # no example_id_key
    },
)

# --- Dataset 3: mixed -- some rows have an id, others leave the column blank ---
csv_mixed = (
    b"task_id,question,answer\n"
    b"task-101,What is 3+3?,6\n"  # has id
    b",What color is the sky?,Blue\n"  # blank id -> external_id NULL
    b"task-103,What is H2O?,Water\n"  # has id
    b",Name a primary color,Red\n"  # blank id -> external_id NULL
)
upload(
    "ids-mixed",
    csv_mixed,
    {
        "input_keys[]": ["question"],
        "output_keys[]": ["answer"],
        "example_id_key": "task_id",
    },
)

print("\nDone. Query the DB to verify.")
