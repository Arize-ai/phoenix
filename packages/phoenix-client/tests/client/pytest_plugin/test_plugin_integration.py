"""Integration tests for the Phoenix pytest plugin using the ``pytester`` fixture.

These run an inner pytest session with the plugin active, exercising the full collection ->
record -> summary lifecycle. The Phoenix client is mocked so no live server is needed; an
offline-mode test asserts zero client construction.
"""

from __future__ import annotations

import pytest

pytest_plugins = ["pytester"]


def test_offline_mode_makes_no_client(
    pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PHOENIX_TEST_TRACKING=false: tests still run, but the plugin builds no client."""
    monkeypatch.setenv("PHOENIX_TEST_TRACKING", "false")
    pytester.makepyfile(
        test_offline="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="offline-suite")
        def test_one():
            px.log_output({"answer": 42})
            assert 1 + 1 == 2
        """
    )
    # Make client construction fatal so any network attempt fails the inner run loudly.
    pytester.makeconftest(
        """
        import phoenix.client.pytest_plugin.plugin as plugin

        def pytest_configure(config):
            def _boom():
                raise AssertionError("client should not be constructed in offline mode")
            plugin._make_client = _boom
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=1)
    result.stdout.fnmatch_lines(["*offline mode*tracking disabled*"])


def test_end_to_end_records_runs_and_pass_annotation(pytester: pytest.Pytester) -> None:
    """A marked, parametrized suite creates one dataset+experiment, one run per case, and a
    `pass` annotation derived from the assertion outcome."""
    pytester.makeconftest(
        """
        import phoenix.client.pytest_plugin.plugin as plugin

        class _FakeDataset:
            id = "Dataset:1"
            version_id = "Version:1"
            def __init__(self, examples):
                self._examples = examples
            @property
            def examples(self):
                return self._examples

        class _FakeDatasets:
            def __init__(self):
                self._examples = []
            def _upload_json_dataset(self, *, dataset_name, inputs, outputs, metadata,
                                     example_ids, action, **kw):
                # Custom-id upload: "id" echoes our external_id, "node_id" is the server
                # GlobalID. Runs must record node_id, not id (PR #13702 guard).
                self._examples = [
                    {"id": eid, "node_id": f"DatasetExampleGID:{i}",
                     "input": inp, "output": {}, "metadata": md}
                    for i, (inp, md, eid) in enumerate(zip(inputs, metadata, example_ids))
                ]
                return _FakeDataset(self._examples)
            def get_dataset(self, *, dataset, **kw):
                return _FakeDataset(self._examples)

        class _FakeExperiments:
            def __init__(self):
                self.runs = []
                self.evals = []
            def create(self, *, dataset_id, dataset_version_id=None,
                       experiment_metadata=None, repetitions=1, **kw):
                self.metadata = experiment_metadata
                return {"id": "Experiment:1"}
            def log_run(self, *, experiment_id, dataset_example_id, output, start_time,
                        end_time, repetition_number=1, error=None, tolerate_existing=False, **kw):
                rid = f"ExperimentRun:{len(self.runs)}"
                self.runs.append({"id": rid, "error": error, "output": output,
                                  "example": dataset_example_id})
                return {"id": rid}
            def log_evaluation(self, *, experiment_run_id, name, **kw):
                self.evals.append({"run": experiment_run_id, "name": name, **kw})
                return {"id": "Annotation:1"}
            def get_experiment_summary(self, *, experiment_id, **kw):
                return {"experiment_id": experiment_id, "dataset_version_id": "Version:1",
                        "baseline_experiment_id": None, "baseline_dataset_version_id": None,
                        "annotation_summaries": []}

        class _FakeClient:
            def __init__(self):
                self.datasets = _FakeDatasets()
                self.experiments = _FakeExperiments()

        _CLIENT = _FakeClient()

        def pytest_configure(config):
            plugin._make_client = lambda: _CLIENT
            config._phoenix_fake_client = _CLIENT

        def pytest_unconfigure(config):
            client = getattr(config, "_phoenix_fake_client", None)
            if client is None:
                return
            import json, os
            with open(os.path.join(str(config.rootdir), "effects.json"), "w") as f:
                json.dump({
                    "n_runs": len(client.experiments.runs),
                    "eval_names": sorted({e["name"] for e in client.experiments.evals}),
                    "metadata": client.experiments.metadata,
                    "run_examples": sorted(r["example"] for r in client.experiments.runs),
                    "node_ids": sorted(e["node_id"] for e in client.datasets._examples),
                }, f)
        """
    )
    pytester.makepyfile(
        test_suite="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="qa-suite")
        @pytest.mark.parametrize("n", [1, 2, 3], ids=["a", "b", "c"])
        def test_square(n):
            px.log_output(n * n)
            px.log_evaluation(name="custom", score=1.0)
            assert n * n >= n
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=3)

    import json

    effects = json.loads((pytester.path / "effects.json").read_text())
    assert effects["n_runs"] == 3
    assert effects["eval_names"] == ["custom", "pass"]
    # PR #13702 guard: runs key on node GlobalIDs, not external_ids (which contain "::").
    assert effects["run_examples"] == effects["node_ids"]


def test_failing_test_records_run_with_error(pytester: pytest.Pytester) -> None:
    """A failing assertion still records a run, carrying the error and a failing `pass`."""
    pytester.makeconftest(
        """
        import json, os
        import phoenix.client.pytest_plugin.plugin as plugin

        class _FakeDataset:
            id = "Dataset:1"
            version_id = "Version:1"
            def __init__(self, ex): self._ex = ex
            @property
            def examples(self): return self._ex

        class _FakeDatasets:
            def __init__(self): self._ex = []
            def _upload_json_dataset(self, *, dataset_name, inputs, outputs, metadata,
                                     example_ids, action, **kw):
                self._ex = [{"id": example_ids[0], "node_id": "DatasetExampleGID:0",
                             "input": inputs[0], "output": {}, "metadata": metadata[0]}]
                return _FakeDataset(self._ex)
            def get_dataset(self, *, dataset, **kw): return _FakeDataset(self._ex)

        class _FakeExperiments:
            def __init__(self): self.runs = []; self.evals = []
            def create(self, **kw): return {"id": "Experiment:1"}
            def log_run(self, *, error=None, **kw):
                self.runs.append({"error": error}); return {"id": "ExperimentRun:0"}
            def log_evaluation(self, *, name, **kw):
                self.evals.append({"name": name, **kw}); return {"id": "A:1"}
            def get_experiment_summary(self, **kw):
                return {"experiment_id": "Experiment:1", "dataset_version_id": "Version:1",
                        "baseline_experiment_id": None, "baseline_dataset_version_id": None,
                        "annotation_summaries": []}

        class _FakeClient:
            def __init__(self):
                self.datasets = _FakeDatasets(); self.experiments = _FakeExperiments()

        _CLIENT = _FakeClient()

        def pytest_configure(config):
            plugin._make_client = lambda: _CLIENT
            config._c = _CLIENT
        def pytest_unconfigure(config):
            c = config._c
            with open(os.path.join(str(config.rootdir), "fx.json"), "w") as f:
                json.dump({"run_errors": [r["error"] for r in c.experiments.runs],
                           "pass_eval": [e for e in c.experiments.evals if e["name"] == "pass"]}, f)
        """
    )
    pytester.makepyfile(
        test_fail="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="fail-suite")
        def test_boom():
            px.log_output("nope")
            assert False, "intentional"
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(failed=1)

    import json

    fx = json.loads((pytester.path / "fx.json").read_text())
    assert fx["run_errors"][0] is not None  # run carried the assertion error
    assert fx["pass_eval"][0]["score"] == 0.0  # failing pass annotation


def test_repetitions_expand_to_distinct_runs(
    pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A marked test with N repetitions becomes N pytest items, each posting a distinct run
    with a distinct repetition_number on the SAME dataset_example_id."""
    monkeypatch.setenv("PHOENIX_TEST_REPETITIONS", "3")
    pytester.makeconftest(
        """
        import json, os
        import phoenix.client.pytest_plugin.plugin as plugin

        class _FakeDataset:
            id = "Dataset:1"; version_id = "Version:1"
            def __init__(self, ex): self._ex = ex
            @property
            def examples(self): return self._ex

        class _FakeDatasets:
            def __init__(self): self._ex = []
            def _upload_json_dataset(self, *, dataset_name, inputs, outputs, metadata,
                                     example_ids, action, **kw):
                # One example only -> proves repetitions did NOT create extra examples.
                self._ex = [{"id": example_ids[0], "node_id": "DatasetExampleGID:0",
                             "input": inputs[0], "output": {}, "metadata": metadata[0]}]
                return _FakeDataset(self._ex)
            def get_dataset(self, *, dataset, **kw): return _FakeDataset(self._ex)

        class _FakeExperiments:
            def __init__(self): self.runs = []
            def create(self, *, repetitions=1, **kw):
                self.repetitions = repetitions
                return {"id": "Experiment:1"}
            def log_run(self, *, dataset_example_id, repetition_number=1, **kw):
                rid = f"ExperimentRun:{len(self.runs)}"
                self.runs.append({"id": rid, "example": dataset_example_id,
                                  "rep": repetition_number})
                return {"id": rid}
            def log_evaluation(self, **kw): return {"id": "A:1"}
            def get_experiment_summary(self, *, experiment_id, **kw):
                return {"experiment_id": experiment_id, "dataset_version_id": "Version:1",
                        "baseline_experiment_id": None, "baseline_dataset_version_id": None,
                        "annotation_summaries": []}

        class _FakeClient:
            def __init__(self):
                self.datasets = _FakeDatasets(); self.experiments = _FakeExperiments()

        _CLIENT = _FakeClient()

        def pytest_configure(config):
            plugin._make_client = lambda: _CLIENT
            config._c = _CLIENT
        def pytest_unconfigure(config):
            c = config._c
            with open(os.path.join(str(config.rootdir), "rep.json"), "w") as f:
                json.dump({"runs": c.experiments.runs,
                           "n_examples": len(c.datasets._ex),
                           "experiment_repetitions": c.experiments.repetitions}, f)
        """
    )
    pytester.makepyfile(
        test_rep="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="rep-suite")
        def test_one():
            px.log_output("ok")
            assert True
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=3)

    import json

    rep = json.loads((pytester.path / "rep.json").read_text())
    assert len(rep["runs"]) == 3
    assert sorted(r["rep"] for r in rep["runs"]) == [1, 2, 3]
    # All repetitions share ONE example node GlobalID (stable external_id across reps).
    assert {r["example"] for r in rep["runs"]} == {"DatasetExampleGID:0"}
    assert rep["n_examples"] == 1
    assert rep["experiment_repetitions"] == 3


def test_hoisted_marker_evaluators_record_annotations(pytester: pytest.Pytester) -> None:
    """@pytest.mark.phoenix(evaluators=[...]) runs each evaluator over the case automatically and
    records its score as an annotation — no inline px.evaluate needed."""
    pytester.makeconftest(
        """
        import json, os
        import phoenix.client.pytest_plugin.plugin as plugin

        class _FakeDataset:
            id = "Dataset:1"; version_id = "Version:1"
            def __init__(self, ex): self._ex = ex
            @property
            def examples(self): return self._ex

        class _FakeDatasets:
            def __init__(self): self._ex = []
            def _upload_json_dataset(self, *, dataset_name, inputs, outputs, metadata,
                                     example_ids, action, **kw):
                self._ex = [{"id": example_ids[0], "node_id": "DatasetExampleGID:0",
                             "input": inputs[0], "output": {}, "metadata": metadata[0]}]
                return _FakeDataset(self._ex)
            def get_dataset(self, *, dataset, **kw): return _FakeDataset(self._ex)

        class _FakeExperiments:
            def __init__(self): self.evals = []
            def create(self, **kw): return {"id": "Experiment:1"}
            def log_run(self, **kw): return {"id": "ExperimentRun:0"}
            def log_evaluation(self, *, name, score=None, **kw):
                self.evals.append({"name": name, "score": score}); return {"id": "A:1"}
            def get_experiment_summary(self, *, experiment_id, **kw):
                return {"experiment_id": experiment_id, "dataset_version_id": "Version:1",
                        "baseline_experiment_id": None, "baseline_dataset_version_id": None,
                        "annotation_summaries": []}

        class _FakeClient:
            def __init__(self):
                self.datasets = _FakeDatasets(); self.experiments = _FakeExperiments()

        _CLIENT = _FakeClient()
        def pytest_configure(config):
            plugin._make_client = lambda: _CLIENT
            config._c = _CLIENT
        def pytest_unconfigure(config):
            c = config._c
            with open(os.path.join(str(config.rootdir), "ev.json"), "w") as f:
                json.dump({"evals": c.experiments.evals}, f)
        """
    )
    pytester.makepyfile(
        test_hoist="""
        import pytest
        import phoenix.client.pytest_plugin as px

        def correctness(output, expected, **_):
            return {"name": "correctness", "score": 1.0 if output == expected else 0.0}

        @pytest.mark.phoenix(dataset="hoist-suite", evaluators=[correctness])
        @pytest.mark.parametrize("expected", ["ok"], ids=["case1"])
        def test_thing(expected):
            px.log_output("ok")
            assert True
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=1)

    import json

    ev = json.loads((pytester.path / "ev.json").read_text())
    by_name = {e["name"]: e["score"] for e in ev["evals"]}
    assert by_name.get("correctness") == 1.0
    assert by_name.get("pass") == 1.0


# A fake client whose ``_client.base_url`` is empty so ``_get_tracer`` installs a no-op span
# processor: real, non-empty trace_ids are produced with zero network. ``create`` returns a
# project_name so the suite tracer is built.
_TRACING_CONFTEST = """
import json, os
import phoenix.client.pytest_plugin.plugin as plugin

class _Http:
    base_url = ""
    headers = {}

class _FakeDataset:
    id = "Dataset:1"; version_id = "Version:1"
    def __init__(self, ex): self._ex = ex
    @property
    def examples(self): return self._ex

class _FakeDatasets:
    def __init__(self): self._ex = []
    def _upload_json_dataset(self, *, dataset_name, inputs, outputs, metadata,
                             example_ids, action, **kw):
        self._ex = [{"id": example_ids[0], "node_id": "DatasetExampleGID:0",
                     "input": inputs[0], "output": {}, "metadata": metadata[0]}]
        return _FakeDataset(self._ex)
    def get_dataset(self, *, dataset, **kw): return _FakeDataset(self._ex)

class _FakeExperiments:
    def __init__(self): self.runs = []; self.evals = []
    def create(self, **kw): return {"id": "Experiment:1", "project_name": "proj-1"}
    def log_run(self, *, trace_id=None, **kw):
        self.runs.append({"trace_id": trace_id}); return {"id": "ExperimentRun:0"}
    def log_evaluation(self, *, name, trace_id=None, **kw):
        self.evals.append({"name": name, "trace_id": trace_id}); return {"id": "A:1"}
    def get_experiment_summary(self, *, experiment_id, **kw):
        return {"experiment_id": experiment_id, "dataset_version_id": "Version:1",
                "baseline_experiment_id": None, "baseline_dataset_version_id": None,
                "annotation_summaries": []}

class _FakeClient:
    def __init__(self):
        self._client = _Http()
        self.datasets = _FakeDatasets(); self.experiments = _FakeExperiments()

_CLIENT = _FakeClient()
def pytest_configure(config):
    plugin._make_client = lambda: _CLIENT
    config._c = _CLIENT
def pytest_unconfigure(config):
    c = config._c
    with open(os.path.join(str(config.rootdir), "trace.json"), "w") as f:
        json.dump({"runs": c.experiments.runs, "evals": c.experiments.evals}, f)
"""


def _trace_effects(pytester: pytest.Pytester) -> dict:
    import json

    return json.loads((pytester.path / "trace.json").read_text())


def _is_trace_id(value: object) -> bool:
    return isinstance(value, str) and len(value) == 32


def test_run_carries_chain_trace_id(pytester: pytest.Pytester) -> None:
    """The posted run carries the test's CHAIN-span trace_id."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_run="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("hi")
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)
    fx = _trace_effects(pytester)
    assert _is_trace_id(fx["runs"][0]["trace_id"])


def test_bare_annotations_inherit_chain_trace_id(pytester: pytest.Pytester) -> None:
    """Annotations with no span of their own — the reserved pass/fail annotation and a bare
    px.log_evaluation — both link to the test's CHAIN trace."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_bare="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("hi")
            px.log_evaluation(name="manual", score=1.0)
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)
    fx = _trace_effects(pytester)
    run_tid = fx["runs"][0]["trace_id"]
    assert _is_trace_id(run_tid)
    pass_eval = next(e for e in fx["evals"] if e["name"] == "pass")
    manual = next(e for e in fx["evals"] if e["name"] == "manual")
    assert pass_eval["trace_id"] == run_tid
    assert manual["trace_id"] == run_tid


def test_inline_evaluate_carries_own_evaluator_trace_id(pytester: pytest.Pytester) -> None:
    """Inline px.evaluate wraps the evaluator in its own EVALUATOR span; the annotation
    carries that span's trace_id, distinct from the test's CHAIN trace."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_inline="""
        import pytest
        import phoenix.client.pytest_plugin as px

        def grader(output, **_):
            return {"name": "grader", "score": 1.0}

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("hi")
            px.evaluate(grader, output="hi")
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)
    fx = _trace_effects(pytester)
    run_tid = fx["runs"][0]["trace_id"]
    grader_eval = next(e for e in fx["evals"] if e["name"] == "grader")
    assert _is_trace_id(grader_eval["trace_id"])
    assert grader_eval["trace_id"] != run_tid


