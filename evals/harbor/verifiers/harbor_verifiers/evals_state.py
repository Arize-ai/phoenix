"""Read the end state of eval-building tasks from the task's Phoenix server.

The `phoenix-evals` tasks grade what an agent left in Phoenix, whatever interface it used:
experiments with their runs and evaluations, datasets with their source links and splits,
saved prompts, and span or trace annotations. These helpers read that state over REST and
identify things by content, such as the examples an experiment ran on, so that a verifier
doesn't depend on the names the agent chose.
"""

from __future__ import annotations

import base64
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable, Mapping, Sequence
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


def dataset_splits(dataset: str) -> dict[str, set[str]]:
    """Returns each split's name mapped to the IDs of its examples."""
    body = get_json(f"/v1/datasets/{_quote(dataset)}/splits") or {"data": []}
    return {
        split["name"]: {example["node_id"] for example in dataset_examples(dataset, split["name"])}
        for split in body["data"]
    }


# Experiments


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


# Prompts


@dataclass
class PromptVersion:
    id: str
    created_at: datetime | None
    text: str


def _prompt_text(version: Mapping[str, Any]) -> str:
    """Returns every string in a prompt version's template, joined."""
    return "\n".join(_strings(version.get("template")))


def _strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, Mapping):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, Sequence):
        for item in value:
            yield from _strings(item)


def prompt_versions(name: str) -> list[PromptVersion]:
    """Returns the versions of a saved prompt, oldest first, or [] if it doesn't exist."""
    versions = _paginate(f"/v1/prompts/{_quote(name)}/versions")
    parsed = [
        PromptVersion(
            id=str(v["id"]),
            created_at=datetime.fromisoformat(str(v["created_at"]))
            if v.get("created_at")
            else None,
            text=_prompt_text(v),
        )
        for v in versions
    ]
    return sorted(parsed, key=lambda v: (v.created_at is None, v.created_at or datetime.min, v.id))


# Comparing an evaluator's output with known truth


def as_binary(evaluations: Sequence[Evaluation]) -> list[bool | None]:
    """Maps each evaluation to a pass or fail value, in order.

    Two distinct scores map to True for the higher one; otherwise two distinct labels map to
    True for the alphabetically later one. A single distinct value maps to True. An error, or
    an evaluator with more than two values, maps to None. Agreement checks try both
    polarities, so the arbitrary direction doesn't matter.
    """
    valid = [e for e in evaluations if not e.error]
    scores = sorted({e.score for e in valid if e.score is not None})
    labels = sorted({e.label for e in valid if e.label is not None})

    def value(e: Evaluation) -> bool | None:
        if e.error:
            return None
        if e.score is not None and len(scores) <= 2:
            return e.score == scores[-1]
        if e.label is not None and len(labels) <= 2:
            return e.label == labels[-1]
        return None

    return [value(e) for e in evaluations]


def agreement(predicted: Sequence[bool | None], truth: Sequence[bool]) -> float:
    """Returns the share of items where the prediction matches the truth, in the better of
    the two polarities. An unmapped prediction counts as a disagreement."""
    if not truth:
        return 0.0
    same = sum(p is not None and p == t for p, t in zip(predicted, truth))
    flipped = sum(p is not None and p != t for p, t in zip(predicted, truth))
    return max(same, flipped) / len(truth)


@dataclass
class Confusion:
    tp: int
    fp: int
    fn: int
    tn: int

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if self.tp + self.fp else 0.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if self.tp + self.fn else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if p + r else 0.0

    @property
    def accuracy(self) -> float:
        total = self.tp + self.fp + self.fn + self.tn
        return (self.tp + self.tn) / total if total else 0.0

    @property
    def specificity(self) -> float:
        return self.tn / (self.tn + self.fp) if self.tn + self.fp else 0.0

    @property
    def balanced_accuracy(self) -> float:
        return (self.recall + self.specificity) / 2

    @property
    def kappa(self) -> float:
        total = self.tp + self.fp + self.fn + self.tn
        if not total:
            return 0.0
        observed = self.accuracy
        expected = (
            (self.tp + self.fp) * (self.tp + self.fn) + (self.fn + self.tn) * (self.fp + self.tn)
        ) / total**2
        return (observed - expected) / (1 - expected) if expected < 1 else 0.0

    def as_dict(self) -> dict[str, float]:
        return {
            "tp": self.tp,
            "fp": self.fp,
            "fn": self.fn,
            "tn": self.tn,
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1": round(self.f1, 4),
            "accuracy": round(self.accuracy, 4),
            "kappa": round(self.kappa, 4),
        }


def confusion(pairs: Iterable[tuple[bool, bool]]) -> Confusion:
    """Builds a confusion matrix from (predicted, actual) pairs, positive meaning True."""
    tp = fp = fn = tn = 0
    for predicted, actual in pairs:
        if predicted and actual:
            tp += 1
        elif predicted:
            fp += 1
        elif actual:
            fn += 1
        else:
            tn += 1
    return Confusion(tp, fp, fn, tn)


