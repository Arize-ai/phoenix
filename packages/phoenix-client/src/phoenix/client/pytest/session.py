from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from httpx import HTTPStatusError

from phoenix.client.resources.experiments import (
    _TracerBundle,  # pyright: ignore[reportPrivateUsage]
)

from .config import PhoenixTestConfig
from .context import (
    _annotator_kind_for,  # pyright: ignore[reportPrivateUsage]
    _as_evaluator,  # pyright: ignore[reportPrivateUsage]
    _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
    _iter_scores,  # pyright: ignore[reportPrivateUsage]
    _RunRecord,  # pyright: ignore[reportPrivateUsage]
)
from .marker import REPETITION_PARAM, resolve_evaluators
from .tracing import (
    SpanHandle,
    SuiteTracer,
    build_evaluator_bundle,
    build_noop_suite_tracer,
    build_suite_tracer,
)

if TYPE_CHECKING:
    from _pytest.nodes import Item

logger = logging.getLogger(__name__)


@dataclass
class ItemBinding:
    nodeid: str
    dataset_name: str
    external_id: str
    dataset_example_id: Optional[str] = None


@dataclass
class DatasetGroup:
    """All marked items resolving to one dataset name -> one dataset + one experiment."""

    name: str
    bindings: dict[str, ItemBinding] = field(default_factory=dict)
    dataset_id: Optional[str] = None
    dataset_version_id: Optional[str] = None
    experiment_id: Optional[str] = None
    project_name: Optional[str] = None
    # external_id -> dataset example node_id (GlobalID), not the example "id"
    example_ids: dict[str, str] = field(default_factory=dict)
    max_repetitions: int = 1


@dataclass
class RecordedRun:
    nodeid: str
    dataset_name: str
    experiment_run_id: Optional[str]
    passed: bool
    error: Optional[str]
    repetition_number: int = 1
    evaluations: dict[str, dict[str, Any]] = field(default_factory=dict)


