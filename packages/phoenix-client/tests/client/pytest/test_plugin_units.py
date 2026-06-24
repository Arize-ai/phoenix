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

        from phoenix.client import Client

        worker = SuiteState(config=PhoenixTestConfig(tracking=True), partial_collection=False)
        worker._groups["ds"] = DatasetGroup(name="ds")  # pyright: ignore[reportPrivateUsage]
        worker.adopt_broadcast(payload, client=Client())
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


class TestEnvBool:
    """PHOENIX_TEST_TRACKING parsing is symmetric and fails loud on typos."""

    def test_none_and_empty_resolve_to_default(self) -> None:
        from phoenix.client.pytest.config import _env_bool  # pyright: ignore[reportPrivateUsage]

        assert _env_bool(None, default=True) is True
        assert _env_bool(None, default=False) is False
        assert _env_bool("", default=True) is True
        assert _env_bool("   ", default=False) is False

    def test_recognized_values(self) -> None:
        from phoenix.client.pytest.config import _env_bool  # pyright: ignore[reportPrivateUsage]

        assert _env_bool("yes", default=False) is True
        assert _env_bool("1", default=False) is True
        assert _env_bool("OFF", default=True) is False
        assert _env_bool("false", default=True) is False

    def test_unrecognized_raises(self) -> None:
        from phoenix.client.pytest.config import _env_bool  # pyright: ignore[reportPrivateUsage]

        with pytest.raises(PhoenixTestConfigError):
            _env_bool("flase", default=True)

    def test_from_env_tracking(self) -> None:
        # empty -> default (True), not the old silent "off"; a typo fails loud.
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_TRACKING": ""}).tracking is True
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_TRACKING": "no"}).tracking is False
        with pytest.raises(PhoenixTestConfigError):
            PhoenixTestConfig.from_env({"PHOENIX_TEST_TRACKING": "garbage"})


class TestAnnotatorKind:
    """_annotator_kind_for derives CODE/LLM from the evaluator instead of defaulting to LLM."""

    def test_plain_callable_is_code(self) -> None:
        from phoenix.client.pytest.context import (
            _annotator_kind_for,  # pyright: ignore[reportPrivateUsage]
        )

        def ev(output: Any) -> float:
            return 1.0

        assert _annotator_kind_for(ev) == "CODE"

    def test_create_evaluator_kind_is_honored(self) -> None:
        from phoenix.client.pytest.context import (
            _annotator_kind_for,  # pyright: ignore[reportPrivateUsage]
        )
        from phoenix.client.resources.experiments.evaluators import create_evaluator

        @create_evaluator(kind="LLM", name="judge")
        def llm_ev(output: Any) -> float:
            return 1.0

        @create_evaluator(kind="CODE", name="match")
        def code_ev(output: Any) -> bool:
            return True

        assert _annotator_kind_for(llm_ev) == "LLM"
        assert _annotator_kind_for(code_ev) == "CODE"


class TestInvokeEvaluator:
    """_invoke_evaluator dispatches by signature so create_evaluator objects work."""

    def test_create_evaluator_object_dispatches_by_keyword(self) -> None:
        from phoenix.client.pytest.context import (
            _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
        )
        from phoenix.client.resources.experiments.evaluators import create_evaluator

        @create_evaluator(kind="CODE", name="exact")
        def exact(output: Any, expected: Any = None) -> bool:
            return output == "hi"

        # create_evaluator objects expose evaluate(self, **kwargs); a positional dict used to
        # raise TypeError. The result is a normalized EvaluationResult dict.
        result = _invoke_evaluator(exact, {"output": "hi"})
        assert result["score"] == 1.0

    def test_plain_callable_dispatches_by_keyword(self) -> None:
        from phoenix.client.pytest.context import (
            _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
        )

        def ev(output: Any) -> dict[str, Any]:
            return {"score": 0.5}

        assert _invoke_evaluator(ev, {"output": "x"})["score"] == 0.5

    def test_async_create_evaluator_runs_via_async_evaluate(self) -> None:
        # An async create_evaluator stubs out evaluate() (it raises NotImplementedError) and puts
        # the logic in async_evaluate(); the plugin must fall back to it and await the coroutine
        # instead of letting the NotImplementedError escape or dropping the score.
        from phoenix.client.pytest.context import (
            _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
        )
        from phoenix.client.resources.experiments.evaluators import create_evaluator

        @create_evaluator(kind="CODE", name="async_exact")
        async def exact(output: Any, expected: Any = None) -> bool:
            return output == "hi"

        result = _invoke_evaluator(exact, {"output": "hi"})
        assert result["score"] == 1.0

    def test_plain_async_callable_is_awaited(self) -> None:
        # A bare ``async def`` evaluator returns a coroutine; it must be driven to its value
        # rather than handed to the scorer as an (uninterpretable, never-awaited) coroutine.
        from phoenix.client.pytest.context import (
            _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
        )

        async def ev(output: Any) -> dict[str, Any]:
            return {"score": 0.25}

        assert _invoke_evaluator(ev, {"output": "x"})["score"] == 0.25

    def test_async_evaluator_scores_record_through_iter_scores(self) -> None:
        # End-to-end: an async evaluator's resolved result flows through _iter_scores to a
        # concrete score (previously dropped as an uninterpretable coroutine).
        from phoenix.client.pytest.context import (
            _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
        )

        async def grader(output: Any) -> float:
            return 0.5

        result = _invoke_evaluator(grader, {"output": "x"})
        (score,) = _iter_scores(result, default_name="grader")
        assert score["score"] == 0.5
