# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# Harbor cannot be installed on the client's Python 3.10 and 3.11 CI jobs.
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
# pyright: reportPrivateUsage=false
"""Build one deterministic Phoenix trace from a terminal Harbor trial."""

from __future__ import annotations

import copy
import hashlib
import json
import logging
from collections.abc import Iterator, Mapping, MutableMapping, Sequence
from dataclasses import dataclass
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
from phoenix.client.helpers.atif._reparent import _reparent_spans_under_common_parent

logger = logging.getLogger(__name__)

__all__ = ["AtifArtifact", "HarborTrace", "build_harbor_trace"]

_NAMESPACE = "phoenix.harbor.atif.v1"
_CANONICAL_FILENAME = "trajectory.json"


@dataclass(frozen=True)
class AtifArtifact:
    path: Path
    relative_path: str
    role: Literal["agent", "user-agent"]
    step_name: str | None
    trajectory: Mapping[str, Any]


@dataclass(frozen=True)
class HarborTrace:
    trace_id: str
    spans: tuple[v1.Span, ...]
    source_paths: tuple[str, ...]


@dataclass(frozen=True)
class _RootLocation:
    directory: Path
    role: Literal["agent", "user-agent"]
    step_name: str | None


@dataclass
class _Graph:
    trial_root: Path
    trial_key: str
    warning_prefix: str
    artifacts: list[AtifArtifact]
    trajectories: list[MutableMapping[str, Any]]
    source_paths: list[str]
    unresolved_references: list[str]
    loaded: dict[Path, MutableMapping[str, Any]]
    active: set[Path]

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
    network calls. Invalid roots and references are reported and salvaged.
    """
    trial_name = str(trial_result.trial_name)
    trial_root = Path(trial_result.config.trials_dir) / trial_name
    trial_key = f"{plan.job_id}:{trial_result.id}"
    graph = _Graph(
        trial_root,
        trial_key,
        (
            f"Harbor ATIF job={plan.job_id} trial_id={trial_result.id} "
            f"trial={trial_name} task={slot.task_id} repetition={slot.repetition}"
        ),
        [],
        [],
        [],
        [],
        {},
        set(),
    )

    missing: list[str] = []
    for location in _root_locations(trial_result):
        root_path = location.directory / _CANONICAL_FILENAME
        if not root_path.is_file():
            missing.append(_display_path(root_path, trial_root))
            continue
        _load_file(
            graph,
            path=root_path,
            allowed_directory=location.directory,
            role=location.role,
            step_name=location.step_name,
            document_key="root",
            is_root=True,
        )

    if missing:
        graph.warn(
            f"Harbor ATIF trace has no canonical root at {', '.join(missing)} "
            f"for trial {trial_name!r}; valid role roots, if any, will still be recorded."
        )
    if not graph.trajectories:
        return None

    trace_id = _hex_id(f"{_NAMESPACE}:{trial_key}:trace", length=32)
    root_span_id = _hex_id(f"{_NAMESPACE}:{trial_key}:root", length=16)
    normalized = _normalize_trajectories(graph, trace_id)
    try:
        converted = _convert_atif_trajectories_to_spans(normalized)
        converted = _reparent_spans_under_common_parent(
            converted,
            parent_id=root_span_id,
            trace_id=trace_id,
        )
        root = _trial_root_span(
            plan=plan,
            slot=slot,
            task=task,
            trial_result=trial_result,
            run_output=run_output,
            trace_id=trace_id,
            span_id=root_span_id,
            converted=converted,
            source_paths=graph.source_paths,
            unresolved_references=graph.unresolved_references,
        )
        spans = (root, *converted)
        _validate_span_graph(spans, trace_id=trace_id, root_span_id=root_span_id)
    except Exception as error:
        graph.warn(f"Could not convert Harbor ATIF for trial {trial_name!r}: {error}")
        return None
    return HarborTrace(trace_id=trace_id, spans=spans, source_paths=tuple(graph.source_paths))


def _root_locations(trial_result: TrialResult) -> tuple[_RootLocation, ...]:
    config = trial_result.config
    paths = TrialPaths(Path(config.trials_dir) / str(trial_result.trial_name))
    step_results = trial_result.step_results
    if not step_results:
        locations = [_RootLocation(paths.agent_dir, "agent", None)]
        if config.user_agent is not None and hasattr(paths, "user_agent_dir"):
            locations.append(_RootLocation(paths.user_agent_dir, "user-agent", None))
        return tuple(locations)

    if config.agent.resume_trajectory:
        for step_result in reversed(step_results):
            directory = paths.step_agent_dir(str(step_result.step_name))
            if (directory / _CANONICAL_FILENAME).is_file():
                return (_RootLocation(directory, "agent", str(step_result.step_name)),)
        last = step_results[-1]
        return (
            _RootLocation(paths.step_agent_dir(str(last.step_name)), "agent", str(last.step_name)),
        )

    return tuple(
        _RootLocation(paths.step_agent_dir(str(result.step_name)), "agent", str(result.step_name))
        for result in step_results
    )


def _load_file(
    graph: _Graph,
    *,
    path: Path,
    allowed_directory: Path,
    role: Literal["agent", "user-agent"],
    step_name: str | None,
    document_key: str,
    is_root: bool,
) -> MutableMapping[str, Any] | None:
    try:
        canonical_directory = allowed_directory.resolve(strict=True)
        canonical_path = path.resolve(strict=True)
        canonical_path.relative_to(canonical_directory)
        if not canonical_path.is_file() or canonical_path.suffix.lower() != ".json":
            raise ValueError("reference is not a regular JSON file")
    except (OSError, ValueError) as error:
        graph.warn(f"Rejected Harbor ATIF path {_display_path(path, graph.trial_root)!r}: {error}")
        return None

    if canonical_path in graph.active:
        graph.warn(
            f"Stopped cyclic Harbor ATIF reference at "
            f"{_display_path(canonical_path, graph.trial_root)!r}."
        )
        return None
    if canonical_path in graph.loaded:
        return graph.loaded[canonical_path]

    try:
        validated = Trajectory.model_validate_json(canonical_path.read_text())
        raw = cast(
            MutableMapping[str, Any],
            validated.model_dump(mode="json", exclude_none=True),
        )
    except Exception as error:
        kind = "root" if is_root else "referenced trajectory"
        graph.warn(
            f"Skipped invalid Harbor ATIF {kind} "
            f"{_display_path(canonical_path, graph.trial_root)!r}: {error}"
        )
        return None

    relative_path = _display_path(canonical_path, graph.trial_root)
    graph.artifacts.append(
        AtifArtifact(canonical_path, relative_path, role, step_name, copy.deepcopy(raw))
    )
    graph.source_paths.append(relative_path)
    graph.trajectories.append(raw)
    graph.loaded[canonical_path] = raw
    graph.active.add(canonical_path)

    _walk_embedded(
        graph,
        raw,
        physical_path=canonical_path,
        allowed_directory=canonical_directory,
        role=role,
        step_name=step_name,
        document_key=document_key,
    )
    _walk_external_references(
        graph,
        raw,
        physical_path=canonical_path,
        allowed_directory=canonical_directory,
        role=role,
        step_name=step_name,
        document_key=document_key,
    )
    continuation = raw.get("continued_trajectory_ref")
    if isinstance(continuation, str) and continuation:
        target = _safe_reference_path(
            graph,
            reference=continuation,
            referring_path=canonical_path,
            allowed_directory=canonical_directory,
        )
        child = (
            _load_file(
                graph,
                path=target,
                allowed_directory=canonical_directory,
                role=role,
                step_name=step_name,
                document_key=f"{document_key}:continuation",
                is_root=False,
            )
            if target is not None
            else None
        )
        if child is None:
            raw.pop("continued_trajectory_ref", None)
    graph.active.remove(canonical_path)
    return raw


def _walk_embedded(
    graph: _Graph,
    trajectory: MutableMapping[str, Any],
    *,
    physical_path: Path,
    allowed_directory: Path,
    role: Literal["agent", "user-agent"],
    step_name: str | None,
    document_key: str,
) -> None:
    embedded = trajectory.get("subagent_trajectories")
    if not isinstance(embedded, list):
        return
    for index, child in enumerate(embedded):
        if not isinstance(child, MutableMapping):
            continue
        _walk_embedded(
            graph,
            child,
            physical_path=physical_path,
            allowed_directory=allowed_directory,
            role=role,
            step_name=step_name,
            document_key=f"{document_key}:embedded:{index}",
        )
        _walk_external_references(
            graph,
            child,
            physical_path=physical_path,
            allowed_directory=allowed_directory,
            role=role,
            step_name=step_name,
            document_key=f"{document_key}:embedded:{index}",
        )


def _walk_external_references(
    graph: _Graph,
    trajectory: MutableMapping[str, Any],
    *,
    physical_path: Path,
    allowed_directory: Path,
    role: Literal["agent", "user-agent"],
    step_name: str | None,
    document_key: str,
) -> None:
    for refs in _subagent_reference_lists(trajectory):
        retained: list[Any] = []
        for index, value in enumerate(refs):
            if not isinstance(value, MutableMapping):
                retained.append(value)
                continue
            reference = value.get("trajectory_path")
            if not isinstance(reference, str) or not reference:
                retained.append(value)
                continue
            target = _safe_reference_path(
                graph,
                reference=reference,
                referring_path=physical_path,
                allowed_directory=allowed_directory,
            )
            child = (
                _load_file(
                    graph,
                    path=target,
                    allowed_directory=allowed_directory,
                    role=role,
                    step_name=step_name,
                    document_key=f"{document_key}:external:{index}:{reference}",
                    is_root=False,
                )
                if target is not None
                else None
            )
            if child is None:
                continue
            value["_phoenix_resolved_child"] = child
            retained.append(value)
        refs[:] = retained


def _subagent_reference_lists(trajectory: Mapping[str, Any]) -> Iterator[list[Any]]:
    steps = trajectory.get("steps")
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


def _safe_reference_path(
    graph: _Graph,
    *,
    reference: str,
    referring_path: Path,
    allowed_directory: Path,
) -> Path | None:
    parsed = urlparse(reference)
    if parsed.scheme or parsed.netloc or Path(reference).is_absolute():
        sanitized = _sanitized_reference(reference)
        graph.unresolved_references.append(sanitized)
        graph.warn(f"Rejected non-local Harbor ATIF reference {sanitized!r}.")
        return None
    target = referring_path.parent / reference
    try:
        resolved = target.resolve(strict=True)
        resolved.relative_to(allowed_directory.resolve(strict=True))
    except (OSError, ValueError):
        graph.unresolved_references.append(reference)
        graph.warn(
            f"Rejected Harbor ATIF reference {reference!r} from "
            f"{_display_path(referring_path, graph.trial_root)!r}."
        )
        return None
    return resolved


def _normalize_trajectories(graph: _Graph, trace_id: str) -> list[Mapping[str, Any]]:
    normalized = copy.deepcopy(graph.trajectories)

    def normalize_document(
        document: MutableMapping[str, Any],
        *,
        role: str,
        step_name: str | None,
        relative_path: str,
        index_path: str,
    ) -> None:
        producer_id = document.get("trajectory_id")
        synthetic_id = _trajectory_id(
            graph.trial_key,
            role=role,
            step_name=step_name,
            relative_path=relative_path,
            index_path=index_path,
        )
        document["trajectory_id"] = synthetic_id
        extra = document.setdefault("extra", {})
        if isinstance(extra, MutableMapping) and producer_id:
            extra["phoenix.harbor.producer_trajectory_id"] = producer_id
        session = document.get("session_id")
        if isinstance(session, str) and session:
            document["session_id"] = _session_id(trace_id, session)

        embedded = document.get("subagent_trajectories")
        embedded_ids: dict[str, str] = {}
        if isinstance(embedded, list):
            for index, child in enumerate(embedded):
                if not isinstance(child, MutableMapping):
                    continue
                old_id = child.get("trajectory_id")
                normalize_document(
                    child,
                    role=role,
                    step_name=step_name,
                    relative_path=relative_path,
                    index_path=f"{index_path}.{index}",
                )
                if isinstance(old_id, str):
                    embedded_ids[old_id] = cast(str, child["trajectory_id"])

        for refs in _subagent_reference_lists(document):
            for ref in refs:
                if not isinstance(ref, MutableMapping):
                    continue
                if "_phoenix_resolved_child" not in ref:
                    old_id = ref.get("trajectory_id")
                    if isinstance(old_id, str) and old_id in embedded_ids:
                        ref["trajectory_id"] = embedded_ids[old_id]
                ref_session = ref.get("session_id")
                if isinstance(ref_session, str) and ref_session:
                    ref["session_id"] = _session_id(trace_id, ref_session)

    for artifact, document in zip(graph.artifacts, normalized):
        normalize_document(
            document,
            role=artifact.role,
            step_name=artifact.step_name,
            relative_path=artifact.relative_path,
            index_path="root",
        )

    external_ids = {id(document): cast(str, document["trajectory_id"]) for document in normalized}

    def rewrite_external_refs(document: MutableMapping[str, Any]) -> None:
        for refs in _subagent_reference_lists(document):
            for ref in refs:
                if not isinstance(ref, MutableMapping):
                    continue
                resolved_child = ref.pop("_phoenix_resolved_child", None)
                if isinstance(resolved_child, MutableMapping):
                    child_id = external_ids.get(id(resolved_child))
                    if child_id is not None:
                        ref["trajectory_id"] = child_id
        embedded = document.get("subagent_trajectories")
        if isinstance(embedded, list):
            for child in embedded:
                if isinstance(child, MutableMapping):
                    rewrite_external_refs(child)

    for document in normalized:
        rewrite_external_refs(document)
    return cast(list[Mapping[str, Any]], normalized)


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
    starts = [_parse_span_time(span["start_time"]) for span in converted]
    ends = [_parse_span_time(span["end_time"]) for span in converted]
    fallback = datetime.now(timezone.utc)
    starts.append(trial_result.started_at or fallback)
    ends.append(trial_result.finished_at or trial_result.started_at or fallback)
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
            "metadata": metadata,
        },
    }
    if failures:
        span["status_message"] = "; ".join(failures)
    return span


def _validate_span_graph(spans: Sequence[v1.Span], *, trace_id: str, root_span_id: str) -> None:
    ids = [span["context"]["span_id"] for span in spans]
    if len(ids) != len(set(ids)):
        raise ValueError("converted Harbor ATIF contains duplicate span IDs")
    if "0" * 16 in ids or trace_id == "0" * 32:
        raise ValueError("converted Harbor ATIF contains an invalid all-zero ID")
    id_set = set(ids)
    for span in spans:
        if span["context"]["trace_id"] != trace_id:
            raise ValueError("converted Harbor ATIF contains more than one trace ID")
        if span["context"]["span_id"] == root_span_id:
            continue
        if span.get("parent_id") not in id_set:
            raise ValueError("converted Harbor ATIF contains an unresolved parent span")


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


def _session_id(trace_id: str, producer_session_id: str) -> str:
    return f"harbor:{trace_id}:{producer_session_id}"


def _hex_id(seed: str, *, length: int) -> str:
    value = hashlib.sha256(seed.encode()).hexdigest()[:length]
    if set(value) == {"0"}:
        return "1" + value[1:]
    return value


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
