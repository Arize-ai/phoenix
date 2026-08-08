"""Integration tests for the Phoenix pytest plugin using the ``pytester`` fixture.

These run an inner pytest session with the plugin active, exercising the full collection ->
record -> summary lifecycle. The Phoenix client is mocked so no live server is needed; an
offline-mode test asserts zero client construction.
"""

from __future__ import annotations

import subprocess
from typing import Any, cast

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
        import phoenix.client.pytest as px

        @pytest.mark.phoenix(dataset="offline-suite")
        def test_one():
            px.log_output({"answer": 42})
            assert 1 + 1 == 2
        """
    )
    # Make client construction fatal so any network attempt fails the inner run loudly.
    pytester.makeconftest(
        """
        import phoenix.client.pytest.plugin as plugin

        def pytest_configure(config):
            def _boom():
                raise AssertionError("client should not be constructed in offline mode")
            plugin._make_client = _boom
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=1)
    result.stdout.fnmatch_lines(["*offline mode*tracking disabled*"])


def test_plugin_loads_without_xdist_installed(
    pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The xdist hook ``pytest_configure_node`` is declared optional. xdist is not a dependency
    of the ``pytest`` extra, so without that the plugin would raise a ``PluginValidationError``
    (unknown hook) on every run when xdist is absent. ``-p no:xdist`` deregisters xdist's
    hookspecs, reproducing a no-xdist install; the suite must still collect and run."""
    monkeypatch.setenv("PHOENIX_TEST_TRACKING", "false")  # offline: no client needed
    pytester.makepyfile(
        test_noxdist="""
        import pytest
        import phoenix.client.pytest as px

        @pytest.mark.phoenix(dataset="noxdist-suite")
        def test_one():
            px.log_output("ok")
            assert True
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "-p", "no:xdist", "--no-header")
    result.assert_outcomes(passed=1)


def test_end_to_end_records_runs_and_pass_annotation(pytester: pytest.Pytester) -> None:
    """A marked, parametrized suite creates one dataset+experiment, one run per case, and a
    `pass` annotation derived from the assertion outcome."""
    pytester.makeconftest(
        """
        import phoenix.client.pytest.plugin as plugin

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
                        end_time, repetition_number=1, error=None, **kw):
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
        import phoenix.client.pytest as px

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


def test_marker_metadata_reaches_created_dataset_and_experiment(
    pytester: pytest.Pytester,
) -> None:
    pytester.makeconftest(
        """
        import json
        import os

        import phoenix.client.pytest.plugin as plugin

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
                self.dataset_description = None
            def _upload_json_dataset(self, *, dataset_description=None, inputs, metadata,
                                     example_ids, **kwargs):
                self.dataset_description = dataset_description
                self._examples = [
                    {"id": eid, "node_id": f"DatasetExampleGID:{i}",
                     "input": inp, "output": {}, "metadata": md}
                    for i, (eid, inp, md) in enumerate(zip(example_ids, inputs, metadata))
                ]
                return _FakeDataset(self._examples)
            def get_dataset(self, **kwargs):
                return _FakeDataset(self._examples)

        class _FakeExperiments:
            def __init__(self):
                self.experiment_description = None
                self.experiment_metadata = None
            def create(self, *, experiment_description=None, experiment_metadata=None, **kwargs):
                self.experiment_description = experiment_description
                self.experiment_metadata = experiment_metadata
                return {"id": "Experiment:1"}
            def log_run(self, **kwargs):
                return {"id": "ExperimentRun:1"}
            def log_evaluation(self, **kwargs):
                return {"id": "Annotation:1"}
            def get_experiment_summary(self, *, experiment_id, **kwargs):
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
            client = config._phoenix_fake_client
            with open(os.path.join(str(config.rootdir), "metadata-effects.json"), "w") as f:
                json.dump({
                    "dataset_description": client.datasets.dataset_description,
                    "experiment_description": client.experiments.experiment_description,
                    "experiment_metadata": client.experiments.experiment_metadata,
                }, f)
        """
    )
    pytester.makepyfile(
        test_metadata="""
        import pytest
        import phoenix.client.pytest as px

        @pytest.mark.phoenix(
            dataset="metadata-suite",
            dataset_description="Customer support regression cases",
            experiment_description="GPT-4.1 with a lower temperature",
            experiment_metadata={
                "model": "gpt-4.1",
                "parameters": {"temperature": 0.2, "max_tokens": 512},
            },
        )
        def test_answer():
            px.log_output("A concise answer")
            assert True
        """
    )
    for command in (
        ("git", "init", "--quiet"),
        ("git", "config", "user.email", "phoenix@example.com"),
        ("git", "config", "user.name", "Phoenix Tests"),
        ("git", "add", "."),
        ("git", "commit", "--quiet", "-m", "test fixture"),
    ):
        completed = subprocess.run(command, cwd=pytester.path, capture_output=True, text=True)
        assert completed.returncode == 0, completed.stderr
    git_sha_result = subprocess.run(
        ("git", "rev-parse", "HEAD"), cwd=pytester.path, capture_output=True, text=True
    )
    assert git_sha_result.returncode == 0, git_sha_result.stderr

    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)

    import json

    effects = json.loads((pytester.path / "metadata-effects.json").read_text())
    assert effects["dataset_description"] == "Customer support regression cases"
    assert effects["experiment_description"] == "GPT-4.1 with a lower temperature"
    assert effects["experiment_metadata"]["model"] == "gpt-4.1"
    assert effects["experiment_metadata"]["parameters"] == {
        "temperature": 0.2,
        "max_tokens": 512,
    }
    assert effects["experiment_metadata"]["git_sha"] == git_sha_result.stdout.strip()


def test_failing_test_records_run_with_error(pytester: pytest.Pytester) -> None:
    """A failing assertion still records a run, carrying the error and a failing `pass`."""
    pytester.makeconftest(
        """
        import json, os
        import phoenix.client.pytest.plugin as plugin

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
        import phoenix.client.pytest as px

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
        import phoenix.client.pytest.plugin as plugin

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
        import phoenix.client.pytest as px

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
        import phoenix.client.pytest.plugin as plugin

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
        import phoenix.client.pytest as px

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


# A fake client that records each evaluation's name/score/label/error, so an errored evaluation
# (error set, no result) can be distinguished from a scored one.
_ERRORED_EVAL_CONFTEST = """
import json, os
import phoenix.client.pytest.plugin as plugin

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
    def log_evaluation(self, *, name, score=None, label=None, error=None, annotator_kind="CODE",
                       **kw):
        self.evals.append({"name": name, "score": score, "label": label, "error": error,
                           "annotator_kind": annotator_kind}); return {"id": "A:1"}

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


def _errored_evals(pytester: pytest.Pytester) -> list[dict[str, Any]]:
    import json

    data = json.loads((pytester.path / "ev.json").read_text())
    return cast("list[dict[str, Any]]", data["evals"])


def test_hoisted_evaluator_failure_recorded_as_errored_evaluation(
    pytester: pytest.Pytester,
) -> None:
    """A hoisted evaluator that raises is persisted as an errored evaluation (``error`` set, no
    result), matching run_experiment, instead of being dropped with only a warning. The failure
    degrades to a warning, so the test itself still passes and its other annotations record."""
    pytester.makeconftest(_ERRORED_EVAL_CONFTEST)
    pytester.makepyfile(
        test_hoist_err="""
        import pytest
        import phoenix.client.pytest as px

        def boom(output, **_):
            raise RuntimeError("evaluator exploded")

        @pytest.mark.phoenix(dataset="hoist-err", evaluators=[boom])
        def test_thing():
            px.log_output("ok")
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)

    evals = _errored_evals(pytester)
    boom_eval = next(e for e in evals if e["name"] == "boom")
    assert boom_eval["error"] is not None
    assert "evaluator exploded" in boom_eval["error"]
    assert boom_eval["score"] is None and boom_eval["label"] is None
    # The reserved pass annotation is still recorded for the (passing) run.
    assert any(e["name"] == "pass" and e["label"] == "pass" for e in evals)


