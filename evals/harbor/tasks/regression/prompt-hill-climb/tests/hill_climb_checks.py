from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, NamedTuple

from strawberry.relay import GlobalID

from evals.harbor.verifiers import phoenix_api, verify
from phoenix.server.api.types.node import from_global_id

QUERIES_DIR = Path(__file__).with_name("queries")
DATASET_NAME = "banking_saas_dataset_clean"

ExampleNodeId = str


# --- the dataset -------------------------------------------------------------------


@dataclass
class Example:
    node_id: ExampleNodeId
    input: Any
    reference: Any
    metadata: Any

    @property
    def rowid(self) -> int:
        return from_global_id(GlobalID.from_id(self.node_id))[1]

    @property
    def reference_text(self) -> str:
        if isinstance(self.reference, dict):
            return str(self.reference.get("reference", ""))
        return str(self.reference)

    @property
    def question(self) -> str:
        if isinstance(self.input, dict):
            messages = self.input.get("messages") or []
            if messages:
                return str(messages[-1].get("content", ""))
        return str(self.input)


def fetch_dataset() -> tuple[str, list[Example]]:
    """The dataset's node id and its current examples."""
    dataset = phoenix_api.client().datasets.get_dataset(dataset=DATASET_NAME)
    examples = [
        Example(e["node_id"], e["input"], e["output"], e["metadata"]) for e in dataset.examples
    ]
    return dataset.id, examples


# --- evaluators and experiments -----------------------------------------------------


@dataclass
class BoundEvaluator:
    node_id: str
    name: str
    kind: str
    input_mapping: dict[str, Any]
    output_configs: list[dict[str, Any]]
    evaluator_name: str
    source_code: str | None = None
    language: str | None = None
    sandbox_config_id: str | None = None

    @property
    def builtin_key(self) -> str | None:
        return self.evaluator_name if self.kind == "BUILTIN" else None


@dataclass
class Experiment:
    node_id: str
    sequence_number: int
    name: str
    description: str | None
    metadata: dict[str, Any]
    created_at: datetime
    run_count: int
    error_count: int
    scores: dict[ExampleNodeId, float | None]
    latest_annotation_at: datetime | None
    latency_ms: float | None
    cost: float | None

    @property
    def rowid(self) -> int:
        return from_global_id(GlobalID.from_id(self.node_id))[1]

    @property
    def scored_count(self) -> int:
        return sum(1 for s in self.scores.values() if s is not None)

    @property
    def pass_count(self) -> int:
        return sum(1 for s in self.scores.values() if s is not None and s >= 0.5)

    @property
    def mean_score(self) -> float:
        scored = [s for s in self.scores.values() if s is not None]
        return sum(scored) / len(scored) if scored else 0.0

    def changed_after(self, instant: datetime) -> bool:
        """Whether the experiment or any of its scores was created after ``instant``."""
        return self.created_at > instant or (
            self.latest_annotation_at is not None and self.latest_annotation_at > instant
        )


