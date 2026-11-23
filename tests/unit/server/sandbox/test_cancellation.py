from __future__ import annotations

import asyncio
from typing import ClassVar, Optional

import anyio
import pytest

from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.evaluators import CodeEvaluatorRunner
from phoenix.server.sandbox.cancellation import run_cancel_once
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import BaseNoSessionBackend, ExecutionResult


class _RemoteLikeBackend(BaseNoSessionBackend):
    family: ClassVar[str] = "TEST"

    def __init__(self) -> None:
        self.running = 0
        self.deleted = 0

    async def execute(
        self, code: str, session_key: str = "", timeout: Optional[int] = None
    ) -> ExecutionResult:
        self.running += 1
        try:
            await asyncio.sleep(3600)
            raise AssertionError("unreachable")
        finally:
            await asyncio.sleep(0.05)
            self.deleted += 1

    async def close(self) -> None:
        return None


async def test_runner_teardown_finishes_when_an_anyio_scope_cancels_evaluate() -> None:
    # timeout=None: on Python 3.11 a timeout makes wait_for absorb the cancel and hide the bug.
    backend = _RemoteLikeBackend()
    runner = CodeEvaluatorRunner(
        name="runner",
        description=None,
        source_code='def evaluate(**kw): return "pass"',
        stored_output_configs=[],
        sandbox_backend=backend,
        language="PYTHON",
        timeout=None,
        evaluator_version_id=None,
        sandbox_session_manager=None,
    )

    async def evaluate() -> None:
        await runner.evaluate(
            context={},
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            name="runner",
            output_configs=[],
        )

    async with anyio.create_task_group() as tg:
        for _ in range(3):
            tg.start_soon(evaluate)
        while backend.running < 3:
            await asyncio.sleep(0.01)
        tg.cancel_scope.cancel()

    for _ in range(100):
        if backend.deleted == 3:
            break
        await asyncio.sleep(0.01)
    assert backend.deleted == 3


async def test_session_manager_shutdown_waits_for_detached_teardowns() -> None:
    manager = SandboxSessionManager()
    await manager.start()
    backend = _RemoteLikeBackend()
    call = asyncio.create_task(run_cancel_once(backend.execute("")))
    while not backend.running:
        await asyncio.sleep(0.01)
    call.cancel()
    with pytest.raises(asyncio.CancelledError):
        await call
    assert backend.deleted == 0

    await manager.stop()

    assert backend.deleted == 1
