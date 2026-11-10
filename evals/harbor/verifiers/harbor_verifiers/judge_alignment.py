"""Find an agent's LLM judge labels on TRAIL traces and score them against the annotators.

An agent can record its judge's verdicts in several ways: as span or trace annotations on
the project, as evaluations on an experiment over a dataset built from the traces, or as the
task output of such an experiment. This module turns each of those into a candidate set of
per-trace predictions, so a verifier can compare the agent's reported agreement with the
agreement it recomputes, whatever the recording method.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from harbor_verifiers import trail_truth
from harbor_verifiers.evals_state import (
    Confusion,
    Evaluation,
    Experiment,
    all_datasets,
    as_binary,
    confusion,
    dataset_examples,
    dataset_experiments,
    flatten,
    trace_level_annotations,
)
from harbor_verifiers.phoenix_api import project_spans


@dataclass
class Candidate:
    """One way of reading the agent's judge verdicts, as per-trace predictions."""

    source: str
    predictions: dict[str, bool]
    llm_kind: bool
    experiment: Experiment | None = None
    dataset_traces: frozenset[str] = frozenset()

    def scored(self, truth: Callable[[trail_truth.TraceFacts], bool]) -> Confusion:
        """Returns the confusion matrix on labeled traces, in the polarity that agrees best."""
        facts = trail_truth.traces()
        pairs = [(p, truth(facts[t])) for t, p in self.predictions.items() if facts[t].labeled]
        direct = confusion(pairs)
        flipped = confusion((not p, a) for p, a in pairs)
        return direct if direct.accuracy >= flipped.accuracy else flipped

    @property
    def labeled_count(self) -> int:
        facts = trail_truth.traces()
        return sum(facts[t].labeled for t in self.predictions)


def _from_values(values: dict[str, Any]) -> dict[str, bool]:
    distinct = sorted({json.dumps(v, sort_keys=True) for v in values.values()})
    if not 1 <= len(distinct) <= 2:
        return {}
    return {t: json.dumps(v, sort_keys=True) == distinct[-1] for t, v in values.items()}


def annotation_candidates(exclude_prefix: str = "trail_") -> list[Candidate]:
    spans = project_spans(trail_truth.PROJECT)
    annotations = trace_level_annotations(trail_truth.PROJECT, spans)
    names = sorted({a.name for a in annotations if not a.name.startswith(exclude_prefix)})
    candidates = []
    for name in names:
        rows = [a for a in annotations if a.name == name]
        evaluations = [
            Evaluation(name, a.annotator_kind, a.label, a.score, a.explanation, None) for a in rows
        ]
        predictions: dict[str, bool] = {}
        for row, value in zip(rows, as_binary(evaluations)):
            if value is not None:
                predictions.setdefault(row.trace_id, value)
        if predictions:
            candidates.append(
                Candidate(
                    source=f"annotation:{name}",
                    predictions=predictions,
                    llm_kind=all(a.annotator_kind.upper() == "LLM" for a in rows),
                )
            )
    return candidates


def experiment_candidates() -> list[Candidate]:
    """Returns candidates from every experiment on a dataset whose examples link to traces."""
    candidates = []
    for dataset in all_datasets():
        examples = dataset_examples(str(dataset["id"]))
        trace_of = {e["node_id"]: trail_truth.linked_trace(e) for e in examples}
        if not examples or not any(trace_of.values()):
            continue
        traces = frozenset(t for t in trace_of.values() if t)
        for found in dataset_experiments(str(dataset["id"])):
            runs = [r for r in found.runs if r.repetition == 1 and trace_of.get(r.example_id)]
            if not runs:
                continue
            label = f"experiment:{found.name or found.id}"
            for name in sorted({e.name for r in runs for e in r.evaluations}):
                pairs = [
                    (trace_of[r.example_id], e)
                    for r in runs
                    for e in r.evaluations
                    if e.name == name
                ]
                values = as_binary([e for _, e in pairs])
                predictions = {str(t): v for (t, _), v in zip(pairs, values) if t and v is not None}
                if predictions:
                    candidates.append(
                        Candidate(
                            source=f"{label}:evaluation:{name}",
                            predictions=predictions,
                            llm_kind=all(e.annotator_kind.upper() == "LLM" for _, e in pairs),
                            experiment=found,
                            dataset_traces=traces,
                        )
                    )
            flats = {str(trace_of[r.example_id]): flatten(r.output) for r in runs if not r.error}
            for path in sorted({p for flat in flats.values() for p in flat}):
                predictions = _from_values(
                    {t: flat.get(path) for t, flat in flats.items() if path in flat}
                )
                if len(predictions) >= len(flats) * 0.9:
                    candidates.append(
                        Candidate(
                            source=f"{label}:output:{path or 'value'}",
                            predictions=predictions,
                            llm_kind=True,
                            experiment=found,
                            dataset_traces=traces,
                        )
                    )
    return candidates


def ranked(
    candidates: Sequence[Candidate], truth: Callable[[trail_truth.TraceFacts], bool]
) -> list[Candidate]:
    """Orders candidates by how many labeled traces they cover, then by agreement."""
    return sorted(
        candidates,
        key=lambda c: (c.labeled_count, c.scored(truth).accuracy),
        reverse=True,
    )


def describe(candidate: Candidate, truth: Callable[[trail_truth.TraceFacts], bool]) -> str:
    matrix = candidate.scored(truth).as_dict()
    return f"{candidate.source} on {candidate.labeled_count} labeled traces: {matrix}"
