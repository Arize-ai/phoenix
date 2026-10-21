"""Seed a simple accuracy judge for the combined Typed Decisions dataset."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterator
from urllib.parse import quote

import httpx

from phoenix.experimental.datagen.datasets import DatasetError
from phoenix.experimental.datagen.decisions import TYPED_DECISIONS_DATASET_NAME, seed_decision

if TYPE_CHECKING:
    from collections.abc import Sequence

    from phoenix.client.resources.datasets import Dataset

_EVALUATOR_NAME = f"{TYPED_DECISIONS_DATASET_NAME}-accuracy"
_INPUT_MAPPING = {
    "literal_mapping": {},
    "path_mapping": {"reference": "reference", "output": "output"},
}


def _list(http: httpx.Client, path: str, **filters: str) -> Iterator[dict[str, Any]]:
    cursor = None
    while True:
        params = dict(filters)
        if cursor is not None:
            params["cursor"] = cursor
        response = http.get(path, params=params)
        response.raise_for_status()
        page = response.json()
        yield from page["data"]
        cursor = page.get("next_cursor")
        if cursor is None:
            return


def seed_dataset_decision_evaluators(
    http: httpx.Client, datasets: Sequence[Dataset]
) -> list[tuple[str, str]]:
    """Attach the accuracy judge once, repairing its version or mapping when changed.

    Seeding saves definitions and bindings without invoking a model or requiring its key.
    Only the combined Typed Decisions dataset receives this evaluator.
    """
    results = []
    for dataset in datasets:
        if dataset.name != TYPED_DECISIONS_DATASET_NAME:
            continue
        version_id = seed_decision(
            http,
            name=_EVALUATOR_NAME,
            metadata={"datagen": True, "dataset_name": dataset.name},
            version={
                "inputs": [
                    {"name": name, "description": None, "jsonSchema": None}
                    for name in ("reference", "output")
                ],
                "state": {"object": True},
                "questions": [
                    {
                        "predicate": {
                            "name": "accuracy",
                            "instructions": "is the output accurate",
                            "criteria": None,
                        }
                    }
                ],
                "modelProvider": "TYPESAFE",
                "modelName": "jev-latest",
                "customProviderId": None,
                "description": "Datagen-owned accuracy judge for Typed Decisions experiments.",
                "metadata": {"datagen": True, "dataset_name": dataset.name},
            },
        )
        evaluator = next(
            (
                value
                for value in _list(http, "v1/evaluators", name=_EVALUATOR_NAME)
                if value["name"] == _EVALUATOR_NAME
            ),
            None,
        )
        if evaluator is None:
            response = http.post(
                "v1/evaluators",
                json={
                    "type": "decision",
                    "name": _EVALUATOR_NAME,
                    "decision_version_id": version_id,
                },
            )
            response.raise_for_status()
            evaluator = response.json()["data"]
        elif evaluator["type"] != "decision":
            raise DatasetError(f"{_EVALUATOR_NAME}: an evaluator of another type already exists")
        elif evaluator["decision_version_id"] != version_id:
            response = http.patch(
                f"v1/evaluators/{quote(evaluator['id'], safe='')}",
                json={"type": "decision", "decision_version_id": version_id},
            )
            response.raise_for_status()
        evaluator_id = evaluator["id"]
        path = f"v1/datasets/{quote(dataset.id, safe='')}/evaluators"
        binding = next((value for value in _list(http, path) if value["name"] == "accuracy"), None)
        if binding is None:
            response = http.post(
                path,
                json={
                    "name": "accuracy",
                    "evaluator_id": evaluator_id,
                    "input_mapping": _INPUT_MAPPING,
                },
            )
            response.raise_for_status()
            binding = response.json()["data"]
        elif binding["evaluator_id"] != evaluator_id:
            raise DatasetError(f"{dataset.name}: accuracy is already bound to another evaluator")
        elif binding["input_mapping"] != _INPUT_MAPPING:
            response = http.patch(
                f"v1/dataset_evaluators/{quote(binding['id'], safe='')}",
                json={"input_mapping": _INPUT_MAPPING},
            )
            response.raise_for_status()
        results.append((f"{dataset.name}/accuracy", binding["id"]))
    return results
