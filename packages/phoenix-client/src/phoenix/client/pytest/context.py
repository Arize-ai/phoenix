from __future__ import annotations

import inspect
import logging
from contextlib import AbstractContextManager, nullcontext
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

if TYPE_CHECKING:
    from .tracing import SpanHandle, SuiteTracer

logger = logging.getLogger(__name__)


@dataclass
class _RunRecord:
    nodeid: str
    external_id: str
    output: Any = None
    output_logged: bool = False
    evaluations: dict[str, dict[str, Any]] = field(default_factory=dict)
    # Test CHAIN trace_id (set by the hookwrapper) carried onto bare annotations.
    trace_id: Optional[str] = None
    # Suite tracer for the test's dataset; lets inline evaluate() open EVALUATOR spans.
    tracer: Optional["SuiteTracer"] = None

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
        error: Optional[str] = None,
    ) -> None:
        self.evaluations[name] = {
            "name": name,
            "score": score,
            "label": label,
            "explanation": explanation,
            "annotator_kind": annotator_kind,
            "metadata": dict(metadata) if metadata else None,
            "trace_id": trace_id,
            "error": error,
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

    The annotation is wrapped in its own EVALUATOR span so its recorded ``trace_id`` points at an
    evaluator trace rather than the test's CHAIN trace — matching ``px.evaluate`` and hoisted
    marker evaluators, so every evaluation links to an evaluator span.
    """
    run = _require_run()
    trace_id: Optional[str] = None
    if run.tracer is not None:
        with run.tracer.evaluator_span(f"Evaluation: {name}", input_value=None) as handle:
            pass
        trace_id = handle.trace_id
    run.add_evaluation(
        name=name,
        score=score,
        label=label,
        explanation=explanation,
        annotator_kind=annotator_kind,
        metadata=metadata,
        trace_id=trace_id,
    )


def evaluate(evaluator: Any, /, **eval_input: Any) -> Any:
    """Run a ``phoenix.evals`` evaluator inline and record its score(s) on the current run.

    Returns the evaluator's raw result so the test body can assert on it (an assertion failure
    feeds the ``pass`` annotation, so an inline evaluation can gate the individual test). The
    optional ``phoenix.evals`` dependency is imported lazily; the adapter is intentionally thin.
    """
    run = _require_run()
    default_name = getattr(evaluator, "name", "evaluation")
    default_kind = _annotator_kind_for(evaluator)
    handle: Optional[SpanHandle] = None
    span_cm: AbstractContextManager[Optional[SpanHandle]] = (
        run.tracer.evaluator_span(f"Evaluation: {default_name}", input_value=dict(eval_input))
        if run.tracer is not None
        else nullcontext(None)
    )
    try:
        with span_cm as handle:
            result = _invoke_evaluator(evaluator, eval_input)
    except Exception as e:
        # Mirror the experiment runner, which persists an evaluator that raises as an errored
        # evaluation (``error=repr(e)``, no result) rather than losing the fact it ran. The
        # annotation is buffered on the run and posted when the run is recorded; the exception
        # is then re-raised so the failure still gates the test (an inline evaluate() is the
        # one evaluator path that can fail an item). ``handle`` carries the EVALUATOR span's
        # trace_id even on failure — the span context manager sets it during unwind.
        run.add_evaluation(
            name=default_name,
            annotator_kind=default_kind,
            error=repr(e),
            trace_id=handle.trace_id if handle is not None else None,
        )
        raise
    trace_id: Optional[str] = handle.trace_id if handle is not None else None
    for score in _iter_scores(result, default_name=default_name):
        run.add_evaluation(
            name=score["name"],
            score=score.get("score"),
            label=score.get("label"),
            explanation=score.get("explanation"),
            annotator_kind=score.get("annotator_kind") or default_kind,
            metadata=score.get("metadata"),
            trace_id=trace_id,
        )
    return result


def _invoke_evaluator(evaluator: Any, eval_input: Mapping[str, Any]) -> Any:
    """Call an evaluator with the test's eval input, dispatching on how it accepts arguments.

    Four evaluator surfaces are supported:

    - a ``phoenix.evals`` evaluator — ``evaluate(self, eval_input, input_mapping=None)`` takes the
      input mapping *positionally*;
    - a ``phoenix.client.create_evaluator`` object — ``evaluate(self, **kwargs)`` takes the input
      fields as *keywords* (calling it positionally raises ``TypeError``);
    - an *async* evaluator — an async ``create_evaluator``/``BaseEvaluator`` whose sync
      ``evaluate`` is a stub that raises ``NotImplementedError`` (the logic lives in
      ``async_evaluate``), or a plain ``async def`` callable that returns a coroutine. Either way
      the coroutine is driven to completion, so an async evaluator records like a sync one;
    - a plain (sync) callable returning a result — invoked with the fields as keywords.
    """
    evaluate = getattr(evaluator, "evaluate", None)
    if callable(evaluate):
        try:
            result = _call_evaluate(evaluate, eval_input)
        except NotImplementedError:
            # An async-only evaluator (e.g. an async create_evaluator) stubs out evaluate() and
            # implements async_evaluate() instead; mirror the experiment runner and use that.
            result = _invoke_async_evaluate(evaluator, eval_input)
        return _resolved(result)
    if callable(evaluator):
        return _resolved(evaluator(**eval_input))
    raise TypeError(f"Object {evaluator!r} is not a usable evaluator")


def _invoke_async_evaluate(evaluator: Any, eval_input: Mapping[str, Any]) -> Any:
    """Fall back to an evaluator's ``async_evaluate`` when its sync ``evaluate`` is a stub."""
    async_evaluate = getattr(evaluator, "async_evaluate", None)
    if not callable(async_evaluate):
        raise NotImplementedError(
            f"Evaluator {evaluator!r} stubs out evaluate() but has no usable async_evaluate()"
        )
    return _call_evaluate(async_evaluate, eval_input)


