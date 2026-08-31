# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
# pyright: reportPrivateUsage=false
"""Build one deterministic Phoenix trace from a terminal Harbor trial."""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Iterator, Mapping, MutableMapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, cast
from urllib.parse import urlparse

from harbor.models.trajectories.trajectory import Trajectory
from harbor.models.trial.paths import TrialPaths
from harbor.models.trial.result import TrialResult

from phoenix.client.__generated__ import v1
from phoenix.client.harbor._model import JobPlan, TaskRecord, TrialSlot
from phoenix.client.harbor._scores import infrastructure_failures
from phoenix.client.helpers.atif import _convert_atif_trajectories_to_spans
from phoenix.client.helpers.atif._convert import (
    _CONTINUATION_INDEX_KEY,
    _FALLBACK_TIMESTAMP_KEY,
    _IS_CONTINUATION_KEY,
    _LLM_LATENCY_MS_KEY,
    _LLM_LATENCY_SOURCE_KEY,
    _STEP_NAME_KEY,
)
from phoenix.client.helpers.atif._reparent import _reparent_spans_under_common_parent

logger = logging.getLogger(__name__)

__all__ = ["HarborTrace", "build_harbor_trace", "harbor_trace_id"]

_NAMESPACE = "phoenix.harbor.atif.v1"
_CANONICAL_FILENAME = "trajectory.json"
_PRODUCER_TRAJECTORY_ID_KEY = "phoenix.harbor.producer_trajectory_id"
_PRODUCER_SESSION_ID_KEY = "phoenix.harbor.producer_session_id"

_Role = Literal["agent", "user-agent"]


@dataclass(frozen=True)
class HarborTrace:
    trace_id: str
    spans: tuple[v1.Span, ...]
    source_paths: tuple[str, ...]


@dataclass(frozen=True)
class _RootLocation:
    directory: Path
    role: _Role
    step_name: str | None


@dataclass
class _Loader:
    """Loaded ATIF documents for one trial, in discovery order."""

    trial_root: Path
    trial_key: str
    trace_id: str
    warning_prefix: str
    documents: dict[Path, MutableMapping[str, Any]] = field(default_factory=dict)
    unresolved_references: list[str] = field(default_factory=list)
    active: set[Path] = field(default_factory=set)

    @property
    def source_paths(self) -> list[str]:
        return [_display_path(path, self.trial_root) for path in self.documents]

    def warn(self, message: str) -> None:
        logger.warning("%s: %s", self.warning_prefix, message)


def build_harbor_trace(
    *,
    plan: JobPlan,
    slot: TrialSlot,
    task: TaskRecord,
    trial_result: TrialResult,
    run_output: Mapping[str, Any],
) -> HarborTrace | None:
    """Discover and convert the valid ATIF graph for one terminal trial.

    The function reads only Harbor-owned role directories and performs no
    network calls. Invalid roots and references are reported and skipped.
    """
    trial_name = str(trial_result.trial_name)
    trial_key = _trial_key(plan, trial_result)
    loader = _Loader(
        trial_root=Path(trial_result.config.trials_dir) / trial_name,
        trial_key=trial_key,
        trace_id=harbor_trace_id(plan, trial_result),
        warning_prefix=(
            f"Harbor ATIF job={plan.job_id} trial_id={trial_result.id} "
            f"trial={trial_name} task={slot.task_id} repetition={slot.repetition}"
        ),
    )

    missing: list[str] = []
    for location in _root_locations(trial_result):
        root_path = location.directory / _CANONICAL_FILENAME
        if not root_path.is_file():
            missing.append(_display_path(root_path, loader.trial_root))
            continue
        documents_before = set(loader.documents)
        document = _load_file(
            loader,
            path=root_path,
            allowed_directory=location.directory.resolve(),
            role=location.role,
            step_name=location.step_name,
            fallback_timestamp=_agent_execution_finished_at(
                trial_result,
                location.step_name,
            ),
        )
        if document is not None:
            loaded_documents = [
                loaded for path, loaded in loader.documents.items() if path not in documents_before
            ]
            _apply_request_times(
                loaded_documents or [document],
                (
                    _agent_context(trial_result, location.step_name)
                    if location.role == "agent"
                    else None
                ),
            )

    if missing:
        loader.warn(
            f"Harbor ATIF trace has no canonical root at {', '.join(missing)} "
            f"for trial {trial_name!r}; valid role roots, if any, will still be recorded."
        )
    if not loader.documents:
        return None

    root_span_id = _hex_id(f"{_NAMESPACE}:{trial_key}:root", length=16)
    try:
        converted = _reparent_spans_under_common_parent(
            _convert_atif_trajectories_to_spans(list(loader.documents.values())),
            parent_id=root_span_id,
            trace_id=loader.trace_id,
        )
        root = _trial_root_span(
            plan=plan,
            slot=slot,
            task=task,
            trial_result=trial_result,
            run_output=run_output,
            trace_id=loader.trace_id,
            span_id=root_span_id,
            converted=converted,
            source_paths=loader.source_paths,
            unresolved_references=loader.unresolved_references,
        )
    except Exception as error:
        loader.warn(f"Could not convert Harbor ATIF for trial {trial_name!r}: {error}")
        return None
    return HarborTrace(
        trace_id=loader.trace_id,
        spans=(root, *converted),
        source_paths=tuple(loader.source_paths),
    )


