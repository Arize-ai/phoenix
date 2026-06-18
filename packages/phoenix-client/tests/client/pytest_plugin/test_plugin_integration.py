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
    # If the plugin tried to build a client it would import phoenix.client.Client; we make that
    # fatal so any network attempt fails the inner run loudly.
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
                # Faithful to a custom-id upload: the example "id" field echoes our uploaded
                # external_id, while "node_id" carries the distinct server GlobalID. Runs must be
                # recorded against node_id, not id (regression guard for PR #13702).
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
            # Persist observed effects for the outer test to assert on.
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
    # One `pass` annotation plus the inline `custom` annotation per run.
    assert effects["eval_names"] == ["custom", "pass"]
    # Runs must be recorded against example node GlobalIDs, not the uploaded external_ids
    # (regression guard for PR #13702: the external_ids contain "::", the node_ids do not).
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
    with a distinct repetition_number on the SAME dataset_example_id (D14)."""
    monkeypatch.setenv("PHOENIX_TEST_REPETITIONS", "3")
    monkeypatch.setenv("PHOENIX_TEST_REPO_INFO", "false")
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
    # Three native pytest items (one per repetition).
    result.assert_outcomes(passed=3)

    import json

    rep = json.loads((pytester.path / "rep.json").read_text())
    assert len(rep["runs"]) == 3
    # Distinct, 1-based repetition_numbers.
    assert sorted(r["rep"] for r in rep["runs"]) == [1, 2, 3]
    # All repetitions share ONE dataset example node GlobalID (stable external_id across reps).
    assert {r["example"] for r in rep["runs"]} == {"DatasetExampleGID:0"}
    assert rep["n_examples"] == 1
    # experiment.repetitions reflects the resolved N.
    assert rep["experiment_repetitions"] == 3


def test_hoisted_marker_evaluators_record_annotations(pytester: pytest.Pytester) -> None:
    """@pytest.mark.phoenix(evaluators=[...]) runs each evaluator over the case automatically and
    records its score as an annotation — no inline px.evaluate needed (D12 declarative form)."""
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
            # A plain callable evaluator (no phoenix.evals dependency needed for the test).
            return {"name": "correctness", "score": 1.0 if output == expected else 0.0}

        @pytest.mark.phoenix(dataset="hoist-suite", evaluators=[correctness])
        @pytest.mark.parametrize("expected", ["ok"], ids=["case1"])
        def test_thing(expected):
            px.log_output("ok")
            assert True   # no inline px.evaluate — the marker evaluator runs automatically
        """
    )
    result = pytester.runpytest_subprocess("-p", "phoenix", "--no-header")
    result.assert_outcomes(passed=1)

    import json

    ev = json.loads((pytester.path / "ev.json").read_text())
    by_name = {e["name"]: e["score"] for e in ev["evals"]}
    # The hoisted evaluator recorded its score WITHOUT any inline px.evaluate call,
    assert by_name.get("correctness") == 1.0
    # alongside the assertion-derived `pass` annotation.
    assert by_name.get("pass") == 1.0