def _resolved(result: Any) -> Any:
    """Drive a coroutine/awaitable result to a value so async evaluators record like sync ones."""
    if inspect.isawaitable(result):
        return _run_blocking(result)
    return result


def _run_blocking(awaitable: Any) -> Any:
    """Drive an awaitable to a value from sync code, whether or not a loop is already running.

    With no running loop (the usual case — evaluators run from ``makereport`` or a sync test
    body) ``asyncio.run`` suffices. Inside a running loop (an inline ``evaluate()`` called from
    an async test), we can't re-enter it, so the awaitable is driven on a dedicated worker
    thread with its own loop.
    """
    import asyncio

    async def _await() -> Any:
        return await awaitable

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_await())
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(_await())).result()


def _call_evaluate(evaluate: Any, eval_input: Mapping[str, Any]) -> Any:
    """Invoke an ``evaluate`` method, passing the eval input positionally when it declares a
    positional parameter (``phoenix.evals``) and by keyword when it is ``**kwargs``-only
    (``create_evaluator``)."""
    try:
        params = list(inspect.signature(evaluate).parameters.values())
    except (TypeError, ValueError):
        return evaluate(dict(eval_input))
    accepts_positional = any(
        p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
        for p in params
    )
    if accepts_positional:
        return evaluate(dict(eval_input))
    return evaluate(**eval_input)


def _as_evaluator(evaluator: Any) -> Any:
    """Normalize an arbitrary evaluator into a canonical experiment ``Evaluator``.

    This is the same adapter the experiment runner applies (``_evaluators_by_name`` ->
    ``create_evaluator()``): a plain callable is signature-validated and wrapped so its declared
    parameters bind to the standard fields (``input/output/expected/reference/metadata/example/
    trace_id``); a ``phoenix.evals`` evaluator is adapted; an already-``Evaluator`` object passes
    through. Routing hoisted evaluators through this means a function written for
    ``run_experiment`` behaves identically here — bound by parameter name, with the evaluator's
    own ``name``/``kind`` preserved — instead of the plugin inventing its own call convention.
    """
    from phoenix.client.resources.experiments.evaluators import create_evaluator

    return create_evaluator()(evaluator)


def _annotator_kind_for(evaluator: Any) -> str:
    """Best-effort annotator kind (``"CODE"``/``"LLM"``) for an evaluator object.

    Reads a ``create_evaluator`` object's ``_kind``/``kind`` (an ``AnnotatorKind`` or str) or a
    ``phoenix.evals`` evaluator's ``source`` (``"llm"`` -> LLM, else CODE). Plain callables and
    unknown objects default to CODE: a hoisted Python function is code, not an LLM judge.
    """
    kind: Any = getattr(evaluator, "_kind", None)
    if kind is None:
        kind = getattr(evaluator, "kind", None)
    if kind is not None:
        text = str(getattr(kind, "value", kind)).upper()
        return "LLM" if "LLM" in text else "CODE"
    source = getattr(evaluator, "source", None)
    if isinstance(source, str):
        return "LLM" if source.lower() == "llm" else "CODE"
    return "CODE"


def _iter_scores(result: Any, *, default_name: str) -> list[dict[str, Any]]:
    """Normalize an evaluator's return value into eval-kwarg dicts.

    The return-shape dispatch is delegated to the experiments runner's canonical
    ``_default_eval_scorer`` so a pytest evaluator accepts exactly the same shapes as one
    passed to ``run_experiment``: a ``phoenix.evals`` Score (or sequence of them), an
    ``EvaluationResult`` dict (or sequence), or a bare ``bool`` / ``float`` / ``str`` /
    ``(score, explanation)`` tuple. The only pytest-specific concern kept here is naming —
    a result that carries no name of its own is keyed by the evaluator's ``default_name``
    (suffixed ``-N`` when one evaluator yields several scores).
    """
    if result is None:
        return []
    from phoenix.client.resources.experiments.evaluators import (
        _default_eval_scorer,  # pyright: ignore[reportPrivateUsage]
    )

    try:
        normalized = _default_eval_scorer(result)
    except Exception as e:  # noqa: BLE001
        logger.warning("Phoenix plugin: could not interpret evaluator result %r: %s", result, e)
        return []
    if isinstance(normalized, Sequence) and not isinstance(normalized, (str, bytes, dict)):
        entries: list[Any] = list(normalized)
    else:
        entries = [normalized]
    scores: list[dict[str, Any]] = []
    for idx, entry in enumerate(entries):
        if not isinstance(entry, Mapping):
            continue
        mapping: Mapping[str, Any] = entry
        name = mapping.get("name") or (
            default_name if len(entries) == 1 else f"{default_name}-{idx + 1}"
        )
        scores.append(
            {
                "name": name,
                "score": mapping.get("score"),
                "label": mapping.get("label"),
                "explanation": mapping.get("explanation"),
                "metadata": mapping.get("metadata"),
            }
        )
    return scores
