from __future__ import annotations

from importlib.metadata import entry_points

from phoenix.client.harbor import PhoenixJobPlugin


def test_harbor_entry_point_resolves_plugin() -> None:
    (entry_point,) = entry_points(group="harbor.plugins", name="phoenix")

    assert entry_point.load() is PhoenixJobPlugin