class SuiteState:
    def __init__(self, *, config: PhoenixTestConfig, partial_collection: bool) -> None:
        self.config = config
        self.partial_collection = partial_collection
        self._groups: dict[str, DatasetGroup] = {}
        self._bindings_by_nodeid: dict[str, ItemBinding] = {}
        self._items_by_nodeid: dict[str, "Item"] = {}
        self._recorded: list[RecordedRun] = []
        self._client: Any = None
        self._bootstrap_error: Optional[Exception] = None
        self._bootstrapped = False
        self._tracers: dict[str, SuiteTracer] = {}
        self._offline_tracer = build_noop_suite_tracer() if config.offline else None
        self._evaluator_bundle: Optional[_TracerBundle] = None
        self._owned_bundles: list[_TracerBundle] = []
        self._tracing_closed = False

    def register_item(
        self, item: "Item", *, dataset_name: str, external_id: str, repetitions: int = 1
    ) -> None:
        group = self._groups.setdefault(dataset_name, DatasetGroup(name=dataset_name))
        group.max_repetitions = max(group.max_repetitions, repetitions)
        binding = ItemBinding(
            nodeid=item.nodeid, dataset_name=dataset_name, external_id=external_id
        )
        group.bindings.setdefault(external_id, binding)
        self._bindings_by_nodeid[item.nodeid] = group.bindings[external_id]
        self._items_by_nodeid[item.nodeid] = item

    def binding_for(self, item: "Item") -> Optional[ItemBinding]:
        return self._bindings_by_nodeid.get(item.nodeid)

    @property
    def dataset_names(self) -> list[str]:
        return list(self._groups)

    @property
    def bootstrapped(self) -> bool:
        return self._bootstrapped

    def bootstrap(self, client: Any, *, pass_annotation: str) -> None:
        self._client = client
        self._bootstrapped = True
        for group in self._groups.values():
            self._sync_dataset(group)
            self._resolve_examples(group)
            self._create_experiment(group)
        self._build_tracers()

    def _build_tracers(self) -> None:
        if self.config.offline:
            return
        base_url, headers = self._tracer_endpoint()
        if self._evaluator_bundle is None:
            self._evaluator_bundle = build_evaluator_bundle(base_url=base_url, headers=headers)
            if self._evaluator_bundle is not None:
                self._owned_bundles.append(self._evaluator_bundle)
        evaluator_bundle = self._evaluator_bundle
        mount_evaluator_provider = evaluator_bundle is not None
        if evaluator_bundle is None:
            evaluator_bundle = build_noop_suite_tracer().evaluator_bundle
        for group in self._groups.values():
            tracer = build_suite_tracer(
                project_name=group.project_name,
                base_url=base_url,
                headers=headers,
                evaluator_bundle=evaluator_bundle,
                mount_evaluator_provider=mount_evaluator_provider,
            )
            if tracer is not None:
                self._tracers[group.name] = tracer
                self._owned_bundles.append(tracer.task_bundle)

    def _tracer_endpoint(self) -> tuple[Optional[str], Optional[dict[str, str]]]:
        http_client = getattr(self._client, "_client", None)
        if http_client is None:
            return None, None
        return str(http_client.base_url), dict(http_client.headers)

    def tracer_for(self, dataset_name: str) -> Optional[SuiteTracer]:
        if self.config.offline:
            return self._offline_tracer
        return self._tracers.get(dataset_name)

    def close_tracing(self) -> None:
        if self._tracing_closed:
            return
        self._tracing_closed = True
        seen: set[int] = set()
        for bundle in self._owned_bundles:
            provider = bundle.provider
            if id(provider) in seen:
                continue
            seen.add(id(provider))
            try:
                provider.force_flush()
            except Exception as e:  # noqa: BLE001
                logger.warning("Phoenix plugin: failed to flush tracing: %s", e)
            finally:
                try:
                    provider.shutdown()
                except Exception as e:  # noqa: BLE001
                    logger.warning("Phoenix plugin: failed to shut down tracing: %s", e)

    def project_name_for(self, dataset_name: str) -> Optional[str]:
        group = self._groups.get(dataset_name)
        return group.project_name if group is not None else None

    def record_bootstrap_error(self, error: Exception) -> None:
        self._bootstrap_error = error

    def _example_payload(self, group: DatasetGroup) -> list[dict[str, Any]]:
        examples: list[dict[str, Any]] = []
        for external_id, binding in group.bindings.items():
            item = self._items_by_nodeid.get(binding.nodeid)
            input_payload, output_payload, metadata_payload = _example_fields(item)
            metadata_payload = {**metadata_payload, "pytest_nodeid": binding.nodeid}
            examples.append(
                {
                    "input": input_payload,
                    "output": output_payload,
                    "metadata": metadata_payload,
                    "id": external_id,
                }
            )
        return examples

    def _sync_dataset(self, group: DatasetGroup) -> None:
        examples = self._example_payload(group)
        inputs = [e["input"] for e in examples]
        outputs = [e["output"] for e in examples]
        metadata = [e["metadata"] for e in examples]
        example_ids = [e["id"] for e in examples]
        # action="update" prunes server examples absent from the upload; append on partial runs.
        action = "append" if self.partial_collection else "update"
        dataset = self._client.datasets._upload_json_dataset(  # noqa: SLF001
            dataset_name=group.name,
            inputs=inputs,
            outputs=outputs,
            metadata=metadata,
            example_ids=example_ids,
            action=action,
        )
        group.dataset_id = dataset.id
        group.dataset_version_id = dataset.version_id

    def _resolve_examples(self, group: DatasetGroup) -> None:
        if group.dataset_id is None:
            return
        from phoenix.client.resources.experiments import (
            _example_global_id,  # pyright: ignore[reportPrivateUsage]
        )

        # Pin to the version the experiment was created against (group.dataset_version_id), not
        # the latest: a concurrent writer to the same dataset name between upload and resolve
        # would otherwise hand back example IDs from a version the experiment isn't pinned to.
        dataset = self._client.datasets.get_dataset(
            dataset=group.dataset_id, version_id=group.dataset_version_id
        )
        # Use the node GlobalID, never "id": custom-id uploads put external_id in "id" and the
        # GlobalID in "node_id" (guards the PR #13702 zero-runs bug).
        by_nodeid: dict[str, str] = {}
        for example in dataset.examples:
            example_any: Any = example
            metadata: Any = example_any.get("metadata") or {}
            nodeid: Any = metadata.get("pytest_nodeid")
            if nodeid:
                by_nodeid[str(nodeid)] = _example_global_id(example_any)
        for external_id, binding in group.bindings.items():
            example_id = by_nodeid.get(binding.nodeid)
            if example_id:
                group.example_ids[external_id] = example_id
                binding.dataset_example_id = example_id

    def _create_experiment(self, group: DatasetGroup) -> None:
        if group.dataset_id is None:
            return
        experiment = self._client.experiments.create(
            dataset_id=group.dataset_id,
            dataset_version_id=group.dataset_version_id,
            repetitions=group.max_repetitions,
        )
        group.experiment_id = experiment["id"]
        group.project_name = experiment.get("project_name")

    def broadcast_payload(self) -> dict[str, dict[str, Any]]:
        return {
            name: {
                "dataset_id": g.dataset_id,
                "dataset_version_id": g.dataset_version_id,
                "experiment_id": g.experiment_id,
                "project_name": g.project_name,
                "example_ids": dict(g.example_ids),
            }
            for name, g in self._groups.items()
        }

    def adopt_broadcast(self, payload: dict[str, dict[str, Any]], *, client: Any) -> None:
        self._client = client
        for name, data in payload.items():
            group = self._groups.get(name)
            if group is None:
                continue
            group.dataset_id = data.get("dataset_id")
            group.dataset_version_id = data.get("dataset_version_id")
            group.experiment_id = data.get("experiment_id")
            group.project_name = data.get("project_name")
            group.example_ids = dict(data.get("example_ids") or {})
            for external_id, example_id in group.example_ids.items():
                if external_id in group.bindings:
                    group.bindings[external_id].dataset_example_id = example_id
        self._build_tracers()

    def record_run(
        self,
        binding: ItemBinding,
        *,
        record: _RunRecord,
        start_time: datetime,
        end_time: datetime,
        passed: bool,
        error: Optional[str],
        pass_annotation: str,
        repetition_number: int = 1,
        run_evaluators: bool = True,
    ) -> None:
        recorded = RecordedRun(
            nodeid=binding.nodeid,
            dataset_name=binding.dataset_name,
            experiment_run_id=None,
            passed=passed,
            error=error,
            repetition_number=repetition_number,
            evaluations=dict(record.evaluations),
        )
        self._recorded.append(recorded)

        if self.config.offline or self._client is None:
            return
        group = self._groups.get(binding.dataset_name)
        if group is None or group.experiment_id is None or binding.dataset_example_id is None:
            return

        try:
            run = self._client.experiments.log_run(
                experiment_id=group.experiment_id,
                dataset_example_id=binding.dataset_example_id,
                output=record.output,
                start_time=start_time,
                end_time=end_time,
                repetition_number=repetition_number,
                trace_id=record.trace_id,
                error=error,
            )
        except Exception as e:  # noqa: BLE001
            # A 409 means the server already has a *successful* run for this
            # (experiment, example, repetition) and treats it as immutable, so it refuses to
            # overwrite it. That run already carries the annotations from the execution that
            # created it; re-posting this attempt's annotations would duplicate them and describe
            # a different output, so skip them. (A run stored with an *error* is not immutable —
            # the server upserts it — so ordinary fail->pass reruns never reach this branch; the
            # duplicate-success case comes from concurrent execution, e.g. xdist collection
            # divergence, or a rerun plugin that reruns already-passing tests.) Any other failure
            # is also non-fatal: logging is best-effort and must not sink the test outcome.
            if isinstance(e, HTTPStatusError) and e.response.status_code == 409:
                logger.warning(
                    "Phoenix plugin: a successful run already exists for %s (repetition %d); "
                    "skipping its annotations.",
                    binding.nodeid,
                    repetition_number,
                )
            else:
                logger.warning("Phoenix plugin: failed to log run for %s: %s", binding.nodeid, e)
            return
        run_id = run["id"]
        recorded.experiment_run_id = run_id

        tracer = self._tracers.get(binding.dataset_name)
        # The pass/fail verdict is an evaluation of the run's output, so give it its own EVALUATOR
        # span (parity with the other evaluators) instead of reusing the test's CHAIN trace_id.
        pass_trace_id: Optional[str] = record.trace_id
        if tracer is not None:
            with tracer.evaluator_span(
                f"Evaluation: {pass_annotation}", input_value=record.output
            ) as handle:
                pass
            pass_trace_id = handle.trace_id
        self._safe_log_eval(
            experiment_run_id=run_id,
            name=pass_annotation,
            score=1.0 if passed else 0.0,
            label="pass" if passed else "fail",
            annotator_kind="CODE",
            trace_id=pass_trace_id,
        )
        for name, kwargs in record.evaluations.items():
            self._safe_log_eval(
                experiment_run_id=run_id,
                name=name,
                score=kwargs.get("score"),
                label=kwargs.get("label"),
                explanation=kwargs.get("explanation"),
                annotator_kind=kwargs.get("annotator_kind", "CODE"),
                metadata=kwargs.get("metadata"),
                trace_id=kwargs.get("trace_id") or record.trace_id,
                error=kwargs.get("error"),
            )
        if run_evaluators:
            # A setup-errored run has no output to evaluate, so the caller suppresses hoisted
            # evaluators; the pass=fail annotation above still records the error.
            self._run_marker_evaluators(
                binding,
                run_id=run_id,
                output=record.output,
                tracer=tracer,
                run_trace_id=record.trace_id,
            )

    def _run_marker_evaluators(
        self,
        binding: ItemBinding,
        *,
        run_id: str,
        output: Any,
        tracer: Optional[SuiteTracer],
        run_trace_id: Optional[str] = None,
    ) -> None:
        """Each evaluator is bound (by parameter name) to the standard fields the case provides —
        ``output``, the parametrized fields, the full ``input`` mapping, and the test's own
        ``trace_id`` — matching ``run_experiment``. A failure degrades to a warning rather than
        sinking the run's other annotations. Each invocation is wrapped in an EVALUATOR span whose
        trace_id links its annotation (distinct from the test ``trace_id`` passed to the evaluator,
        which correlates to the run being evaluated)."""
        item = self._items_by_nodeid.get(binding.nodeid)
        if item is None:
            return
        evaluators = resolve_evaluators(item)
        if not evaluators:
            return
        eval_input = _eval_input_for(item, output)
        # The test run's CHAIN trace_id, so an evaluator declaring ``trace_id`` can correlate to
        # the run's spans (run_experiment passes the task run's trace_id the same way). A field
        # explicitly parametrized as ``trace_id`` takes precedence.
        if run_trace_id is not None:
            eval_input.setdefault("trace_id", run_trace_id)
        for evaluator in evaluators:
            # A display name resolved before wrapping, so a wrap/parse failure can still be
            # reported and recorded against a sensible annotation name.
            raw_name = (
                getattr(evaluator, "name", None)
                or getattr(evaluator, "__name__", None)
                or "evaluation"
            )
            default_name = raw_name
            default_kind = _annotator_kind_for(evaluator)
            # Pre-init so the EVALUATOR span's trace_id is recoverable even when the evaluator
            # raises inside the span: the span context manager populates handle.trace_id during
            # unwind, so the errored eval below still links to its span (parity with evaluate()).
            handle: Optional[SpanHandle] = None
            try:
                # Route through the experiment adapter so a hoisted evaluator behaves exactly as
                # it would under run_experiment: arguments bound by parameter name and the
                # evaluator's own name/kind preserved (P2/P4). Wrapping validates the signature,
                # so a malformed evaluator surfaces here and is recorded as an errored eval below.
                wrapped = _as_evaluator(evaluator)
                default_name = wrapped.name
                default_kind = wrapped.kind
                if tracer is not None:
                    with tracer.evaluator_span(
                        f"Evaluation: {default_name}", input_value=eval_input
                    ) as handle:
                        result = _invoke_evaluator(wrapped, eval_input)
                else:
                    result = _invoke_evaluator(wrapped, eval_input)
            except Exception as e:  # noqa: BLE001
                # Persist the failure as an errored evaluation (parity with run_experiment, which
                # posts error=repr(e) with no result) before degrading to a warning — so Phoenix
                # records that the evaluator ran and failed instead of dropping it silently.
                logger.warning(
                    "Phoenix plugin: hoisted evaluator %s failed for %s: %s",
                    default_name,
                    binding.nodeid,
                    e,
                )
                self._safe_log_eval(
                    experiment_run_id=run_id,
                    name=default_name,
                    annotator_kind=default_kind,
                    error=repr(e),
                    trace_id=handle.trace_id if handle is not None else None,
                )
                continue
            trace_id = handle.trace_id if handle is not None else None
            for score in _iter_scores(result, default_name=default_name):
                self._safe_log_eval(
                    experiment_run_id=run_id,
                    name=score["name"],
                    score=score.get("score"),
                    label=score.get("label"),
                    explanation=score.get("explanation"),
                    annotator_kind=score.get("annotator_kind") or default_kind,
                    metadata=score.get("metadata"),
                    trace_id=trace_id,
                )

    def _safe_log_eval(self, **kwargs: Any) -> None:
        try:
            self._client.experiments.log_evaluation(**kwargs)
        except Exception as e:  # noqa: BLE001
            logger.warning("Phoenix plugin: failed to log evaluation %s: %s", kwargs.get("name"), e)

    @property
    def recorded_runs(self) -> list[RecordedRun]:
        return list(self._recorded)

    @property
    def groups(self) -> dict[str, DatasetGroup]:
        return dict(self._groups)

    @property
    def bootstrap_error(self) -> Optional[Exception]:
        return self._bootstrap_error

    @property
    def client(self) -> Any:
        return self._client

    def offline_summary_line(self) -> str:
        n = len(self._recorded)
        return f"Phoenix: offline mode (tracking disabled); {n} test(s) ran without recording."

    def summary_line(self) -> str:
        n = len(self._recorded)
        return f"Phoenix: recorded {n} run(s) across {len(self._groups)} experiment(s)."


