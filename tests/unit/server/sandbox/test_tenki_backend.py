from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import SecretStr

from phoenix.server.sandbox.tenki_backend import TenkiAdapter, TenkiSandboxBackend
from phoenix.server.sandbox.types import TenkiConfig, TenkiCredentials, TenkiDeployment

_API_KEY = SecretStr("tk_test")
_CANONICAL_API_KEY = "TENKI_API_KEY"
_CREDS = TenkiCredentials(TENKI_API_KEY=SecretStr("tk_test"))
_EMPTY_CREDS = TenkiCredentials(TENKI_API_KEY=SecretStr(""))
_DEPLOY = TenkiDeployment()
_PINNED = "proj_pinned"


def _make_command_result(
    *,
    ok: bool = True,
    stdout: str = "",
    stderr: str = "",
    exit_code: int = 0,
) -> MagicMock:
    """Stand-in for ``tenki_sandbox.CommandResult``.

    The real class isn't importable when the ``tenki`` extra is absent (the
    unit-test CI job is one such environment), so tests use a mock exposing the
    fields the backend reads: ``ok`` / ``stdout_text`` / ``stderr_text`` /
    ``exit_code``.
    """
    result = MagicMock()
    result.ok = ok
    result.stdout_text = stdout
    result.stderr_text = stderr
    result.exit_code = exit_code
    return result


def _make_identity(project_id: str | None = "proj_resolved") -> MagicMock:
    """Stand-in for the ``who_am_i`` ``Identity``: workspaces → projects.

    ``project_id=None`` yields a workspace with no projects (the
    unresolvable-key case).
    """
    workspace = MagicMock()
    if project_id is None:
        workspace.projects = []
    else:
        project = MagicMock()
        project.id = project_id
        workspace.projects = [project]
    identity = MagicMock()
    identity.workspaces = [workspace]
    return identity


def _make_mock_client(
    exec_result: Any = None,
    resolved_project_id: str = "proj_resolved",
) -> MagicMock:
    """Build a mock ``AsyncClient`` whose ``create`` yields a usable sandbox.

    The sandbox exposes an ``exec`` coroutine and ``close_if_open``; the client
    exposes ``who_am_i`` (identity resolution), ``create``, and ``close``.
    """
    sandbox = MagicMock()
    sandbox.exec = AsyncMock(return_value=exec_result or _make_command_result())
    sandbox.close_if_open = AsyncMock()
    client = MagicMock()
    client.who_am_i = AsyncMock(return_value=_make_identity(resolved_project_id))
    client.create = AsyncMock(return_value=sandbox)
    client.list = AsyncMock(return_value=[])  # reap-by-tag finds no orphans by default
    client.close = AsyncMock()
    return client


# --- _create_kwargs -------------------------------------------------------


def test_create_kwargs_includes_project_id() -> None:
    backend = TenkiSandboxBackend(api_key=_API_KEY)
    assert backend._create_kwargs("proj_x", None, "tag")["project_id"] == "proj_x"


def test_create_kwargs_defaults_to_allow_outbound_true() -> None:
    backend = TenkiSandboxBackend(api_key=_API_KEY)
    assert backend._create_kwargs("p", None, "tag")["allow_outbound"] is True


@pytest.mark.parametrize("allow", [True, False])
def test_create_kwargs_forwards_allow_internet_access(allow: bool) -> None:
    backend = TenkiSandboxBackend(api_key=_API_KEY, allow_internet_access=allow)
    assert backend._create_kwargs("p", None, "tag")["allow_outbound"] is allow


def test_create_kwargs_tags_the_sandbox() -> None:
    backend = TenkiSandboxBackend(api_key=_API_KEY)
    assert backend._create_kwargs("p", None, "phoenix-exec:abc")["tags"] == ["phoenix-exec:abc"]


def test_max_duration_derives_from_timeout() -> None:
    """A configured timeout must not be truncated by a hardcoded lifetime cap:
    max_duration = timeout + headroom; a fixed default applies when unset."""
    backend = TenkiSandboxBackend(api_key=_API_KEY)
    # 900s eval → cap comfortably above it (was hardcoded 600, which truncated).
    assert backend._create_kwargs("p", 900, "tag")["max_duration"] > 900
    assert backend._create_kwargs("p", 900, "tag")["max_duration"] == 900 + 300
    # No timeout → fixed default.
    assert backend._create_kwargs("p", None, "tag")["max_duration"] == 600


