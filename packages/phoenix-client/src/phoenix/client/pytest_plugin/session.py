"""Suite-level state: dataset upsert, experiment correlation, and run recording.

One :class:`SuiteState` per pytest session holds the mapping from resolved dataset name to its
dataset + experiment, the per-item bindings (external_id -> dataset example), and the recorded
runs. It centralizes the three correlated IDs of D14: ``experiment_id`` (one per dataset name,
controller-created), ``dataset_example_id`` (resolved post-upload), and ``experiment_run_id``
(returned by each run POST, the anchor for every annotation).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from .config import PhoenixTestConfig
from .context import _RunRecord
from .marker import resolve_evaluators
from .repo_info import REPO_INFO_METADATA_KEY

if TYPE_CHECKING:
    from _pytest.nodes import Item

logger = logging.getLogger(__name__)


@dataclass
class ItemBinding:
    """Per-test binding produced at collection time and resolved during bootstrap."""

    nodeid: str
    dataset_name: str
    external_id: str
    # Resolved during bootstrap / recording:
    dataset_example_id: Optional[str] = None


@dataclass
class DatasetGroup:
    """All marked items resolving to one dataset name -> one dataset + one experiment."""

    name: str
    # external_id -> ItemBinding (deduped by external_id within the group)
    bindings: dict[str, ItemBinding] = field(default_factory=dict)
    dataset_id: Optional[str] = None
    dataset_version_id: Optional[str] = None
    experiment_id: Optional[str] = None
    # external_id -> dataset example node_id (GlobalID)
    example_ids: dict[str, str] = field(default_factory=dict)
    # Max resolved repetition count across this group's items (experiment.repetitions).
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
        self._repo_info_conflict = False
        self._bootstrapped = False

    # --- collection -----------------------------------------------------------------

    def register_item(
        self, item: "Item", *, dataset_name: str, external_id: str, repetitions: int = 1
    ) -> None:
        group = self._groups.setdefault(dataset_name, DatasetGroup(name=dataset_name))
        group.max_repetitions = max(group.max_repetitions, repetitions)
        binding = ItemBinding(
            nodeid=item.nodeid, dataset_name=dataset_name, external_id=external_id
        )
        # Dedup by external_id within the group (D13: one example per distinct id).
        group.bindings.setdefault(external_id, binding)
        self._bindings_by_nodeid[item.nodeid] = group.bindings[external_id]
        self._items_by_nodeid[item.nodeid] = item

    def binding_for(self, item: "Item") -> Optional[ItemBinding]:
        return self._bindings_by_nodeid.get(item.nodeid)

    @property
    def dataset_names(self) -> list[str]:
        return list(self._groups)

    # --- bootstrap (controller only) ------------------------------------------------

    @property
    def bootstrapped(self) -> bool:
        return self._bootstrapped

    def bootstrap(self, client: Any, *, repo_info: dict[str, Any], pass_annotation: str) -> None:
        self._client = client
        self._bootstrapped = True
        for group in self._groups.values():
            self._sync_dataset(group)
            self._resolve_examples(group)
            self._create_experiment(group, repo_info=repo_info)

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
        # Partial collection must NOT update-sync: action="update" deletes latest-version
        # examples absent from the upload and would prune the shared dataset (D15). Fall back
        # to append (no deletes) so a local `-k`/single-nodeid run never corrupts lineage.
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
        from phoenix.client.resources.experiments import _example_global_id

        dataset = self._client.datasets.get_dataset(dataset=group.dataset_id)
        # Map our stamped metadata.pytest_nodeid back to each example's node GlobalID. The run
        # endpoint records dataset_example_id as the node GlobalID; because we upload with custom
        # example ids, the example "id" field carries our external_id while "node_id" carries the
        # GlobalID. Resolve through the canonical helper (never "id") so we don't reintroduce the
        # silent zero-runs bug fixed in PR #13702.
        by_nodeid: dict[str, str] = {}
        for example in dataset.examples:
            nodeid = (example.get("metadata") or {}).get("pytest_nodeid")
            if nodeid:
                by_nodeid[str(nodeid)] = _example_global_id(example)
        for external_id, binding in group.bindings.items():
            example_id = by_nodeid.get(binding.nodeid)
            if example_id:
                group.example_ids[external_id] = example_id
                binding.dataset_example_id = example_id

    def _create_experiment(self, group: DatasetGroup, *, repo_info: dict[str, Any]) -> None:
        if group.dataset_id is None:
            return
        metadata: dict[str, Any] = {}
        if repo_info:
            # repo_info is reserved for runner-collected git metadata (D3); it overwrites any
            # user value. We only set it here so there is no user value to clobber yet.
            metadata[REPO_INFO_METADATA_KEY] = repo_info
        experiment = self._client.experiments.create(
            dataset_id=group.dataset_id,
            dataset_version_id=group.dataset_version_id,
            experiment_metadata=metadata or None,
            # Max resolved N across the group's items (per-marker overrides included).
            repetitions=group.max_repetitions,
        )
        group.experiment_id = experiment["id"]

    # --- xdist broadcast ------------------------------------------------------------

    def broadcast_payload(self) -> dict[str, dict[str, Any]]:
        return {
            name: {
                "dataset_id": g.dataset_id,
                "dataset_version_id": g.dataset_version_id,
                "experiment_id": g.experiment_id,
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
            group.example_ids = dict(data.get("example_ids") or {})
            for external_id, example_id in group.example_ids.items():
                if external_id in group.bindings:
                    group.bindings[external_id].dataset_example_id = example_id

    # --- recording ------------------------------------------------------------------

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
                error=error,
                tolerate_existing=True,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("Phoenix plugin: failed to log run for %s: %s", binding.nodeid, e)
            return
        recorded.experiment_run_id = run["id"]

        # Assertion outcome -> reserved `pass` annotation (D12 default composition).
        self._safe_log_eval(
            experiment_run_id=run["id"],
            name=pass_annotation,
            score=1.0 if passed else 0.0,
            label="pass" if passed else "fail",
            annotator_kind="CODE",
        )
        # Inline px.evaluate / px.log_evaluation annotations (independent of `pass`).
        for name, kwargs in record.evaluations.items():
            self._safe_log_eval(
                experiment_run_id=run["id"],
                name=name,
                score=kwargs.get("score"),
                label=kwargs.get("label"),
                explanation=kwargs.get("explanation"),
                annotator_kind=kwargs.get("annotator_kind", "CODE"),
                metadata=kwargs.get("metadata"),
            )

    def _safe_log_eval(self, **kwargs: Any) -> None:
        try:
            self._client.experiments.log_evaluation(**kwargs)
        except Exception as e:  # noqa: BLE001
            logger.warning("Phoenix plugin: failed to log evaluation %s: %s", kwargs.get("name"), e)

    # --- summary --------------------------------------------------------------------

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
        reason = "tracking disabled" if not self.config.tracking else "dry-run"
        n = len(self._recorded)
        return f"Phoenix: offline mode ({reason}); {n} test(s) ran without recording."

    def summary_line(self) -> str:
        n = len(self._recorded)
        return f"Phoenix: recorded {n} run(s) across {len(self._groups)} experiment(s)."


def _example_fields(
    item: Optional["Item"],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Derive input/output/metadata for a dataset example from a pytest item.

    Parametrized inputs (``callspec.params``) become the example input; everything else stays
    minimal so authors who want richer examples attach data via the marker / parametrize ids.
    """
    input_payload: dict[str, Any] = {}
    output_payload: dict[str, Any] = {}
    metadata_payload: dict[str, Any] = {}
    if item is not None:
        callspec = getattr(item, "callspec", None)
        if callspec is not None and getattr(callspec, "params", None):
            input_payload = {k: _jsonable(v) for k, v in callspec.params.items()}
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
