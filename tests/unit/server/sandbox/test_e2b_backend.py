from __future__ import annotations

from contextlib import ExitStack, contextmanager
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import SecretStr

from phoenix.server.sandbox.e2b_backend import E2BAdapter, E2BSandboxBackend
from phoenix.server.sandbox.types import E2BConfig, E2BCredentials, E2BDeployment


class _StubSandboxQuery:
    """Stand-in for ``e2b.sandbox.sandbox_api.SandboxQuery``.

    The real class isn't importable in environments where the ``e2b`` extra
    isn't installed — the unit-test CI job is one such environment. This
    stub captures the kwargs so assertions on metadata still work.
    """

    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs


@contextmanager
def _patch_e2b_sdk(backend: E2BSandboxBackend, sandbox_cls: Any) -> Iterator[None]:
    """Patch both lazy SDK lookups on ``backend`` for the duration of the block.

    ``_get_sandbox_cls`` returns the user-supplied mock; ``_get_sandbox_query_cls``
    returns the ``_StubSandboxQuery`` so tests don't need the ``e2b`` extra.
    """
    with ExitStack() as stack:
        stack.enter_context(patch.object(backend, "_get_sandbox_cls", return_value=sandbox_cls))
        stack.enter_context(
            patch.object(backend, "_get_sandbox_query_cls", return_value=_StubSandboxQuery)
        )
        yield


_API_KEY = SecretStr("k")
_CANONICAL_API_KEY = "E2B_API_KEY"
_CREDS = E2BCredentials(E2B_API_KEY=SecretStr("k"))
_EMPTY_CREDS = E2BCredentials(E2B_API_KEY=SecretStr(""))
_DEPLOY = E2BDeployment()


def _make_mock_sandbox_cls(create_result: Any = None) -> MagicMock:
    sandbox_instance = MagicMock()
    sandbox_instance.run_code = AsyncMock(
        return_value=MagicMock(logs=MagicMock(stdout=[], stderr=[]), error=None)
    )
    sandbox_instance.close = AsyncMock()
    sandbox_cls = MagicMock()
    sandbox_cls.create = AsyncMock(return_value=create_result or sandbox_instance)
    # Default paginator: empty, single page. Tests that exercise the dedup
    # path override sandbox_cls.list to return a paginator with prefilled
    # results.
    empty_paginator = MagicMock()
    empty_paginator.has_next = False
    empty_paginator.next_items = AsyncMock(return_value=[])
    sandbox_cls.list = MagicMock(return_value=empty_paginator)
    return sandbox_cls


def test_create_kwargs_defaults_to_allow_true() -> None:
    backend = E2BSandboxBackend(api_key=_API_KEY)
    assert backend._create_kwargs(None)["allow_internet_access"] is True


@pytest.mark.parametrize("allow", [True, False])
def test_create_kwargs_forwards_allow_internet_access(allow: bool) -> None:
    backend = E2BSandboxBackend(api_key=_API_KEY, allow_internet_access=allow)
    assert backend._create_kwargs(None)["allow_internet_access"] is allow


@pytest.mark.parametrize(
    "config,expected",
    [
        ({"internet_access": {"mode": "deny"}}, False),
        ({"internet_access": {"mode": "allow"}}, True),
        ({}, True),  # no internet_access → default permissive
    ],
)
def test_build_backend_translates_internet_access_to_allow_flag(
    config: dict[str, Any], expected: bool
) -> None:
    adapter = E2BAdapter()
    backend: E2BSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        E2BConfig.model_validate({**config, "language": "PYTHON"}),
        credentials=_CREDS,
        deployment=_DEPLOY,
    )
    assert backend._create_kwargs(None)["allow_internet_access"] is expected


@pytest.mark.asyncio
@pytest.mark.parametrize("allow", [True, False])
async def test_start_session_forwards_allow_internet_access(allow: bool) -> None:
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key=_API_KEY, allow_internet_access=allow)
    with _patch_e2b_sdk(backend, mock_cls):
        await backend.find_or_create_session("s1")
    assert mock_cls.create.call_args.kwargs["allow_internet_access"] is allow