def harbor_trace_id(plan: JobPlan, trial_result: TrialResult) -> str:
    """Return the deterministic Phoenix trace ID for a Harbor trial."""
    return _hex_id(f"{_NAMESPACE}:{_trial_key(plan, trial_result)}:trace", length=32)


def _root_locations(trial_result: TrialResult) -> tuple[_RootLocation, ...]:
    config = trial_result.config
    paths = TrialPaths(Path(config.trials_dir) / str(trial_result.trial_name))
    step_results = trial_result.step_results
    if not step_results:
        locations = [_RootLocation(paths.agent_dir, "agent", None)]
        if getattr(config, "user_agent", None) is not None and hasattr(paths, "user_agent_dir"):
            locations.append(_RootLocation(paths.user_agent_dir, "user-agent", None))
        return tuple(locations)

    step_names = [str(step_result.step_name) for step_result in step_results]
    if config.agent.resume_trajectory:
        step_names = [
            next(
                (
                    name
                    for name in reversed(step_names)
                    if (paths.step_agent_dir(name) / _CANONICAL_FILENAME).is_file()
                ),
                step_names[-1],
            )
        ]
    return tuple(_RootLocation(paths.step_agent_dir(name), "agent", name) for name in step_names)


def _step_result(trial_result: TrialResult, step_name: str | None) -> Any:
    if step_name is None:
        return None
    for step_result in trial_result.step_results or ():
        if str(step_result.step_name) == step_name:
            return step_result
    return None


def _agent_context(trial_result: TrialResult, step_name: str | None) -> Any:
    step_result = _step_result(trial_result, step_name)
    if step_result is not None:
        return getattr(step_result, "agent_result", None)
    return getattr(trial_result, "agent_result", None)


def _agent_execution_finished_at(
    trial_result: TrialResult,
    step_name: str | None,
) -> datetime | None:
    step_result = _step_result(trial_result, step_name)
    execution = (
        getattr(step_result, "agent_execution", None)
        if step_result is not None
        else getattr(trial_result, "agent_execution", None)
    )
    finished_at = getattr(execution, "finished_at", None)
    if isinstance(finished_at, datetime):
        return finished_at
    trial_finished_at = getattr(trial_result, "finished_at", None)
    return trial_finished_at if isinstance(trial_finished_at, datetime) else None


def _documents_with_embedded_subagents(
    documents: Sequence[MutableMapping[str, Any]],
) -> list[MutableMapping[str, Any]]:
    expanded: list[MutableMapping[str, Any]] = []

    def visit(document: MutableMapping[str, Any]) -> None:
        expanded.append(document)
        for child in _embedded_subagents(document):
            visit(child)

    for document in documents:
        visit(document)
    return expanded


def _request_timed_llm_steps(
    documents: Sequence[MutableMapping[str, Any]],
) -> list[MutableMapping[str, Any]] | None:
    """Return fresh LLM steps in a defensible request order.

    Step order is authoritative within one document. Across continuation or
    subagent documents, timestamps are required so their events can be merged
    chronologically without guessing how the producer interleaved them.
    """
    expanded = _documents_with_embedded_subagents(documents)
    candidates: list[tuple[int, int, MutableMapping[str, Any]]] = []
    for document_index, document in enumerate(expanded):
        for step_index, step in enumerate(document.get("steps", [])):
            if (
                isinstance(step, MutableMapping)
                and step.get("source") == "agent"
                and not step.get("is_copied_context", False)
                and step.get("llm_call_count") != 0
            ):
                candidates.append((document_index, step_index, step))

    if len(expanded) == 1:
        return [step for _, _, step in candidates]

    timed_candidates: list[tuple[datetime, int, int, MutableMapping[str, Any]]] = []
    for document_index, step_index, step in candidates:
        raw_timestamp = step.get("timestamp")
        if not isinstance(raw_timestamp, str):
            return None
        try:
            timestamp = datetime.fromisoformat(raw_timestamp.replace("Z", "+00:00"))
        except ValueError:
            return None
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        timed_candidates.append((timestamp, document_index, step_index, step))
    timed_candidates.sort(key=lambda item: item[:3])
    return [step for _, _, _, step in timed_candidates]


