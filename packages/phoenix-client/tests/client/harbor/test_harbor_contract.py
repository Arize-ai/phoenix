# harbor is unresolvable on the client's 3.10 type-check floor; every import below is
# executed only where the module-level importorskip passes (Python >=3.12, harbor present).
# pyright: reportMissingImports=false, reportUnknownVariableType=false
"""Contract tests against a real harbor install.

Skipped unless harbor is importable (Python >=3.12); the phoenix_client_harbor tox env
installs it. With no runtime dependency on harbor there is no resolver-level signal when
Harbor changes its plugin contract, so these tests are that tripwire.
"""

from __future__ import annotations

import pytest

from phoenix.client.harbor import PhoenixJobPlugin

pytest.importorskip(
    "harbor",
    reason="harbor requires Python >=3.12; run the phoenix_client_harbor tox env",
)


def test_plugin_satisfies_harbor_protocol() -> None:
    """Harbor's contract is a runtime_checkable Protocol, so no subclassing is required."""
    from harbor.models.job.plugin import JobPlugin

    assert isinstance(PhoenixJobPlugin(), JobPlugin)


async def test_harbor_can_attach_plugin_by_entry_point_name() -> None:
    """End-to-end through Harbor's own attach path: resolve, construct, isinstance, invoke.

    on_job_start is still an unimplemented stub, so reaching its RuntimeError proves every
    earlier step succeeded, including entry-point resolution of the bare name "phoenix".
    """
    from harbor.cli.job_plugins import attach_job_plugin

    with pytest.raises(RuntimeError, match="lifecycle orchestration is not implemented"):
        await attach_job_plugin(
            object(),  # a Job stand-in; the plugin never touches it
            "phoenix",
            kwargs={"dataset": "my-dataset", "trace_mode": "atif"},
        )


async def test_harbor_surfaces_invalid_configuration_before_running() -> None:
    """Harbor wraps constructor TypeErrors into ValueError at attach time."""
    from harbor.cli.job_plugins import attach_job_plugin

    with pytest.raises(ValueError, match="Failed to construct plugin"):
        await attach_job_plugin(
            object(),  # a Job stand-in; the plugin never touches it
            "phoenix",
            kwargs={"unknown": "value"},
        )