def test_inline_evaluate_failure_recorded_and_gates_test(pytester: pytest.Pytester) -> None:
    """An inline px.evaluate() whose evaluator raises persists an errored evaluation and re-raises,
    so the failure gates the test (the run records pass=fail) rather than losing the signal."""
    pytester.makeconftest(_ERRORED_EVAL_CONFTEST)
    pytester.makepyfile(
        test_inline_err="""
        import pytest
        import phoenix.client.pytest as px
        from phoenix.client.resources.experiments.evaluators import create_evaluator

        @create_evaluator(kind="LLM", name="judge")
        def judge(output):
            raise RuntimeError("inline boom")

        @pytest.mark.phoenix(dataset="inline-err")
        def test_thing():
            px.log_output("ok")
            px.evaluate(judge, output="ok")
            assert True  # unreachable: the evaluator raises first
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(failed=1)

    evals = _errored_evals(pytester)
    judge_eval = next(e for e in evals if e["name"] == "judge")
    assert judge_eval["error"] is not None
    assert "inline boom" in judge_eval["error"]
    # annotator_kind is preserved from the evaluator even on the errored annotation.
    assert judge_eval["annotator_kind"] == "LLM"
    # The run is recorded as a failure (the inline evaluator failure gates the test).
    pass_eval = next(e for e in evals if e["name"] == "pass")
    assert pass_eval["label"] == "fail"


def test_hoisted_evaluator_input_field_receives_param_mapping(
    pytester: pytest.Pytester,
) -> None:
    """A hoisted evaluator declaring ``input`` receives the case's full parametrized-field mapping
    (matching run_experiment), not ``None`` — so non-standard fields like ``question`` are reachable
    via ``input`` even though they are not bound as top-level keyword arguments."""
    pytester.makeconftest(_ERRORED_EVAL_CONFTEST)
    pytester.makepyfile(
        test_input_field="""
        import pytest
        import phoenix.client.pytest as px

        def uses_input(output, input, **_):
            ok = input.get("question") == "q" and input.get("expected") == "e"
            return {"name": "uses_input", "score": 1.0 if ok else 0.0}

        @pytest.mark.phoenix(dataset="input-suite", evaluators=[uses_input])
        @pytest.mark.parametrize("question,expected", [("q", "e")], ids=["c1"])
        def test_thing(question, expected):
            px.log_output("out")
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)

    evals = _errored_evals(pytester)
    ui = next(e for e in evals if e["name"] == "uses_input")
    assert ui["score"] == 1.0


