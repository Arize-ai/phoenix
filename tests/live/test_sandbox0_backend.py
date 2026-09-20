"""Opt-in tests against a real Sandbox0 region; every fixture owns its resources.

Run with SANDBOX0_TEST_API_KEY and optionally SANDBOX0_TEST_API_URL / TEMPLATE.
No LLM credentials are needed for the code evaluator execution path.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from pydantic import SecretStr

from phoenix.server.api.evaluators import CodeEvaluatorRunner
from phoenix.server.sandbox.result_protocol import extract_framed_result
from phoenix.server.sandbox.sandbox0_backend import Sandbox0SandboxBackend
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import (
    Sandbox0Config,
    Sandbox0Credentials,
    Sandbox0Deployment,
)

pytestmark = pytest.mark.skipif(
    not os.getenv("SANDBOX0_TEST_API_KEY"), reason="SANDBOX0_TEST_API_KEY is required"
)


def make_backend(language: str = "PYTHON", **config: Any) -> Sandbox0SandboxBackend:
    return Sandbox0SandboxBackend(
        Sandbox0Config.model_validate({"language": language, **config}),
        Sandbox0Credentials(SANDBOX0_API_KEY=SecretStr(os.environ["SANDBOX0_TEST_API_KEY"])),
        Sandbox0Deployment(
            api_url=os.getenv("SANDBOX0_TEST_API_URL"),
            template=os.getenv("SANDBOX0_TEST_TEMPLATE"),
        ),
        {"PHOENIX_TEST_VALUE": "injected-test-value"},
    )


@pytest.fixture
async def runtime() -> AsyncIterator[tuple[Sandbox0SandboxBackend, object]]:
    backend = make_backend()
    key = f"phoenix-live-{uuid.uuid4().hex}"
    try:
        handle = await backend.find_or_create_session(key)
        yield backend, handle
    finally:
        await backend.close_session(key)
        await backend.close()


async def test_real_ephemeral_python() -> None:
    result = await make_backend().execute("print('python-ok')", "ephemeral", timeout=30)
    assert result.success, result.error
    assert result.stdout.strip() == "python-ok"


async def test_real_ephemeral_typescript() -> None:
    result = await make_backend("TYPESCRIPT").execute(
        "const value: number = 42; console.log(value);", "ephemeral", timeout=30
    )
    assert result.success, result.error
    assert result.stdout.strip() == "42"


async def test_real_env_and_split_stderr(runtime: tuple[Sandbox0SandboxBackend, object]) -> None:
    backend, handle = runtime
    result = await backend.execute_in_session(
        handle,
        "import os,sys; print(os.environ['PHOENIX_TEST_VALUE']); print('diagnostic', file=sys.stderr)",
        30,
    )
    assert result.success, result.error
    assert result.stdout.strip() == "injected-test-value"
    assert result.stderr.strip() == "diagnostic"


async def test_real_nonzero_exit(runtime: tuple[Sandbox0SandboxBackend, object]) -> None:
    backend, handle = runtime
    result = await backend.execute_in_session(handle, "raise ValueError('expected-test-error')", 30)
    assert not result.success
    assert "expected-test-error" in result.stderr


async def test_real_parallel_fresh_globals(runtime: tuple[Sandbox0SandboxBackend, object]) -> None:
    backend, handle = runtime
    results = await asyncio.gather(
        *(
            backend.execute_in_session(
                handle, f"assert 'value' not in globals(); value={i}; print(value)", 30
            )
            for i in range(4)
        )
    )
    assert all(r.success for r in results), results
    assert [r.stdout.strip() for r in results] == ["0", "1", "2", "3"]


async def test_real_timeout_preserves_reusable_sandbox(
    runtime: tuple[Sandbox0SandboxBackend, object],
) -> None:
    backend, handle = runtime
    try:
        result = await backend.execute_in_session(handle, "import time; time.sleep(60)", 1)
        assert not result.success  # Runtime TTL may end the process before our timer.
    except asyncio.TimeoutError:
        pass
    assert (await backend.execute_in_session(handle, "print('still-alive')", 30)).success


async def test_real_cancel_cleans_context(runtime: tuple[Sandbox0SandboxBackend, object]) -> None:
    from sandbox0.apispec.api.contexts import get_api_v1_sandboxes_id_contexts
    from sandbox0.apispec.models.success_context_list_response import SuccessContextListResponse
    from sandbox0.response import ensure_data

    backend, handle = runtime
    task = asyncio.create_task(
        backend.execute_in_session(handle, "import time; time.sleep(60)", 60)
    )
    await asyncio.sleep(1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    async with backend._client() as client:
        response = await get_api_v1_sandboxes_id_contexts.asyncio_detailed(
            str(handle), client=client
        )
        contexts = ensure_data(response, SuccessContextListResponse).contexts
    assert not contexts


async def test_real_session_reuse_and_rebind() -> None:
    backend = make_backend()
    manager = SandboxSessionManager()
    try:
        async with manager.acquire(backend, "live-rebind") as session:
            old_handle = session._handle
            assert (await session.execute("print(1)", 30)).success
        async with manager.acquire(backend, "live-rebind") as session:
            assert session._handle == old_handle
            await backend._delete(str(old_handle))
            # Deletion is asynchronous; wait for the identity to become unavailable.
            for _ in range(100):
                try:
                    result = await session.execute("print(2)", 30)
                    if result.success and session._handle != old_handle:
                        break
                except Exception:
                    pass
                await asyncio.sleep(0.2)
            else:
                pytest.fail("Session manager did not recover a deleted sandbox")
    finally:
        await manager.stop()


@pytest.mark.parametrize(
    "language,source",
    [
        ("PYTHON", "import requests; print(requests.__version__)"),
        ("TYPESCRIPT", "import isNumber from 'is-number'; console.log(isNumber(42));"),
    ],
)
async def test_real_dependencies(language: str, source: str) -> None:
    package = "requests==2.32.3" if language == "PYTHON" else "is-number@7.0.0"
    result = await make_backend(language, dependencies={"packages": [package]}).execute(
        source, "deps", 60
    )
    assert result.success, result.error
    assert result.stdout.strip() == ("2.32.3" if language == "PYTHON" else "true")


@pytest.mark.parametrize("mode", ["allow", "deny"])
async def test_real_network_policy(mode: str) -> None:
    # TPROXY may accept a TCP handshake locally even when egress is denied.
    # Assert an actual HTTPS response, not just connect() success.
    source = """import urllib.request
