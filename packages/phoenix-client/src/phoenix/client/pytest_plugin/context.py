"""Module-level ``px.*`` recording helpers backed by a contextvar.

The plugin sets a per-run accumulator around each marked test body, so authors call
``px.log_output(...)`` / ``px.log_evaluation(...)`` / ``px.evaluate(...)`` with no fixture
parameter — which also works for unittest ``TestCase`` methods that receive no fixtures.
"""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional


@dataclass
class _RunRecord:
    """Per-test recording accumulator. One record per marked item invocation."""

    nodeid: str
    external_id: str
    output: Any = None
    output_logged: bool = False
    # name -> evaluation kwargs accepted by Experiments.log_evaluation
    evaluations: dict[str, dict[str, Any]] = field(default_factory=dict)

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
    ) -> None:
        self.evaluations[name] = {
            "name": name,
            "score": score,
            "label": label,
            "explanation": explanation,
            "annotator_kind": annotator_kind,
            "metadata": dict(metadata) if metadata else None,
        }


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
    result = _invoke_evaluator(evaluator, eval_input)
    for score in _iter_scores(result, default_name=getattr(evaluator, "name", "evaluation")):
        run.add_evaluation(
            name=score["name"],
            score=score.get("score"),
            label=score.get("label"),
            explanation=score.get("explanation"),
            annotator_kind=score.get("annotator_kind", "LLM"),
            metadata=score.get("metadata"),
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
    candidates = result if isinstance(result, (list, tuple)) else [result]
    for idx, item in enumerate(candidates):
        if item is None:
            continue
        name = getattr(item, "name", None)
        if name is None and isinstance(item, Mapping):
            name = item.get("name")
        if not name:
            name = default_name if len(candidates) == 1 else f"{default_name}-{idx + 1}"
        if isinstance(item, Mapping):
            scores.append(
                {
                    "name": name,
                    "score": item.get("score"),
                    "label": item.get("label"),
                    "explanation": item.get("explanation"),
                    "metadata": item.get("metadata"),
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
