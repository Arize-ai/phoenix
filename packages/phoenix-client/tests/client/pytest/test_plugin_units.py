"""Unit tests for the Phoenix pytest plugin's pure config logic."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional, cast

import pytest
from openinference.semconv.resource import ResourceAttributes

from phoenix.client.pytest.config import PhoenixTestConfig, PhoenixTestConfigError
from phoenix.client.pytest.context import (
    _iter_scores,  # pyright: ignore[reportPrivateUsage]
)
from phoenix.client.pytest.marker import resolve_dataset_name
from phoenix.client.pytest.session import DatasetGroup, SuiteState

if TYPE_CHECKING:
    from _pytest.nodes import Item


class _FakeMarker:
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs


class _FakeItem:
    def __init__(self, nodeid: str, marker: Optional[_FakeMarker] = None) -> None:
        self.nodeid = nodeid
        self._marker = marker

    def get_closest_marker(self, name: str) -> Optional[_FakeMarker]:
        return self._marker


def _dataset_name(
    nodeid: str, *, marker: Optional[_FakeMarker] = None, override: Optional[str] = None
) -> str:
    return resolve_dataset_name(cast("Item", _FakeItem(nodeid, marker)), override=override)


class TestConfig:
    def test_defaults(self) -> None:
        cfg = PhoenixTestConfig.from_env({})
        assert cfg.tracking is True
        assert cfg.offline is False
        assert cfg.repetitions == 1
        assert cfg.dataset_override is None

    def test_tracking_false_is_offline(self) -> None:
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_TRACKING": "false"}).offline is True

    def test_repetitions_invalid_raises(self) -> None:
        with pytest.raises(PhoenixTestConfigError):
            PhoenixTestConfig.from_env({"PHOENIX_TEST_REPETITIONS": "zero"})

    @pytest.mark.parametrize(
        "env_dataset,ini_override,expected",
        [
            ("smoke", None, "smoke"),
            ("smoke", "from-ini", "smoke"),
            (None, "from-ini", "from-ini"),
            ("   ", "from-ini", "from-ini"),
        ],
        ids=["env-only", "env-beats-ini", "ini-when-no-env", "blank-env-falls-back-to-ini"],
    )
    def test_dataset_override_precedence(
        self, env_dataset: Optional[str], ini_override: Optional[str], expected: str
    ) -> None:
        env = {"PHOENIX_TEST_DATASET": env_dataset} if env_dataset is not None else {}
        cfg = PhoenixTestConfig.from_env(env, dataset_override=ini_override)
        assert cfg.dataset_override == expected


class TestResolveDatasetName:
    @pytest.mark.parametrize(
        "nodeid,marker,override,expected",
        [
            ("tests/agent/test_eval.py::test_x", None, None, "tests/agent/test_eval"),
            ("tests/sql/test_eval.py::test_x", None, None, "tests/sql/test_eval"),
            ("tests/test_qa.py::test_answers[arithmetic]", None, None, "tests/test_qa"),
            ("tests/test_qa.py::test_x", _FakeMarker(dataset="qa-suite"), None, "qa-suite"),
            ("tests/test_qa.py::test_x", _FakeMarker(dataset="qa-suite"), "smoke", "smoke"),
        ],
        ids=[
            "path-default",
            "same-basename-different-dir-no-collision",
            "strips-parametrize-id",
            "marker-beats-path",
            "override-beats-marker",
        ],
    )
    def test_resolution(
        self,
        nodeid: str,
        marker: Optional[_FakeMarker],
        override: Optional[str],
        expected: str,
    ) -> None:
        assert _dataset_name(nodeid, marker=marker, override=override) == expected


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


class TestIterScores:
    """_iter_scores must accept the same return shapes as a run_experiment evaluator.

    Regression guard: bool / float / str / (score, explanation) returns used to normalize to
    an all-None annotation (silently rejected by the server). They must now carry a value.
    """

    def test_bool_return_records_score_and_label(self) -> None:
        scores = _iter_scores(True, default_name="exact_match")
        assert scores == [
            {
                "name": "exact_match",
                "score": 1.0,
                "label": "True",
                "explanation": None,
                "metadata": None,
            }
        ]

    def test_float_return_records_score(self) -> None:
        (score,) = _iter_scores(0.75, default_name="similarity")
        assert score["name"] == "similarity"
        assert score["score"] == 0.75

    def test_str_return_records_label(self) -> None:
        (score,) = _iter_scores("positive", default_name="sentiment")
        assert score["score"] is None
        assert score["label"] == "positive"

    def test_tuple_is_score_and_explanation_as_one_score(self) -> None:
        # The old _iter_scores iterated a tuple element-wise, producing two all-None
        # annotations. Delegation to _default_eval_scorer makes a 2-tuple one score whose
        # second element is the explanation, per the documented evaluator contract.
        scores = _iter_scores((0.9, "close enough"), default_name="grade")
        assert len(scores) == 1
        assert scores[0]["score"] == 0.9
        assert scores[0]["explanation"] == "close enough"
        assert scores[0]["label"] is None

    def test_dict_return_keeps_its_own_name(self) -> None:
        (score,) = _iter_scores({"name": "correctness", "score": 1.0}, default_name="ignored")
        assert score["name"] == "correctness"
        assert score["score"] == 1.0

    def test_list_of_dicts_yields_multiple_named_scores(self) -> None:
        scores = _iter_scores(
            [{"name": "a", "score": 1.0}, {"name": "b", "score": 0.0}],
            default_name="multi",
        )
        assert {s["name"] for s in scores} == {"a", "b"}

    def test_none_return_yields_no_scores(self) -> None:
        assert _iter_scores(None, default_name="x") == []

    def test_uninterpretable_return_degrades_to_empty(self) -> None:
        assert _iter_scores(object(), default_name="x") == []
