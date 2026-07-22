from __future__ import annotations

import json
import time

from phoenix.server.sandbox.monty_backend import MontyAdapter, MontySandboxBackend, _run
from phoenix.server.sandbox.types import MontyConfig


async def test_execute_serializes_returned_value_and_captures_stdout() -> None:
    backend = MontySandboxBackend()

    result = await backend.execute(
        "print('running')\n{'label': 'pass', 'score': 1}",
        session_key="",
        timeout=1,
    )

    assert result.success
    assert "running" in result.stdout
    assert json.dumps({"label": "pass", "score": 1}) in result.stdout
    assert "===PHOENIX_RESULT_BEGIN===" in result.stdout
    assert "===PHOENIX_RESULT_END===" in result.stdout


def test_validate_code_runs_module_body_with_a_bound() -> None:
    error = MontyAdapter().validate_code(
        MontyConfig(),
        "import definitely_missing\ndef evaluate(output):\n    return output",
    )

    assert error is not None
    assert "ModuleNotFoundError" in error


def test_execute_interrupts_runaway_loop_at_native_timeout() -> None:
    started_at = time.monotonic()

    result = _run("while True:\n    pass", timeout=0.05)

    assert not result.success
    assert time.monotonic() - started_at < 0.5
    assert result.error is not None
    assert "TimeoutError" in result.error
    assert "time limit exceeded" in result.error
