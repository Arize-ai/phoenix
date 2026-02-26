import json
from hashlib import sha256
from pathlib import Path
from typing import Any

import pytest

from phoenix.client.resources.datasets import (
    _compute_example_content_hash,  # pyright: ignore[reportPrivateUsage]
)

_HASH_VECTOR_FIXTURE_NAME = "dataset_upsert_hash_vectors.json"


def _get_hash_vector_fixture_path() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "tests" / "fixtures" / _HASH_VECTOR_FIXTURE_NAME
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        f"Could not locate {_HASH_VECTOR_FIXTURE_NAME} in repository tests/fixtures"
    )


def _load_hash_vectors() -> list[dict[str, Any]]:
    fixture_path = _get_hash_vector_fixture_path()
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    return fixture["vectors"]


@pytest.mark.parametrize("vector", _load_hash_vectors(), ids=lambda vector: str(vector["name"]))
def test_python_hash_matches_shared_golden_vectors(vector: dict[str, Any]) -> None:
    canonical_hash = sha256(vector["canonical_json"].encode("utf-8")).hexdigest()
    assert canonical_hash == vector["expected_hash"]

    for example in vector["examples"]:
        assert (
            _compute_example_content_hash(
                input=example["input"],
                output=example["output"],
                metadata=example["metadata"],
            )
            == vector["expected_hash"]
        )
