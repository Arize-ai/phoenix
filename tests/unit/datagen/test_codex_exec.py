import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from scripts.datagen.codex_exec import CodexExecBackend
from scripts.datagen.model_backend import ModelBackendError, ModelRequest


def test_codex_exec_uses_isolated_structured_cli_contract() -> None:
    captured: dict[str, Any] = {}

    def run(argv: list[str], **kwargs: Any) -> SimpleNamespace:
        captured.update(argv=argv, kwargs=kwargs)
        result_path = Path(argv[argv.index("--output-last-message") + 1])
        result_path.write_text(json.dumps({"answer": "ok"}))
        events = [
            {"type": "thread.started", "thread_id": "thread-1"},
            {"type": "turn.completed", "usage": {"input_tokens": 8, "output_tokens": 3}},
        ]
        return SimpleNamespace(
            returncode=0, stdout="\n".join(map(json.dumps, events)).encode(), stderr=b"note\xff"
        )

    result = CodexExecBackend(executable="codex-test", run_process=run).generate(_request())

    argv = captured["argv"]
    assert argv[:2] == ["codex-test", "exec"]
    assert argv[2 : argv.index("--cd") + 1] == [
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--cd",
    ]
    assert argv[-2:] == ["--json", "-"]
    assert captured["kwargs"]["input"] == b"Return JSON."
    assert result.output == {"answer": "ok"}
    assert result.provider_run_id == "thread-1"
    assert result.usage is not None and result.usage.input_tokens == 8
    assert "\ufffd" in result.metadata["stderr"]


def test_codex_exec_preserves_unknown_usage_as_null() -> None:
    def run(argv: list[str], **kwargs: Any) -> SimpleNamespace:
        Path(argv[argv.index("--output-last-message") + 1]).write_text("{}")
        return SimpleNamespace(returncode=0, stdout=b'{"type":"turn.completed"}\n', stderr=b"")

    assert CodexExecBackend(run_process=run).generate(_request()).usage is None


@pytest.mark.parametrize(
    "event", [{"type": "turn.failed", "error": "bad"}, {"type": "error", "message": "bad"}]
)
def test_codex_exec_rejects_terminal_failures(event: dict[str, str]) -> None:
    def run(argv: list[str], **kwargs: Any) -> SimpleNamespace:
        return SimpleNamespace(returncode=0, stdout=(json.dumps(event) + "\n").encode(), stderr=b"")

    with pytest.raises(ModelBackendError, match="reported"):
        CodexExecBackend(run_process=run).generate(_request())


def _request() -> ModelRequest:
    return ModelRequest(
        "request-1", "generation", "model-exact", "Return JSON.", {"type": "object"}, 100
    )