# A fake client whose ``_client.base_url`` is empty so ``_get_tracer`` installs a no-op span
# processor: real, non-empty trace_ids are produced with zero network. ``create`` returns a
# project_name so the suite tracer is built.
_TRACING_CONFTEST = """
import json, os
import phoenix.client.pytest.plugin as plugin

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


def _trace_effects(pytester: pytest.Pytester) -> dict[str, Any]:
    import json

    return cast("dict[str, Any]", json.loads((pytester.path / "trace.json").read_text()))


def _is_trace_id(value: object) -> bool:
    return isinstance(value, str) and len(value) == 32


def test_run_carries_chain_trace_id(pytester: pytest.Pytester) -> None:
    """The posted run carries the test's CHAIN-span trace_id."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_run="""
        import pytest
        import phoenix.client.pytest as px

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("hi")
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)
    fx = _trace_effects(pytester)
    assert _is_trace_id(fx["runs"][0]["trace_id"])


def test_bare_annotations_get_own_evaluator_trace_id(pytester: pytest.Pytester) -> None:
    """Every evaluation gets its own EVALUATOR-span trace_id — the reserved pass/fail annotation
    and a bare px.log_evaluation included — each distinct from the test's CHAIN trace and from
    each other, rather than reusing the CHAIN trace."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_bare="""
        import pytest
        import phoenix.client.pytest as px

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
    assert _is_trace_id(pass_eval["trace_id"])
    assert _is_trace_id(manual["trace_id"])
    # Each evaluation links to its own evaluator span, not the test's CHAIN trace.
    assert pass_eval["trace_id"] != run_tid
    assert manual["trace_id"] != run_tid
    assert pass_eval["trace_id"] != manual["trace_id"]


def test_inline_evaluate_carries_own_evaluator_trace_id(pytester: pytest.Pytester) -> None:
    """Inline px.evaluate wraps the evaluator in its own EVALUATOR span; the annotation
    carries that span's trace_id, distinct from the test's CHAIN trace."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_inline="""
        import pytest
        import phoenix.client.pytest as px

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
        import phoenix.client.pytest as px

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
        import builtins
        import phoenix.client.pytest.plugin as plugin
        import phoenix.client.pytest.tracing as tracing
        from opentelemetry import trace

        def pytest_configure(config):
            original_provider = trace.NoOpTracerProvider()
            trace._TRACER_PROVIDER = original_provider
            builtins._phoenix_original_provider = original_provider
            def _boom(*a, **k):
                raise AssertionError("no tracer should be built offline")
            tracing.build_suite_tracer = _boom
            tracing._attach_global_tracer_provider = _boom
            def _no_client():
                raise AssertionError("no client offline")
            plugin._make_client = _no_client
        """
    )
    pytester.makepyfile(
        test_off="""
        import builtins
        import pytest
        import phoenix.client.pytest as px
        from opentelemetry import trace
        from phoenix.client.pytest.context import current_run

        def offline_eval(output, **_):
            assert trace.get_tracer_provider() is builtins._phoenix_original_provider
            return {"name": "offline", "score": 1.0}

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one():
            px.log_output("hi")
            px.evaluate(offline_eval, output="hi")
            run = current_run()
            assert run is not None
            assert run.trace_id is None
            assert run.evaluations["offline"]["trace_id"] is None
            assert trace.get_tracer_provider() is builtins._phoenix_original_provider
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)