@pytest.mark.asyncio
async def test_start_session_installs_packages_via_run_code() -> None:
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key=_API_KEY, packages=["cowsay"])
    with _patch_e2b_sdk(backend, mock_cls):
        await backend.find_or_create_session("s1")
    sandbox_instance = mock_cls.create.return_value
    sandbox_instance.run_code.assert_called_once()
    code_arg = sandbox_instance.run_code.call_args.args[0]
    assert "pip" in code_arg and "cowsay" in code_arg


@pytest.mark.asyncio
async def test_start_session_without_packages_skips_run_code() -> None:
    mock_cls = _make_mock_sandbox_cls()
    backend = E2BSandboxBackend(api_key=_API_KEY, packages=None)
    with _patch_e2b_sdk(backend, mock_cls):
        await backend.find_or_create_session("s1")
    mock_cls.create.return_value.run_code.assert_not_called()


@pytest.mark.asyncio
async def test_pip_install_failure_raises_and_leaves_no_cached_session() -> None:
    mock_cls = _make_mock_sandbox_cls()
    mock_cls.create.return_value.run_code = AsyncMock(
        return_value=MagicMock(
            logs=MagicMock(stdout=[], stderr=[]),
            error="ModuleNotFoundError: No module named pip",
        )
    )
    backend = E2BSandboxBackend(api_key=_API_KEY, packages=["bad-pkg"])
    with _patch_e2b_sdk(backend, mock_cls):
        with pytest.raises(RuntimeError):
            await backend.find_or_create_session("s1")
    # The backend is stateless across the find_or_create_session call:
    # session identity is carried by the provider-side metadata tag, not by
    # any local wrapper attribute, so a failed install simply propagates the
    # error and the caller is free to retry.


@pytest.mark.asyncio
async def test_package_specs_pass_through_to_subprocess_unmodified() -> None:
    """Earlier helper used shlex.quote, which baked literal single-quotes into
    argv elements containing shell metacharacters (``>=``, ``[extras]``); pip
    then rejected ``'numpy>=1.0'`` as an invalid package name. Regression guard.
    """
    mock_cls = _make_mock_sandbox_cls()
    specs = ["numpy>=1.0", "requests[security]", "pandas==2.1.0"]
    backend = E2BSandboxBackend(api_key=_API_KEY, packages=specs)
    with _patch_e2b_sdk(backend, mock_cls):
        await backend.find_or_create_session("s1")
    code_arg = mock_cls.create.return_value.run_code.call_args.args[0]
    for spec in specs:
        assert repr(spec) in code_arg, (
            f"Expected {spec!r} (Python repr) in generated code; got: {code_arg}"
        )
        assert f"'{spec}'" not in code_arg.replace(repr(spec), ""), (
            f"Found double-quoted form of {spec!r} — shlex.quote regression"
        )


@pytest.mark.asyncio
async def test_ephemeral_execute_installs_packages_before_run_code() -> None:
    """Evaluator path enters via execute() without calling start_session(), so
    a missing _install_packages call silently drops dependencies.packages for
    every E2B evaluation. Regression guard.
    """
    mock_cls = _make_mock_sandbox_cls()
    sandbox_instance = mock_cls.create.return_value
    # Make the context-manager protocol work for `async with await create(...)`.
    sandbox_instance.__aenter__ = AsyncMock(return_value=sandbox_instance)
    sandbox_instance.__aexit__ = AsyncMock(return_value=None)
    backend = E2BSandboxBackend(api_key=_API_KEY, packages=["cowsay"])
    with patch.object(backend, "_get_sandbox_cls", return_value=mock_cls):
        await backend.execute("print('hi')", session_key="s1")
    assert sandbox_instance.run_code.await_count == 2
    install_code = sandbox_instance.run_code.call_args_list[0].args[0]
    user_code = sandbox_instance.run_code.call_args_list[1].args[0]
    assert "pip" in install_code and "cowsay" in install_code
    assert user_code == "print('hi')"


