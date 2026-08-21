"""OpenAI Batch request construction and persisted job synchronization."""

from __future__ import annotations

import io
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Protocol, Sequence

if __package__:
    from scripts.datagen.generation import GenerationError, GenerationRun
else:
    from generation import GenerationError, GenerationRun  # type: ignore[import-not-found,no-redef]

BATCH_COMPLETION_WINDOW = "24h"
BATCH_ENDPOINTS = frozenset({"/v1/responses", "/v1/chat/completions"})
BATCH_STATUSES = frozenset(
    {
        "validating",
        "failed",
        "in_progress",
        "finalizing",
        "completed",
        "expired",
        "cancelling",
        "cancelled",
    }
)
BATCH_TERMINAL_STATUSES = frozenset({"failed", "completed", "expired", "cancelled"})
BATCH_MAX_REQUESTS = 50_000
BATCH_MAX_BYTES = 200 * 1024 * 1024


class _FilesClient(Protocol):
    def create(self, *, file: Any, purpose: str) -> Any: ...

    def content(self, file_id: str) -> Any: ...


class _BatchesClient(Protocol):
    def create(self, *, input_file_id: str, endpoint: str, completion_window: str) -> Any: ...

    def retrieve(self, batch_id: str) -> Any: ...


class BatchClient(Protocol):
    files: _FilesClient
    batches: _BatchesClient


@dataclass(frozen=True)
class BatchRequest:
    custom_id: str
    body: Mapping[str, Any]
    endpoint: str = "/v1/responses"

    def to_dict(self) -> dict[str, Any]:
        if self.endpoint not in BATCH_ENDPOINTS:
            raise GenerationError(f"Unsupported Batch endpoint {self.endpoint!r}")
        if not self.custom_id or self.custom_id.count(":") != 2:
            raise GenerationError("Batch custom_id must be '<run-id>:<cell-id>:<purpose>'")
        return {
            "custom_id": self.custom_id,
            "method": "POST",
            "url": self.endpoint,
            "body": dict(self.body),
        }


@dataclass(frozen=True)
class BatchResult:
    custom_id: str
    response_status_code: int | None
    request_id: str | None
    body: Mapping[str, Any] | None
    error: Mapping[str, Any] | None

    @property
    def succeeded(self) -> bool:
        return (
            self.error is None
            and self.response_status_code is not None
            and (200 <= self.response_status_code < 300)
        )


def custom_id(run_id: str, cell_id: str, purpose: str) -> str:
    if (
        not run_id
        or not cell_id
        or not purpose
        or any(":" in part for part in (run_id, cell_id, purpose))
    ):
        raise GenerationError("custom_id components must be non-empty and must not contain ':'")
    return f"{run_id}:{cell_id}:{purpose}"


def encode_requests(requests: Sequence[BatchRequest]) -> bytes:
    if not requests:
        raise GenerationError("Batch submission requires at least one request")
    if len(requests) > BATCH_MAX_REQUESTS:
        raise GenerationError(f"Batch submission exceeds {BATCH_MAX_REQUESTS} requests")
    endpoints = {request.endpoint for request in requests}
    if len(endpoints) != 1:
        raise GenerationError("A Batch submission cannot mix endpoints")
    identifiers = [request.custom_id for request in requests]
    if len(set(identifiers)) != len(identifiers):
        raise GenerationError("Batch custom_id values must be unique within a batch")
    content = b"".join(
        json.dumps(request.to_dict(), sort_keys=True, separators=(",", ":")).encode() + b"\n"
        for request in requests
    )
    if len(content) > BATCH_MAX_BYTES:
        raise GenerationError(f"Batch input exceeds {BATCH_MAX_BYTES} bytes")
    return content