# Wraps ``_TRACING_CONFTEST`` with an in-memory span exporter (swapping in a real
# ``SimpleSpanProcessor`` for the no-op one) so a test can read back the actual exported span
# status/events. The appended ``pytest_unconfigure`` dumps spans and shadows the trace.json one.
_SPAN_CAPTURE_HEADER = """
import builtins
import phoenix.client.pytest.tracing as _tracing
from opentelemetry import trace as _trace
from opentelemetry.sdk import trace as _trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor as _SSP
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter as _IMSE
from opentelemetry.sdk.resources import Resource as _Resource
from openinference.instrumentation import OITracer as _OITracer, TraceConfig as _TraceConfig
from openinference.semconv.resource import ResourceAttributes as _RA
from phoenix.client.resources.experiments import _TracerBundle

_SPAN_EXPORTERS = []
_LIFECYCLE = []
builtins._phoenix_span_exporters = _SPAN_EXPORTERS
_trace._TRACER_PROVIDER = None
_ORIGINAL_PROVIDER = _trace.get_tracer_provider()
builtins._phoenix_original_provider = _ORIGINAL_PROVIDER
builtins._phoenix_fail_flush = False

class _RecordingExporter(_IMSE):
    def __init__(self, project_name):
        super().__init__()
        self.project_name = project_name

    def export(self, spans):
        for span in spans:
            _LIFECYCLE.append({"event": "export", "project": self.project_name,
                               "span": span.name})
        return super().export(spans)

class _RecordingProvider(_trace_sdk.TracerProvider):
    def __init__(self, *, resource, project_name):
        super().__init__(resource=resource)
        self.project_name = project_name

    def force_flush(self, *args, **kwargs):
        global_provider = _trace.get_tracer_provider()
        _LIFECYCLE.append({"event": "flush", "project": self.project_name,
                           "is_global": global_provider is not _ORIGINAL_PROVIDER,
                           "is_raw": global_provider is self})
        if self.project_name == "evaluators" and builtins._phoenix_fail_flush:
            builtins._phoenix_fail_flush = False
            raise RuntimeError("flush failed")
        return super().force_flush(*args, **kwargs)

    def shutdown(self):
        _LIFECYCLE.append({"event": "shutdown", "project": self.project_name})
        return super().shutdown()

def _capturing_get_tracer_bundle(project_name=None, base_url=None, headers=None):
    resource = _Resource({_RA.PROJECT_NAME: project_name} if project_name else {})
    exporter = _RecordingExporter(project_name)
    _SPAN_EXPORTERS.append(exporter)
    tp = _RecordingProvider(resource=resource, project_name=project_name)
    tp.add_span_processor(_SSP(exporter))
    if project_name == "evaluators":
        builtins._phoenix_evaluator_provider = tp
    return _TracerBundle(
        tracer=_OITracer(tp.get_tracer(__name__), config=_TraceConfig()),
        resource=resource,
        provider=tp,
    )

_tracing._get_tracer_bundle = _capturing_get_tracer_bundle
"""

_SPAN_CAPTURE_FOOTER = """
import pytest

@pytest.hookimpl(trylast=True)
def pytest_unconfigure(config):
    import json, os
    from openinference.semconv.trace import SpanAttributes as _SA
    spans = [
        {"name": s.name, "status": s.status.status_code.name,
         "kind": s.attributes.get(_SA.OPENINFERENCE_SPAN_KIND),
         "trace_id": format(s.context.trace_id, "032x"),
         "project": s.resource.attributes.get(_RA.PROJECT_NAME),
         "events": [e.name for e in s.events]}
        for exporter in _SPAN_EXPORTERS
        for s in exporter.get_finished_spans()
    ]
    client = config._c
    with open(os.path.join(str(config.rootdir), "spans.json"), "w") as f:
        json.dump({"spans": spans, "lifecycle": _LIFECYCLE,
                   "restored": _trace.get_tracer_provider() is _ORIGINAL_PROVIDER,
                   "runs": client.experiments.runs,
                   "evals": client.experiments.evals}, f)
"""

_TRACING_CAPTURE_CONFTEST = _SPAN_CAPTURE_HEADER + _TRACING_CONFTEST + _SPAN_CAPTURE_FOOTER


def _span_effects(pytester: pytest.Pytester) -> dict[str, Any]:
    import json

    return cast("dict[str, Any]", json.loads((pytester.path / "spans.json").read_text()))


def _spans(pytester: pytest.Pytester) -> list[dict[str, Any]]:
    return cast("list[dict[str, Any]]", _span_effects(pytester)["spans"])


