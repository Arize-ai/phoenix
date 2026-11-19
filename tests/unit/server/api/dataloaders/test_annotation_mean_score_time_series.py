from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Literal, Optional

import pytest
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.annotation_metrics import build_entity_weighted_annotation_metrics_stmt
from phoenix.server.api.dataloaders.annotation_score_metrics import SeriesBin, _as_datetime
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace
from .annotation_mean_score_time_series import AnnotationMeanScoreTimeSeriesDataLoader, Result

_POSTGRESQL = postgresql.dialect()  # type: ignore[no-untyped-call]

_DAY_0 = datetime(2024, 6, 10, tzinfo=timezone.utc)
_DAY_BINS = TimeBucketSpec(unit="day")


async def _add_entity(
    session: AsyncSession,
    project: models.Project,
    kind: Literal["span", "trace", "session"],
    start_time: datetime,
) -> int:
    if kind == "session":
        project_session = await _add_project_session(
            session, project, start_time=start_time, end_time=start_time
        )
        return project_session.id
    trace = await _add_trace(session, project, start_time=start_time)
    if kind == "trace":
        return trace.id
    span = await _add_span(session, trace, start_time=start_time)
    return span.id


def _annotation(
    kind: Literal["span", "trace", "session"],
    entity_id: int,
    name: str,
    label: Optional[str],
    score: Optional[float],
) -> models.Base:
    fields: dict[str, Any] = dict(
        name=name,
        label=label,
        score=score,
        explanation=None,
        metadata_={},
        annotator_kind="CODE",
        source="API",
        identifier=token_hex(4),
    )
    if kind == "span":
        return models.SpanAnnotation(span_rowid=entity_id, **fields)
    if kind == "trace":
        return models.TraceAnnotation(trace_rowid=entity_id, **fields)
    return models.ProjectSessionAnnotation(project_session_id=entity_id, **fields)


def _rounded(result: Result) -> Result:
    """The result with its label fractions rounded, to compare against exact ratios."""
    return {
        bucket: series_bin._replace(
            label_fractions=tuple(
                (label, round(fraction, 6)) for label, fraction in series_bin.label_fractions
            )
        )
        for bucket, series_bin in result.items()
    }


