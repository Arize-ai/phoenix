from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional


@dataclass
class _RunRecord:
    nodeid: str
    external_id: str
    output: Any = None
    output_logged: bool = False
    evaluations: dict[str, dict[str, Any]] = field(default_factory=dict)
    # Test CHAIN trace_id (set by the hookwrapper) carried onto bare annotations.
    trace_id: Optional[str] = None
    # Suite tracer for the test's dataset; lets inline px.evaluate open EVALUATOR spans.
    tracer: Any = None

    def set_output(self, value: Any) -> None:
        self.output = value
        self.output_logged = True

    def add_evaluation(
        self,
        *,
        name: str,
        score: Optional[float] = None,
        label: Optional[str] = None,
        explanation: Optional[str] = None,
        annotator_kind: str = "CODE",
        metadata: Optional[Mapping[str, Any]] = None,
        trace_id: Optional[str] = None,
    ) -> None:
        self.evaluations[name] = {
            "name": name,
            "score": score,
            "label": label,
            "explanation": explanation,
            "annotator_kind": annotator_kind,
            "metadata": dict(metadata) if metadata else None,
            "trace_id": trace_id,
        }


# A contextvar, not a fixture, so px.* helpers work in unittest TestCase methods (no fixtures).
_CURRENT_RUN: ContextVar[Optional[_RunRecord]] = ContextVar(
    "phoenix_pytest_current_run", default=None
)


class PhoenixContextError(RuntimeError):
    """Raised when a ``px.*`` helper is called outside a marked Phoenix test."""


def _require_run() -> _RunRecord:
    run = _CURRENT_RUN.get()
    if run is None:
        raise PhoenixContextError(
            "phoenix recording helpers (log_output/log_evaluation/evaluate) may only be "
            "called from inside a test marked with @pytest.mark.phoenix"
        )
    return run


def set_current_run(run: _RunRecord) -> Token[Optional[_RunRecord]]:
    return _CURRENT_RUN.set(run)


def reset_current_run(token: Token[Optional[_RunRecord]]) -> None:
    _CURRENT_RUN.reset(token)


def current_run() -> Optional[_RunRecord]:
    return _CURRENT_RUN.get()


def log_output(output: Any) -> None:
    """Record the output under test for the current Phoenix test.

    Output capture is explicit (pytest warns on non-``None`` test returns), so the value must
    be passed here rather than returned from the test function.
    """
    _require_run().set_output(output)


def log_evaluation(
    *,
    name: str,
    score: Optional[float] = None,
    label: Optional[str] = None,
    explanation: Optional[str] = None,
    annotator_kind: str = "CODE",
    metadata: Optional[Mapping[str, Any]] = None,
) -> None:
    """Attach an evaluation annotation to the current run (keyed by ``name``).

    These annotations are independent of the assertion-derived ``pass`` annotation and gate
    only in aggregate; calling this does not by itself fail the pytest item.
    """
    _require_run().add_evaluation(
        name=name,
        score=score,
        label=label,
        explanation=explanation,
        annotator_kind=annotator_kind,
        metadata=metadata,
    )


def evaluate(evaluator: Any, /, **eval_input: Any) -> Any:
    """Run a ``phoenix.evals`` evaluator inline and record its score(s) on the current run.

    Returns the evaluator's raw result so the test body can assert on it (an assertion failure
    feeds the ``pass`` annotation, so an inline evaluation can gate the individual test). The
    optional ``phoenix.evals`` dependency is imported lazily; the adapter is intentionally thin.
    """
    run = _require_run()
    default_name = getattr(evaluator, "name", "evaluation")
    trace_id: Optional[str] = None
    if run.tracer is not None:
        with run.tracer.evaluator_span(
            f"Evaluation: {default_name}", input_value=dict(eval_input)
        ) as handle:
            result = _invoke_evaluator(evaluator, eval_input)
        trace_id = handle.trace_id
    else:
        result = _invoke_evaluator(evaluator, eval_input)
    for score in _iter_scores(result, default_name=default_name):
        run.add_evaluation(
            name=score["name"],
            score=score.get("score"),
            label=score.get("label"),
            explanation=score.get("explanation"),
            annotator_kind=score.get("annotator_kind", "LLM"),
            metadata=score.get("metadata"),
            trace_id=trace_id,
        )
    return result


def _invoke_evaluator(evaluator: Any, eval_input: Mapping[str, Any]) -> Any:
    """Call a ``phoenix.evals``-style evaluator. Accepts an ``evaluate(input=...)`` object."""
    if hasattr(evaluator, "evaluate"):
        return evaluator.evaluate(dict(eval_input))
    if callable(evaluator):
        return evaluator(**eval_input)
    raise TypeError(f"Object {evaluator!r} is not a usable evaluator")


def _iter_scores(result: Any, *, default_name: str) -> list[dict[str, Any]]:
    """Normalize a `phoenix.evals` Score / Sequence[Score] / dict into eval-kwarg dicts."""
    scores: list[dict[str, Any]] = []
    if isinstance(result, (list, tuple)):
        seq: Any = result
        candidates: list[Any] = list(seq)
    else:
        candidates = [result]
    for idx, item in enumerate(candidates):
        if item is None:
            continue
        name: Any = getattr(item, "name", None)
        if name is None and isinstance(item, Mapping):
            mapping: Mapping[Any, Any] = item
            name = mapping.get("name")
        if not name:
            name = default_name if len(candidates) == 1 else f"{default_name}-{idx + 1}"
        if isinstance(item, Mapping):
            mapping = item
            scores.append(
                {
                    "name": name,
                    "score": mapping.get("score"),
                    "label": mapping.get("label"),
                    "explanation": mapping.get("explanation"),
                    "metadata": mapping.get("metadata"),
                }
            )
        else:
            scores.append(
                {
                    "name": name,
                    "score": getattr(item, "score", None),
                    "label": getattr(item, "label", None),
                    "explanation": getattr(item, "explanation", None),
                    "metadata": getattr(item, "metadata", None),
                }
            )
    return scores