def test_failing_test_records_error_chain_span(pytester: pytest.Pytester) -> None:
    """A failing test's CHAIN span carries ERROR status and records the exception, so the
    linked trace reflects the failure instead of a misleading OK."""
    pytester.makeconftest(_TRACING_CAPTURE_CONFTEST)
    pytester.makepyfile(
        test_fail="""
        import pytest
        import phoenix.client.pytest as px

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
        import phoenix.client.pytest as px

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


def test_task_and_evaluator_spans_use_separate_provider_lifecycles(
    pytester: pytest.Pytester,
) -> None:
    """Task and evaluator spans use distinct projects while evaluator-global tracing is scoped."""
    pytester.makeconftest(_TRACING_CAPTURE_CONFTEST)
    pytester.makepyfile(
        test_kinds="""
        import builtins
        import pytest
        import phoenix.client.pytest as px
        from opentelemetry import trace
        from phoenix.client.pytest.context import current_run

        def _evaluator_child(name):
            global_provider = trace.get_tracer_provider()
            assert global_provider is not builtins._phoenix_original_provider
            assert global_provider is not builtins._phoenix_evaluator_provider
            with trace.get_tracer(__name__).start_as_current_span(name):
                pass

        def inline(output, **_):
            _evaluator_child("inline child")
            return {"name": "inline", "score": 1.0}
        inline.name = "inline"

        def nested(output, **_):
            _evaluator_child("nested child")
            px.evaluate(inline, output=output)
            assert trace.get_tracer_provider() is not builtins._phoenix_original_provider
            return {"name": "nested", "score": 1.0}
        nested.name = "nested"

        def broken(output, **_):
            _evaluator_child("error child")
            builtins._phoenix_fail_flush = True
            raise ValueError("expected")
        broken.name = "broken"

        def correctness(output, **_):
            _evaluator_child("marker child")
            return {"name": "correctness", "score": 1.0}

        @pytest.mark.phoenix(dataset="trace-suite", evaluators=[correctness])
        def test_one():
            px.log_output("stable")
            run = current_run()
            assert run is not None and run.tracer is not None
            with run.tracer.tracer.start_as_current_span("task child before"):
                pass
            assert trace.get_tracer_provider() is builtins._phoenix_original_provider
            px.evaluate(nested, output="stable")
            assert trace.get_tracer_provider() is builtins._phoenix_original_provider
            with pytest.raises(ValueError, match="expected"):
                px.evaluate(broken, output="stable")
            assert trace.get_tracer_provider() is builtins._phoenix_original_provider
            px.log_evaluation(name="manual", score=1.0)
            with run.tracer.tracer.start_as_current_span("task child after"):
                pass
            assert True
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)
    effects = _span_effects(pytester)
    spans = effects["spans"]
    by_name = {s["name"]: s for s in spans}
    chain = next(s for s in spans if s["name"].startswith("Test: "))
    assert chain["kind"] == "CHAIN"
    assert chain["project"] == "proj-1"
    for task_name in ("task child before", "task child after"):
        assert by_name[task_name]["project"] == "proj-1"
    for ev_name in (
        "Evaluation: inline",
        "Evaluation: nested",
        "Evaluation: broken",
        "Evaluation: manual",
        "Evaluation: pass",
        "Evaluation: correctness",
    ):
        ev = by_name[ev_name]
        assert ev["kind"] == "EVALUATOR", ev_name
        assert ev["project"] == "evaluators", ev_name
        assert ev["trace_id"] != chain["trace_id"], ev_name
    for child_name in ("inline child", "nested child", "error child", "marker child"):
        assert by_name[child_name]["project"] == "evaluators"
    assert all(
        not span["name"].startswith("Evaluation:")
        and span["name"] not in {"inline child", "nested child", "error child", "marker child"}
        for span in spans
        if span["project"] == "proj-1"
    )

    run_trace_id = effects["runs"][0]["trace_id"]
    for evaluation in effects["evals"]:
        root = by_name[f"Evaluation: {evaluation['name']}"]
        assert evaluation["trace_id"] == root["trace_id"]
        assert evaluation["trace_id"] != run_trace_id
    assert effects["restored"] is True

    lifecycle = effects["lifecycle"]
    for ev_name in (
        "Evaluation: inline",
        "Evaluation: nested",
        "Evaluation: broken",
        "Evaluation: manual",
        "Evaluation: pass",
        "Evaluation: correctness",
    ):
        exported = next(
            i
            for i, event in enumerate(lifecycle)
            if event["event"] == "export" and event.get("span") == ev_name
        )
        flushed = next(
            event
            for event in lifecycle[exported + 1 :]
            if event["event"] == "flush" and event["project"] == "evaluators"
        )
        assert flushed["is_global"] is True
        assert flushed["is_raw"] is False
    for project in ("evaluators", "proj-1"):
        shutdown = next(
            i
            for i, event in enumerate(lifecycle)
            if event["event"] == "shutdown" and event["project"] == project
        )
        assert lifecycle[shutdown - 1]["event"] == "flush"
        assert lifecycle[shutdown - 1]["project"] == project
        assert (
            sum(event["event"] == "shutdown" and event["project"] == project for event in lifecycle)
            == 1
        )


def test_preacquired_proxy_tracer_does_not_bind_permanently_to_evaluator_provider(
    pytester: pytest.Pytester,
) -> None:
    pytester.makeconftest(_TRACING_CAPTURE_CONFTEST)
    pytester.makepyfile(
        test_proxy="""
        import builtins
        import pytest
        import phoenix.client.pytest as px
        from openinference.semconv.resource import ResourceAttributes
        from opentelemetry import trace
        from opentelemetry.sdk import trace as trace_sdk
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace.export import SimpleSpanProcessor
        from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

        trace._TRACER_PROVIDER = None
        tracer = trace.get_tracer("preacquired.lib")

        def first_emission(output, **_):
            with tracer.start_as_current_span("proxy first evaluator span"):
                pass
            return {"name": "proxy", "score": 1.0}

        @pytest.fixture
        def application_provider_after_test():
            yield
            exporter = InMemorySpanExporter()
            provider = trace_sdk.TracerProvider(
                resource=Resource({ResourceAttributes.PROJECT_NAME: "application"})
            )
            provider.add_span_processor(SimpleSpanProcessor(exporter))
            builtins._phoenix_span_exporters.append(exporter)
            trace._TRACER_PROVIDER = provider
            with tracer.start_as_current_span("proxy post-evaluator span"):
                pass
            assert [span.name for span in exporter.get_finished_spans()] == [
                "proxy post-evaluator span"
            ]
            trace._TRACER_PROVIDER = None
            provider.shutdown()

        @pytest.mark.phoenix(dataset="trace-suite")
        def test_one(application_provider_after_test):
            px.log_output("stable")
            px.evaluate(first_emission, output="stable")
        """
    )
    pytester.runpytest_subprocess("-p", "phoenix", "--no-header").assert_outcomes(passed=1)
    proxy_spans = {
        span["name"]: span
        for span in _spans(pytester)
        if span["name"] in {"proxy first evaluator span", "proxy post-evaluator span"}
    }
    assert proxy_spans["proxy first evaluator span"]["project"] == "evaluators"
    assert proxy_spans["proxy post-evaluator span"]["project"] == "application"


