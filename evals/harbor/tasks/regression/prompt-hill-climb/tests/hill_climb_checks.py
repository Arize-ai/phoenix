from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Callable, NamedTuple

from phoenix.client.__generated__ import v1

from evals.harbor.verifiers import phoenix_api
from evals.harbor.verifiers.graphql.__generated__ import (
    AnnotationConfigInput,
    BaseModel,
    CategoricalAnnotationConfigInput,
    ContinuousAnnotationConfigInput,
    DatasetEvaluatorFields,
    DatasetEvaluatorFieldsEvaluatorCodeEvaluator,
    EvaluatorInputMappingInput,
    EvaluatorKind,
    EvaluatorPreviewInput,
    EvaluatorPreviewItemInput,
    EvaluatorPreviewsEvaluatorPreviewsResults,
    EvaluatorPreviewsInput,
    ExperimentFields,
    ExperimentRunFields,
    FreeformAnnotationConfigInput,
    InlineCodeEvaluatorInput,
)

DATASET_NAME = "banking_saas_dataset_clean"

ExampleNodeId = str
Scores = dict[ExampleNodeId, float | None]


# --- the dataset -------------------------------------------------------------------


def reference_text(example: v1.DatasetExample) -> str:
    return str(example["output"].get("reference", ""))


def question(example: v1.DatasetExample) -> str:
    messages = example["input"].get("messages") or []
    if messages:
        return str(messages[-1].get("content", ""))
    return str(example["input"])


# --- evaluators and experiments -----------------------------------------------------


def builtin_key(evaluator: DatasetEvaluatorFields) -> str | None:
    return evaluator.evaluator.name if evaluator.evaluator.kind is EvaluatorKind.BUILTIN else None


def first_runs(experiment: ExperimentFields) -> list[ExperimentRunFields]:
    return [edge.node for edge in experiment.runs.edges if edge.node.repetition_number == 1]


def error_count(experiment: ExperimentFields) -> int:
    return sum(1 for run in first_runs(experiment) if run.error)


def scores(experiment: ExperimentFields, evaluators: list[DatasetEvaluatorFields]) -> Scores:
    """Each run's score from the latest annotation left by one of the evaluators."""
    names = {e.name for e in evaluators}
    result: Scores = {}
    for run in first_runs(experiment):
        matching = [
            edge.node.score
            for edge in run.annotations.edges
            if edge.node.name in names and edge.node.score is not None
        ]
        result[run.example.id] = matching[-1] if matching else None
    return result


def scored_count(scores: Scores) -> int:
    return sum(1 for s in scores.values() if s is not None)


def pass_count(scores: Scores) -> int:
    return sum(1 for s in scores.values() if s is not None and s >= 0.5)


def mean_score(scores: Scores) -> float:
    scored = [s for s in scores.values() if s is not None]
    return sum(scored) / len(scored) if scored else 0.0


def changed_after(experiment: ExperimentFields, instant: datetime) -> bool:
    """Whether the experiment or any of its annotations was created after ``instant``."""
    annotated_at = [
        edge.node.start_time for run in first_runs(experiment) for edge in run.annotations.edges
    ]
    return experiment.created_at > instant or any(t > instant for t in annotated_at)


def moved_examples(
    first: Scores, last: Scores
) -> dict[ExampleNodeId, tuple[float | None, float | None]]:
    return {
        example_id: (first.get(example_id), last.get(example_id))
        for example_id in set(first) | set(last)
        if first.get(example_id) != last.get(example_id)
    }


# --- the evaluator probe -------------------------------------------------------------


class ProbeCase(NamedTuple):
    label: str
    output: str
    should_pass: bool


def probe_cases(example: v1.DatasetExample) -> list[ProbeCase]:
    reference = reference_text(example)
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


def _config_input(config: BaseModel) -> AnnotationConfigInput:
    fields = config.model_dump()
    kind = fields.pop("typename__")
    if kind == "CategoricalAnnotationConfig":
        return AnnotationConfigInput(
            categorical=CategoricalAnnotationConfigInput.model_validate(fields)
        )
    if kind == "ContinuousAnnotationConfig":
        return AnnotationConfigInput(
            continuous=ContinuousAnnotationConfigInput.model_validate(fields)
        )
    return AnnotationConfigInput(freeform=FreeformAnnotationConfigInput.model_validate(fields))