def test_create_kwargs_stays_on_stable_features() -> None:
    """Guard: the ephemeral path must never request unstable features
    (custom image, snapshot, volumes, sticky/long-lived) — doing so would
    change the guest runtime our ``python3``/pip argv depends on and pull the
    integration off Tenki's stable surface."""
    backend = TenkiSandboxBackend(api_key=_API_KEY)
    kwargs = backend._create_kwargs("p", None, "tag")
    for forbidden in ("image", "snapshot_id", "volumes", "sticky"):
        assert forbidden not in kwargs


# --- project resolution ---------------------------------------------------


@pytest.mark.asyncio
async def test_resolve_project_id_from_identity() -> None:
    client = _make_mock_client(resolved_project_id="proj_from_key")
    backend = TenkiSandboxBackend(api_key=_API_KEY)
    assert await backend._resolve_project_id(client) == "proj_from_key"
    client.who_am_i.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolve_project_id_is_cached() -> None:
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY)
    await backend._resolve_project_id(client)
    await backend._resolve_project_id(client)
    client.who_am_i.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolve_project_id_concurrent_calls_resolve_once() -> None:
    """A batch whose first calls race must fire who_am_i() exactly once
    (the resolution lock + re-check guarantees it)."""
    import asyncio

    calls = 0

    async def _slow_who_am_i() -> Any:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)  # widen the race window before the cache fills
        return _make_identity("proj_x")

    client = MagicMock()
    client.who_am_i = AsyncMock(side_effect=_slow_who_am_i)
    backend = TenkiSandboxBackend(api_key=_API_KEY)

    results = await asyncio.gather(*(backend._resolve_project_id(client) for _ in range(5)))

    assert results == ["proj_x"] * 5
    assert calls == 1


@pytest.mark.asyncio
async def test_resolve_project_id_skips_who_am_i_when_pinned() -> None:
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    assert await backend._resolve_project_id(client) == _PINNED
    client.who_am_i.assert_not_awaited()


@pytest.mark.asyncio
async def test_resolve_project_id_raises_when_key_has_no_project() -> None:
    client = MagicMock()
    client.who_am_i = AsyncMock(return_value=_make_identity(project_id=None))
    backend = TenkiSandboxBackend(api_key=_API_KEY)
    with pytest.raises(RuntimeError, match="no workspace/project"):
        await backend._resolve_project_id(client)


# --- execute --------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_runs_code_via_python_argv() -> None:
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("print('hi')", session_key="s1")
    sandbox = client.create.return_value
    sandbox.exec.assert_awaited_once()
    assert sandbox.exec.call_args.args == ("python3", "-c", "print('hi')")


@pytest.mark.asyncio
async def test_execute_creates_in_resolved_project() -> None:
    client = _make_mock_client(resolved_project_id="proj_from_key")
    backend = TenkiSandboxBackend(api_key=_API_KEY)  # no pinned project
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("noop", session_key="s1")
    assert client.create.call_args.kwargs["project_id"] == "proj_from_key"


@pytest.mark.asyncio
async def test_execute_forwards_user_env_and_timeout() -> None:
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY, user_env={"CI": "1"}, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("noop", session_key="s1", timeout=5)
    kwargs = client.create.return_value.exec.call_args.kwargs
    assert kwargs["env"] == {"CI": "1"}
    assert kwargs["timeout"] == 5


@pytest.mark.asyncio
@pytest.mark.parametrize("allow", [True, False])
async def test_execute_forwards_allow_internet_access(allow: bool) -> None:
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY, allow_internet_access=allow, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("noop", session_key="s1")
    assert client.create.call_args.kwargs["allow_outbound"] is allow


@pytest.mark.asyncio
async def test_execute_tears_down_sandbox_and_client() -> None:
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("noop", session_key="s1")
    client.create.return_value.close_if_open.assert_awaited_once()
    client.close.assert_awaited_once()
    # On the happy path we hold a handle, so no reap-by-tag list call is needed.
    client.list.assert_not_awaited()


