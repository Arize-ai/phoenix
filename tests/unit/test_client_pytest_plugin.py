from importlib.metadata import entry_points

import pytest


def test_the_client_pytest_plugin_is_blocked(request: pytest.FixtureRequest) -> None:
    """arize-phoenix-client's pytest plugin stays out of this suite via `-p no:phoenix` in
    the project's pytest options; under xdist it would collect the whole suite on the
    controller to look for its marker, which no test here carries."""
    if not any(ep.name == "phoenix" for ep in entry_points(group="pytest11")):
        pytest.skip("arize-phoenix-client's pytest plugin is not installed")
    manager = request.config.pluginmanager
    assert manager.is_blocked("phoenix")
    assert not manager.hasplugin("phoenix")