def _example_fields(
    item: Optional["Item"],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Derive the (input, output, metadata) dicts for a dataset example from a pytest item."""
    input_payload: dict[str, Any] = {}
    output_payload: dict[str, Any] = {}
    metadata_payload: dict[str, Any] = {}
    if item is not None:
        callspec = getattr(item, "callspec", None)
        if callspec is not None and getattr(callspec, "params", None):
            input_payload = {
                k: _jsonable(v) for k, v in callspec.params.items() if k != REPETITION_PARAM
            }
        marker = item.get_closest_marker("phoenix")
        if marker is not None:
            evaluators = resolve_evaluators(item)
            if evaluators:
                metadata_payload["evaluators"] = [getattr(e, "name", repr(e)) for e in evaluators]
    if not input_payload:
        input_payload = {"nodeid": item.nodeid if item is not None else ""}
    return input_payload, output_payload, metadata_payload


def _jsonable(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return repr(value)


def _eval_input_for(item: "Item", output: Any) -> dict[str, Any]:
    """Build the keyword arguments for a hoisted evaluator from the test case.

    Each parametrized field is surfaced under its own name, so an evaluator binds any field named
    after a standard parameter (``expected``/``reference``/``metadata``). The full set of fields is
    also exposed as ``input`` — the dataset example's input, matching ``run_experiment`` — so an
    evaluator declaring ``input`` receives the whole mapping rather than ``None``; a field
    explicitly parametrized as ``input`` takes precedence over that default. The recorded value is
    added under ``output``. The adapter then binds whichever of these the evaluator declares.
    """
    params: dict[str, Any] = {}
    callspec = getattr(item, "callspec", None)
    if callspec is not None and getattr(callspec, "params", None):
        params = {k: v for k, v in callspec.params.items() if k != REPETITION_PARAM}
    eval_input: dict[str, Any] = dict(params)
    eval_input["output"] = output
    eval_input.setdefault("input", params)
    return eval_input