@pytest.mark.asyncio
async def test_execute_reaps_orphan_when_create_fails() -> None:
    """If create() fails after the VM came up (no handle returned), the VM is
    found by its unique tag and terminated — otherwise it leaks, billing."""
    client = _make_mock_client()
    client.create = AsyncMock(side_effect=RuntimeError("boom during create"))
    orphan = MagicMock()
    orphan.close_if_open = AsyncMock()
    client.list = AsyncMock(return_value=[orphan])
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        result = await backend.execute("noop", session_key="s1")
    assert result.error is not None
    # reap listed by the per-execution tag and terminated the orphan
    assert client.list.await_args.kwargs["tags"][0].startswith("phx-")
    orphan.close_if_open.assert_awaited_once()
    client.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_tag_within_tenki_length_limit() -> None:
    """Regression guard: Tenki rejects tags over 32 chars. The per-execution
    reap tag passed to create() must stay within that limit."""
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("noop", session_key="s1")
    tag = client.create.await_args.kwargs["tags"][0]
    assert len(tag) <= 32, f"tag {tag!r} is {len(tag)} chars (Tenki max 32)"


@pytest.mark.asyncio
async def test_execute_reaps_orphan_when_create_cancelled() -> None:
    """Cancellation during create() must still terminate the orphaned VM, and
    the CancelledError must propagate (not be swallowed as a result)."""
    client = _make_mock_client()
    client.create = AsyncMock(side_effect=asyncio.CancelledError())
    orphan = MagicMock()
    orphan.close_if_open = AsyncMock()
    client.list = AsyncMock(return_value=[orphan])
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        with pytest.raises(asyncio.CancelledError):
            await backend.execute("noop", session_key="s1")
    orphan.close_if_open.assert_awaited_once()
    client.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_caps_concurrency() -> None:
    """Concurrent executions never exceed the process-wide semaphore cap, so a
    large eval batch can't fan out unbounded billable VMs."""
    from phoenix.server.sandbox import tenki_backend as tb

    cap = tb._MAX_CONCURRENT_TENKI_EXECUTIONS
    in_flight = 0
    max_in_flight = 0

    sandbox = MagicMock()
    sandbox.exec = AsyncMock(return_value=_make_command_result())
    sandbox.close_if_open = AsyncMock()

    async def _tracking_create(**kwargs: Any) -> Any:
        nonlocal in_flight, max_in_flight
        in_flight += 1
        max_in_flight = max(max_in_flight, in_flight)
        try:
            await asyncio.sleep(0.02)  # hold the slot so overlap is observable
            return sandbox
        finally:
            in_flight -= 1

    client = _make_mock_client()
    client.create = AsyncMock(side_effect=_tracking_create)

    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await asyncio.gather(*(backend.execute("noop", session_key="s") for _ in range(cap * 3)))

    assert max_in_flight <= cap
    assert max_in_flight > 1  # sanity: the batch really did overlap


@pytest.mark.asyncio
async def test_execute_tears_down_even_when_exec_raises() -> None:
    client = _make_mock_client()
    client.create.return_value.exec = AsyncMock(side_effect=RuntimeError("boom"))
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        result = await backend.execute("noop", session_key="s1")
    assert result.error == "boom"
    client.create.return_value.close_if_open.assert_awaited_once()
    client.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_execute_installs_packages_before_running_code() -> None:
    """Regression guard: a missing install call silently drops
    dependencies.packages for every Tenki evaluation."""
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY, packages=["cowsay"], project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("print('hi')", session_key="s1")
    calls = client.create.return_value.exec.call_args_list
    assert len(calls) == 2
    assert calls[0].args == (
        "python3",
        "-m",
        "pip",
        "install",
        "--break-system-packages",
        "cowsay",
    )
    assert calls[1].args == ("python3", "-c", "print('hi')")