class TestAnnotationMeanScoreTimeSeriesDataLoader:
    @pytest.mark.parametrize("kind", ["span", "trace", "session"])
    async def test_series_matches_the_entity_weighted_metrics(
        self,
        db: DbSessionFactory,
        kind: Literal["span", "trace", "session"],
    ) -> None:
        """The series' lean statement reports the same per-bucket mean and
        scored-entity count as the shared metrics statement it replaces."""
        async with db() as session:
            project = await _add_project(session)
            # (day offset, [(name, label, score), ...]) per entity
            entities: list[tuple[int, list[tuple[str, Optional[str], Optional[float]]]]] = [
                # Repeated annotations on one entity average first: weight 1, mean 0.5.
                (0, [("quality", "pass", 1.0), ("quality", "fail", 0.0)]),
                # Label-only: neither a mean nor a scored entity.
                (0, [("quality", "pass", None)]),
                (0, [("quality", None, 1.0)]),
                (1, [("quality", "meh", 0.25), ("other", None, 0.0)]),
                # Before the window.
                (-1, [("quality", None, 1.0)]),
            ]
            for day, annotations in entities:
                entity_id = await _add_entity(
                    session, project, kind, _DAY_0 + timedelta(days=day, hours=1)
                )
                for name, label, score in annotations:
                    session.add(_annotation(kind, entity_id, name, label, score))
            await session.flush()

        segment = (kind, project.id, (_DAY_0, None), _DAY_BINS)
        loader = AnnotationMeanScoreTimeSeriesDataLoader(db)
        quality, other = map(
            _rounded,
            await loader.load_many([(*segment, "quality"), (*segment, "other")]),
        )
        # Day 0 holds three result-bearing entities: the first splits its labels
        # evenly, the second is all "pass", the third has only a score.
        assert quality == {
            _DAY_0: SeriesBin(
                0.75, 2, 3, (("fail", round(0.5 / 3, 6)), ("pass", round(1.5 / 3, 6)))
            ),
            _DAY_0 + timedelta(days=1): SeriesBin(0.25, 1, 1, (("meh", 1.0),)),
        }
        assert other == {_DAY_0 + timedelta(days=1): SeriesBin(0.0, 1, 1)}

        reference_means: dict[tuple[str, datetime], tuple[float, int]] = {}
        reference_fractions: dict[tuple[str, datetime], dict[str, float]] = {}
        rows_stmt = loader._get_rows_stmt(segment, "quality", "other")
        async with db() as session:
            for row in await session.execute(
                build_entity_weighted_annotation_metrics_stmt(rows_stmt)
            ):
                bucket_key = (row.name, _as_datetime(row.bucket))
                if row.avg_score is not None:
                    reference_means.setdefault(
                        bucket_key, (float(row.avg_score), int(row.scored_entity_count))
                    )
                if row.label is not None:
                    reference_fractions.setdefault(bucket_key, {})[row.label] = float(
                        row.avg_label_fraction
                    )
        lean = {("quality", bucket): series_bin for bucket, series_bin in quality.items()}
        lean.update({("other", bucket): series_bin for bucket, series_bin in other.items()})
        assert {
            bucket_key: (series_bin.mean_score, series_bin.scored_entity_count)
            for bucket_key, series_bin in lean.items()
            if series_bin.mean_score is not None
        } == reference_means
        lean_fractions = {
            bucket_key: dict(series_bin.label_fractions)
            for bucket_key, series_bin in lean.items()
            if series_bin.label_fractions
        }
        assert lean_fractions.keys() == reference_fractions.keys()
        for bucket_key, fractions in lean_fractions.items():
            assert fractions == pytest.approx(reference_fractions[bucket_key], abs=1e-6)

    @pytest.mark.parametrize("kind", ["span", "trace", "session"])
    async def test_label_only_buckets_have_fractions_and_no_mean(
        self,
        db: DbSessionFactory,
        kind: Literal["span", "trace", "session"],
    ) -> None:
        """A bucket whose entities carry only labels still appears, with no mean
        or scored entities, and repeated annotations on one entity weigh as one."""
        async with db() as session:
            project = await _add_project(session)
            for day, labels in [(0, ["yes", "yes", "no"]), (0, ["no"]), (2, ["yes"])]:
                entity_id = await _add_entity(
                    session, project, kind, _DAY_0 + timedelta(days=day, hours=3)
                )
                for label in labels:
                    session.add(_annotation(kind, entity_id, "verdict", label, None))
            await session.flush()

        loader = AnnotationMeanScoreTimeSeriesDataLoader(db)
        verdict = _rounded(
            await loader.load((kind, project.id, (_DAY_0, None), _DAY_BINS, "verdict"))
        )
        assert verdict == {
            # (1/3 + 1) / 2 entities are "no", (2/3) / 2 are "yes"
            _DAY_0: SeriesBin(None, 0, 2, (("no", round(2 / 3, 6)), ("yes", round(1 / 3, 6)))),
            _DAY_0 + timedelta(days=2): SeriesBin(None, 0, 1, (("yes", 1.0),)),
        }

    @pytest.mark.parametrize("kind", ["span", "trace", "session"])
    @pytest.mark.parametrize(
        "dialect",
        [
            (SupportedSQLDialect.SQLITE, sqlite.dialect()),
            (SupportedSQLDialect.POSTGRESQL, _POSTGRESQL),
        ],
    )
    def test_statement_scans_the_annotations_once(
        self, kind: Literal["span", "trace", "session"], dialect: tuple[SupportedSQLDialect, Any]
    ) -> None:
        """The shared metrics statement inlined its rows into five branches, and on
        Postgres a mis-estimated join between those branches took minutes."""
        supported_dialect, sa_dialect = dialect

        class _Db:
            pass

        db = _Db()
        db.dialect = supported_dialect  # type: ignore[attr-defined]
        loader = AnnotationMeanScoreTimeSeriesDataLoader(db)  # type: ignore[arg-type]
        stmt = loader._get_stmt((kind, 1, (_DAY_0, None), _DAY_BINS), "quality", "other")
        annotation_table = {
            "span": "span_annotations",
            "trace": "trace_annotations",
            "session": "project_session_annotations",
        }[kind]
        assert str(stmt.compile(dialect=sa_dialect)).count(f"FROM {annotation_table}") == 1