def test_failing_test_output_carries_trace_id(pytester: pytest.Pytester) -> None:
    """The failing test's output includes its trace_id so a reader can open the trace."""
    pytester.makeconftest(_TRACING_CONFTEST)
    pytester.makepyfile(
        test_fail="""
        import pytest
        import phoenix.client.pytest as px

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


# --- xdist (`-n`) records via controller-side collection + broadcast ------------------------

_XDIST_CONFTEST = """
import json, os
import phoenix.client.pytest.plugin as plugin

class _FakeDataset:
    id = "Dataset:1"; version_id = "Version:1"
    def __init__(self, ex): self._ex = ex
    @property
    def examples(self): return self._ex

class _FakeDatasets:
    def __init__(self): self._ex = []; self.uploads = 0
    def _upload_json_dataset(self, *, dataset_name, inputs, outputs, metadata,
                             example_ids, action, **kw):
        self.uploads += 1
        self._ex = [{"id": eid, "node_id": f"DatasetExampleGID:{i}",
                     "input": inp, "output": {}, "metadata": md}
                    for i, (inp, md, eid) in enumerate(zip(inputs, metadata, example_ids))]
        return _FakeDataset(self._ex)
    def get_dataset(self, *, dataset, **kw): return _FakeDataset(self._ex)

class _FakeExperiments:
    def __init__(self): self.runs = []; self.evals = []; self.creates = 0
    def create(self, *, repetitions=1, **kw):
        self.creates += 1
        return {"id": "Experiment:1", "project_name": None}
    def log_run(self, *, experiment_id, dataset_example_id, repetition_number=1,
                error=None, **kw):
        rid = f"ExperimentRun:{len(self.runs)}"
        self.runs.append({"id": rid, "example": dataset_example_id})
        return {"id": rid}
    def log_evaluation(self, *, experiment_run_id, name, **kw):
        self.evals.append({"name": name}); return {"id": "A:1"}

class _FakeClient:
    def __init__(self):
        self.datasets = _FakeDatasets(); self.experiments = _FakeExperiments()

_CLIENT = _FakeClient()

def pytest_configure(config):
    plugin._make_client = lambda: _CLIENT
    config._c = _CLIENT

def pytest_unconfigure(config):
    c = config._c
    worker = os.environ.get("PYTEST_XDIST_WORKER", "controller")
    with open(os.path.join(str(config.rootdir), f"effects-{worker}.json"), "w") as f:
        json.dump({
            "worker": worker,
            "creates": c.experiments.creates,
            "uploads": c.datasets.uploads,
            "n_runs": len(c.experiments.runs),
            "n_pass_evals": sum(1 for e in c.experiments.evals if e["name"] == "pass"),
        }, f)
"""


def test_xdist_records_runs_via_controller_bootstrap(pytester: pytest.Pytester) -> None:
    """Under ``-n`` the controller (which xdist forbids from collecting) force-collects, creates
    exactly one dataset+experiment, and broadcasts the ids; workers then record every run. Before
    this fix this whole path was a silent no-op."""
    pytester.makeconftest(_XDIST_CONFTEST)
    pytester.makepyfile(
        test_par="""
        import pytest
        import phoenix.client.pytest as px

        @pytest.mark.phoenix(dataset="xdist-suite")
        @pytest.mark.parametrize("n", [1, 2, 3, 4], ids=["a", "b", "c", "d"])
        def test_sq(n):
            px.log_output(n * n)
            assert n * n >= n
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "-n", "2", "--no-header")
    result.assert_outcomes(passed=4)

    import glob
    import json

    effects = [json.loads(open(p).read()) for p in glob.glob(str(pytester.path / "effects-*.json"))]
    # Exactly one process — the controller — created the dataset+experiment (creation isn't
    # idempotent, so per-worker bootstrap would have made N experiments).
    creators = [e for e in effects if e["creates"] > 0]
    assert len(creators) == 1
    assert creators[0]["worker"] == "controller"
    assert creators[0]["creates"] == 1
    assert creators[0]["uploads"] == 1
    assert creators[0]["n_runs"] == 0  # the controller does not execute tests
    # Workers recorded all four runs and their pass annotations.
    assert sum(e["n_runs"] for e in effects if e["worker"] != "controller") == 4
    assert sum(e["n_pass_evals"] for e in effects if e["worker"] != "controller") == 4


# --- skip / xfail / xpass are classified from the report, not the raw exception -------------