def test_marker_evaluator_carries_own_evaluator_trace_id(pytester: pytest.Pytester) -> None:
    """A hoisted marker evaluator gets its own EVALUATOR-span trace_id, distinct from the run."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_marker="""
        import pytest
        import phoenix.client.pytest_plugin as px

        def correctness(output, **_):
            return {"name": "correctness", "score": 1.0}

        @pytest.mark.phoenix(dataset="trace-suite", evaluators=[correctness])
        def test_one():
            px.log_output("hi")
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)
    fx = _trace_effects(pytester)
    run_tid = fx["runs"][0]["trace_id"]
    corr = next(e for e in fx["evals"] if e["name"] == "correctness")
    assert _is_trace_id(corr["trace_id"])
    assert corr["trace_id"] != run_tid


def test_offline_builds_no_tracer(
    pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Offline (tracking off): no tracer is built and no spans are opened."""
    monkeypatch.setenv("PHOENIX_TEST_TRACKING", "false")
    pytester.makeconftest(
        """
        import phoenix.client.pytest_plugin.plugin as plugin
        import phoenix.client.pytest_plugin.tracing as tracing

        def pytest_configure(config):
            def _boom(*a, **k):
                raise AssertionError("no tracer should be built offline")
            tracing.build_suite_tracer = _boom
            def _no_client():
                raise AssertionError("no client offline")
            plugin._make_client = _no_client
        """
    )
    pytester.makepyfile(
        test_off="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("hi")
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)


# Wraps ``_TRACING_CONFTEST`` with an in-memory span exporter (swapping in a real
# ``SimpleSpanProcessor`` for the no-op one) so a test can read back the actual exported span
# status/events. The appended ``pytest_unconfigure`` dumps spans and shadows the trace.json one.
_SPAN_CAPTURE_HEADER = """
import phoenix.client.pytest_plugin.tracing as _tracing
from opentelemetry.sdk import trace as _trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor as _SSP
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter as _IMSE
from opentelemetry.sdk.resources import Resource as _Resource
from openinference.instrumentation import OITracer as _OITracer, TraceConfig as _TraceConfig
from openinference.semconv.resource import ResourceAttributes as _RA

_SPAN_EXPORTER = _IMSE()

def _capturing_get_tracer(project_name=None, base_url=None, headers=None):
    resource = _Resource({_RA.PROJECT_NAME: project_name} if project_name else {})
    tp = _trace_sdk.TracerProvider(resource=resource)
    tp.add_span_processor(_SSP(_SPAN_EXPORTER))
    return _OITracer(tp.get_tracer(__name__), config=_TraceConfig()), resource

_tracing._get_tracer = _capturing_get_tracer
"""

_SPAN_CAPTURE_FOOTER = """
def pytest_unconfigure(config):
    import json, os
    spans = [
        {"name": s.name, "status": s.status.status_code.name,
         "events": [e.name for e in s.events]}
        for s in _SPAN_EXPORTER.get_finished_spans()
    ]
    with open(os.path.join(str(config.rootdir), "spans.json"), "w") as f:
        json.dump(spans, f)
"""

_TRACING_CAPTURE_CONFTEST = _SPAN_CAPTURE_HEADER + _TRACING_CONFTEST + _SPAN_CAPTURE_FOOTER


def _spans(pytester: pytest.Pytester) -> list:
    import json

    return json.loads((pytester.path / "spans.json").read_text())


def test_failing_test_records_error_chain_span(pytester: pytest.Pytester) -> None:
    """A failing test's CHAIN span carries ERROR status and records the exception, so the
    linked trace reflects the failure instead of a misleading OK."""
    pytester.makeconftest(_TRACING_CAPTURE_CONFTEST)
    pytester.makepyfile(
        test_fail="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("partial")
            assert False, "boom"
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(failed=1)
    chain = next(s for s in _spans(pytester) if s["name"].startswith("Test: "))
    assert chain["status"] == "ERROR"
    assert "exception" in chain["events"]


def test_passing_test_records_ok_chain_span(pytester: pytest.Pytester) -> None:
    """A passing test's CHAIN span is OK with no recorded exception (the fix must not
    over-correct every span to ERROR)."""
    pytester.makeconftest(_TRACING_CAPTURE_CONFTEST)
    pytester.makepyfile(
        test_ok="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("ok")
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)
    chain = next(s for s in _spans(pytester) if s["name"].startswith("Test: "))
    assert chain["status"] == "OK"
    assert "exception" not in chain["events"]


def test_failing_test_output_carries_trace_id(pytester: pytest.Pytester) -> None:
    """The failing test's output includes its trace_id so a reader can open the trace."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_fail="""
        import pytest
        import phoenix.client.pytest_plugin as px

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("partial")
            assert False, "boom"
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(failed=1)
    run_tid = _trace_effects(pytester)["runs"][0]["trace_id"]
    assert _is_trace_id(run_tid)
    out = result.stdout.str()
    assert "phoenix trace" in out
    assert run_tid in out