@pytest.mark.parametrize(
    "config,expected_packages",
    [
        ({"dependencies": {"packages": ["cowsay"]}}, ["cowsay"]),
        ({}, []),
    ],
)
def test_build_backend_wires_packages(config: dict[str, Any], expected_packages: list[str]) -> None:
    adapter = E2BAdapter()
    backend: E2BSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        E2BConfig.model_validate({**config, "language": "PYTHON"}),
        credentials=_CREDS,
        deployment=_DEPLOY,
    )
    assert backend._packages == expected_packages


def test_build_backend_requires_api_key() -> None:
    """Empty credentials must raise, not fall back to ``os.getenv("E2B_API_KEY")``
    via the SDK's ConnectionConfig autodiscovery (e2b/connection_config.py:94).
    """
    adapter = E2BAdapter()
    with pytest.raises(ValueError, match=_CANONICAL_API_KEY):
        adapter.build_backend(
            E2BConfig(language="PYTHON"),
            credentials=_EMPTY_CREDS,
            deployment=_DEPLOY,
        )


@pytest.mark.asyncio
async def test_execute_strips_ansi_from_all_three_fields() -> None:
    execution = MagicMock()
    execution.logs.stdout = ["\x1b[32mok\x1b[0m"]
    execution.logs.stderr = ["\x1b[31merror\x1b[0m: bad"]
    execution.error = "\x1b[31mboom\x1b[0m"

    sandbox = MagicMock()
    sandbox.run_code = AsyncMock(return_value=execution)
    sandbox.__aenter__ = AsyncMock(return_value=sandbox)
    sandbox.__aexit__ = AsyncMock(return_value=None)

    sandbox_cls = MagicMock()
    sandbox_cls.create = AsyncMock(return_value=sandbox)

    backend = E2BSandboxBackend(api_key=_API_KEY)
    with patch.object(backend, "_get_sandbox_cls", return_value=sandbox_cls):
        result = await backend.execute("noop", session_key="ephemeral")

    assert result.stdout == "ok"
    assert result.stderr == "error: bad"
    assert result.error == "boom"


@pytest.mark.asyncio
async def test_execute_strips_ansi_in_raised_exception_path() -> None:
    sandbox_cls = MagicMock()
    sandbox_cls.create = AsyncMock(side_effect=RuntimeError("\x1b[31mprovider error\x1b[0m"))

    backend = E2BSandboxBackend(api_key=_API_KEY)
    with patch.object(backend, "_get_sandbox_cls", return_value=sandbox_cls):
        result = await backend.execute("noop", session_key="ephemeral")

    assert result.error == "provider error"
    assert result.stderr == "provider error"


def _make_mock_sandbox_with_contexts() -> MagicMock:
    """Build a sandbox handle whose context API can be asserted against.

    ``create_code_context`` returns a fresh sentinel each invocation (so tests
    can assert distinct contexts under concurrent calls). ``run_code`` returns
    an empty successful Execution. ``remove_code_context`` records calls.
    """
    sandbox = MagicMock()
    sandbox.sandbox_id = "sbx-test"
    contexts: list[MagicMock] = []

    async def _create_context(language: str = "python") -> MagicMock:
        # ``language`` is captured to match the production call signature
        # (``await sandbox.create_code_context(language="python")``); the
        # value is asserted on ``create_code_context.assert_awaited_once_with``.
        del language
        ctx = MagicMock(name=f"ctx-{len(contexts)}")
        contexts.append(ctx)
        return ctx

    sandbox.create_code_context = AsyncMock(side_effect=_create_context)
    sandbox.run_code = AsyncMock(
        return_value=MagicMock(logs=MagicMock(stdout=[], stderr=[]), error=None)
    )
    sandbox.remove_code_context = AsyncMock()
    # Surface the per-call context list on the mock for assertion sites.
    sandbox._created_contexts = contexts
    return sandbox