try:
    with urllib.request.urlopen('https://example.com', timeout=5) as response:
        print('connected' if response.read(32) else 'blocked')
except OSError:
    print('blocked')
"""
    result = await make_backend(internet_access={"mode": mode}).execute(source, "network", 15)
    assert result.success, result.error
    assert result.stdout.strip() == ("connected" if mode == "allow" else "blocked")


@pytest.mark.parametrize("language", ["PYTHON", "TYPESCRIPT"])
async def test_real_evaluator_harness(language: str) -> None:
    backend = make_backend(language)
    source = (
        "def evaluate(output):\n    return {'score': 1 if output == 'correct' else 0}"
        if language == "PYTHON"
        else "function evaluate({output}: {output: string}) { return {score: output === 'correct' ? 1 : 0}; }"
    )
    runner = CodeEvaluatorRunner(
        name="live-evaluator",
        description=None,
        source_code=source,
        stored_output_configs=[],
        sandbox_backend=backend,
        sandbox_session_manager=None,
        language=language,
    )
    code = (
        runner._build_python_harness({"output": "correct"})
        if language == "PYTHON"
        else runner._build_typescript_harness({"output": "correct"})
    )
    result = await backend.execute(code, "harness", 30)
    assert result.success, result.error
    import json

    payload, _ = extract_framed_result(result.stdout)
    assert payload is not None
    assert json.loads(payload) == {"score": 1}


@pytest.mark.parametrize("language", ["PYTHON", "TYPESCRIPT"])
async def test_real_runner_returns_score(language: str) -> None:
    from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
    from phoenix.db.types.evaluators import InputMapping

    output = ContinuousOutputConfig(
        type="CONTINUOUS",
        name="score",
        description="",
        optimization_direction=OptimizationDirection.MAXIMIZE,
    )
    runner = CodeEvaluatorRunner(
        name="score",
        description=None,
        source_code=(
            "def evaluate(output):\n    return 1 if output == 'correct' else 0"
            if language == "PYTHON"
            else "function evaluate({output}: {output: string}) { return output === 'correct' ? 1 : 0; }"
        ),
        stored_output_configs=[output],
        sandbox_backend=make_backend(language),
        sandbox_session_manager=None,
        language=language,
        timeout=60,
    )
    results = await runner.evaluate(
        context={"output": "correct"},
        input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        name="score",
        output_configs=[output],
    )
    assert len(results) == 1
    assert results[0].get("error") is None, results
    assert results[0]["score"] == 1
