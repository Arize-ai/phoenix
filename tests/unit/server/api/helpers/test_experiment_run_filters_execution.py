"""Experiment-filter behavior against rows, not against generated SQL.

The rest of this suite snapshots the SQL a condition compiles to. That records
what we generate, never whether it selects anything: a condition that compiled
to a quoted string comparison passed every snapshot while matching no row on
either backend, because the JSON accessor returned `"yes"` and the literal was
`yes`.

These assert exact `external_id` sets and run under both `--db sqlite` and
`--db postgresql`. A fixed expectation checked on each backend catches
divergence and shared defects alike, which comparing the two to each other
cannot.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.server.api.helpers.experiment_run_filters import (
    update_examples_query_with_filter_condition,
)
from phoenix.server.types import DbSessionFactory

_TS = datetime(2026, 1, 1, tzinfo=timezone.utc)

# (external_id, revision input, revision output, run output, run error, seconds)
_EXAMPLES: tuple[tuple[str, dict[str, Any], dict[str, Any], Any, Any, int], ...] = (
    ("e1", {"x": "yes"}, {"answer": "yes"}, "yes", None, 1),
    ("e2", {"x": "no"}, {"answer": "no"}, "no", None, 2),
    ("e3", {"x": 1}, {"answer": 1}, 1, "boom", 3),
    ("e4", {"x": True}, {"answer": True}, True, None, 4),
    ("e5", {"x": None}, {"answer": None}, None, None, 5),
    # A key the other rows lack: the accessor yields SQL NULL, not a value.
    ("e6", {"other": "yes"}, {"other": "yes"}, {"nested": "yes"}, None, 6),
)


@pytest.fixture
async def experiment_filter_data(db: DbSessionFactory) -> int:
    """Seed one dataset and one experiment; return the experiment rowid."""
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset).values(name="d", metadata_={}).returning(models.Dataset.id)
        )
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .values(dataset_id=dataset_id, metadata_={})
            .returning(models.DatasetVersion.id)
        )
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="x",
                repetitions=1,
                metadata_={},
            )
            .returning(models.Experiment.id)
        )
        for external_id, input_, output, run_output, error, seconds in _EXAMPLES:
            example_id = await session.scalar(
                insert(models.DatasetExample)
                .values(dataset_id=dataset_id, external_id=external_id)
                .returning(models.DatasetExample.id)
            )
            revision_id = await session.scalar(
                insert(models.DatasetExampleRevision)
                .values(
                    dataset_example_id=example_id,
                    dataset_version_id=version_id,
                    input=input_,
                    output=output,
                    metadata_=input_,
                    revision_kind="CREATE",
                )
                .returning(models.DatasetExampleRevision.id)
            )
            await session.execute(
                insert(models.ExperimentDatasetExample).values(
                    experiment_id=experiment_id,
                    dataset_example_id=example_id,
                    dataset_example_revision_id=revision_id,
                )
            )
            run_id = await session.scalar(
                insert(models.ExperimentRun)
                .values(
                    experiment_id=experiment_id,
                    dataset_example_id=example_id,
                    repetition_number=1,
                    output={"task_output": run_output},
                    error=error,
                    start_time=_TS,
                    end_time=_TS + timedelta(seconds=seconds),
                )
                .returning(models.ExperimentRun.id)
            )
            await session.execute(
                insert(models.ExperimentRunAnnotation).values(
                    experiment_run_id=run_id,
                    name="correctness",
                    annotator_kind="CODE",
                    label=external_id,
                    score=float(seconds),
                    metadata_={},
                    start_time=_TS,
                    end_time=_TS,
                )
            )
    assert experiment_id is not None
    return experiment_id


async def _matches(db: DbSessionFactory, experiment_id: int, condition: str) -> set[str]:
    query = update_examples_query_with_filter_condition(
        query=select(models.DatasetExample)
        .join(models.DatasetExampleRevision)
        .join(
            models.ExperimentDatasetExample,
            models.ExperimentDatasetExample.dataset_example_id == models.DatasetExample.id,
        )
        .where(models.ExperimentDatasetExample.experiment_id == experiment_id),
        # `experiments[0]` indexes this list positionally, not by rowid.
        filter_condition=condition,
        experiment_ids=[experiment_id],
    )
    async with db() as session:
        return {example.external_id or "" for example in (await session.scalars(query)).all()}


class TestExperimentFilterExecution:
    @pytest.mark.parametrize(
        "condition,expected",
        [
            # The regression: a JSON string compared against a string literal.
            pytest.param("input['x'] == 'yes'", {"e1"}, id="json-string-eq"),
            pytest.param("reference_output['answer'] == 'yes'", {"e1"}, id="reference-output-eq"),
            pytest.param("metadata['x'] == 'yes'", {"e1"}, id="metadata-eq"),
            pytest.param("experiments[0].output == 'yes'", {"e1"}, id="run-output-eq"),
            # Inequality must not become "every row whose accessor is quoted".
            pytest.param("input['x'] != 'yes'", {"e2", "e3", "e4"}, id="json-string-ne"),
            # Substring search goes through the same string coercion.
            pytest.param("'ye' in input['x']", {"e1"}, id="json-string-contains"),
            # Non-string comparisons must keep working.
            pytest.param("experiments[0].latency_ms > 3500", {"e4", "e5", "e6"}, id="latency"),
            pytest.param("experiments[0].error is not None", {"e3"}, id="error-not-null"),
            pytest.param(
                "experiments[0].evals['correctness'].score > 4",
                {"e5", "e6"},
                id="eval-score",
            ),
            pytest.param(
                "experiments[0].evals['correctness'].label == 'e1'",
                {"e1"},
                id="eval-label",
            ),
        ],
    )
    async def test_filter_selects_expected_examples(
        self,
        db: DbSessionFactory,
        experiment_filter_data: int,
        condition: str,
        expected: set[str],
    ) -> None:
        assert await _matches(db, experiment_filter_data, condition) == expected

    async def test_missing_key_matches_nothing_rather_than_everything(
        self, db: DbSessionFactory, experiment_filter_data: int
    ) -> None:
        # e6 has no 'x'; a NULL accessor is neither equal nor unequal.
        eq = await _matches(db, experiment_filter_data, "input['x'] == 'absent'")
        ne = await _matches(db, experiment_filter_data, "input['x'] != 'absent'")
        assert "e6" not in eq and "e6" not in ne

    async def test_is_none_covers_json_null_and_absent_key(
        self, db: DbSessionFactory, experiment_filter_data: int
    ) -> None:
        # e5 stores JSON null, e6 omits the key. `json_extract` returns SQL NULL
        # for both and no dialect can separate them, so `is None` means "no
        # usable value" rather than "explicitly null".
        assert await _matches(db, experiment_filter_data, "input['x'] is None") == {"e5", "e6"}
        assert await _matches(db, experiment_filter_data, "input['x'] is not None") == {
            "e1",
            "e2",
            "e3",
            "e4",
        }

    async def test_json_booleans_as_numbers_is_a_known_divergence(
        self, db: DbSessionFactory, experiment_filter_data: int, dialect: str
    ) -> None:
        """SQLite counts a JSON boolean as a number; PostgreSQL does not.

        `json_extract` renders `true` as `1` with no type left to inspect, so
        SQLite cannot tell it from the integer. PostgreSQL's `strict $.double()`
        rejects it. Pinned rather than fixed: the two backends would have to
        agree on what a boolean *is* before either could change, and the
        alternative is dropping e3, which is genuinely a number.
        """
        numeric = await _matches(db, experiment_filter_data, "input['x'] == 1")
        assert "e3" in numeric
        assert numeric == ({"e3", "e4"} if dialect == "sqlite" else {"e3"})

    async def test_json_boolean_text_rendering_is_a_known_divergence(
        self, db: DbSessionFactory, experiment_filter_data: int, dialect: str
    ) -> None:
        # The mirror of the numeric case: extracted as text, e4's JSON `true`
        # reads as `true` on PostgreSQL and as `1` on SQLite, so a substring
        # search reaches it on only one backend.
        matches = await _matches(db, experiment_filter_data, "'e' in input['x']")
        assert matches == ({"e1"} if dialect == "sqlite" else {"e1", "e4"})
