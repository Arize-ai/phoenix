import json
from datetime import datetime
from secrets import token_hex
from typing import Any, Sequence

import pytest
import sqlalchemy as sa
from deepdiff.diff import DeepDiff
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DbSessionFactory


async def test_projects_with_session_injection(
    db: DbSessionFactory,
    project: Any,
) -> None:
    # this test demonstrates parametrizing the session fixture
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_projects_with_db_injection(
    db: DbSessionFactory,
    project: Any,
) -> None:
    # this test demonstrates mixing the db and model fixtures
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_empty_projects(
    db: DbSessionFactory,
) -> None:
    # shows that databases are reset between tests
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert not result


class TestCaseInsensitiveContains:
    @pytest.fixture
    async def _case_insensitive_data(
        self,
        db: DbSessionFactory,
    ) -> list[models.Project]:
        """Create test data for case-insensitive filtering with unicode characters."""
        # Create comprehensive test data that covers various Unicode and special character scenarios
        descriptions = [
            "Hello Wörld",  # 0: Basic Unicode (German umlaut)
            "HELLO wörld",  # 1: Mixed case Unicode
            "Café Naïve",  # 2: French accents
            "café naïve",  # 3: Lowercase French accents
            "test_underscore%percent",  # 4: LIKE special characters
            "path\\to\\file",  # 5: Backslashes
            "query_like_%_pattern",  # 6: Multiple LIKE special chars
            "  Space123  ",  # 7: Whitespace and numbers
            "Hello 世界",  # 8: Chinese characters
            "'; dRoP tAbLe UsErS;--",  # 9: SQL injection patterns
            "repeat_pattern_" * 10,  # 10: Long repeated pattern
            "café",  # 11: Unicode normalization test
            "completely different",  # 12: Control case
            "αβγ ñoño",  # 13: Greek + Spanish
            "C:\\Windows\\System32",  # 14: Windows paths
            "data%%%multiple",  # 15: Multiple consecutive percent signs
            "test___underscores",  # 16: Multiple consecutive underscores
            "path\\\\\\escaped",  # 17: Multiple consecutive backslashes
            "%_mixed_special_%",  # 18: Mixed special chars at boundaries
            "unicode_café%wörld",  # 19: Unicode combined with special chars
            "\\%escaped_percent",  # 20: Escaped percent sign
            "\\_escaped_underscore",  # 21: Escaped underscore
            "sql%_injection'--",  # 22: Complex SQL injection with special chars
            "regex[.*]%like_",  # 23: Regex-like pattern with special chars
            None,  # 24: None
        ]

        projects = [
            models.Project(
                name=token_hex(8),
                description=description,
            )
            for description in descriptions
        ]
        async with db() as session:
            session.add_all(projects)

        return projects

    async def test_case_insensitive_contains(
        self,
        _case_insensitive_data: list[models.Project],
        db: DbSessionFactory,
    ) -> None:
        """Comprehensive test for CaseInsensitiveContains covering Unicode,
        special chars, security, and edge cases."""

        def get_expected_indices(search_term: str) -> list[int]:
            if search_term == "":
                return [
                    i
                    for i, project in enumerate(_case_insensitive_data)
                    if project.description is not None
                ]
            search_lower = search_term.lower()
            # Use the actual project descriptions from the database
            return [
                i
                for i, project in enumerate(_case_insensitive_data)
                if project.description is not None
                if search_lower in project.description.lower()
            ]

        test_cases = [
            # Unicode case-insensitivity
            ("hello", "Unicode: basic case-insensitive matching"),
            ("WÖRLD", "Unicode: German umlauts case-insensitive"),
            ("café", "Unicode: French accents"),
            ("NAÏVE", "Unicode: French accents case-insensitive"),
            ("ö", "Unicode: single character"),
            ("世界", "Unicode: Chinese characters"),
            ("αβγ", "Unicode: Greek letters"),
            ("ñoño", "Unicode: Spanish with tildes"),
            # LIKE special character escaping
            ("%", "Special chars: literal percent"),
            ("_", "Special chars: literal underscore"),
            ("\\", "Special chars: literal backslash"),
            ("test_underscore", "Special chars: word with underscore"),
            ("%percent", "Special chars: trailing percent"),
            ("_pattern", "Special chars: leading underscore"),
            ("C:\\Windows", "Special chars: Windows path"),
            ("query_like_%_pattern", "Special chars: multiple special chars"),
            # Advanced escaping edge cases
            ("%%%", "Escaping: multiple consecutive percent signs"),
            ("___", "Escaping: multiple consecutive underscores"),
            ("\\\\\\", "Escaping: multiple consecutive backslashes"),
            ("%_", "Escaping: mixed special chars"),
            ("_%", "Escaping: underscore followed by percent"),
            ("café%", "Escaping: Unicode with special chars"),
            ("\\%", "Escaping: escaped percent sign"),
            ("\\_", "Escaping: escaped underscore"),
            ("injection'--", "Escaping: SQL injection with quote and comment"),
            ("[.*]", "Escaping: regex-like patterns"),
            ("%like_", "Escaping: percent and underscore combination"),
            # SQL injection protection
            ("'", "Security: single quote"),
            ("DROP", "Security: SQL keyword"),
            ("--", "Security: SQL comment"),
            ("'; DROP TABLE users;--", "Security: full injection attempt"),
            # Edge cases and boundary conditions
            ("", "Edge case: empty string matches all"),
            ("  ", "Edge case: double space"),
            ("123", "Edge case: numbers"),
            ("Space123", "Edge case: mixed content"),
            ("repeat_pattern_", "Edge case: long pattern matching"),
            ("nonexistent", "Edge case: no matches"),
            ("completely different", "Edge case: exact match"),
        ]

        for substring, test_description in test_cases:
            expected_indices = get_expected_indices(substring)
            async with db() as session:
                stmt = select(models.Project).where(
                    models.CaseInsensitiveContains(models.Project.description, substring)
                )
                results = (await session.scalars(stmt)).all()
                actual_ids = {project.id for project in results}
                expected_ids = {_case_insensitive_data[i].id for i in expected_indices}

                assert actual_ids == expected_ids, f"{test_description} failed for '{substring}'"