# Leakage


_WORD = re.compile(r"[a-z0-9_]+")


def word_ngrams(text: str, n: int) -> set[tuple[str, ...]]:
    words = _WORD.findall(text.lower())
    return {tuple(words[i : i + n]) for i in range(len(words) - n + 1)}


def leaked_sources(text: str, sources: Mapping[str, str], n: int = 6) -> list[str]:
    """Returns the keys of the sources that share a run of `n` words with `text`."""
    grams = word_ngrams(text, n)
    return [key for key, source in sources.items() if grams & word_ngrams(source, n)]


# Matching an agent's evaluators to criteria


@dataclass
class EvaluatorFit:
    """How well one evaluator's results fit one criterion over the runs it applies to."""

    name: str
    kinds: set[str]
    coverage: float
    agreement: float


def evaluator_fits(
    runs: Sequence[Run], applies: Sequence[bool], truth: Sequence[bool]
) -> list[EvaluatorFit]:
    """Scores every evaluator on the runs where a criterion applies.

    Coverage is the share of those runs with an error-free evaluation. Agreement compares the
    evaluator's pass or fail values with the truth, in the better polarity, and counts a
    missing evaluation as a disagreement.
    """
    selected = [(run, t) for run, a, t in zip(runs, applies, truth) if a]
    names = sorted({e.name for run, _ in selected for e in run.evaluations})
    fits = []
    for name in names:
        found = [next((e for e in run.evaluations if e.name == name), None) for run, _ in selected]
        present = [e for e in found if e is not None]
        values = iter(as_binary(present))
        predicted = [next(values) if e is not None else None for e in found]
        covered = sum(e is not None and not e.error for e in found)
        fits.append(
            EvaluatorFit(
                name=name,
                kinds={e.annotator_kind.upper() for e in present},
                coverage=covered / len(selected) if selected else 0.0,
                agreement=agreement(predicted, [t for _, t in selected]),
            )
        )
    return fits


def label_values(runs: Sequence[Run], name: str) -> set[str]:
    return {e.label for run in runs for e in run.evaluations if e.name == name and e.label}


GENERIC_NAMES = re.compile(
    r"^(eval|evaluator|judge|llm_judge|llm_eval|score|scorer|quality|check|criteria|criterion|"
    r"metric|custom|custom_eval|my_eval|test)(_?\d+)?$",
    re.IGNORECASE,
)

# The label sets of the built-in classification evaluators in arize-phoenix-evals.
BUILTIN_LABEL_SETS = {
    "completeness": {"complete", "incomplete"},
    "conciseness": {"concise", "verbose"},
    "correctness": {"correct", "incorrect"},
    "document_relevance": {"relevant", "unrelated"},
    "faithfulness": {"faithful", "unfaithful"},
    "hallucination": {"hallucinated", "grounded"},
    "pii_detection": {"pii_detected", "no_pii_detected"},
    "refusal": {"refused", "answered"},
    "retrieval_relevance": {"relevant", "irrelevant"},
    "toxicity": {"toxic", "non-toxic"},
    "user_friction": {"friction", "no_friction"},
}


def builtin_match(name: str, labels: set[str]) -> str | None:
    """Returns the built-in evaluator a result set most likely came from, if any.

    A match needs the built-in's name or a label set that is a non-empty subset of the
    built-in's labels and includes a label unique to it. Generic sets such as
    `correct`/`incorrect` match only by name.
    """
    lowered = {label.lower() for label in labels}
    for builtin, builtin_labels in BUILTIN_LABEL_SETS.items():
        if name.lower() == builtin:
            return builtin
        distinctive = builtin_labels - {"correct", "incorrect", "relevant"}
        if lowered and lowered <= builtin_labels and lowered & distinctive:
            return builtin
    return None


# Experiments across copies of a dataset


@dataclass
class KeyedExperiment:
    """An experiment with its examples identified by content instead of by ID."""

    experiment: Experiment
    dataset_name: str
    keys: frozenset[str]
    split_names: tuple[str, ...]

    @property
    def created_at(self) -> datetime:
        return self.experiment.created_at


def all_datasets() -> list[dict[str, Any]]:
    return _paginate("/v1/datasets")