@pytest.mark.asyncio
async def test_execute_in_session_creates_and_removes_context_per_call() -> None:
    """Happy path: each execute_in_session creates a context, passes it to
    run_code, and removes it after."""
    sandbox = _make_mock_sandbox_with_contexts()
    backend = E2BSandboxBackend(api_key=_API_KEY)

    result = await backend.execute_in_session(sandbox, "print('hi')", timeout=5)

    assert result.error is None
    sandbox.create_code_context.assert_awaited_once_with(language="python")
    sandbox.run_code.assert_awaited_once()
    run_kwargs = sandbox.run_code.call_args.kwargs
    assert run_kwargs["context"] is sandbox._created_contexts[0]
    assert run_kwargs["timeout"] == 5
    sandbox.remove_code_context.assert_awaited_once_with(sandbox._created_contexts[0])


def test_is_session_gone_classifies_sandbox_not_found() -> None:
    """SandboxNotFoundException → True; plain RuntimeError → False.

    SandboxNotFoundException is the SDK signal that the remote sandbox no
    longer exists (provider reaped it, or it was killed out-of-band) — the
    one case where a rebind+retry would recover. Unrelated user-code errors
    must NOT classify, so the manager doesn't churn fresh sessions on
    every failed evaluation.
    """
    pytest.importorskip("e2b")
    from e2b.exceptions import SandboxNotFoundException

    backend = E2BSandboxBackend(api_key=_API_KEY)
    assert backend.is_session_gone(SandboxNotFoundException("gone")) is True
    assert backend.is_session_gone(RuntimeError("user oops")) is False


@pytest.mark.asyncio
async def test_execute_in_session_propagates_session_gone_exception() -> None:
    """A classified SDK exception inside run_code must propagate, not wrap.

    Without the narrow re-raise the manager has no signal to retry against —
    every SDK failure arrives as ExecutionResult(error=...), indistinguishable
    from user code.
    """
    pytest.importorskip("e2b")
    from e2b.exceptions import SandboxNotFoundException

    sandbox = _make_mock_sandbox_with_contexts()
    sandbox.run_code = AsyncMock(side_effect=SandboxNotFoundException("gone"))
    backend = E2BSandboxBackend(api_key=_API_KEY)

    with pytest.raises(SandboxNotFoundException):
        await backend.execute_in_session(sandbox, "print('hi')")
    # The finally block still ran cleanup on the context that was created.
    sandbox.remove_code_context.assert_awaited_once_with(sandbox._created_contexts[0])


@pytest.mark.asyncio
async def test_execute_in_session_wraps_non_session_gone_exception() -> None:
    """Non-classified exceptions continue to wrap as ExecutionResult.

    Regression guard: the narrowed handler must only re-raise session-gone
    exceptions; everything else (user-code error, transient SDK fault) keeps
    the existing ExecutionResult wrap.
    """
    sandbox = _make_mock_sandbox_with_contexts()
    sandbox.run_code = AsyncMock(side_effect=RuntimeError("user oops"))
    backend = E2BSandboxBackend(api_key=_API_KEY)

    result = await backend.execute_in_session(sandbox, "print('hi')")

    assert result.error == "user oops"
    assert result.stderr == "user oops"


@pytest.mark.asyncio
async def test_execute_in_session_concurrent_calls_get_distinct_contexts() -> None:
    """Two concurrent execute_in_session calls against the same sandbox handle
    each get their own context. This is the parallelism property — without
    distinct contexts, E2B's single default kernel would serialize the calls.
    """
    import asyncio

    sandbox = _make_mock_sandbox_with_contexts()
    backend = E2BSandboxBackend(api_key=_API_KEY)

    await asyncio.gather(
        backend.execute_in_session(sandbox, "a = 1"),
        backend.execute_in_session(sandbox, "b = 2"),
    )

    assert sandbox.create_code_context.await_count == 2
    assert len(sandbox._created_contexts) == 2
    # Each run_code received a different context object.
    run_contexts = [call.kwargs["context"] for call in sandbox.run_code.call_args_list]
    assert run_contexts[0] is not run_contexts[1]
    # Both contexts were removed.
    removed = [call.args[0] for call in sandbox.remove_code_context.call_args_list]
    assert set(removed) == set(sandbox._created_contexts)