class OpenAIBatchAdapter:
    def __init__(self, client: BatchClient, run: GenerationRun) -> None:
        self._client = client
        self._run = run

    def submit(self, requests: Sequence[BatchRequest]) -> Mapping[str, Any]:
        content = encode_requests(requests)
        endpoint = requests[0].endpoint
        upload = io.BytesIO(content)
        upload.name = "batch.jsonl"
        input_file = _as_mapping(self._client.files.create(file=upload, purpose="batch"))
        input_file_id = _required_string(input_file, "id")
        batch = _as_mapping(
            self._client.batches.create(
                input_file_id=input_file_id,
                endpoint=endpoint,
                completion_window=BATCH_COMPLETION_WINDOW,
            )
        )
        job = self._job_record(
            batch,
            input_file_id=input_file_id,
            endpoint=endpoint,
            custom_ids=[request.custom_id for request in requests],
        )
        self._run.record_job(job)
        return job

    def refresh(self, batch_id: str) -> Mapping[str, Any]:
        current = self._run.latest_jobs.get(batch_id)
        if current is None:
            raise GenerationError(f"Unknown persisted Batch job {batch_id}")
        batch = _as_mapping(self._client.batches.retrieve(batch_id))
        job = self._job_record(
            batch,
            input_file_id=_required_string(current, "input_file_id"),
            endpoint=_required_string(current, "endpoint"),
            custom_ids=_required_strings(current, "custom_ids"),
        )
        self._run.record_job(job)
        return job

    def results(self, batch_id: str) -> tuple[BatchResult, ...]:
        job = self._run.latest_jobs.get(batch_id)
        if job is None:
            raise GenerationError(f"Unknown persisted Batch job {batch_id}")
        rows: list[BatchResult] = []
        for key in ("output_file_id", "error_file_id"):
            file_id = job.get(key)
            if isinstance(file_id, str) and file_id:
                rows.extend(_decode_result_file(self._client.files.content(file_id), file_id))
        expected = set(_required_strings(job, "custom_ids"))
        unknown = sorted(result.custom_id for result in rows if result.custom_id not in expected)
        if unknown:
            raise GenerationError(f"Batch result contains unknown custom_id values: {unknown!r}")
        duplicates = {
            result.custom_id
            for result in rows
            if sum(r.custom_id == result.custom_id for r in rows) > 1
        }
        if duplicates:
            raise GenerationError(
                f"Batch result contains duplicate custom_id values: {sorted(duplicates)!r}"
            )
        for result in rows:
            self._run.record_job_result(
                batch_id,
                {
                    "custom_id": result.custom_id,
                    "response_status_code": result.response_status_code,
                    "request_id": result.request_id,
                    "body": result.body,
                    "error": result.error,
                },
            )
        return tuple(rows)

    def _job_record(
        self,
        batch: Mapping[str, Any],
        *,
        input_file_id: str,
        endpoint: str,
        custom_ids: Sequence[str],
    ) -> dict[str, Any]:
        status = _required_string(batch, "status")
        if status not in BATCH_STATUSES:
            raise GenerationError(f"Provider returned unknown Batch status {status!r}")
        completion_window = batch.get("completion_window", BATCH_COMPLETION_WINDOW)
        if completion_window != BATCH_COMPLETION_WINDOW:
            raise GenerationError(
                f"Provider returned unsupported completion window {completion_window!r}"
            )
        record = {
            "batch_id": _required_string(batch, "id"),
            "status": status,
            "input_file_id": input_file_id,
            "endpoint": endpoint,
            "completion_window": completion_window,
            "custom_ids": list(custom_ids),
            "request_counts": _optional_mapping(batch.get("request_counts")),
            "output_file_id": batch.get("output_file_id"),
            "error_file_id": batch.get("error_file_id"),
            "created_at": batch.get("created_at"),
            "in_progress_at": batch.get("in_progress_at"),
            "finalizing_at": batch.get("finalizing_at"),
            "completed_at": batch.get("completed_at"),
            "failed_at": batch.get("failed_at"),
            "expired_at": batch.get("expired_at"),
            "cancelling_at": batch.get("cancelling_at"),
            "cancelled_at": batch.get("cancelled_at"),
        }
        return record