def _preview_ref(evaluator: DatasetEvaluatorFields) -> EvaluatorPreviewInput:
    """Builtins are previewed by id. Code evaluators are sent inline because the GraphQL
    by-id preview filters them out as the wrong type: with the saved output configs when
    the binding exposes them and otherwise a freeform config, under which Phoenix passes
    the label and score through unchanged."""
    inner = evaluator.evaluator
    if isinstance(inner, DatasetEvaluatorFieldsEvaluatorCodeEvaluator):
        if inner.sandbox_config is None:
            raise ValueError("code evaluator has no sandbox configuration")
        configs = [_config_input(c) for c in evaluator.output_configs or inner.output_configs] or [
            AnnotationConfigInput(freeform=FreeformAnnotationConfigInput(name=evaluator.name))
        ]
        return EvaluatorPreviewInput(
            inline_code_evaluator=InlineCodeEvaluatorInput(
                name=evaluator.name,
                language=inner.language,
                source_code=inner.source_code,
                sandbox_config_id=inner.sandbox_config.id,
                output_configs=configs,
            )
        )
    if inner.kind is EvaluatorKind.BUILTIN:
        return EvaluatorPreviewInput(built_in_evaluator_id=inner.id)
    raise ValueError(f"cannot preview a {inner.kind.value} evaluator")


def preview_scores(
    evaluator: DatasetEvaluatorFields, contexts: list[dict[str, Any]]
) -> list[float]:
    """Score each context with the evaluator through Phoenix, on its own sandbox and with
    its own input mapping, exactly as an experiment run would."""
    input_mapping = EvaluatorInputMappingInput.model_validate(evaluator.input_mapping.model_dump())
    previews = EvaluatorPreviewsInput(
        previews=[
            EvaluatorPreviewItemInput(
                evaluator=_preview_ref(evaluator), context=context, input_mapping=input_mapping
            )
            for context in contexts
        ]
    )
    results = phoenix_api.graphql_client().evaluator_previews(previews, timeout=300.0)
    scores = [_as_score(r) for r in results.evaluator_previews.results]
    if len(scores) != len(contexts):
        raise ValueError(f"{len(contexts)} contexts produced {len(scores)} results")
    return scores


def _as_score(result: EvaluatorPreviewsEvaluatorPreviewsResults) -> float:
    if result.error:
        raise ValueError(result.error)
    annotation = result.annotation
    if annotation is not None and annotation.score is not None:
        return annotation.score
    label = (annotation.label if annotation is not None else None) or ""
    if label.lower() in {"pass", "true", "correct", "match", "yes"}:
        return 1.0
    if label.lower() in {"fail", "false", "incorrect", "mismatch", "no"}:
        return 0.0
    raise ValueError(f"unrecognized evaluator result {result!r}")


def probe_evaluator(
    evaluator: DatasetEvaluatorFields, examples: list[v1.DatasetExample]
) -> tuple[bool, dict[str, Any]]:
    """Passes when every probe agrees with expectation under at least one output shape: a
    bare string, as SDK tasks return, or a chat-messages dict, as playground runs store."""
    kind = evaluator.evaluator.kind
    if kind not in {EvaluatorKind.CODE, EvaluatorKind.BUILTIN}:
        return False, {"reason": f"a {kind.value} evaluator is not an exact-match check"}
    if kind is EvaluatorKind.BUILTIN and builtin_key(evaluator) != "exact_match":
        return False, {"reason": f"builtin {builtin_key(evaluator)!r} cannot check exact match"}
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
                    "input": example["input"],
                    "reference": example["output"],
                    "output": shape(case.output),
                    "metadata": example["metadata"],
                }
                for case in cases
            ]
            example_rowid = phoenix_api.rowid(example["node_id"])
            try:
                scores = preview_scores(evaluator, contexts)
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{example_rowid}: {type(exc).__name__}: {str(exc)[:200]}")
                continue
            for case, score in zip(cases, scores):
                if (score >= 0.5) != case.should_pass:
                    failures.append(f"{example_rowid}/{case.label}: score {score}")
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