def fetch_dataset_state(dataset_id: str) -> tuple[list[BoundEvaluator], list[Experiment]]:
    """The evaluators bound to the dataset and every experiment run on it, with each run
    scored by the latest annotation from one of those evaluators."""
    query = phoenix_api.read_query(QUERIES_DIR / "dataset_state.graphql")
    dataset = phoenix_api.graphql(query, {"datasetId": dataset_id})["node"]
    evaluators = [
        BoundEvaluator(
            node_id=binding["evaluator"]["id"],
            name=binding["name"],
            kind=binding["evaluator"]["kind"],
            input_mapping=binding["inputMapping"],
            output_configs=binding["outputConfigs"]
            or binding["evaluator"].get("outputConfigs")
            or [],
            source_code=binding["evaluator"].get("sourceCode"),
            language=binding["evaluator"].get("language"),
            sandbox_config_id=(binding["evaluator"].get("sandboxConfig") or {}).get("id"),
            evaluator_name=binding["evaluator"]["name"],
        )
        for binding in phoenix_api.nodes(dataset["datasetEvaluators"])
    ]
    evaluator_names = {e.name for e in evaluators}
    experiments: list[Experiment] = []
    for node in phoenix_api.nodes(dataset["experiments"]):
        runs = [r for r in phoenix_api.nodes(node["runs"]) if r["repetitionNumber"] == 1]
        scores: dict[ExampleNodeId, float | None] = {}
        annotation_times: list[datetime] = []
        for run in runs:
            annotations = phoenix_api.nodes(run["annotations"])
            annotation_times.extend(verify.parse_timestamp(a["startTime"]) for a in annotations)
            matching = [
                a["score"]
                for a in annotations
                if a["name"] in evaluator_names and a["score"] is not None
            ]
            scores[run["example"]["id"]] = float(matching[-1]) if matching else None
        total_cost = (node["costSummary"]["total"] or {}).get("cost")
        experiments.append(
            Experiment(
                node_id=node["id"],
                sequence_number=node["sequenceNumber"],
                name=node["name"],
                description=node["description"],
                metadata=node["metadata"] or {},
                created_at=verify.parse_timestamp(node["createdAt"]),
                run_count=len(runs),
                error_count=sum(1 for r in runs if r["error"]),
                scores=scores,
                latest_annotation_at=max(annotation_times, default=None),
                latency_ms=node["averageRunLatencyMs"],
                cost=float(total_cost) if total_cost is not None else None,
            )
        )
    experiments.sort(key=lambda x: x.sequence_number)
    return evaluators, experiments


def moved_examples(
    first: Experiment, last: Experiment
) -> dict[ExampleNodeId, tuple[float | None, float | None]]:
    return {
        example_id: (first.scores.get(example_id), last.scores.get(example_id))
        for example_id in set(first.scores) | set(last.scores)
        if first.scores.get(example_id) != last.scores.get(example_id)
    }


# --- the evaluator probe -------------------------------------------------------------


class ProbeCase(NamedTuple):
    label: str
    output: str
    should_pass: bool


def probe_cases(example: Example) -> list[ProbeCase]:
    reference = example.reference_text
    altered = (
        reference.replace("user_id", "userid", 1)
        if "user_id" in reference
        else reference[:-1] + "X"
    )
    return [
        ProbeCase("identical", reference, True),
        ProbeCase("fenced", f"```sql\n{reference}\n```", True),
        ProbeCase("padded", f"  {reference}\n\n", True),
        ProbeCase("one_token_changed", altered, False),
        ProbeCase("empty", "", False),
    ]


def _config_input(config: dict[str, Any]) -> dict[str, Any]:
    kind = config["__typename"]
    fields = {k: v for k, v in config.items() if k != "__typename"}
    if kind == "CategoricalAnnotationConfig":
        return {"categorical": fields}
    if kind == "ContinuousAnnotationConfig":
        return {"continuous": fields}
    return {"freeform": fields}


def _preview_ref(evaluator: BoundEvaluator) -> dict[str, Any]:
    """Phoenix stores a code evaluator's output configs as annotation configs, and every
    GraphQL surface, including the by-id preview, filters those out as the wrong type. So
    the saved source and sandbox are sent inline, with the saved configs when the binding
    exposes them and otherwise a freeform config, under which Phoenix passes the label and
    score through unchanged."""
    if evaluator.kind == "CODE":
        if evaluator.sandbox_config_id is None:
            raise ValueError("code evaluator has no sandbox configuration")
        configs = [_config_input(c) for c in evaluator.output_configs] or [
            {"freeform": {"name": evaluator.name}}
        ]
        return {
            "inlineCodeEvaluator": {
                "name": evaluator.name,
                "language": evaluator.language or "PYTHON",
                "sourceCode": evaluator.source_code or "",
                "sandboxConfigId": evaluator.sandbox_config_id,
                "outputConfigs": configs,
            }
        }
    if evaluator.kind == "BUILTIN":
        return {"builtInEvaluatorId": evaluator.node_id}
    raise ValueError(f"cannot preview a {evaluator.kind} evaluator")


