"""Structured Codex CLI execution for offline datagen."""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence, cast

if __package__:
    from scripts.datagen.model_backend import (
        BackendCapabilities,
        ModelBackendError,
        ModelRequest,
        ModelResult,
        ProviderUsage,
        provider_usage,
    )
else:
    from model_backend import (  # type: ignore[import-not-found,no-redef]
        BackendCapabilities,
        ModelBackendError,
        ModelRequest,
        ModelResult,
        ProviderUsage,
        provider_usage,
    )

RunProcess = Callable[..., Any]


class CodexExecBackend:
    provider = "codex_exec"
    capabilities = BackendCapabilities()

    def __init__(self, *, executable: str = "codex", run_process: RunProcess = subprocess.run) -> None:
        self._executable = executable
        self._run_process = run_process

    def generate(self, request: ModelRequest) -> ModelResult:
        with tempfile.TemporaryDirectory(prefix="phoenix-datagen-codex-") as directory:
            root = Path(directory)
            schema_path = root / "schema.json"
            result_path = root / "result.json"
            schema_path.write_text(
                json.dumps(request.output_schema, sort_keys=True, separators=(",", ":")),
                encoding="utf-8",
            )
            argv = self._argv(request, root, schema_path, result_path)
            completed = self._run_process(
                argv,
                input=request.prompt.encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            stdout = _decode(completed.stdout)
            stderr = _decode(completed.stderr)
            events = _events(stdout)
            provider_run_id, usage = _terminal(events)
            if completed.returncode != 0:
                raise ModelBackendError(
                    f"codex exec exited with status {completed.returncode}: {stderr.strip()}"
                )
            try:
                output = json.loads(result_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                raise ModelBackendError("codex exec did not write a valid final JSON object") from error
            if not isinstance(output, Mapping):
                raise ModelBackendError("codex exec final output must be a JSON object")
            return ModelResult(
                provider=self.provider,
                model=request.model,
                output=output,
                usage=usage,
                provider_run_id=provider_run_id,
                metadata={
                    "request_id": request.request_id,
                    "event_count": len(events),
                    "stderr": stderr,
                },
            )

    def _argv(
        self, request: ModelRequest, root: Path, schema_path: Path, result_path: Path
    ) -> list[str]:
        return [
            self._executable,
            "exec",
            "--ephemeral",
            "--ignore-user-config",
            "--ignore-rules",
            "--sandbox",
            "read-only",
            "--skip-git-repo-check",
            "--cd",
            str(root),
            "--model",
            request.model,
            "--output-schema",
            str(schema_path),
            "--output-last-message",
            str(result_path),
            "--json",
            "-",
        ]


def _decode(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value if isinstance(value, str) else ""


def _events(stdout: str) -> tuple[Mapping[str, Any], ...]:
    events = []
    for line_number, line in enumerate(stdout.splitlines(), start=1):
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ModelBackendError(f"invalid codex JSONL event at line {line_number}") from error
        if not isinstance(value, Mapping):
            raise ModelBackendError(f"codex JSONL event at line {line_number} must be an object")
        events.append(value)
    if not events:
        raise ModelBackendError("codex exec produced no JSONL events")
    return tuple(events)


def _terminal(events: Sequence[Mapping[str, Any]]) -> tuple[str | None, ProviderUsage | None]:
    thread_id = None
    usage = None
    completed = False
    for event in events:
        event_type = event.get("type")
        if event_type == "thread.started" and isinstance(event.get("thread_id"), str):
            thread_id = cast(str, event["thread_id"])
        if event_type in {"turn.failed", "error"}:
            detail = event.get("error", event.get("message", "unknown failure"))
            raise ModelBackendError(f"codex exec reported {event_type}: {detail}")
        if event_type == "turn.completed":
            completed = True
            raw_usage = event.get("usage")
            if isinstance(raw_usage, Mapping):
                usage = provider_usage(raw_usage)
    if not completed:
        raise ModelBackendError("codex exec JSONL stream has no turn.completed event")
    return thread_id, usage
