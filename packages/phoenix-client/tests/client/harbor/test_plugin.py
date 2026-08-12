"""Tests that must pass on every supported Python, with harbor NOT installed."""

from __future__ import annotations

import subprocess
import sys
from importlib.metadata import entry_points

import pytest

from phoenix.client.harbor import PhoenixJobPlugin


def test_harbor_entry_point_resolves_plugin() -> None:
    (entry_point,) = entry_points(group="harbor.plugins", name="phoenix")

    assert entry_point.load() is PhoenixJobPlugin


def test_plugin_rejects_unknown_configuration() -> None:
    with pytest.raises(TypeError):
        PhoenixJobPlugin(unknown="value")  # type: ignore[call-arg]


def test_plugin_exposes_validated_config() -> None:
    plugin = PhoenixJobPlugin(dataset=" my-dataset ", trace_mode="otlp", project=" traces ")

    assert plugin.config.dataset == "my-dataset"
    assert plugin.config.trace_mode == "otlp"
    assert plugin.config.project == "traces"


def test_importing_plugin_does_not_import_harbor() -> None:
    """The plugin must never pull harbor into a user's runtime.

    harbor requires Python >=3.12 and brings a large dependency tree, so this property is
    what lets the plugin ship inside arize-phoenix-client without constraining the client's
    Python floor or dependency set. Asserted in a subprocess so an earlier test importing
    harbor cannot mask a regression.
    """
    code = (
        "import sys; import phoenix.client.harbor; "
        "print(any(m == 'harbor' or m.startswith('harbor.') for m in sys.modules))"
    )
    result = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, check=True
    )

    assert result.stdout.strip() == "False"
