"""Read the end state of eval-building tasks from the task's Phoenix server.

The `phoenix-evals` tasks grade what an agent left in Phoenix, whatever interface it used.
These helpers read datasets, their examples, and experiments with their runs and
evaluations over REST.
"""

from __future__ import annotations

import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from harbor_verifiers.phoenix_api import PHOENIX_URL


def get_json(path: str, params: Mapping[str, Any] | None = None) -> Any:
    """Returns the decoded JSON body of a GET request, or None for a 404."""
    query = "?" + urllib.parse.urlencode(params, doseq=True) if params else ""
    try:
        with urllib.request.urlopen(f"{PHOENIX_URL}{path}{query}", timeout=120) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


def _paginate(path: str, params: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        page = get_json(path, {**(params or {}), **({"cursor": cursor} if cursor else {})})
        if page is None:
            return items
        items.extend(page.get("data", []))
        cursor = page.get("next_cursor")
        if not cursor:
            return items


def _quote(identifier: str) -> str:
    return urllib.parse.quote(identifier, safe="")


# Datasets


def dataset_id(name: str) -> str | None:
    """Returns the ID of the dataset with this name, or None if none exists."""
    for dataset in _paginate("/v1/datasets", {"name": name}):
        if dataset.get("name") == name:
            return str(dataset["id"])
    return None


def dataset_examples(dataset: str, split: str | None = None) -> list[dict[str, Any]]:
    """Returns the current examples of a dataset, by ID, optionally filtered to one split."""
    params = {"split": split} if split else None
    body = get_json(f"/v1/datasets/{_quote(dataset)}/examples", params)
    return list(body["data"]["examples"]) if body else []


@dataclass
class Evaluation:
    """One evaluation of one experiment run."""

    name: str
    annotator_kind: str
    label: str | None
    score: float | None
    explanation: str | None
    error: str | None


@dataclass
class Run:
    """One task run of an experiment, with its evaluations."""

    example_id: str
    repetition: int
    input: dict[str, Any]
    reference: dict[str, Any]
    output: Any
    error: str | None
    evaluations: list[Evaluation] = field(default_factory=list)


@dataclass
class Experiment:
    """An experiment and its runs, oldest first in the lists that helpers return."""

    id: str
    name: str | None
    created_at: datetime
    metadata: dict[str, Any]
    runs: list[Run]

    @property
    def rowid(self) -> int:
        """The database row ID, which orders experiments by creation even within a second."""
        try:
            decoded = base64.b64decode(self.id + "=" * (-len(self.id) % 4)).decode()
            return int(decoded.rsplit(":", 1)[-1])
        except (ValueError, UnicodeDecodeError):
            return 0

    @property
    def example_ids(self) -> frozenset[str]:
        """The IDs of the dataset examples this experiment ran on."""
        return frozenset(run.example_id for run in self.runs)

    def evaluator_names(self) -> set[str]:
        return {evaluation.name for run in self.runs for evaluation in run.evaluations}


def _evaluation(raw: Mapping[str, Any]) -> Evaluation:
    score = raw.get("score")
    return Evaluation(
        name=str(raw.get("name")),
        annotator_kind=str(raw.get("annotator_kind") or ""),
        label=raw.get("label"),
        score=float(score) if score is not None else None,
        explanation=raw.get("explanation"),
        error=raw.get("error"),
    )


def experiment(experiment_id: str, meta: Mapping[str, Any]) -> Experiment:
    """Returns an experiment with its runs and evaluations."""
    rows = get_json(f"/v1/experiments/{_quote(experiment_id)}/json") or []
    runs = [
        Run(
            example_id=str(row["example_id"]),
            repetition=int(row.get("repetition_number") or 1),
            input=row.get("input") or {},
            reference=row.get("reference_output") or {},
            output=row.get("output"),
            error=row.get("error"),
            evaluations=[_evaluation(a) for a in row.get("annotations") or []],
        )
        for row in rows
    ]
    return Experiment(
        id=experiment_id,
        name=meta.get("name"),
        created_at=datetime.fromisoformat(str(meta["created_at"])),
        metadata=dict(meta.get("metadata") or {}),
        runs=runs,
    )


def dataset_experiments(dataset: str) -> list[Experiment]:
    """Returns every experiment on a dataset, by ID, oldest first."""
    metas = _paginate(f"/v1/datasets/{_quote(dataset)}/experiments")
    experiments = [experiment(str(meta["id"]), meta) for meta in metas]
    return sorted(experiments, key=lambda e: (e.created_at, e.rowid))
