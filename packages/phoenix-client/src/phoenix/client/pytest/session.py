from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from .config import PhoenixTestConfig
from .context import (
    _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
    _iter_scores,  # pyright: ignore[reportPrivateUsage]
    _RunRecord,  # pyright: ignore[reportPrivateUsage]
)
from .marker import REPETITION_PARAM, resolve_evaluators
from .tracing import SuiteTracer, build_suite_tracer

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
        for group in self._groups.values():
            tracer = build_suite_tracer(
                project_name=group.project_name, base_url=base_url, headers=headers
            )
            if tracer is not None:
                self._tracers[group.name] = tracer

    def _tracer_endpoint(self) -> tuple[Optional[str], Optional[dict[str, str]]]:
        http_client = getattr(self._client, "_client", None)
        if http_client is None:
            return None, None
        return str(http_client.base_url), dict(http_client.headers)

    def tracer_for(self, dataset_name: str) -> Optional[SuiteTracer]:
        return self._tracers.get(dataset_name)

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

        dataset = self._client.datasets.get_dataset(dataset=group.dataset_id)
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

    def adopt_broadcast(self, payload: dict[str, dict[str, Any]]) -> None:
        from phoenix.client import Client

        self._client = Client()
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
                tolerate_existing=True,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("Phoenix plugin: failed to log run for %s: %s", binding.nodeid, e)
            return
        recorded.experiment_run_id = run["id"]

        self._safe_log_eval(
            experiment_run_id=run["id"],
            name=pass_annotation,
            score=1.0 if passed else 0.0,
            label="pass" if passed else "fail",
            annotator_kind="CODE",
            trace_id=record.trace_id,
        )
        for name, kwargs in record.evaluations.items():
            self._safe_log_eval(
                experiment_run_id=run["id"],
                name=name,
                score=kwargs.get("score"),
                label=kwargs.get("label"),
                explanation=kwargs.get("explanation"),
                annotator_kind=kwargs.get("annotator_kind", "CODE"),
                metadata=kwargs.get("metadata"),
                trace_id=kwargs.get("trace_id") or record.trace_id,
            )
        self._run_marker_evaluators(
            binding,
            run_id=run["id"],
            output=record.output,
            tracer=self._tracers.get(binding.dataset_name),
        )

    def _run_marker_evaluators(
        self,
        binding: ItemBinding,
        *,
        run_id: str,
        output: Any,
        tracer: Optional[SuiteTracer],
    ) -> None:
        """Each evaluator gets the case's parametrized fields plus ``output``; a failure degrades
        to a warning rather than sinking the run's other annotations. Each invocation is wrapped
        in an EVALUATOR span whose trace_id links its annotation."""
        item = self._items_by_nodeid.get(binding.nodeid)
        if item is None:
            return
        evaluators = resolve_evaluators(item)
        if not evaluators:
            return
        eval_input = _eval_input_for(item, output)
        for evaluator in evaluators:
            default_name = (
                getattr(evaluator, "name", None)
                or getattr(evaluator, "__name__", None)
                or "evaluation"
            )
            trace_id: Optional[str] = None
            try:
                if tracer is not None:
                    with tracer.evaluator_span(
                        f"Evaluation: {default_name}", input_value=eval_input
                    ) as handle:
                        result = _invoke_evaluator(evaluator, eval_input)
                    trace_id = handle.trace_id
                else:
                    result = _invoke_evaluator(evaluator, eval_input)
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "Phoenix plugin: hoisted evaluator %s failed for %s: %s",
                    default_name,
                    binding.nodeid,
                    e,
                )
                continue
            for score in _iter_scores(result, default_name=default_name):
                self._safe_log_eval(
                    experiment_run_id=run_id,
                    name=score["name"],
                    score=score.get("score"),
                    label=score.get("label"),
                    explanation=score.get("explanation"),
                    annotator_kind=score.get("annotator_kind", "LLM"),
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
    eval_input: dict[str, Any] = {}
    callspec = getattr(item, "callspec", None)
    if callspec is not None and getattr(callspec, "params", None):
        eval_input = {k: v for k, v in callspec.params.items() if k != REPETITION_PARAM}
    eval_input["output"] = output
    return eval_input