@pytest.mark.asyncio
async def test_execute_without_packages_skips_install() -> None:
    client = _make_mock_client()
    backend = TenkiSandboxBackend(api_key=_API_KEY, packages=None, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("print('hi')", session_key="s1")
    client.create.return_value.exec.assert_awaited_once()


@pytest.mark.asyncio
async def test_package_specs_pass_through_to_exec_unmodified() -> None:
    """Tenki exec runs argv directly (no shell), so specs with shell
    metacharacters (``>=``, ``[extras]``) must reach pip as-is."""
    client = _make_mock_client()
    specs = ["numpy>=1.0", "requests[security]", "pandas==2.1.0"]
    backend = TenkiSandboxBackend(api_key=_API_KEY, packages=specs, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        await backend.execute("noop", session_key="s1")
    install_args = client.create.return_value.exec.call_args_list[0].args
    assert install_args == ("python3", "-m", "pip", "install", "--break-system-packages", *specs)


@pytest.mark.asyncio
async def test_pip_install_failure_surfaces_as_error() -> None:
    client = _make_mock_client()
    client.create.return_value.exec = AsyncMock(
        return_value=_make_command_result(ok=False, stderr="No matching distribution", exit_code=1)
    )
    backend = TenkiSandboxBackend(api_key=_API_KEY, packages=["bad-pkg"], project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        result = await backend.execute("print('hi')", session_key="s1")
    assert result.error is not None
    assert "pip install failed" in result.error


@pytest.mark.asyncio
async def test_execute_maps_nonzero_exit_to_error() -> None:
    client = _make_mock_client(
        exec_result=_make_command_result(ok=False, stdout="", stderr="Traceback: boom", exit_code=1)
    )
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        result = await backend.execute("raise SystemExit(1)", session_key="s1")
    assert result.error == "Traceback: boom"
    assert result.success is False


@pytest.mark.asyncio
async def test_execute_success_has_no_error() -> None:
    client = _make_mock_client(
        exec_result=_make_command_result(ok=True, stdout="hi\n", exit_code=0)
    )
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        result = await backend.execute("print('hi')", session_key="s1")
    assert result.stdout == "hi\n"
    assert result.error is None
    assert result.success is True


@pytest.mark.asyncio
async def test_execute_strips_ansi_from_all_fields() -> None:
    client = _make_mock_client(
        exec_result=_make_command_result(
            ok=False,
            stdout="\x1b[32mok\x1b[0m",
            stderr="\x1b[31mboom\x1b[0m",
            exit_code=1,
        )
    )
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        result = await backend.execute("noop", session_key="s1")
    assert result.stdout == "ok"
    assert result.stderr == "boom"
    assert result.error == "boom"


@pytest.mark.asyncio
async def test_execute_wraps_create_exception() -> None:
    client = _make_mock_client()
    client.create = AsyncMock(side_effect=RuntimeError("\x1b[31mprovider error\x1b[0m"))
    backend = TenkiSandboxBackend(api_key=_API_KEY, project_id=_PINNED)
    with patch.object(backend, "_get_client", return_value=client):
        result = await backend.execute("noop", session_key="s1")
    assert result.error == "provider error"
    assert result.stderr == "provider error"
    # Client is still closed even when create() blows up.
    client.close.assert_awaited_once()


# --- adapter --------------------------------------------------------------


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
    adapter = TenkiAdapter()
    backend: TenkiSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        TenkiConfig.model_validate({**config, "language": "PYTHON"}),
        credentials=_CREDS,
        deployment=_DEPLOY,
    )
    assert backend._create_kwargs("p", None, "tag")["allow_outbound"] is expected


@pytest.mark.parametrize(
    "config,expected_packages",
    [
        ({"dependencies": {"packages": ["cowsay"]}}, ["cowsay"]),
        ({}, []),
    ],
)
def test_build_backend_wires_packages(config: dict[str, Any], expected_packages: list[str]) -> None:
    adapter = TenkiAdapter()
    backend: TenkiSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        TenkiConfig.model_validate({**config, "language": "PYTHON"}),
        credentials=_CREDS,
        deployment=_DEPLOY,
    )
    assert backend._packages == expected_packages


def test_build_backend_forwards_deployment_routing() -> None:
    adapter = TenkiAdapter()
    backend: TenkiSandboxBackend = adapter.build_backend(  # type: ignore[assignment]
        TenkiConfig(language="PYTHON"),
        credentials=_CREDS,
        deployment=TenkiDeployment(api_url="https://api.example.com", project_id="proj_x"),
    )
    assert backend._api_url == "https://api.example.com"
    assert backend._project_id == "proj_x"


def test_build_backend_requires_api_key() -> None:
    """Empty credentials must raise, not fall back to the SDK's
    TENKI_AUTH_TOKEN / TENKI_API_KEY process-env autodiscovery."""
    adapter = TenkiAdapter()
    with pytest.raises(ValueError, match=_CANONICAL_API_KEY):
        adapter.build_backend(
            TenkiConfig(language="PYTHON"),
            credentials=_EMPTY_CREDS,
            deployment=_DEPLOY,
        )