def _apply_request_times(documents: Sequence[MutableMapping[str, Any]], agent_context: Any) -> None:
    """Copy Harbor's per-request measurements into matching ATIF LLM steps.

    Some Harbor agents record request latency on ``AgentContext`` but omit it
    from ATIF. Enrichment is all-or-nothing so a partial or aggregated list can
    never be shifted onto the wrong steps. Phoenix-private fields keep this
    Harbor convention out of the general ATIF schema.
    """
    context_metadata = getattr(agent_context, "metadata", None)
    if not isinstance(context_metadata, Mapping):
        return
    request_times = context_metadata.get("api_request_times_msec")
    if not isinstance(request_times, Sequence) or isinstance(request_times, (str, bytes)):
        return
    if not all(
        isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0
        for value in request_times
    ):
        return

    llm_steps = _request_timed_llm_steps(documents)
    if llm_steps is None or len(llm_steps) != len(request_times):
        return
    for step, latency_ms in zip(llm_steps, request_times):
        step[_LLM_LATENCY_MS_KEY] = latency_ms
        step[_LLM_LATENCY_SOURCE_KEY] = "harbor.api_request_times_msec"


def _load_file(
    loader: _Loader,
    *,
    path: Path,
    allowed_directory: Path,
    role: _Role,
    step_name: str | None,
    fallback_timestamp: datetime | None,
    reference: str | None = None,
    continuation_index: int = 0,
) -> MutableMapping[str, Any] | None:
    """Load, validate, and normalize one ATIF file and everything it references.

    ``allowed_directory`` must already be canonical. ``reference`` is the raw
    reference string when this file was reached through one, so rejected
    references can be reported on the trial root span.
    """
    try:
        canonical_path = path.resolve(strict=True)
        canonical_path.relative_to(allowed_directory)
        if not canonical_path.is_file() or canonical_path.suffix.lower() != ".json":
            raise ValueError("reference is not a regular JSON file")
    except (OSError, ValueError) as error:
        if reference is not None:
            loader.unresolved_references.append(reference)
        loader.warn(
            f"Rejected Harbor ATIF path {_display_path(path, loader.trial_root)!r}: {error}"
        )
        return None

    if canonical_path in loader.active:
        loader.warn(
            f"Stopped cyclic Harbor ATIF reference at "
            f"{_display_path(canonical_path, loader.trial_root)!r}."
        )
        return None
    if canonical_path in loader.documents:
        return loader.documents[canonical_path]

    try:
        validated = Trajectory.model_validate_json(canonical_path.read_text())
        document = cast(
            MutableMapping[str, Any],
            validated.model_dump(mode="json", exclude_none=True),
        )
    except Exception as error:
        kind = "referenced trajectory" if reference is not None else "root"
        loader.warn(
            f"Skipped invalid Harbor ATIF {kind} "
            f"{_display_path(canonical_path, loader.trial_root)!r}: {error}"
        )
        return None

    loader.documents[canonical_path] = document
    loader.active.add(canonical_path)
    try:
        _normalize_document(
            loader,
            document,
            role=role,
            step_name=step_name,
            relative_path=_display_path(canonical_path, loader.trial_root),
            index_path="root",
            fallback_timestamp=fallback_timestamp,
        )
        if continuation_index > 0:
            document[_IS_CONTINUATION_KEY] = True
            document[_CONTINUATION_INDEX_KEY] = continuation_index
        if step_name is not None and (reference is None or continuation_index > 0):
            # Qualify only canonical role roots and their continuations; nested
            # subagent documents keep their producer identity unqualified.
            document[_STEP_NAME_KEY] = step_name
        _resolve_file_references(
            loader,
            document,
            physical_path=canonical_path,
            allowed_directory=allowed_directory,
            role=role,
            step_name=step_name,
            fallback_timestamp=fallback_timestamp,
        )
        continuation = document.get("continued_trajectory_ref")
        if isinstance(continuation, str) and continuation:
            target = _local_reference(loader, reference=continuation, referring_path=canonical_path)
            if target is not None:
                _load_file(
                    loader,
                    path=target,
                    allowed_directory=allowed_directory,
                    role=role,
                    step_name=step_name,
                    fallback_timestamp=fallback_timestamp,
                    reference=continuation,
                    continuation_index=continuation_index + 1,
                )
    finally:
        loader.active.discard(canonical_path)
    return document