_OUTCOMES_CONFTEST = """
import json, os
import phoenix.client.pytest.plugin as plugin

class _FakeDataset:
    id = "Dataset:1"; version_id = "Version:1"
    def __init__(self, ex): self._ex = ex
    @property
    def examples(self): return self._ex

class _FakeDatasets:
    def __init__(self): self._ex = []
    def _upload_json_dataset(self, *, dataset_name, inputs, outputs, metadata,
                             example_ids, action, **kw):
        self._ex = [{"id": eid, "node_id": f"DatasetExampleGID:{i}",
                     "input": inp, "output": {}, "metadata": md}
                    for i, (inp, md, eid) in enumerate(zip(inputs, metadata, example_ids))]
        return _FakeDataset(self._ex)
    def get_dataset(self, *, dataset, **kw): return _FakeDataset(self._ex)

class _FakeExperiments:
    def __init__(self): self.runs = []; self.evals = []
    def create(self, **kw): return {"id": "Experiment:1"}
    def log_run(self, *, error=None, **kw):
        self.runs.append({"error": error}); return {"id": f"ExperimentRun:{len(self.runs)}"}
    def log_evaluation(self, *, name, score=None, **kw):
        self.evals.append({"name": name, "score": score}); return {"id": "A:1"}

class _FakeClient:
    def __init__(self): self.datasets = _FakeDatasets(); self.experiments = _FakeExperiments()

_CLIENT = _FakeClient()

def pytest_configure(config):
    plugin._make_client = lambda: _CLIENT
    config._c = _CLIENT
def pytest_unconfigure(config):
    c = config._c
    with open(os.path.join(str(config.rootdir), "outcomes.json"), "w") as f:
        json.dump({"n_runs": len(c.experiments.runs),
                   "pass_scores": [e["score"] for e in c.experiments.evals
                                   if e["name"] == "pass"]}, f)
"""