class TestJsonSanitization:
    """Validate cross-dialect JSON sanitization for NaN/Inf values.

    This suite ensures that float("nan"), float("inf"), and float("-inf") are
    normalized to JSON null when persisted across all JsonDict/JsonList columns:
    - Span attributes and events[*].attributes
    - Annotation, Dataset, DatasetVersion, and Experiment metadata_ fields

    Tests verify behavior using both raw SQL reads (to observe actual DB storage)
    and ORM reads (to validate application-level sanitization), exercising both
    SQLite and PostgreSQL dialect paths.
    """

    async def test_json_sanitization(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Test comprehensive NaN/Inf sanitization across all JSON columns.

        This test validates that NaN/Inf values are properly sanitized to null when:
        1. Writing through ORM (JsonDict/JsonList type adapters sanitize on bind)
        2. Reading through ORM (type adapters sanitize on read for any remaining values)
        3. For SQLite: raw JSON TEXT storage allows NaN/Inf, but ORM reads still sanitize

        Test Structure:
        - Section 1: Spans with NaN/Inf in attributes and events → verify sanitization
        - Section 2: Annotations/Datasets with NaN/Inf in metadata_ → verify sanitization
        - For each section: verify both raw SQL reads and ORM reads show sanitized values
        - SQLite edge case: force raw NaN/Inf into DB, confirm ORM still sanitizes on read

        Covers JsonDict/JsonList columns: span attributes/events + all metadata_ fields.
        """
        # Comprehensive payload matrix covering:
        # - Top-level NaN/Inf and -Inf
        # - Mixed arrays with nested objects and lists containing NaN/Inf
        # - Deeply nested structures under multiple sibling keys
        # - Preservation of None, booleans, and strings
        attrs = {
            "a": float("nan"),
            "b": [1, float("nan"), {"c": float("nan"), "ci": float("inf")}, [float("-inf")]],
            "d": {"e": float("nan"), "f": [float("nan"), {"g": float("nan"), "gi": float("inf")}]},
            "h": None,
            "i": True,
            "j": "NaN",
            "k": float("inf"),
            "l": float("-inf"),
            "x": {
                "y": [
                    float("nan"),
                    {"z": float("nan"), "zi": float("inf")},
                    [float("inf"), float("-inf"), float("nan")],
                ]
            },
        }
        sanitized = {
            "a": None,
            "b": [1, None, {"c": None, "ci": None}, [None]],
            "d": {"e": None, "f": [None, {"g": None, "gi": None}]},
            "h": None,
            "i": True,
            "j": "NaN",
            "k": None,
            "l": None,
            "x": {"y": [None, {"z": None, "zi": None}, [None, None, None]]},
        }
        EVENT_NAME = "Guten Tag!"
        EVENT_TS = "2022-04-29T18:52:58.114561Z"
        event = {"name": EVENT_NAME, "timestamp": EVENT_TS, "attributes": attrs}
        no_nan_event = {**event, "attributes": sanitized}

        # === SECTION 1: Test Span attributes and events ===
        # Insert spans with NaN/Inf payload, verify sanitization in both raw SQL and ORM reads
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)
            await session.flush()

            start_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
            end_time = datetime.fromisoformat("2021-01-01T00:00:30.000+00:00")

            trace = models.Trace(
                project_rowid=project.id,
                trace_id=token_hex(8),
                start_time=start_time,
                end_time=end_time,
            )
            session.add(trace)
            await session.flush()

            span = models.Span(
                trace_rowid=trace.id,
                span_id=token_hex(8),
                name=token_hex(8),
                span_kind="LLM",
                start_time=start_time,
                end_time=end_time,
                attributes=attrs,
                events=[event],  # first span
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)

            # Insert a second span with the same payload shape
            await session.execute(
                sa.insert(models.Span).values(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=None,
                    name=token_hex(8),
                    span_kind="LLM",
                    start_time=start_time,
                    end_time=end_time,
                    attributes=attrs,
                    events=[event],  # second span
                    status_code="OK",
                    status_message="okay",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )

        attributes_stmt = sa.text("SELECT attributes FROM spans")
        events_stmt = sa.text("SELECT events FROM spans")

        # VERIFICATION: Raw SQL reads after ORM writes (should show sanitized values)
        # Two spans inserted; we expect identical sanitized payloads for both rows, so order is irrelevant.
        async with db() as session:
            attributes_rows = (await session.scalars(attributes_stmt)).all()
            attributes_rows = _decode_if_sqlite(attributes_rows, db.dialect)
            assert attributes_rows == [sanitized, sanitized]

            events_rows = (await session.scalars(events_stmt)).all()
            events_rows = _decode_if_sqlite(events_rows, db.dialect)
            assert events_rows == [[no_nan_event], [no_nan_event]]

        # SQLite note:
        # - SQLite will happily persist NaN/Inf/-Inf inside JSON TEXT columns.
        # - Our ORM layer/type adapters are responsible for sanitizing these to null on read.
        #   PostgreSQL JSONB rejects NaN/Inf literals, so the raw reinsert step only applies
        #   to SQLite. The block below writes raw JSON strings with NaN/Inf directly via SQL
        #   (updating both rows) and verifies that reading back through ORM still returns
        #   sanitized payloads.
        if db.dialect is SupportedSQLDialect.SQLITE:
            async with db() as session:
                await session.execute(
                    sa.text("UPDATE spans SET attributes = :attrs").bindparams(
                        attrs=json.dumps(attrs)
                    )
                )
                await session.execute(
                    sa.text("UPDATE spans SET events = :events").bindparams(
                        events=json.dumps([event])
                    )
                )

            # Verify raw storage: SQLite should now contain unsanitized NaN/Inf values
            # (We use DeepDiff because NaN != NaN in direct equality comparisons)
            async with db() as session:
                attributes_rows = (await session.scalars(attributes_stmt)).all()
                attributes_rows = _decode_if_sqlite(attributes_rows, db.dialect)
                assert not DeepDiff(attributes_rows, [attrs, attrs], ignore_nan_inequality=True)

                events_rows = (await session.scalars(events_stmt)).all()
                events_rows = _decode_if_sqlite(events_rows, db.dialect)
                assert not DeepDiff(events_rows, [[event], [event]], ignore_nan_inequality=True)

            # Even with raw NaN/Inf in DB, ORM reads should still return sanitized values
            async with db() as session:
                attributes_rows = (await session.scalars(select(models.Span.attributes))).all()
                assert attributes_rows == [sanitized, sanitized]

                events_rows = (await session.scalars(select(models.Span.events))).all()
                assert events_rows == [[no_nan_event], [no_nan_event]]

        # === SECTION 2: Test metadata_ fields across all entities ===
        # Create annotations/datasets with NaN/Inf in metadata_, verify sanitization
        # Note: Reusing existing span/trace from Section 1 for annotations
        async with db() as session:
            # JsonDict-backed metadata_ columns
            session.add(
                models.SpanAnnotation(
                    span_rowid=span.id,
                    name="qa",
                    annotator_kind="HUMAN",
                    source="APP",
                    metadata_=attrs,
                )
            )
            session.add(
                models.TraceAnnotation(
                    trace_rowid=trace.id,
                    name="qa",
                    annotator_kind="HUMAN",
                    source="APP",
                    metadata_=attrs,
                )
            )
            session.add(
                models.DocumentAnnotation(
                    span_rowid=span.id,
                    document_position=0,
                    name="doc",
                    annotator_kind="CODE",
                    source="APP",
                    metadata_=attrs,
                )
            )

            dataset = models.Dataset(name=f"ds_{token_hex(6)}", metadata_=attrs)
            session.add(dataset)
            await session.flush()

            version = models.DatasetVersion(
                dataset_id=dataset.id, description=None, metadata_=attrs
            )
            session.add(version)
            await session.flush()

            session.add(
                models.Experiment(
                    dataset_id=dataset.id,
                    dataset_version_id=version.id,
                    name=f"exp_{token_hex(6)}",
                    repetitions=1,
                    metadata_=attrs,
                )
            )

        # VERIFICATION: Raw SQL reads for metadata fields (should show sanitized values)
        async with db() as session:
            stmts = [
                sa.text("SELECT metadata FROM span_annotations"),
                sa.text("SELECT metadata FROM trace_annotations"),
                sa.text("SELECT metadata FROM document_annotations"),
                sa.text("SELECT metadata FROM datasets"),
                sa.text("SELECT metadata FROM dataset_versions"),
                sa.text("SELECT metadata FROM experiments"),
            ]
            rows_by_table: list[list[Any]] = []
            for stmt in stmts:
                rows = (await session.scalars(stmt)).all()
                rows = _decode_if_sqlite(rows, db.dialect)
                rows_by_table.append(rows)

            assert rows_by_table[0] == [sanitized]  # span_annotations
            assert rows_by_table[1] == [sanitized]  # trace_annotations
            assert rows_by_table[2] == [sanitized]  # document_annotations
            assert rows_by_table[3] == [sanitized]  # datasets
            assert rows_by_table[4] == [sanitized]  # dataset_versions
            assert rows_by_table[5] == [sanitized]  # experiments

        # SQLite-only: reinsert raw JSON TEXT with NaN/Inf into metadata columns to
        # verify that ORM reads still sanitize to None on read.
        if db.dialect is SupportedSQLDialect.SQLITE:
            async with db() as session:
                await session.execute(
                    sa.text("UPDATE span_annotations SET metadata = :m").bindparams(
                        m=json.dumps(attrs)
                    )
                )
                await session.execute(
                    sa.text("UPDATE trace_annotations SET metadata = :m").bindparams(
                        m=json.dumps(attrs)
                    )
                )
                await session.execute(
                    sa.text("UPDATE document_annotations SET metadata = :m").bindparams(
                        m=json.dumps(attrs)
                    )
                )
                await session.execute(
                    sa.text("UPDATE datasets SET metadata = :m").bindparams(m=json.dumps(attrs))
                )
                await session.execute(
                    sa.text("UPDATE dataset_versions SET metadata = :m").bindparams(
                        m=json.dumps(attrs)
                    )
                )
                await session.execute(
                    sa.text("UPDATE experiments SET metadata = :m").bindparams(m=json.dumps(attrs))
                )

            # Raw SQL read (verification): allow NaN inequality in comparisons
            async with db() as session:
                rows = (
                    await session.scalars(sa.text("SELECT metadata FROM span_annotations"))
                ).all()
                rows = _decode_if_sqlite(rows, db.dialect)
                assert not DeepDiff(rows, [attrs], ignore_nan_inequality=True)

                rows = (
                    await session.scalars(sa.text("SELECT metadata FROM trace_annotations"))
                ).all()
                rows = _decode_if_sqlite(rows, db.dialect)
                assert not DeepDiff(rows, [attrs], ignore_nan_inequality=True)

                rows = (
                    await session.scalars(sa.text("SELECT metadata FROM document_annotations"))
                ).all()
                rows = _decode_if_sqlite(rows, db.dialect)
                assert not DeepDiff(rows, [attrs], ignore_nan_inequality=True)

                rows = (await session.scalars(sa.text("SELECT metadata FROM datasets"))).all()
                rows = _decode_if_sqlite(rows, db.dialect)
                assert not DeepDiff(rows, [attrs], ignore_nan_inequality=True)

                rows = (
                    await session.scalars(sa.text("SELECT metadata FROM dataset_versions"))
                ).all()
                rows = _decode_if_sqlite(rows, db.dialect)
                assert not DeepDiff(rows, [attrs], ignore_nan_inequality=True)

                rows = (await session.scalars(sa.text("SELECT metadata FROM experiments"))).all()
                rows = _decode_if_sqlite(rows, db.dialect)
                assert not DeepDiff(rows, [attrs], ignore_nan_inequality=True)

            # Even with raw NaN/Inf in metadata DB storage, ORM reads should return sanitized values
            async with db() as session:
                assert (await session.scalars(select(models.SpanAnnotation.metadata_))).all() == [
                    sanitized
                ]
                assert (await session.scalars(select(models.TraceAnnotation.metadata_))).all() == [
                    sanitized
                ]
                assert (
                    await session.scalars(select(models.DocumentAnnotation.metadata_))
                ).all() == [sanitized]
                assert (await session.scalars(select(models.Dataset.metadata_))).all() == [
                    sanitized
                ]
                assert (await session.scalars(select(models.DatasetVersion.metadata_))).all() == [
                    sanitized
                ]
                assert (await session.scalars(select(models.Experiment.metadata_))).all() == [
                    sanitized
                ]


def _decode_if_sqlite(values: Sequence[Any], dialect: SupportedSQLDialect) -> list[Any]:
    """Ensure consistent JSON decoding across dialects.

    SQLite stores JSON as TEXT; raw SELECTs return strings that must be decoded.
    PostgreSQL returns native JSONB, which SQLAlchemy maps to Python objects.
    This helper is only needed when fetching via raw SQL (not ORM), since ORM
    queries on mapped columns already return Python objects across dialects.
    """
    return list(map(json.loads, values)) if dialect is SupportedSQLDialect.SQLITE else list(values)