def keyed_experiments(
    example_key: Callable[[dict[str, Any]], str | None], allowed: set[str]
) -> tuple[list[KeyedExperiment], dict[str, dict[str, frozenset[str]]]]:
    """Returns every experiment on any dataset whose examples all map to allowed keys.

    Agents sometimes copy a dataset to split it, so the examples are matched by content.
    Also returns each such dataset's splits as sets of keys. Experiments are oldest first.
    """
    keyed: list[KeyedExperiment] = []
    splits_by_dataset: dict[str, dict[str, frozenset[str]]] = {}
    for dataset in all_datasets():
        examples = dataset_examples(str(dataset["id"]))
        keys = {example["node_id"]: example_key(example) for example in examples}
        if not keys or any(key is None or key not in allowed for key in keys.values()):
            continue
        splits = {
            name: frozenset(str(keys[node]) for node in nodes if node in keys)
            for name, nodes in dataset_splits(str(dataset["id"])).items()
        }
        splits_by_dataset[str(dataset["name"])] = splits
        for found in dataset_experiments(str(dataset["id"])):
            run_keys = frozenset(
                str(keys[run.example_id]) for run in found.runs if run.example_id in keys
            )
            keyed.append(
                KeyedExperiment(
                    experiment=found,
                    dataset_name=str(dataset["name"]),
                    keys=run_keys,
                    split_names=tuple(str(s) for s in found.metadata.get("splits", []) or []),
                )
            )
    return sorted(keyed, key=lambda k: k.experiment.rowid), splits_by_dataset


# Reading binary labels that an agent stored in dataset outputs


def _flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    if isinstance(value, Mapping):
        flat: dict[str, Any] = {}
        for key, item in value.items():
            flat.update(_flatten(item, f"{prefix}.{key}" if prefix else str(key)))
        return flat
    if isinstance(value, list):
        return {prefix: json.dumps(value, sort_keys=True)}
    return {prefix: value}


def stored_label_agreement(outputs: Sequence[Any], truth: Sequence[bool], pattern: str) -> float:
    """Returns how well binary labels stored in dataset outputs match the truth.

    Tries every output field that takes exactly two values across the examples, plus the
    presence of `pattern` anywhere in the output, and returns the best agreement in either
    polarity. This accepts any reasonable labeling scheme without knowing its field names.
    """
    flats = [_flatten(output) for output in outputs]
    candidates: list[list[bool | None]] = []
    for path in sorted({p for flat in flats for p in flat}):
        values = [json.dumps(flat.get(path), sort_keys=True) for flat in flats]
        distinct = sorted(set(values))
        if len(distinct) == 2:
            candidates.append([value == distinct[1] for value in values])
    regex = re.compile(pattern, re.IGNORECASE)
    candidates.append([bool(regex.search(json.dumps(o))) for o in outputs])
    return max((agreement(c, truth) for c in candidates), default=0.0)


# Annotations on a project's traces


@dataclass
class TraceAnnotation:
    """A span or trace annotation, attributed to the trace it belongs to."""

    trace_id: str
    unit: str
    span_kind: str | None
    name: str
    annotator_kind: str
    label: str | None
    score: float | None
    explanation: str | None


def trace_level_annotations(
    project: str, spans: Sequence[Mapping[str, Any]]
) -> list[TraceAnnotation]:
    """Returns every span and trace annotation in a project, each with its trace ID.

    Notes, which Phoenix stores as annotations named `note`, are left out.
    """
    trace_of = {s["context"]["span_id"]: s["context"]["trace_id"] for s in spans}
    kind_of = {s["context"]["span_id"]: str(s.get("span_kind", "")).upper() for s in spans}
    found: list[TraceAnnotation] = []
    span_ids = sorted(trace_of)
    for start in range(0, len(span_ids), 100):
        page = _paginate(
            f"/v1/projects/{_quote(project)}/span_annotations",
            {"span_ids": span_ids[start : start + 100], "limit": 1000},
        )
        for a in page:
            found.append(_trace_annotation(a, trace_of.get(a.get("span_id", "")), "span", kind_of))
    trace_ids = sorted(set(trace_of.values()))
    for start in range(0, len(trace_ids), 50):
        page = _paginate(
            f"/v1/projects/{_quote(project)}/trace_annotations",
            {"trace_ids": trace_ids[start : start + 50], "limit": 1000},
        )
        for a in page:
            found.append(_trace_annotation(a, a.get("trace_id"), "trace", kind_of))
    return [a for a in found if a.trace_id and a.name != "note"]


def _trace_annotation(
    raw: Mapping[str, Any], trace_id: str | None, unit: str, kind_of: Mapping[str, str]
) -> TraceAnnotation:
    result = raw.get("result") or {}
    score = result.get("score")
    return TraceAnnotation(
        trace_id=str(trace_id or ""),
        unit=unit,
        span_kind=kind_of.get(raw.get("span_id", "")) if unit == "span" else None,
        name=str(raw.get("name")),
        annotator_kind=str(raw.get("annotator_kind") or ""),
        label=result.get("label"),
        score=float(score) if score is not None else None,
        explanation=result.get("explanation"),
    )


def per_trace(annotations: Sequence[TraceAnnotation], name: str) -> dict[str, TraceAnnotation]:
    """Returns one annotation per trace for a name, preferring LLM spans, then traces."""
    rank = {"LLM": 0, None: 1}
    chosen: dict[str, TraceAnnotation] = {}
    for a in sorted(annotations, key=lambda a: rank.get(a.span_kind, 2)):
        if a.name == name and (a.label is not None or a.score is not None):
            chosen.setdefault(a.trace_id, a)
    return chosen