def _normalize_document(
    loader: _Loader,
    document: MutableMapping[str, Any],
    *,
    role: _Role,
    step_name: str | None,
    relative_path: str,
    index_path: str,
    fallback_timestamp: datetime | None,
) -> None:
    """Give a document and its embedded subagents trial-scoped identities.

    Producer IDs move into agent metadata, which the converter writes onto the
    trajectory's root span. Embedded references are rewritten to the new IDs.
    """
    producer_trajectory_id = document.get("trajectory_id")
    producer_session_id = document.get("session_id")
    document["trajectory_id"] = _trajectory_id(
        loader.trial_key,
        role=role,
        step_name=step_name,
        relative_path=relative_path,
        index_path=index_path,
    )
    document["session_id"] = _session_id(loader.trace_id)
    if fallback_timestamp is not None:
        document[_FALLBACK_TIMESTAMP_KEY] = fallback_timestamp.isoformat()
    agent = document.get("agent")
    if isinstance(agent, MutableMapping):
        extra = agent.setdefault("extra", {})
        if isinstance(extra, MutableMapping):
            if producer_trajectory_id:
                extra[_PRODUCER_TRAJECTORY_ID_KEY] = producer_trajectory_id
            if producer_session_id:
                extra[_PRODUCER_SESSION_ID_KEY] = producer_session_id

    embedded_ids: dict[str, str] = {}
    for index, child in enumerate(_embedded_subagents(document)):
        producer_child_id = child.get("trajectory_id")
        _normalize_document(
            loader,
            child,
            role=role,
            step_name=step_name,
            relative_path=relative_path,
            index_path=f"{index_path}.{index}",
            fallback_timestamp=fallback_timestamp,
        )
        if isinstance(producer_child_id, str):
            embedded_ids[producer_child_id] = cast(str, child["trajectory_id"])

    for ref in _subagent_references(document):
        producer_ref_id = ref.get("trajectory_id")
        if isinstance(producer_ref_id, str) and producer_ref_id in embedded_ids:
            ref["trajectory_id"] = embedded_ids[producer_ref_id]
        # Every retained child gets a unique normalized trajectory ID. Keeping
        # a trial-wide session ID on a pre-v1.7 reference would turn it into an
        # ambiguous fallback key that could attach another document here.
        ref.pop("session_id", None)


def _resolve_file_references(
    loader: _Loader,
    document: MutableMapping[str, Any],
    *,
    physical_path: Path,
    allowed_directory: Path,
    role: _Role,
    step_name: str | None,
    fallback_timestamp: datetime | None,
) -> None:
    """Load ``trajectory_path`` references and point them at the loaded IDs.

    The rejected path of a reference that cannot be loaded is reported on the
    trial root span. The reference itself stays only when it still names a
    ``trajectory_id`` (an embedded child, for example); the converter rejects
    path-only references.
    """
    for child in _embedded_subagents(document):
        _resolve_file_references(
            loader,
            child,
            physical_path=physical_path,
            allowed_directory=allowed_directory,
            role=role,
            step_name=step_name,
            fallback_timestamp=fallback_timestamp,
        )
    for refs in _subagent_reference_lists(document):
        retained: list[Any] = []
        for ref in refs:
            reference = ref.get("trajectory_path") if isinstance(ref, MutableMapping) else None
            if isinstance(ref, MutableMapping) and isinstance(reference, str) and reference:
                target = _local_reference(loader, reference=reference, referring_path=physical_path)
                loaded_child = (
                    _load_file(
                        loader,
                        path=target,
                        allowed_directory=allowed_directory,
                        role=role,
                        step_name=step_name,
                        fallback_timestamp=fallback_timestamp,
                        reference=reference,
                    )
                    if target is not None
                    else None
                )
                if loaded_child is not None:
                    ref["trajectory_id"] = loaded_child["trajectory_id"]
                elif not ref.get("trajectory_id"):
                    continue
            retained.append(ref)
        refs[:] = retained


def _embedded_subagents(document: Mapping[str, Any]) -> Iterator[MutableMapping[str, Any]]:
    embedded = document.get("subagent_trajectories")
    if not isinstance(embedded, list):
        return
    for child in embedded:
        if isinstance(child, MutableMapping):
            yield child