def preview_scores(evaluator: BoundEvaluator, contexts: list[dict[str, Any]]) -> list[float]:
    """Score each context with the evaluator through Phoenix, on its own sandbox and with
    its own input mapping, exactly as an experiment run would."""
    previews = [
        {
            "evaluator": _preview_ref(evaluator),
            "context": context,
            "inputMapping": evaluator.input_mapping,
        }
        for context in contexts
    ]
    query = phoenix_api.read_query(QUERIES_DIR / "evaluator_previews.graphql")
    results = phoenix_api.graphql(query, {"input": {"previews": previews}}, timeout=300.0)
    scores = [_as_score(r) for r in results["evaluatorPreviews"]["results"]]
    if len(scores) != len(contexts):
        raise ValueError(f"{len(contexts)} contexts produced {len(scores)} results")
    return scores


def _as_score(result: dict[str, Any]) -> float:
    if result.get("error"):
        raise ValueError(result["error"])
    annotation = result.get("annotation") or {}
    if isinstance(annotation.get("score"), (int, float)):
        return float(annotation["score"])
    label = str(annotation.get("label") or "").lower()
    if label in {"pass", "true", "correct", "match", "yes"}:
        return 1.0
    if label in {"fail", "false", "incorrect", "mismatch", "no"}:
        return 0.0
    raise ValueError(f"unrecognized evaluator result {result!r}")


def probe_evaluator(
    evaluator: BoundEvaluator, examples: list[Example]
) -> tuple[bool, dict[str, Any]]:
    """Passes when every probe agrees with expectation under at least one output shape: a
    bare string, as SDK tasks return, or a chat-messages dict, as playground runs store."""
    if evaluator.kind not in {"CODE", "BUILTIN"}:
        return False, {"reason": f"a {evaluator.kind} evaluator is not an exact-match check"}
    if evaluator.kind == "BUILTIN" and evaluator.builtin_key != "exact_match":
        return False, {"reason": f"builtin {evaluator.builtin_key!r} cannot check exact match"}
    shapes: dict[str, Callable[[str], Any]] = {
        "text": lambda text: text,
        "messages": lambda text: {"messages": [{"role": "assistant", "content": text}]},
    }
    detail: dict[str, Any] = {}
    for shape_name, shape in shapes.items():
        failures: list[str] = []
        for example in examples:
            cases = probe_cases(example)
            contexts = [
                {
                    "input": example.input,
                    "reference": example.reference,
                    "output": shape(case.output),
                    "metadata": example.metadata,
                }
                for case in cases
            ]
            try:
                scores = preview_scores(evaluator, contexts)
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{example.rowid}: {type(exc).__name__}: {str(exc)[:200]}")
                continue
            for case, score in zip(cases, scores):
                if (score >= 0.5) != case.should_pass:
                    failures.append(f"{example.rowid}/{case.label}: score {score}")
        detail[shape_name] = failures[:10]
        if not failures:
            return True, {"shape": shape_name}
    return False, detail


# --- the final reply ---------------------------------------------------------------

_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def dates_in(text: str) -> list[date]:
    dates = []
    for match in _DATE.findall(text):
        try:
            dates.append(date.fromisoformat(match))
        except ValueError:
            continue
    return dates


_COMPARE_LINK = re.compile(r"/datasets/([A-Za-z0-9=_-]+)/compare\?([^\s)\]>\"']*)")


def compare_links(text: str) -> list[tuple[str, set[str]]]:
    links: list[tuple[str, set[str]]] = []
    for dataset_id, query_string in _COMPARE_LINK.findall(text):
        links.append((dataset_id, set(re.findall(r"experimentId=([A-Za-z0-9=_-]+)", query_string))))
    return links