def parse_result_row(value: Mapping[str, Any]) -> BatchResult:
    identifier = _required_string(value, "custom_id")
    raw_response = value.get("response")
    raw_error = value.get("error")
    response = raw_response if isinstance(raw_response, Mapping) else None
    error = raw_error if isinstance(raw_error, Mapping) else None
    if response is None and error is None:
        raise GenerationError(f"Batch result {identifier!r} has neither response nor error")
    status_code = response.get("status_code") if response else None
    if status_code is not None and not isinstance(status_code, int):
        raise GenerationError(f"Batch result {identifier!r} has invalid response.status_code")
    request_id = response.get("request_id") if response else None
    if request_id is not None and not isinstance(request_id, str):
        raise GenerationError(f"Batch result {identifier!r} has invalid response.request_id")
    body = response.get("body") if response else None
    if body is not None and not isinstance(body, Mapping):
        raise GenerationError(f"Batch result {identifier!r} has invalid response.body")
    return BatchResult(
        custom_id=identifier,
        response_status_code=status_code,
        request_id=request_id,
        body=body,
        error=error,
    )


def usage_from_body(body: Mapping[str, Any]) -> tuple[int, int, int]:
    usage = body.get("usage")
    if not isinstance(usage, Mapping):
        raise GenerationError("Batch response body has no usage object")
    input_tokens = usage.get("input_tokens", usage.get("prompt_tokens"))
    output_tokens = usage.get("output_tokens", usage.get("completion_tokens"))
    details = usage.get("input_tokens_details", usage.get("prompt_tokens_details", {}))
    cached = details.get("cached_tokens", 0) if isinstance(details, Mapping) else 0
    if not all(
        isinstance(value, int) and value >= 0 for value in (input_tokens, output_tokens, cached)
    ):
        raise GenerationError("Batch response body has invalid token usage")
    return input_tokens, cached, output_tokens


def save_input_file(path: Path, requests: Sequence[BatchRequest]) -> None:
    content = encode_requests(requests)
    if path.exists() and path.read_bytes() != content:
        raise GenerationError(f"Persisted Batch input changed: {path}")
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def _decode_result_file(content: Any, file_id: str) -> Iterable[BatchResult]:
    if isinstance(content, bytes):
        encoded = content
    elif isinstance(content, str):
        encoded = content.encode()
    elif hasattr(content, "read"):
        encoded = content.read()
        if isinstance(encoded, str):
            encoded = encoded.encode()
    elif hasattr(content, "content"):
        encoded = content.content
    elif hasattr(content, "text"):
        encoded = content.text.encode()
    else:
        raise GenerationError(f"Unable to read Batch result file {file_id}")
    try:
        text = encoded.decode("utf-8")
    except (AttributeError, UnicodeDecodeError) as error:
        raise GenerationError(f"Batch result file {file_id} is not UTF-8") from error
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise GenerationError(
                f"Invalid JSON in Batch result file {file_id} at line {line_number}"
            ) from error
        if not isinstance(value, dict):
            raise GenerationError(
                f"Expected object in Batch result file {file_id} at line {line_number}"
            )
        yield parse_result_row(value)


def _as_mapping(value: Any) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    if hasattr(value, "model_dump"):
        dumped = value.model_dump(mode="json")
        if isinstance(dumped, Mapping):
            return dumped
    keys = (
        "id",
        "status",
        "completion_window",
        "request_counts",
        "output_file_id",
        "error_file_id",
        "created_at",
        "in_progress_at",
        "finalizing_at",
        "completed_at",
        "failed_at",
        "expired_at",
        "cancelling_at",
        "cancelled_at",
    )
    mapped = {key: getattr(value, key) for key in keys if hasattr(value, key)}
    if mapped:
        return mapped
    raise GenerationError(f"Provider returned unsupported object {type(value).__name__}")


def _required_string(value: Mapping[str, Any], key: str) -> str:
    item = value.get(key)
    if not isinstance(item, str) or not item:
        raise GenerationError(f"Provider response field {key!r} must be a non-empty string")
    return item


def _required_strings(value: Mapping[str, Any], key: str) -> tuple[str, ...]:
    item = value.get(key)
    if not isinstance(item, list) or any(not isinstance(element, str) for element in item):
        raise GenerationError(f"Provider job field {key!r} must be an array of strings")
    return tuple(item)


def _optional_mapping(value: Any) -> Mapping[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "model_dump"):
        dumped = value.model_dump(mode="json")
        if isinstance(dumped, Mapping):
            return dict(dumped)
    return {
        key: getattr(value, key) for key in ("total", "completed", "failed") if hasattr(value, key)
    }
