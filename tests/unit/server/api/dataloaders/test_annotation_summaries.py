from datetime import datetime
from typing import Literal

import pandas as pd
import pytest
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.server.api.dataloaders import AnnotationSummaryDataLoader
from phoenix.server.api.dataloaders.annotation_summaries import Key
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.types import DbSessionFactory


async def test_evaluation_summaries(
    db: DbSessionFactory,
    data_for_testing_dataloaders: None,
) -> None:
    start_time = datetime.fromisoformat("2021-01-01T00:00:10.000+00:00")
    end_time = datetime.fromisoformat("2021-01-01T00:10:00.000+00:00")
    pid = models.Trace.project_rowid
    async with db() as session:
        span_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(
                    pid,
                    models.SpanAnnotation.name,
                    func.avg(models.SpanAnnotation.score).label("mean_score"),
                )
                .group_by(pid, models.SpanAnnotation.name)
                .order_by(pid, models.SpanAnnotation.name)
                .join_from(models.Trace, models.Span)
                .join_from(models.Span, models.SpanAnnotation)
                .where(models.Span.name.contains("_trace4_"))
                .where(models.SpanAnnotation.name.in_(("A", "C")))
                .where(start_time <= models.Span.start_time)
                .where(models.Span.start_time < end_time),
                s.connection(),
            )
        )
        trace_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(
                    pid,
                    models.TraceAnnotation.name,
                    func.avg(models.TraceAnnotation.score).label("mean_score"),
                )
                .group_by(pid, models.TraceAnnotation.name)
                .order_by(pid, models.TraceAnnotation.name)
                .join_from(models.Trace, models.TraceAnnotation)
                .where(models.TraceAnnotation.name.in_(("B", "D")))
                .where(start_time <= models.Trace.start_time)
                .where(models.Trace.start_time < end_time),
                s.connection(),
            )
        )
    expected = trace_df.loc[:, "mean_score"].to_list() + span_df.loc[:, "mean_score"].to_list()
    kinds: list[Literal["span", "trace"]] = ["trace", "span"]
    keys: list[Key] = [
        (
            kind,
            id_ + 1,
            TimeRange(start=start_time, end=end_time),
            "'_trace4_' in name" if kind == "span" else None,
            eval_name,
        )
        for kind in kinds
        for id_ in range(10)
        for eval_name in (("B", "D") if kind == "trace" else ("A", "C"))
    ]

    summaries = [summary for summary in await AnnotationSummaryDataLoader(db)._load_fn(keys)]
    actual = []
    for summary in summaries:
        assert summary is not None
        actual.append(
            summary.mean_score(),  # type: ignore[call-arg]
        )
    assert actual == pytest.approx(expected, 1e-7)


async def test_multiple_annotations_score_weighting(
    db: DbSessionFactory,
    data_with_multiple_annotations: None,
) -> None:
    # Using the "quality" annotations fixture.
    start_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    end_time = datetime.fromisoformat("2021-01-01T01:00:00.000+00:00")
    # Based on the fixture:
    # Span 1: avg score = (0.85+0.95+0.3)/3 = 0.70
    # Span 2: avg score = (0.85+0.3)/2 = 0.575
    # Span 3: avg score = 0.85
    # Overall average score = (0.70+0.575+0.85)/3 ≈ 0.70833.
    expected_avg_score = 0.70833

    async with db() as session:
        project_id = await session.scalar(
            select(models.Project.id).where(models.Project.name == "simple_multiple")
        )
        assert isinstance(project_id, int)

    loader = AnnotationSummaryDataLoader(db)
    result = await loader.load(
        (
            "span",
            project_id,
            TimeRange(start=start_time, end=end_time),
            None,
            "quality",
        )
    )
    assert result is not None
    assert result.mean_score() == pytest.approx(expected_avg_score, rel=1e-4)  # type: ignore[call-arg]

    # Expected fractions:
    # "good": (2/3 + 1/2 + 1) / 3 ≈ 0.722
    # "bad": (1/3 + 1/2 + 0) / 3 ≈ 0.277
    label_fracs = {lf.label: lf.fraction for lf in result.label_fractions()}  # type: ignore[call-arg, attr-defined]
    assert label_fracs["good"] == pytest.approx(0.722, rel=1e-2)
    assert label_fracs["bad"] == pytest.approx(0.277, rel=1e-2)
    assert abs(label_fracs["good"] + label_fracs["bad"] - 1.0) < 1e-2


async def test_missing_label_aggregation(
    db: DbSessionFactory,
    data_with_missing_labels: None,
) -> None:
    # Using the "distribution" annotations fixture.
    start_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    end_time = datetime.fromisoformat("2021-01-01T01:00:00.000+00:00")
    # Based on the fixture:
    # Span 1: For "distribution": "X" fraction = 2/3, "Y" fraction = 1/3.
    # Span 2: "X" fraction = 1.
    # Span 3: "X" fraction = 1.
    # Overall label fractions for "distribution" annotation:
    #   "X": (0.667 + 1 + 1) / 3 ≈ 0.889,
    #   "Y": (0.333 + 0 + 0) / 3 ≈ 0.111.
    loader = AnnotationSummaryDataLoader(db)

    async with db() as session:
        project_id = await session.scalar(
            select(models.Project.id).where(models.Project.name == "simple_missing")
        )
        assert isinstance(project_id, int)
    result = await loader.load(
        (
            "span",
            project_id,
            TimeRange(start=start_time, end=end_time),
            None,
            "distribution",
        )
    )
    assert result is not None

    label_fracs = {lf.label: lf.fraction for lf in result.label_fractions()}  # type: ignore[call-arg, attr-defined]
    assert label_fracs["X"] == pytest.approx(0.889, rel=1e-2)
    assert label_fracs["Y"] == pytest.approx(0.111, rel=1e-2)
    assert abs(sum(label_fracs.values()) - 1.0) < 1e-7

    # The "distribution" annotation is grouped as follows:
    # Span 1: .8, .8, .6
    # Span 2: .8
    # Span 3: .8
    # Overall average = ((0.8 + 0.8 + 0.6) / 3 + 0.8 + 0.8) / 3 ≈ 0.777
    assert result.mean_score() == pytest.approx(0.777, rel=1e-2)  # type: ignore[call-arg]


async def test_null_label_handling(
    db: DbSessionFactory,
    data_with_null_labels: None,
) -> None:
    """Ensure that the loader does not raise when all labels are NULL.

    The expected behavior is:
    * label_fractions() returns an empty list.
    * mean_score() computes the per-entity average score correctly.
    """
    start_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    end_time = datetime.fromisoformat("2021-01-01T01:00:00.000+00:00")

    async with db() as session:
        project_id = await session.scalar(
            select(models.Project.id).where(models.Project.name == "null_labels")
        )
        assert isinstance(project_id, int)

    loader = AnnotationSummaryDataLoader(db)
    result = await loader.load(
        (
            "span",
            project_id,
            TimeRange(start=start_time, end=end_time),
            None,
            "unlabeled",
        )
    )

    # Should not be None and should have no label fractions.
    assert result is not None
    assert result.label_fractions() == []  # type: ignore

    # Each span has 2 scores. Compute expected overall average.
    # Span averages: (0.5+0.9)/2 = 0.7, (0.6+0.8)/2 = 0.7, (0.4+1.0)/2 = 0.7.
    expected_avg = 0.7
    assert result.mean_score() == pytest.approx(expected_avg, rel=1e-4)  # type: ignore[call-arg]
