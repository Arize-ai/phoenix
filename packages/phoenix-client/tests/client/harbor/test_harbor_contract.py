# pyright: reportArgumentType=false, reportMissingImports=false, reportMissingTypeStubs=false, reportUnknownVariableType=false
"""Contract tests against Harbor."""

from __future__ import annotations

import pytest

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12")


async def test_harbor_can_attach_plugin_by_entry_point_name() -> None:
    """The entry point loads and Harbor accepts the plugin."""
    from harbor.cli.job_plugins import attach_job_plugin

    with pytest.raises(RuntimeError, match="lifecycle orchestration is not implemented"):
        await attach_job_plugin(
            object(),  # a Job stand-in; the plugin never touches it
            "phoenix",
            kwargs={"trace_mode": "atif"},
        )
