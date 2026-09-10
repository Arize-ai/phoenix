import base64
import sqlite3

import pytest

from isolation import InvalidEvidence
from smoke_cli import cli_request
from smoke_target import scoped_sql
from smoke_tasks import grade_review


def test_cli_runs_argv_without_a_shell_or_inherited_environment():
    args = ["api", "graphql", "{projects{edges{node{name}}}}; echo secret"]
    argv, stdin = cli_request({"argv": args, "stdin": "input"})
    assert argv == ["/usr/local/bin/px", *args]
    assert stdin == "input"
    for args in (["self", "update"], ["auth", "login"], ["/bin/sh"], ["trace", "\0"]):
        with pytest.raises(ValueError):
            cli_request({"argv": args})


def test_review_joins_cannot_reach_other_datasets_or_annotations():
    review = {
        "dataset_id": base64.b64encode(b"Dataset:1").decode(),
        "experiment_id": base64.b64encode(b"Experiment:1").decode(),
    }
    with sqlite3.connect(":memory:") as db:
        db.executescript(
            "CREATE TABLE traces(id INTEGER, project_rowid INTEGER);"
            "CREATE TABLE spans(id INTEGER, trace_rowid INTEGER);"
            "CREATE TABLE span_annotations(id INTEGER, span_rowid INTEGER);"
            "CREATE TABLE datasets(id INTEGER);"
            "CREATE TABLE dataset_examples(id INTEGER, dataset_id INTEGER);"
            "CREATE TABLE dataset_example_revisions(id INTEGER, dataset_example_id INTEGER);"
            "CREATE TABLE experiments(id INTEGER, dataset_id INTEGER);"
            "CREATE TABLE experiment_runs(id INTEGER, experiment_id INTEGER);"
            "INSERT INTO traces VALUES(1,1),(2,2);"
            "INSERT INTO spans VALUES(1,1),(2,2);"
            "INSERT INTO span_annotations VALUES(1,1),(2,2);"
            "INSERT INTO datasets VALUES(1),(2);"
            "INSERT INTO dataset_examples VALUES(1,1),(2,2);"
            "INSERT INTO dataset_example_revisions VALUES(1,1),(2,2);"
            "INSERT INTO experiments VALUES(1,1),(2,2);"
            "INSERT INTO experiment_runs VALUES(1,1),(2,2);"
        )
        for table in (
            "spans",
            "span_annotations",
            "datasets",
            "dataset_examples",
            "dataset_example_revisions",
            "experiments",
            "experiment_runs",
        ):
            assert db.execute(scoped_sql(f"SELECT id FROM {table}", 1, review)).fetchall() == [(1,)]
        assert (
            db.execute(
                scoped_sql(
                    "WITH x AS (SELECT * FROM experiment_runs) "
                    "SELECT x.id FROM x JOIN experiments e ON e.id=x.experiment_id WHERE e.id=2",
                    1,
                    review,
                )
            ).fetchall()
            == []
        )


def test_review_grading_rejects_missing_or_forged_evidence():
    reference = {"span_id": "a", "annotations": [{"label": "failure", "score": 1}]}
    evidence = {
        "shutdown_confirmed": True,
        "audit_complete": True,
        "target_state_complete": True,
        "state_unchanged": True,
        "forbidden_attempts": [],
    }
    assert grade_review(reference, reference, evidence)["reward"] == 1
    wrong = reference | {"annotations": [{"label": "success", "score": 1}]}
    assert grade_review(wrong, reference, evidence)["answer_correct"] == 0
    boolean_score = reference | {"annotations": [{"label": "failure", "score": True}]}
    assert grade_review(boolean_score, reference, evidence)["answer_correct"] == 0
    assert grade_review(reference, reference, evidence | {"state_unchanged": False})["reward"] == 0
    assert (
        grade_review(reference, reference, evidence | {"forbidden_attempts": [{}]})["reward"] == 0
    )
    with pytest.raises(InvalidEvidence):
        grade_review(reference, reference, evidence | {"shutdown_confirmed": False})


@pytest.mark.parametrize(
    "name", ["traces", "TRACES", "spans", "dataset_examples", "experiment_runs"]
)
def test_cte_cannot_replace_a_physical_table_in_scope_predicates(name):
    review = {
        "dataset_id": base64.b64encode(b"Dataset:1").decode(),
        "experiment_id": base64.b64encode(b"Experiment:1").decode(),
    }
    with pytest.raises(ValueError, match="shadow"):
        scoped_sql(
            f'WITH "{name}" AS (SELECT 2 AS id, 1 AS project_rowid) SELECT * FROM spans', 1, review
        )
