import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from scripts.datagen.codex_exec import CodexExecBackend
from scripts.datagen.model_backend import ModelRequest


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
            returncode=0, stdout="\n".join(map(json.dumps, events)).encode(), stderr=b"note"
        )

    result = CodexExecBackend(executable="codex-test", run_process=run).generate(_request())

    argv = captured["argv"]
    assert argv[:2] == ["codex-test", "exec"]
    assert argv[-2:] == ["--json", "-"]
    assert captured["kwargs"]["input"] == b"Return JSON."
    assert result.output == {"answer": "ok"}
    assert result.provider_run_id == "thread-1"
    assert result.usage is not None and result.usage.input_tokens == 8


def _request() -> ModelRequest:
    return ModelRequest(
        "request-1", "generation", "model-exact", "Return JSON.", {"type": "object"}, 100
    )