def test_skip_and_xfail_outcomes_are_not_mislabeled(pytester: pytest.Pytester) -> None:
    """Call-phase skips (in-body ``pytest.skip``) and expected-xfails are no longer recorded as
    failed ``pass`` annotations; only real pass/fail (and xpass) record runs."""
    pytester.makeconftest(_OUTCOMES_CONFTEST)
    pytester.makepyfile(
        test_outcomes="""
        import pytest
        import phoenix.client.pytest as px

        @pytest.mark.phoenix(dataset="outcomes")
        def test_pass():
            px.log_output("ok"); assert True

        @pytest.mark.phoenix(dataset="outcomes")
        def test_fail():
            px.log_output("no"); assert False

        @pytest.mark.phoenix(dataset="outcomes")
        def test_inbody_skip():
            px.log_output("x"); pytest.skip("later")

        @pytest.mark.phoenix(dataset="outcomes")
        @pytest.mark.skip(reason="marker")
        def test_marker_skip():
            px.log_output("x")

        @pytest.mark.phoenix(dataset="outcomes")
        @pytest.mark.xfail(reason="known")
        def test_xfail_fail():
            px.log_output("x"); assert False

        @pytest.mark.phoenix(dataset="outcomes")
        @pytest.mark.xfail(reason="maybe")
        def test_xpass():
            px.log_output("x"); assert True
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=1, failed=1, skipped=2, xfailed=1, xpassed=1)

    import json

    fx = json.loads((pytester.path / "outcomes.json").read_text())
    # pass + fail + xpass record runs; the two skips and the expected-xfail do not.
    assert fx["n_runs"] == 3
    assert sorted(fx["pass_scores"]) == [0.0, 1.0, 1.0]


# --- setup / teardown phases are classified, not just the call phase ------------------------

_PHASES_CONFTEST = """
import json, os
import phoenix.client.pytest.plugin as plugin

class _FakeDataset:
    id = "Dataset:1"; version_id = "Version:1"
    def __init__(self, ex): self._ex = ex
    @property
    def examples(self): return self._ex

class _FakeDatasets:
    def __init__(self): self._ex = []
    def _upload_json_dataset(self, *, dataset_name, inputs, outputs, metadata,
                             example_ids, action, **kw):
        self._ex = [{"id": eid, "node_id": f"DatasetExampleGID:{i}",
                     "input": inp, "output": {}, "metadata": md}
                    for i, (inp, md, eid) in enumerate(zip(inputs, metadata, example_ids))]
        return _FakeDataset(self._ex)
    def get_dataset(self, *, dataset, **kw): return _FakeDataset(self._ex)

class _FakeExperiments:
    def __init__(self): self.runs = []; self.evals = []
    def create(self, **kw): return {"id": "Experiment:1"}
    def log_run(self, *, error=None, **kw):
        self.runs.append({"error": error}); return {"id": f"ExperimentRun:{len(self.runs)}"}
    def log_evaluation(self, *, name, score=None, **kw):
        self.evals.append({"name": name, "score": score}); return {"id": "A:1"}

class _FakeClient:
    def __init__(self): self.datasets = _FakeDatasets(); self.experiments = _FakeExperiments()

_CLIENT = _FakeClient()

def pytest_configure(config):
    plugin._make_client = lambda: _CLIENT
    config._c = _CLIENT
def pytest_unconfigure(config):
    c = config._c
    with open(os.path.join(str(config.rootdir), "phases.json"), "w") as f:
        json.dump({"n_runs": len(c.experiments.runs),
                   "run_errors": [r["error"] for r in c.experiments.runs],
                   "eval_names": sorted({e["name"] for e in c.experiments.evals}),
                   "pass_scores": [e["score"] for e in c.experiments.evals
                                   if e["name"] == "pass"]}, f)
"""


def test_setup_error_records_error_run(pytester: pytest.Pytester) -> None:
    """A fixture that raises in setup is recorded as an errored run instead of vanishing from
    the experiment. The call phase never fires, so the run carries the setup error and a failing
    `pass`; hoisted evaluators are suppressed (there is no output to evaluate)."""
    pytester.makeconftest(_PHASES_CONFTEST)
    pytester.makepyfile(
        test_setup="""
        import pytest
        import phoenix.client.pytest as px

        @pytest.fixture
        def broken():
            raise RuntimeError("setup boom")

        def grader(output, **_):
            return {"name": "grader", "score": 1.0}

        @pytest.mark.phoenix(dataset="phases", evaluators=[grader])
        def test_needs_fixture(broken):
            px.log_output("never reached")
            assert True
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(errors=1)

    import json

    fx = json.loads((pytester.path / "phases.json").read_text())
    assert fx["n_runs"] == 1  # recorded, did not vanish
    assert fx["run_errors"][0] is not None and "setup boom" in fx["run_errors"][0]
    assert fx["pass_scores"] == [0.0]  # recorded as a failing run
    assert fx["eval_names"] == ["pass"]  # hoisted grader suppressed (no output to evaluate)


def test_teardown_failure_downgrades_run_to_fail(pytester: pytest.Pytester) -> None:
    """A test whose body passes but whose teardown errors is recorded as a failing run, not a
    pass — pytest reports it as an error, and the recorded outcome must agree."""
    pytester.makeconftest(_PHASES_CONFTEST)
    pytester.makepyfile(
        test_teardown="""
        import pytest
        import phoenix.client.pytest as px

        @pytest.mark.phoenix(dataset="phases")
        def test_body_ok(request):
            def _boom():
                raise RuntimeError("teardown boom")
            request.addfinalizer(_boom)
            px.log_output("ok")
            assert True
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=1, errors=1)

    import json

    fx = json.loads((pytester.path / "phases.json").read_text())
    assert fx["n_runs"] == 1
    assert fx["pass_scores"] == [0.0]  # body passed, but teardown error downgrades to fail
    assert fx["run_errors"][0] is not None and "teardown boom" in fx["run_errors"][0]


# --- a 409 for an existing successful run must not post annotations against an unresolved id --

_DUP_CONFTEST = """
import json, os
import httpx
import phoenix.client.pytest.plugin as plugin

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
    def __init__(self): self.runs = 0; self.evals = []
    def create(self, **kw): return {"id": "Experiment:1"}
    def log_run(self, **kw):
        self.runs += 1
        # The server treats an existing *successful* run as immutable and 409s instead of
        # overwriting it. experiments.log_run surfaces that as an HTTPStatusError; the plugin
        # must catch it and skip annotations rather than post them against an unresolved run.
        request = httpx.Request("POST", "http://test/runs")
        response = httpx.Response(409, json={"detail": "already exists"}, request=request)
        raise httpx.HTTPStatusError("409", request=request, response=response)
    def log_evaluation(self, *, name, **kw):
        self.evals.append(name); return {"id": "A:1"}

class _FakeClient:
    def __init__(self): self.datasets = _FakeDatasets(); self.experiments = _FakeExperiments()

_CLIENT = _FakeClient()

def pytest_configure(config):
    plugin._make_client = lambda: _CLIENT
    config._c = _CLIENT
def pytest_unconfigure(config):
    c = config._c
    with open(os.path.join(str(config.rootdir), "dup.json"), "w") as f:
        json.dump({"n_runs": c.experiments.runs, "eval_names": c.experiments.evals}, f)
"""


def test_existing_successful_run_409_skips_annotations(pytester: pytest.Pytester) -> None:
    """When ``log_run`` raises a 409 (a successful run already exists and the server refuses to
    overwrite it), the plugin skips the pass annotation and evaluations instead of posting them
    against a run it can't resolve.

    The duplicate-success case comes from concurrent duplicate execution (e.g. xdist collection
    divergence) or a rerun plugin that reruns an already-passing test. (Ordinary fail->pass
    reruns never reach here: the server upserts a run stored with an error.) Raising the 409
    directly from the stub covers the plugin-side behaviour without orchestrating a real race."""
    pytester.makeconftest(_DUP_CONFTEST)
    pytester.makepyfile(
        test_dup="""
        import pytest
        import phoenix.client.pytest as px

        @pytest.mark.phoenix(dataset="dup")
        def test_one():
            px.log_output("x")
            px.log_evaluation(name="custom", score=1.0)
            assert True
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=1)

    import json

    fx = json.loads((pytester.path / "dup.json").read_text())
    assert fx["n_runs"] == 1  # the run was attempted
    assert fx["eval_names"] == []  # but nothing was posted after the 409


# create_evaluator keyword dispatch and annotator-kind derivation are covered by the unit tests
# TestInvokeEvaluator / TestAnnotatorKind; the record -> log_evaluation path is exercised by the
# outcome test above, so no separate hoisted-evaluator integration test is kept here.
