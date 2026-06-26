"""Unit coverage for the Phoenix pytest plugin's error paths, guards, and pure helpers.

These complement ``test_plugin_units.py`` (config/score normalization) and
``test_plugin_integration.py`` (the pytester lifecycle) by exercising the branches that the
end-to-end runs do not reach: validation failures, degradation-to-warning fallbacks, the
context helpers' dispatch corners, the ``SuiteState`` recording guards, and the ``SuiteTracer``
span machinery with a fake tracer (no OpenTelemetry/server needed).
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import AbstractContextManager, nullcontext
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any, Optional, cast

import pytest

from phoenix.client.pytest.config import PhoenixTestConfig, PhoenixTestConfigError

if TYPE_CHECKING:
    from _pytest.nodes import Item


# --------------------------------------------------------------------------------------------
# config
# --------------------------------------------------------------------------------------------


class TestConfigRepetitions:
    def test_zero_repetitions_raises(self) -> None:
        # An integer < 1 is parsed fine but rejected by the >= 1 guard (distinct from the
        # "not an integer" path already covered).
        with pytest.raises(PhoenixTestConfigError, match=">= 1"):
            PhoenixTestConfig.from_env({"PHOENIX_TEST_REPETITIONS": "0"})

    def test_negative_repetitions_raises(self) -> None:
        with pytest.raises(PhoenixTestConfigError, match=">= 1"):
            PhoenixTestConfig.from_env({"PHOENIX_TEST_REPETITIONS": "-3"})

    def test_explicit_repetitions(self) -> None:
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_REPETITIONS": "5"}).repetitions == 5


# --------------------------------------------------------------------------------------------
# marker
# --------------------------------------------------------------------------------------------


class _FakeMarker:
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs


class _FakeItem:
    def __init__(
        self,
        nodeid: str,
        marker: Optional[_FakeMarker] = None,
        callspec: Any = None,
    ) -> None:
        self.nodeid = nodeid
        self._marker = marker
        if callspec is not None:
            self.callspec = callspec

    def get_closest_marker(self, name: str) -> Optional[_FakeMarker]:
        return self._marker


def _item(
    nodeid: str = "tests/test_x.py::test_y",
    *,
    marker: Optional[_FakeMarker] = None,
    callspec: Any = None,
) -> "Item":
    return cast("Item", _FakeItem(nodeid, marker, callspec))


class TestResolveRepetitions:
    def test_no_marker_uses_env_default(self) -> None:
        from phoenix.client.pytest.marker import resolve_repetitions

        assert resolve_repetitions(None, env_default=4) == 4

    def test_env_default_floored_at_one(self) -> None:
        from phoenix.client.pytest.marker import resolve_repetitions

        assert resolve_repetitions(None, env_default=0) == 1

    def test_marker_repetitions_wins(self) -> None:
        from phoenix.client.pytest.marker import resolve_repetitions

        assert resolve_repetitions(_FakeMarker(repetitions=3), env_default=1) == 3

    def test_marker_without_repetitions_falls_back(self) -> None:
        from phoenix.client.pytest.marker import resolve_repetitions

        assert resolve_repetitions(_FakeMarker(dataset="d"), env_default=2) == 2

    def test_marker_repetitions_below_one_raises(self) -> None:
        from phoenix.client.pytest.marker import resolve_repetitions

        with pytest.raises(ValueError, match=">= 1"):
            resolve_repetitions(_FakeMarker(repetitions=0), env_default=1)


class TestResolveEvaluators:
    def test_no_marker_returns_empty(self) -> None:
        from phoenix.client.pytest.marker import resolve_evaluators

        assert resolve_evaluators(_item()) == []

    def test_marker_without_evaluators_returns_empty(self) -> None:
        from phoenix.client.pytest.marker import resolve_evaluators

        assert resolve_evaluators(_item(marker=_FakeMarker(dataset="d"))) == []

    def test_list_passed_through(self) -> None:
        from phoenix.client.pytest.marker import resolve_evaluators

        a, b = object(), object()
        assert resolve_evaluators(_item(marker=_FakeMarker(evaluators=[a, b]))) == [a, b]

    def test_single_evaluator_wrapped_in_list(self) -> None:
        from phoenix.client.pytest.marker import resolve_evaluators

        ev = object()
        assert resolve_evaluators(_item(marker=_FakeMarker(evaluators=ev))) == [ev]


class TestDatasetNameMarkerEmptyDataset:
    def test_empty_marker_dataset_falls_back_to_path(self) -> None:
        # A marker present but with an empty/falsy dataset= must not win; the path default applies.
        from phoenix.client.pytest.marker import resolve_dataset_name

        name = resolve_dataset_name(
            _item("tests/test_x.py::test_y", marker=_FakeMarker(dataset=""))
        )
        assert name == "tests/test_x"


class TestStableExternalId:
    def test_unparametrized_nodeid_unchanged(self) -> None:
        from phoenix.client.pytest.marker import stable_external_id

        assert stable_external_id(_item("tests/test_x.py::test_y")) == "tests/test_x.py::test_y"

    def test_parametrized_id_preserved(self) -> None:
        from phoenix.client.pytest.marker import stable_external_id

        assert (
            stable_external_id(_item("tests/test_x.py::test_y[a-b]"))
            == "tests/test_x.py::test_y[a-b]"
        )

    def test_repetition_token_stripped(self) -> None:
        from phoenix.client.pytest.marker import stable_external_id

        # phxrepN is injected by pytest_generate_tests; it must be stripped so all reps share one
        # external_id, leaving the genuine parametrize tokens intact.
        assert (
            stable_external_id(_item("tests/test_x.py::test_y[a-phxrep2-b]"))
            == "tests/test_x.py::test_y[a-b]"
        )

    def test_only_repetition_token_collapses_to_base(self) -> None:
        from phoenix.client.pytest.marker import stable_external_id

        assert (
            stable_external_id(_item("tests/test_x.py::test_y[phxrep1]"))
            == "tests/test_x.py::test_y"
        )


class TestRepetitionIndex:
    def test_no_callspec_is_zero(self) -> None:
        from phoenix.client.pytest.marker import repetition_index

        assert repetition_index(_item()) == 0

    def test_reads_callspec_param(self) -> None:
        from phoenix.client.pytest.marker import REPETITION_PARAM, repetition_index

        item = _item(callspec=SimpleNamespace(params={REPETITION_PARAM: 2}))
        assert repetition_index(item) == 2

    def test_callspec_without_param_is_zero(self) -> None:
        from phoenix.client.pytest.marker import repetition_index

        item = _item(callspec=SimpleNamespace(params={"other": 1}))
        assert repetition_index(item) == 0


# --------------------------------------------------------------------------------------------
# context: helper dispatch corners
# --------------------------------------------------------------------------------------------


class TestContextHelpersOutsideRun:
    def test_log_output_outside_marked_test_raises(self) -> None:
        from phoenix.client.pytest import log_output
        from phoenix.client.pytest.context import PhoenixContextError

        with pytest.raises(PhoenixContextError):
            log_output("x")

    def test_log_evaluation_outside_marked_test_raises(self) -> None:
        from phoenix.client.pytest import log_evaluation
        from phoenix.client.pytest.context import PhoenixContextError

        with pytest.raises(PhoenixContextError):
            log_evaluation(name="x", score=1.0)

    def test_current_run_is_none_outside_test(self) -> None:
        from phoenix.client.pytest.context import current_run

        assert current_run() is None


class TestInvokeEvaluatorErrors:
    def test_non_callable_object_raises_typeerror(self) -> None:
        from phoenix.client.pytest.context import (
            _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
        )

        with pytest.raises(TypeError, match="not a usable evaluator"):
            _invoke_evaluator(object(), {"output": "x"})

    def test_stub_evaluate_without_async_evaluate_raises(self) -> None:
        # An evaluator whose sync evaluate() raises NotImplementedError but exposes no usable
        # async_evaluate() surfaces the NotImplementedError rather than silently dropping.
        from phoenix.client.pytest.context import (
            _invoke_evaluator,  # pyright: ignore[reportPrivateUsage]
        )

        def evaluate(eval_input: Any) -> Any:
            raise NotImplementedError

        ev = SimpleNamespace(evaluate=evaluate)  # no async_evaluate attribute
        with pytest.raises(NotImplementedError, match="no usable async_evaluate"):
            _invoke_evaluator(ev, {"output": "x"})


class TestCallEvaluate:
    def test_positional_signature_passes_mapping_positionally(self) -> None:
        from phoenix.client.pytest.context import (
            _call_evaluate,  # pyright: ignore[reportPrivateUsage]
        )

        seen: dict[str, Any] = {}

        def evaluate(eval_input: Any, input_mapping: Any = None) -> str:
            seen.update(eval_input)
            return "ok"

        assert _call_evaluate(evaluate, {"a": 1}) == "ok"
        assert seen == {"a": 1}

    def test_unintrospectable_callable_passes_mapping_positionally(self) -> None:
        # inspect.signature fails on some builtins (ValueError); the helper then calls the target
        # with the mapping positionally rather than crashing.
        from phoenix.client.pytest.context import (
            _call_evaluate,  # pyright: ignore[reportPrivateUsage]
        )

        target: dict[str, Any] = {}
        result = _call_evaluate(target.update, {"a": 1})  # builtin method, no signature
        assert result is None
        assert target == {"a": 1}


class TestRunBlocking:
    def test_drives_coroutine_with_no_running_loop(self) -> None:
        from phoenix.client.pytest.context import (
            _run_blocking,  # pyright: ignore[reportPrivateUsage]
        )

        async def coro() -> int:
            return 7

        assert _run_blocking(coro()) == 7

    def test_drives_coroutine_inside_running_loop_on_worker_thread(self) -> None:
        # Called from within a running loop (an inline evaluate() in an async test), the helper
        # cannot re-enter the loop, so it drives the awaitable on a dedicated worker thread.
        from phoenix.client.pytest.context import (
            _run_blocking,  # pyright: ignore[reportPrivateUsage]
        )

        async def coro() -> int:
            return 11

        async def driver() -> int:
            return cast(int, _run_blocking(coro()))

        assert asyncio.run(driver()) == 11


class TestAnnotatorKindFromSource:
    def test_source_llm_is_llm(self) -> None:
        from phoenix.client.pytest.context import (
            _annotator_kind_for,  # pyright: ignore[reportPrivateUsage]
        )

        assert _annotator_kind_for(SimpleNamespace(source="llm")) == "LLM"

    def test_source_non_llm_is_code(self) -> None:
        from phoenix.client.pytest.context import (
            _annotator_kind_for,  # pyright: ignore[reportPrivateUsage]
        )

        assert _annotator_kind_for(SimpleNamespace(source="heuristic")) == "CODE"


class TestIterScoresNonMappingEntry:
    def test_non_mapping_entries_are_skipped(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # _default_eval_scorer normally yields mappings; guard the defensive skip of any
        # non-mapping entry in a returned sequence.
        import phoenix.client.resources.experiments.evaluators as ev_mod
        from phoenix.client.pytest.context import (
            _iter_scores,  # pyright: ignore[reportPrivateUsage]
        )

        def _scorer(result: Any) -> list[Any]:
            return [{"name": "kept", "score": 1.0}, "junk", 42]

        monkeypatch.setattr(ev_mod, "_default_eval_scorer", _scorer)
        scores = _iter_scores("anything", default_name="d")
        assert [s["name"] for s in scores] == ["kept"]


# --------------------------------------------------------------------------------------------
# session: pure helpers + recording guards
# --------------------------------------------------------------------------------------------


class _RecItem:
    """Minimal pytest item: a nodeid, an optional phoenix marker, and an optional callspec."""

    def __init__(
        self, nodeid: str, *, marker: Optional[_FakeMarker] = None, params: Any = None
    ) -> None:
        self.nodeid = nodeid
        self._marker = marker
        if params is not None:
            self.callspec = SimpleNamespace(params=params)

    def get_closest_marker(self, name: str) -> Optional[_FakeMarker]:
        return self._marker


class _FakeExperiments:
    def __init__(self, *, log_run_error: Optional[Exception] = None) -> None:
        self.runs: list[dict[str, Any]] = []
        self.evals: list[dict[str, Any]] = []
        self._log_run_error = log_run_error

    def log_run(self, **kwargs: Any) -> dict[str, Any]:
        if self._log_run_error is not None:
            raise self._log_run_error
        rid = f"ExperimentRun:{len(self.runs)}"
        self.runs.append({"id": rid, **kwargs})
        return {"id": rid}

    def log_evaluation(self, **kwargs: Any) -> dict[str, Any]:
        self.evals.append(kwargs)
        return {"id": "A:1"}


class _FakeClient:
    def __init__(self, **kw: Any) -> None:
        self.experiments = _FakeExperiments(**kw)


def _binding(state: Any, *, nodeid: str = "tests/t.py::test_a", dataset: str = "ds") -> Any:
    from phoenix.client.pytest.marker import stable_external_id

    item = _RecItem(nodeid)
    external_id = stable_external_id(cast("Item", item))
    state.register_item(cast("Item", item), dataset_name=dataset, external_id=external_id)
    return state.binding_for(cast("Item", item))


def _make_state(*, offline: bool = False) -> Any:
    from phoenix.client.pytest.session import SuiteState

    return SuiteState(config=PhoenixTestConfig(tracking=not offline), partial_collection=False)


def _record(state: Any, binding: Any, **kw: Any) -> None:
    from phoenix.client.pytest.context import (
        _RunRecord,  # pyright: ignore[reportPrivateUsage]
    )

    record = kw.pop("record", None)
    if record is None:
        record = _RunRecord(nodeid=binding.nodeid, external_id=binding.external_id)
    now = datetime.now(timezone.utc)
    state.record_run(
        binding,
        record=record,
        start_time=kw.pop("start_time", now),
        end_time=kw.pop("end_time", now),
        passed=kw.pop("passed", True),
        error=kw.pop("error", None),
        pass_annotation="pass",
        run_evaluators=kw.pop("run_evaluators", True),
        **kw,
    )


class TestSuiteStateRecordGuards:
    def test_offline_records_locally_without_client_calls(self) -> None:
        state = _make_state(offline=True)
        binding = _binding(state)
        _record(state, binding)
        assert len(state.recorded_runs) == 1
        # No client was ever set; offline short-circuits before any network call.
        assert state.client is None

    def test_no_client_skips_posting(self) -> None:
        state = _make_state()  # online but never bootstrapped -> _client is None
        binding = _binding(state)
        _record(state, binding)
        assert len(state.recorded_runs) == 1

    def test_unresolved_example_skips_posting(self) -> None:
        state = _make_state()
        binding = _binding(state)
        client = _FakeClient()
        state._client = client  # pyright: ignore[reportPrivateUsage]
        # group exists with no experiment_id / example_id -> guarded out, nothing posted.
        _record(state, binding)
        assert client.experiments.runs == []

    def test_happy_path_posts_run_and_pass_and_custom_evals(self) -> None:
        from phoenix.client.pytest.context import (
            _RunRecord,  # pyright: ignore[reportPrivateUsage]
        )

        state = _make_state()
        binding = _binding(state)
        group = state.groups["ds"]
        group.experiment_id = "Experiment:1"
        binding.dataset_example_id = "DatasetExampleGID:0"
        # register_item stored a copy in the group; mirror the resolved example id there too.
        state.groups["ds"].bindings[binding.external_id].dataset_example_id = "DatasetExampleGID:0"
        client = _FakeClient()
        state._client = client  # pyright: ignore[reportPrivateUsage]

        record = _RunRecord(nodeid=binding.nodeid, external_id=binding.external_id)
        record.set_output("out")
        record.add_evaluation(name="custom", score=0.5, label="ok")
        _record(state, binding, record=record, run_evaluators=False)

        assert len(client.experiments.runs) == 1
        names = {e["name"] for e in client.experiments.evals}
        assert names == {"pass", "custom"}
        pass_eval = next(e for e in client.experiments.evals if e["name"] == "pass")
        assert pass_eval["score"] == 1.0 and pass_eval["label"] == "pass"

    def test_log_run_non_409_failure_degrades(self, caplog: pytest.LogCaptureFixture) -> None:
        state = _make_state()
        binding = _binding(state)
        state.groups["ds"].experiment_id = "Experiment:1"
        binding.dataset_example_id = "DatasetExampleGID:0"
        client = _FakeClient(log_run_error=RuntimeError("boom"))
        state._client = client  # pyright: ignore[reportPrivateUsage]
        with caplog.at_level(logging.WARNING):
            _record(state, binding)
        # The run is still recorded locally; the failure degraded to a warning, no evals posted.
        assert len(state.recorded_runs) == 1
        assert client.experiments.evals == []
        assert any("failed to log run" in r.message for r in caplog.records)


class TestSuiteStateMisc:
    def test_property_getters(self) -> None:
        state = _make_state()
        binding = _binding(state)
        assert state.dataset_names == ["ds"]
        assert "ds" in state.groups
        assert state.bootstrap_error is None
        assert state.recorded_runs == []
        assert binding is not None

    def test_record_bootstrap_error(self) -> None:
        state = _make_state()
        err = RuntimeError("nope")
        state.record_bootstrap_error(err)
        assert state.bootstrap_error is err

    def test_project_name_for_unknown_dataset_is_none(self) -> None:
        state = _make_state()
        assert state.project_name_for("missing") is None

    def test_build_tracers_offline_is_noop(self) -> None:
        state = _make_state(offline=True)
        _binding(state)
        state._build_tracers()  # pyright: ignore[reportPrivateUsage]
        assert state.tracer_for("ds") is None

    def test_resolve_examples_without_dataset_id_is_noop(self) -> None:
        from phoenix.client.pytest.session import DatasetGroup

        state = _make_state()
        group = DatasetGroup(name="ds")  # dataset_id is None
        state._resolve_examples(group)  # pyright: ignore[reportPrivateUsage]
        assert group.example_ids == {}

    def test_create_experiment_without_dataset_id_is_noop(self) -> None:
        from phoenix.client.pytest.session import DatasetGroup

        state = _make_state()
        group = DatasetGroup(name="ds")
        state._client = _FakeClient()  # pyright: ignore[reportPrivateUsage]
        state._create_experiment(group)  # pyright: ignore[reportPrivateUsage]
        assert group.experiment_id is None

    def test_adopt_broadcast_ignores_unknown_group(self) -> None:
        state = _make_state()
        _binding(state, dataset="known")
        state.adopt_broadcast({"unknown": {"experiment_id": "E:9"}}, client=_FakeClient())
        # The unknown group is skipped; the known one is untouched.
        assert state.groups["known"].experiment_id is None

    def test_safe_log_eval_swallows_errors(self, caplog: pytest.LogCaptureFixture) -> None:
        state = _make_state()

        class _Boom:
            class experiments:  # noqa: N801
                @staticmethod
                def log_evaluation(**kw: Any) -> None:
                    raise RuntimeError("eval boom")

        state._client = _Boom()  # pyright: ignore[reportPrivateUsage]
        with caplog.at_level(logging.WARNING):
            state._safe_log_eval(name="x")  # pyright: ignore[reportPrivateUsage]
        assert any("failed to log evaluation" in r.message for r in caplog.records)

    def test_run_marker_evaluators_missing_item_is_noop(self) -> None:
        from phoenix.client.pytest.session import ItemBinding

        state = _make_state()
        state._client = _FakeClient()  # pyright: ignore[reportPrivateUsage]
        binding = ItemBinding(nodeid="unregistered", dataset_name="ds", external_id="x")
        # No item registered for this nodeid -> the method returns without evaluating.
        state._run_marker_evaluators(  # pyright: ignore[reportPrivateUsage]
            binding, run_id="R:0", output="o", tracer=None
        )
        assert state.client.experiments.evals == []

    def test_summary_lines(self) -> None:
        state = _make_state()
        assert "experiment" in state.summary_line()
        assert "offline" in _make_state(offline=True).offline_summary_line()


class TestExampleFields:
    def test_none_item_yields_empty_nodeid_input(self) -> None:
        from phoenix.client.pytest.session import (
            _example_fields,  # pyright: ignore[reportPrivateUsage]
        )

        inp, out, md = _example_fields(None)
        assert inp == {"nodeid": ""}
        assert out == {} and md == {}

    def test_unparametrized_item_uses_nodeid(self) -> None:
        from phoenix.client.pytest.session import (
            _example_fields,  # pyright: ignore[reportPrivateUsage]
        )

        inp, _, md = _example_fields(cast("Item", _RecItem("tests/t.py::test_a")))
        assert inp == {"nodeid": "tests/t.py::test_a"}
        assert "evaluators" not in md

    def test_parametrized_item_serializes_params(self) -> None:
        from phoenix.client.pytest.marker import REPETITION_PARAM
        from phoenix.client.pytest.session import (
            _example_fields,  # pyright: ignore[reportPrivateUsage]
        )

        item = _RecItem(
            "tests/t.py::test_a",
            marker=_FakeMarker(),
            params={"n": 2, "obj": [1, 2], REPETITION_PARAM: 0},
        )
        inp, _, _ = _example_fields(cast("Item", item))
        assert inp["n"] == 2
        assert inp["obj"] == "[1, 2]"  # non-scalar -> repr
        assert REPETITION_PARAM not in inp

    def test_marker_evaluators_recorded_in_metadata(self) -> None:
        from phoenix.client.pytest.session import (
            _example_fields,  # pyright: ignore[reportPrivateUsage]
        )

        def grader(output: Any) -> bool:
            return True

        grader.name = "grader"  # type: ignore[attr-defined]
        item = _RecItem(
            "tests/t.py::test_a", marker=_FakeMarker(evaluators=[grader]), params={"n": 1}
        )
        _, _, md = _example_fields(cast("Item", item))
        assert md["evaluators"] == ["grader"]


class TestJsonable:
    def test_scalars_pass_through(self) -> None:
        from phoenix.client.pytest.session import _jsonable  # pyright: ignore[reportPrivateUsage]

        for v in ("s", 1, 1.5, True, None):
            assert _jsonable(v) == v

    def test_non_scalar_is_repr(self) -> None:
        from phoenix.client.pytest.session import _jsonable  # pyright: ignore[reportPrivateUsage]

        assert _jsonable({"a": 1}) == repr({"a": 1})


# --------------------------------------------------------------------------------------------
# plugin: pure helpers
# --------------------------------------------------------------------------------------------


class TestChainInput:
    def test_params_used_when_present(self) -> None:
        from phoenix.client.pytest.marker import REPETITION_PARAM
        from phoenix.client.pytest.plugin import (
            _chain_input,  # pyright: ignore[reportPrivateUsage]
        )

        item = _RecItem("tests/t.py::test_a", params={"q": "x", REPETITION_PARAM: 0})
        assert _chain_input(cast("Item", item)) == {"q": "x"}

    def test_nodeid_used_when_unparametrized(self) -> None:
        from phoenix.client.pytest.plugin import (
            _chain_input,  # pyright: ignore[reportPrivateUsage]
        )

        item = _RecItem("tests/t.py::test_a")
        assert _chain_input(cast("Item", item)) == {"nodeid": "tests/t.py::test_a"}

    def test_only_repetition_param_falls_back_to_nodeid(self) -> None:
        from phoenix.client.pytest.marker import REPETITION_PARAM
        from phoenix.client.pytest.plugin import (
            _chain_input,  # pyright: ignore[reportPrivateUsage]
        )

        item = _RecItem("tests/t.py::test_a", params={REPETITION_PARAM: 0})
        assert _chain_input(cast("Item", item)) == {"nodeid": "tests/t.py::test_a"}


class TestCallTimes:
    def test_numeric_start_stop(self) -> None:
        from phoenix.client.pytest.plugin import _call_times  # pyright: ignore[reportPrivateUsage]

        start, stop = _call_times(SimpleNamespace(start=0.0, stop=10.0))
        assert start == datetime.fromtimestamp(0.0, timezone.utc)
        assert stop == datetime.fromtimestamp(10.0, timezone.utc)

    def test_missing_times_fall_back_to_now(self) -> None:
        from phoenix.client.pytest.plugin import _call_times  # pyright: ignore[reportPrivateUsage]

        start, stop = _call_times(SimpleNamespace(start=None, stop=None))
        assert start == stop  # both default to a single "now"
        assert start.tzinfo is timezone.utc


class TestExcinfoRepr:
    def test_none_when_no_exception(self) -> None:
        from phoenix.client.pytest.plugin import (
            _excinfo_repr,  # pyright: ignore[reportPrivateUsage]
        )

        assert _excinfo_repr(SimpleNamespace(excinfo=None)) is None

    def test_repr_of_exception(self) -> None:
        from phoenix.client.pytest.plugin import (
            _excinfo_repr,  # pyright: ignore[reportPrivateUsage]
        )

        call = SimpleNamespace(excinfo=SimpleNamespace(value=ValueError("bad")))
        assert _excinfo_repr(call) == repr(ValueError("bad"))


class TestIsPartialCollection:
    @pytest.mark.parametrize(
        "option_kwargs",
        [
            {"keyword": "foo"},
            {"markexpr": "smoke"},
            {"last_failed": True},
            {"failed_first": True},
            {"lf": True},
            {"ff": True},
        ],
    )
    def test_filtered_options_are_partial(self, option_kwargs: dict[str, Any]) -> None:
        from phoenix.client.pytest.plugin import (
            _is_partial_collection,  # pyright: ignore[reportPrivateUsage]
        )

        base = {
            "keyword": None,
            "markexpr": None,
            "last_failed": False,
            "failed_first": False,
            "lf": False,
            "ff": False,
        }
        base.update(option_kwargs)
        config = SimpleNamespace(option=SimpleNamespace(**base), args=[])
        session = SimpleNamespace(config=config)
        assert _is_partial_collection(cast(Any, session), cast(Any, config)) is True

    def test_nodeid_arg_is_partial(self) -> None:
        from phoenix.client.pytest.plugin import (
            _is_partial_collection,  # pyright: ignore[reportPrivateUsage]
        )

        config = SimpleNamespace(
            option=SimpleNamespace(
                keyword=None,
                markexpr=None,
                last_failed=False,
                failed_first=False,
                lf=False,
                ff=False,
            ),
            args=["tests/t.py::test_a"],
        )
        session = SimpleNamespace(config=config)
        assert _is_partial_collection(cast(Any, session), cast(Any, config)) is True

    def test_full_run_is_not_partial(self) -> None:
        from phoenix.client.pytest.plugin import (
            _is_partial_collection,  # pyright: ignore[reportPrivateUsage]
        )

        config = SimpleNamespace(
            option=SimpleNamespace(
                keyword=None,
                markexpr=None,
                last_failed=False,
                failed_first=False,
                lf=False,
                ff=False,
            ),
            args=["tests/"],
        )
        session = SimpleNamespace(config=config)
        assert _is_partial_collection(cast(Any, session), cast(Any, config)) is False

    def test_no_option_is_not_partial(self) -> None:
        from phoenix.client.pytest.plugin import (
            _is_partial_collection,  # pyright: ignore[reportPrivateUsage]
        )

        config = SimpleNamespace(option=None, args=[])
        session = SimpleNamespace(config=config)
        assert _is_partial_collection(cast(Any, session), cast(Any, config)) is False


class TestMakeClient:
    def test_returns_a_client(self) -> None:
        from phoenix.client import Client
        from phoenix.client.pytest.plugin import _make_client  # pyright: ignore[reportPrivateUsage]

        assert isinstance(_make_client(), Client)


# --------------------------------------------------------------------------------------------
# tracing
# --------------------------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_degrade_warned() -> Any:
    """``_degrade_warned`` is a process-global one-shot latch; reset it around each test so the
    warning assertions are deterministic regardless of order."""
    import phoenix.client.pytest.tracing as tracing

    tracing._degrade_warned = False  # pyright: ignore[reportPrivateUsage]
    yield
    tracing._degrade_warned = False  # pyright: ignore[reportPrivateUsage]


class _FakeSpanContext:
    def __init__(self, trace_id: int) -> None:
        self.trace_id = trace_id


class _FakeSpan:
    def __init__(self, trace_id: int = 0xABCDEF) -> None:
        self.attributes: dict[str, Any] = {}
        self.status: Any = None
        self.exceptions: list[BaseException] = []
        self._trace_id = trace_id

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def set_status(self, status: Any) -> None:
        self.status = status

    def record_exception(self, exc: BaseException) -> None:
        self.exceptions.append(exc)

    def get_span_context(self) -> _FakeSpanContext:
        return _FakeSpanContext(self._trace_id)


class _FakeTracer:
    def __init__(self, span: _FakeSpan) -> None:
        self._span = span

    def start_as_current_span(self, name: str, *, context: Any = None) -> Any:
        from contextlib import contextmanager

        span = self._span

        @contextmanager
        def _cm() -> Any:
            yield span

        return _cm()


def _no_capture(resource: Any) -> AbstractContextManager[None]:
    # capture_spans wraps a real OTel resource; stub it so the unit tests need no SDK setup.
    return nullcontext()


def _suite_tracer(span: _FakeSpan, monkeypatch: pytest.MonkeyPatch) -> Any:
    import phoenix.client.pytest.tracing as tracing

    monkeypatch.setattr(tracing, "capture_spans", _no_capture)
    return tracing.SuiteTracer(tracer=_FakeTracer(span), resource=object())


class TestSetIO:
    def test_input_none_skips_input_attrs(self) -> None:
        from phoenix.client.pytest.tracing import _set_io  # pyright: ignore[reportPrivateUsage]
        from phoenix.client.resources.experiments import INPUT_VALUE, OUTPUT_VALUE

        span = _FakeSpan()
        _set_io(span, None, "hi")
        assert INPUT_VALUE not in span.attributes
        assert span.attributes[OUTPUT_VALUE] == "hi"  # str output stored verbatim

    def test_output_none_returns_early(self) -> None:
        from phoenix.client.pytest.tracing import _set_io  # pyright: ignore[reportPrivateUsage]
        from phoenix.client.resources.experiments import INPUT_VALUE, OUTPUT_VALUE

        span = _FakeSpan()
        _set_io(span, {"q": 1}, None)
        assert INPUT_VALUE in span.attributes
        assert OUTPUT_VALUE not in span.attributes

    def test_non_str_output_is_json_with_mime(self) -> None:
        from phoenix.client.pytest.tracing import _set_io  # pyright: ignore[reportPrivateUsage]
        from phoenix.client.resources.experiments import OUTPUT_MIME_TYPE, OUTPUT_VALUE

        span = _FakeSpan()
        _set_io(span, None, {"a": 1})
        assert span.attributes[OUTPUT_VALUE] == '{"a": 1}'
        assert OUTPUT_MIME_TYPE in span.attributes


class TestWarnDegraded:
    def test_warns_once(self, caplog: pytest.LogCaptureFixture) -> None:
        from phoenix.client.pytest.tracing import (
            _warn_degraded,  # pyright: ignore[reportPrivateUsage]
        )

        with caplog.at_level(logging.WARNING):
            _warn_degraded("first")
            _warn_degraded("second")
        degraded = [r for r in caplog.records if "tracing degraded" in r.message]
        assert len(degraded) == 1
        assert "first" in degraded[0].message


class TestBuildSuiteTracer:
    def test_none_project_name_returns_none(self) -> None:
        from phoenix.client.pytest.tracing import build_suite_tracer

        assert build_suite_tracer(project_name=None, base_url=None, headers=None) is None

    def test_get_tracer_failure_degrades_to_none(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        import phoenix.client.pytest.tracing as tracing

        def _boom(*a: Any, **k: Any) -> Any:
            raise RuntimeError("no tracer")

        monkeypatch.setattr(tracing, "_get_tracer", _boom)
        with caplog.at_level(logging.WARNING):
            result = tracing.build_suite_tracer(project_name="proj", base_url=None, headers=None)
        assert result is None
        assert any("tracing degraded" in r.message for r in caplog.records)

    def test_success_returns_suite_tracer(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import phoenix.client.pytest.tracing as tracing

        sentinel_tracer, sentinel_resource = object(), object()

        def _fake_get_tracer(*a: Any, **k: Any) -> tuple[object, object]:
            return sentinel_tracer, sentinel_resource

        monkeypatch.setattr(tracing, "_get_tracer", _fake_get_tracer)
        result = tracing.build_suite_tracer(project_name="proj", base_url="b", headers={})
        assert result is not None
        assert result.tracer is sentinel_tracer
        assert result.resource is sentinel_resource


class TestSuiteTracerSpans:
    def test_chain_span_ok_status_and_trace_id(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from phoenix.client.resources.experiments import OPENINFERENCE_SPAN_KIND, OUTPUT_VALUE

        span = _FakeSpan(trace_id=0x1234)
        tracer = _suite_tracer(span, monkeypatch)
        with tracer.chain_span(
            "Test: x", input_value={"q": 1}, output_getter=lambda: "result"
        ) as handle:
            pass
        from opentelemetry.trace import StatusCode

        assert span.status.status_code == StatusCode.OK
        assert span.attributes[OUTPUT_VALUE] == "result"
        assert span.attributes[OPENINFERENCE_SPAN_KIND] == "CHAIN"
        assert handle.trace_id == format(0x1234, "032x")

    def test_chain_span_records_body_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from opentelemetry.trace import StatusCode

        span = _FakeSpan()
        tracer = _suite_tracer(span, monkeypatch)
        with pytest.raises(ValueError):
            with tracer.chain_span("Test: x", input_value=None, output_getter=lambda: None):
                raise ValueError("body boom")
        assert span.status.status_code == StatusCode.ERROR
        assert any(isinstance(e, ValueError) for e in span.exceptions)

    def test_chain_span_error_getter_marks_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # pytest's hookwrapper swallows a failing test's exception, so the span learns of the
        # failure through error_getter rather than a raised body.
        from opentelemetry.trace import StatusCode

        span = _FakeSpan()
        tracer = _suite_tracer(span, monkeypatch)
        with tracer.chain_span(
            "Test: x",
            input_value=None,
            output_getter=lambda: None,
            error_getter=lambda: RuntimeError("recovered"),
        ):
            pass
        assert span.status.status_code == StatusCode.ERROR
        assert any(isinstance(e, RuntimeError) for e in span.exceptions)

    def test_error_getter_exception_is_swallowed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from opentelemetry.trace import StatusCode

        span = _FakeSpan()
        tracer = _suite_tracer(span, monkeypatch)

        def _bad_getter() -> Any:
            raise RuntimeError("getter itself failed")

        with tracer.chain_span(
            "Test: x", input_value=None, output_getter=lambda: None, error_getter=_bad_getter
        ):
            pass
        # A failing error_getter is treated as "no error" -> OK status, no crash.
        assert span.status.status_code == StatusCode.OK

    def test_evaluator_span_kind(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from phoenix.client.resources.experiments import OPENINFERENCE_SPAN_KIND

        span = _FakeSpan()
        tracer = _suite_tracer(span, monkeypatch)
        with tracer.evaluator_span("Evaluation: x", input_value={"in": 1}):
            pass
        assert span.attributes[OPENINFERENCE_SPAN_KIND] == "EVALUATOR"

    def test_span_setup_failure_still_runs_body(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        # If opening the span raises, the body must still run and yield exactly once, degrading to
        # no span (handle.trace_id stays None) rather than failing the test.

        import phoenix.client.pytest.tracing as tracing

        monkeypatch.setattr(tracing, "capture_spans", _no_capture)

        class _BoomTracer:
            def start_as_current_span(self, *a: Any, **k: Any) -> Any:
                raise RuntimeError("cannot start span")

        tracer = tracing.SuiteTracer(tracer=_BoomTracer(), resource=object())
        ran: list[bool] = []
        with caplog.at_level(logging.WARNING):
            with tracer.evaluator_span("Evaluation: x", input_value=None) as handle:
                ran.append(True)
        assert ran == [True]
        assert handle.trace_id is None
        assert any("tracing degraded" in r.message for r in caplog.records)

    def test_zero_trace_id_leaves_handle_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # A span whose context reports trace_id 0 (no real trace) must not populate the handle.
        span = _FakeSpan(trace_id=0)
        tracer = _suite_tracer(span, monkeypatch)
        with tracer.evaluator_span("Evaluation: x", input_value=None) as handle:
            pass
        assert handle.trace_id is None

    def test_finalization_error_degrades_to_warning(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        # A failure while finalizing the span (here ``get_span_context`` raising during unwind)
        # is swallowed into a single degraded-tracing warning; the body still completes.
        class _BadCtxSpan(_FakeSpan):
            def get_span_context(self) -> Any:
                raise RuntimeError("ctx boom")

        span = _BadCtxSpan()
        tracer = _suite_tracer(span, monkeypatch)
        ran: list[bool] = []
        with caplog.at_level(logging.WARNING):
            with tracer.evaluator_span("Evaluation: x", input_value=None) as handle:
                ran.append(True)
        assert ran == [True]
        assert handle.trace_id is None
        assert any("tracing degraded" in r.message for r in caplog.records)


# --------------------------------------------------------------------------------------------
# plugin: xdist controller collection + setup-error guard
# --------------------------------------------------------------------------------------------


def _fake_config() -> Any:
    from _pytest.stash import Stash

    def _getini(name: str) -> None:
        return None

    return SimpleNamespace(stash=Stash(), getini=_getini)


class TestEnsureControllerCollected:
    def test_already_collected_is_noop(self) -> None:
        import phoenix.client.pytest.plugin as plugin

        config = _fake_config()
        config.stash[plugin._CONTROLLER_COLLECTED_KEY] = True  # pyright: ignore[reportPrivateUsage]
        plugin._ensure_controller_collected(config)  # pyright: ignore[reportPrivateUsage]
        # The latch stays set and nothing else happened (no session stashed -> would have no-op'd).
        assert config.stash[plugin._CONTROLLER_COLLECTED_KEY] is True  # pyright: ignore[reportPrivateUsage]

    def test_existing_state_short_circuits(self) -> None:
        import phoenix.client.pytest.plugin as plugin

        config = _fake_config()
        config.stash[plugin._STATE_KEY] = _make_state()  # pyright: ignore[reportPrivateUsage]
        # A session is stashed too, but the pre-existing state must short-circuit before collect.
        config.stash[plugin._SESSION_KEY] = SimpleNamespace(  # pyright: ignore[reportPrivateUsage]
            perform_collect=lambda: (_ for _ in ()).throw(AssertionError("must not collect"))
        )
        plugin._ensure_controller_collected(config)  # pyright: ignore[reportPrivateUsage]

    def test_no_session_is_noop(self) -> None:
        import phoenix.client.pytest.plugin as plugin

        plugin._ensure_controller_collected(_fake_config())  # pyright: ignore[reportPrivateUsage]

    def test_config_error_returns_quietly(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import phoenix.client.pytest.plugin as plugin

        monkeypatch.setenv("PHOENIX_TEST_REPETITIONS", "not-an-int")
        config = _fake_config()
        config.stash[plugin._SESSION_KEY] = SimpleNamespace(  # pyright: ignore[reportPrivateUsage]
            perform_collect=lambda: (_ for _ in ()).throw(AssertionError("must not collect"))
        )
        plugin._ensure_controller_collected(config)  # pyright: ignore[reportPrivateUsage]

    def test_offline_returns_before_collect(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import phoenix.client.pytest.plugin as plugin

        monkeypatch.setenv("PHOENIX_TEST_TRACKING", "false")
        config = _fake_config()
        config.stash[plugin._SESSION_KEY] = SimpleNamespace(  # pyright: ignore[reportPrivateUsage]
            perform_collect=lambda: (_ for _ in ()).throw(AssertionError("must not collect"))
        )
        plugin._ensure_controller_collected(config)  # pyright: ignore[reportPrivateUsage]

    def test_perform_collect_failure_degrades_to_warning(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        import phoenix.client.pytest.plugin as plugin

        monkeypatch.delenv("PHOENIX_TEST_TRACKING", raising=False)
        monkeypatch.delenv("PHOENIX_TEST_REPETITIONS", raising=False)

        def _boom() -> None:
            raise RuntimeError("collect boom")

        config = _fake_config()
        config.stash[plugin._SESSION_KEY] = SimpleNamespace(  # pyright: ignore[reportPrivateUsage]
            perform_collect=_boom
        )
        with caplog.at_level(logging.WARNING):
            plugin._ensure_controller_collected(config)  # pyright: ignore[reportPrivateUsage]
        assert any("controller-side collection" in r.message for r in caplog.records)


class TestRecordSetupErrorGuard:
    def test_missing_binding_is_noop(self) -> None:
        import phoenix.client.pytest.plugin as plugin

        state = _make_state()  # no item registered -> binding_for returns None
        call = SimpleNamespace(excinfo=None, start=0.0, stop=1.0)
        plugin._record_setup_error(  # pyright: ignore[reportPrivateUsage]
            state, cast("Item", _RecItem("unregistered")), call
        )
        assert state.recorded_runs == []


class TestIsPartialCollectionFileArg:
    def test_existing_file_arg_is_partial(self, tmp_path: Any) -> None:
        from phoenix.client.pytest.plugin import (
            _is_partial_collection,  # pyright: ignore[reportPrivateUsage]
        )

        f = tmp_path / "test_mod.py"
        f.write_text("def test_x(): pass\n")
        config = SimpleNamespace(
            option=SimpleNamespace(
                keyword=None,
                markexpr=None,
                last_failed=False,
                failed_first=False,
                lf=False,
                ff=False,
            ),
            args=[str(f)],
        )
        session = SimpleNamespace(config=config)
        assert _is_partial_collection(cast(Any, session), cast(Any, config)) is True


# --------------------------------------------------------------------------------------------
# session: resolve/adopt loop false-branches
# --------------------------------------------------------------------------------------------


class TestResolveExamplesMismatch:
    def test_examples_without_nodeid_and_unmatched_bindings_resolve_nothing(self) -> None:
        from phoenix.client.pytest.session import DatasetGroup, ItemBinding

        class _Dataset:
            examples = [{"metadata": {"unrelated": "v"}, "node_id": "DatasetExampleGID:0"}]

        class _Datasets:
            def get_dataset(self, *, dataset: Any, version_id: Any = None) -> Any:
                return _Dataset()

        class _Client:
            datasets = _Datasets()

        state = _make_state()
        state._client = _Client()  # pyright: ignore[reportPrivateUsage]
        group = DatasetGroup(name="ds", dataset_id="Dataset:1", dataset_version_id="Version:1")
        group.bindings["ext1"] = ItemBinding(nodeid="node-1", dataset_name="ds", external_id="ext1")
        state._resolve_examples(group)  # pyright: ignore[reportPrivateUsage]
        # The server example carries no ``pytest_nodeid`` and no binding matches -> nothing pinned.
        assert group.example_ids == {}
        assert group.bindings["ext1"].dataset_example_id is None


class TestAdoptBroadcastUnmatchedExample:
    def test_example_id_for_unknown_binding_is_ignored(self) -> None:
        state = _make_state()
        _binding(state, dataset="ds")  # registers one binding under "ds"
        payload = {
            "ds": {
                "dataset_id": "Dataset:1",
                "dataset_version_id": "Version:1",
                "experiment_id": "Experiment:1",
                "project_name": None,
                "example_ids": {"not-a-known-external-id": "DatasetExampleGID:9"},
            }
        }
        state.adopt_broadcast(payload, client=_FakeClient())
        group = state.groups["ds"]
        # The broadcast example id keys on an external_id absent from this worker's bindings, so it
        # is recorded on the group but bound to no ItemBinding.
        assert group.example_ids == {"not-a-known-external-id": "DatasetExampleGID:9"}
        assert all(b.dataset_example_id is None for b in group.bindings.values())