def _subagent_reference_lists(document: Mapping[str, Any]) -> Iterator[list[Any]]:
    steps = document.get("steps")
    if not isinstance(steps, Sequence):
        return
    for step in steps:
        if not isinstance(step, Mapping):
            continue
        observation = step.get("observation")
        if not isinstance(observation, Mapping):
            continue
        results = observation.get("results")
        if not isinstance(results, Sequence):
            continue
        for result in results:
            if not isinstance(result, Mapping):
                continue
            refs = result.get("subagent_trajectory_ref")
            if isinstance(refs, list):
                yield refs


def _subagent_references(document: Mapping[str, Any]) -> Iterator[MutableMapping[str, Any]]:
    for refs in _subagent_reference_lists(document):
        for ref in refs:
            if isinstance(ref, MutableMapping):
                yield ref


def _local_reference(loader: _Loader, *, reference: str, referring_path: Path) -> Path | None:
    """Return the on-disk target of a relative reference, or None for non-local ones.

    Containment inside the role directory is enforced when the target loads.
    """
    parsed = urlparse(reference)
    if parsed.scheme or parsed.netloc or Path(reference).is_absolute():
        sanitized = _sanitized_reference(reference)
        loader.unresolved_references.append(sanitized)
        loader.warn(f"Rejected non-local Harbor ATIF reference {sanitized!r}.")
        return None
    return referring_path.parent / reference


def _trial_root_span(
    *,
    plan: JobPlan,
    slot: TrialSlot,
    task: TaskRecord,
    trial_result: TrialResult,
    run_output: Mapping[str, Any],
    trace_id: str,
    span_id: str,
    converted: Sequence[v1.Span],
    source_paths: Sequence[str],
    unresolved_references: Sequence[str],
) -> v1.Span:
    started_at = trial_result.started_at
    finished_at = trial_result.finished_at
    if started_at is None or finished_at is None:
        raise ValueError("Harbor trial has no complete start and end timestamps")
    starts = [started_at, *(_parse_span_time(span["start_time"]) for span in converted)]
    ends = [finished_at, *(_parse_span_time(span["end_time"]) for span in converted)]
    failures = infrastructure_failures(trial_result)
    metadata: dict[str, Any] = {
        "integration": "harbor",
        "harbor_job_id": plan.job_id,
        "harbor_trial_id": str(trial_result.id),
        "harbor_trial_name": str(trial_result.trial_name),
        "harbor_task_id": slot.task_id,
        "harbor_repetition": slot.repetition,
        "atif_source_paths": list(source_paths),
    }
    if unresolved_references:
        metadata["atif_unresolved_references"] = list(unresolved_references)
    span: v1.Span = {
        "name": "harbor.trial",
        "context": {"trace_id": trace_id, "span_id": span_id},
        "span_kind": "CHAIN",
        "start_time": min(starts).isoformat(),
        "end_time": max(ends).isoformat(),
        "status_code": "ERROR" if failures else "OK",
        "attributes": {
            "openinference.span.kind": "CHAIN",
            "input.value": json.dumps(task.to_example()["input"]),
            "input.mime_type": "application/json",
            "output.value": json.dumps(dict(run_output)),
            "output.mime_type": "application/json",
            "session.id": _session_id(trace_id),
            "metadata": metadata,
        },
    }
    if failures:
        span["status_message"] = "; ".join(failures)
    return span


def _trajectory_id(
    trial_key: str,
    *,
    role: str,
    step_name: str | None,
    relative_path: str,
    index_path: str,
) -> str:
    seed = ":".join((_NAMESPACE, trial_key, role, step_name or "single", relative_path, index_path))
    return f"harbor-{hashlib.sha256(seed.encode()).hexdigest()}"


def _trial_key(plan: JobPlan, trial_result: TrialResult) -> str:
    return f"{plan.job_id}:{trial_result.id}"


def _session_id(trace_id: str) -> str:
    """One Phoenix session per trial; producer sessions are kept in agent metadata."""
    return f"harbor:{trace_id}"


def _hex_id(seed: str, *, length: int) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()[:length]


def _display_path(path: Path, trial_root: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(trial_root.resolve(strict=False)).as_posix()
    except ValueError:
        return path.name


def _sanitized_reference(reference: str) -> str:
    parsed = urlparse(reference)
    if parsed.scheme:
        host = parsed.hostname or "external"
        return f"{parsed.scheme}://{host}"
    return reference


def _parse_span_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
