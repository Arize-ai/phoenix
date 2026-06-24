"""Unit tests for the Phoenix pytest plugin's pure config logic."""

from __future__ import annotations

import pytest
from openinference.semconv.resource import ResourceAttributes

from phoenix.client.pytest_plugin.config import PhoenixTestConfig, PhoenixTestConfigError
from phoenix.client.pytest_plugin.session import DatasetGroup, SuiteState


class TestConfig:
    def test_defaults(self) -> None:
        cfg = PhoenixTestConfig.from_env({})
        assert cfg.tracking is True
        assert cfg.offline is False
        assert cfg.repetitions == 1

    def test_tracking_false_is_offline(self) -> None:
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_TRACKING": "false"}).offline is True

    def test_repetitions_invalid_raises(self) -> None:
        with pytest.raises(PhoenixTestConfigError):
            PhoenixTestConfig.from_env({"PHOENIX_TEST_REPETITIONS": "zero"})


class TestBroadcastTracing:
    def test_adopt_broadcast_builds_per_worker_tracer_with_project_name(self) -> None:
        """Under xdist the controller broadcasts project_name and each worker builds its own
        tracer scoped to that project."""
        state = SuiteState(config=PhoenixTestConfig(tracking=True), partial_collection=False)
        state._groups["ds"] = DatasetGroup(  # pyright: ignore[reportPrivateUsage]
            name="ds", experiment_id="Experiment:1", project_name="proj-x"
        )
        payload = state.broadcast_payload()
        assert payload["ds"]["project_name"] == "proj-x"

        worker = SuiteState(config=PhoenixTestConfig(tracking=True), partial_collection=False)
        worker._groups["ds"] = DatasetGroup(name="ds")  # pyright: ignore[reportPrivateUsage]
        worker.adopt_broadcast(payload)
        tracer = worker.tracer_for("ds")
        assert tracer is not None
        assert tracer.resource.attributes.get(ResourceAttributes.PROJECT_NAME) == "proj-x"
