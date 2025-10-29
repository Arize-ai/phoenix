import json
from datetime import datetime
from secrets import token_hex
from typing import Any, AsyncIterator, Sequence

import pytest
import sqlalchemy as sa
from deepdiff.diff import DeepDiff
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
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


class TestJsonSerialization:
    """Comprehensive validation of orjson serialization behavior across all JSON columns.

    This suite ensures proper handling of all serialization scenarios across all
    JsonDict/JsonList columns:
    - Span attributes and events[*].attributes
    - Annotation, Dataset, DatasetVersion, and Experiment metadata_ fields

    Tests cover:
    1. Special object conversion via _default function:
       - numpy arrays → lists, numpy scalars → Python scalars
       - Enum objects → their .value
       - datetime objects → ISO strings (orjson native handling)
    2. NaN/Inf sanitization:
       - float("nan"), float("inf"), float("-inf") → null
       - Cross-dialect compatibility (SQLite vs PostgreSQL)

    All conversions work correctly when persisted and read back through both
    raw SQL and ORM operations.
    """

    async def test_comprehensive_orjson_serialization(
        self,
        db: DbSessionFactory,
    ) -> None:
        """Test comprehensive orjson serialization of all special object types across JSON columns.

        This single comprehensive test validates all serialization scenarios:
        1. Special objects via _default function (numpy, datetime, enum)
        2. NaN/Inf sanitization to null values
        3. Cross-dialect compatibility (SQLite vs PostgreSQL)
        4. Both raw SQL reads and ORM reads show correct conversions

        Covers all JsonDict/JsonList columns: span attributes/events + all metadata_ fields.
        More efficient than separate tests since all scenarios use the same serialization pipeline.
        """
        from datetime import timezone
        from enum import Enum

        import numpy as np

        # Define test enums
        class Status(Enum):
            PENDING = "pending"
            ACTIVE = "active"
            INACTIVE = "inactive"

        class Priority(Enum):
            LOW = 1
            MEDIUM = 2
            HIGH = 3

        # Single comprehensive payload testing ALL serialization scenarios:
        # 1. Numpy arrays/scalars (including edge case dtypes) 2. Datetime objects 3. Enum objects 4. NaN/Inf values
        test_datetime = datetime(2023, 12, 25, 10, 30, 45, 123456, timezone.utc)
        comprehensive_attrs = {
            # Numpy arrays and scalars (consolidated edge case dtypes)
            "numpy_array_1d": np.array([1, 2, 3, 4]),
            "numpy_array_2d": np.array([[1, 2], [3, 4]]),
            "numpy_array_empty": np.array([]),
            "numpy_scalar_int": np.int64(42),
            "numpy_scalar_float": np.float64(3.14159),
            "numpy_scalar_bool": np.bool_(True),
            # Edge case numpy dtypes (consolidated from test_numpy_edge_cases)
            "numpy_dtypes": {
                "int8": np.int8(127),
                "int32": np.int32(2147483647),
                "uint16": np.uint16(65535),
                "float16": np.float16(3.14),
                "float32": np.float32(2.718),
                "bool_array": np.array([True, False]),
                "mixed_array": np.array([1, 2.5, 3]),  # Will be converted to float array
            },
            # Datetime and enum objects
            "status_enum": Status.ACTIVE,
            "priority_enum": Priority.HIGH,
            "timestamp_dt": test_datetime,
            # NaN/Inf values (consolidated comprehensive coverage from test_json_sanitization)
            "nan_value": float("nan"),
            "inf_value": float("inf"),
            "neg_inf_value": float("-inf"),
            # Complex nested structures combining ALL types
            "complex_nested": {
                "numpy_arrays": [np.array([5, 6]), {"nested_array": np.array([[7, 8], [9, 10]])}],
                "enums_datetimes": [Status.PENDING, test_datetime, Priority.LOW],
                "nan_inf_mixed": [1, float("nan"), {"inf_nested": float("inf")}, [float("-inf")]],
                "regular_python": {"normal": [1, 2, 3], "string": "test", "bool": False},
                # Deep NaN/Inf nesting (consolidated edge cases)
                "deep_nan_structure": {
                    "level1": [float("nan"), {"level2": [float("inf"), float("-inf")]}],
                    "mixed_arrays": [1, None, float("nan"), "NaN_string", True],
                },
            },
            # Edge cases
            "mixed_types_array": [
                np.int32(100),
                Status.INACTIVE,
                test_datetime,
                float("nan"),
                np.array([20, 30]),
                {"enum_key": Priority.MEDIUM, "nan_key": float("inf")},
            ],
        }

        # Expected converted values after all serialization transformations
        expected_converted = {
            # Numpy → Python native types
            "numpy_array_1d": [1, 2, 3, 4],
            "numpy_array_2d": [[1, 2], [3, 4]],
            "numpy_array_empty": [],
            "numpy_scalar_int": 42,
            "numpy_scalar_float": 3.14159,
            "numpy_scalar_bool": True,
            # Edge case dtypes → Python native types
            "numpy_dtypes": {
                "int8": 127,
                "int32": 2147483647,
                "uint16": 65535,
                "float16": float(np.float16(3.14)),
                "float32": float(np.float32(2.718)),
                "bool_array": [True, False],
                "mixed_array": [1.0, 2.5, 3.0],
            },
            # Datetime → ISO string, Enum → .value
            "status_enum": "active",
            "priority_enum": 3,
            "timestamp_dt": test_datetime.isoformat(),
            # NaN/Inf → null
            "nan_value": None,
            "inf_value": None,
            "neg_inf_value": None,
            # Complex nested with all conversions applied
            "complex_nested": {
                "numpy_arrays": [[5, 6], {"nested_array": [[7, 8], [9, 10]]}],
                "enums_datetimes": ["pending", test_datetime.isoformat(), 1],
                "nan_inf_mixed": [1, None, {"inf_nested": None}, [None]],
                "regular_python": {"normal": [1, 2, 3], "string": "test", "bool": False},
                # Deep NaN/Inf → null conversions
                "deep_nan_structure": {
                    "level1": [None, {"level2": [None, None]}],
                    "mixed_arrays": [1, None, None, "NaN_string", True],
                },
            },
            # Mixed edge cases with all conversions
            "mixed_types_array": [
                100,
                "inactive",
                test_datetime.isoformat(),
                None,
                [20, 30],
                {"enum_key": 2, "nan_key": None},
            ],
        }

        EVENT_NAME = "Comprehensive Serialization Test"
        EVENT_TS = "2022-04-29T18:52:58.114561Z"
        test_event = {"name": EVENT_NAME, "timestamp": EVENT_TS, "attributes": comprehensive_attrs}
        expected_event = {**test_event, "attributes": expected_converted}

        # === SINGLE EFFICIENT DATABASE SETUP ===
        # Create all entities once and test all serialization scenarios together
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
                name="comprehensive_serialization_test",
                span_kind="LLM",
                start_time=start_time,
                end_time=end_time,
                attributes=comprehensive_attrs,
                events=[test_event],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            await session.flush()  # Flush span to get its ID

            # Create all metadata entities with the comprehensive payload
            session.add(
                models.SpanAnnotation(
                    span_rowid=span.id,
                    name="comprehensive_test",
                    annotator_kind="HUMAN",
                    source="APP",
                    metadata_=comprehensive_attrs,
                )
            )
            session.add(
                models.TraceAnnotation(
                    trace_rowid=trace.id,
                    name="comprehensive_test",
                    annotator_kind="HUMAN",
                    source="APP",
                    metadata_=comprehensive_attrs,
                )
            )
            session.add(
                models.DocumentAnnotation(
                    span_rowid=span.id,
                    document_position=0,
                    name="comprehensive_test",
                    annotator_kind="CODE",
                    source="APP",
                    metadata_=comprehensive_attrs,
                )
            )

            dataset = models.Dataset(
                name=f"comprehensive_ds_{token_hex(6)}", metadata_=comprehensive_attrs
            )
            session.add(dataset)
            await session.flush()

            version = models.DatasetVersion(
                dataset_id=dataset.id, description=None, metadata_=comprehensive_attrs
            )
            session.add(version)
            await session.flush()

            session.add(
                models.Experiment(
                    dataset_id=dataset.id,
                    dataset_version_id=version.id,
                    name=f"comprehensive_exp_{token_hex(6)}",
                    repetitions=1,
                    metadata_=comprehensive_attrs,
                )
            )

        # === COMPREHENSIVE VERIFICATION ===
        # Test all JSON columns with single set of queries (more efficient than separate tests)

        # Raw SQL verification
        async with db() as session:
            # Verify span attributes & events
            attributes_result = (
                await session.scalars(sa.text("SELECT attributes FROM spans"))
            ).first()
            attributes_result = _decode_if_sqlite([attributes_result], db.dialect)[0]
            assert attributes_result == expected_converted

            events_result = (await session.scalars(sa.text("SELECT events FROM spans"))).first()
            events_result = _decode_if_sqlite([events_result], db.dialect)[0]
            assert events_result == [expected_event]

            # Verify all metadata fields
            metadata_tables = [
                "span_annotations",
                "trace_annotations",
                "document_annotations",
                "datasets",
                "dataset_versions",
                "experiments",
            ]
            for table in metadata_tables:
                result = (await session.scalars(sa.text(f"SELECT metadata FROM {table}"))).first()
                result = _decode_if_sqlite([result], db.dialect)[0]
                assert result == expected_converted, f"Failed for table: {table}"

        # ORM verification (ensures type adapters work correctly)
        async with db() as session:
            # Span attributes & events
            assert (
                await session.scalars(select(models.Span.attributes))
            ).first() == expected_converted
            assert (await session.scalars(select(models.Span.events))).first() == [expected_event]

            # All metadata fields
            assert (
                await session.scalars(select(models.SpanAnnotation.metadata_))
            ).first() == expected_converted
            assert (
                await session.scalars(select(models.TraceAnnotation.metadata_))
            ).first() == expected_converted
            assert (
                await session.scalars(select(models.DocumentAnnotation.metadata_))
            ).first() == expected_converted
            assert (
                await session.scalars(select(models.Dataset.metadata_))
            ).first() == expected_converted
            assert (
                await session.scalars(select(models.DatasetVersion.metadata_))
            ).first() == expected_converted
            assert (
                await session.scalars(select(models.Experiment.metadata_))
            ).first() == expected_converted

        # === COMPREHENSIVE SQLite NaN/Inf EDGE CASE TESTING ===
        # SQLite allows raw NaN/Inf in JSON TEXT storage, but ORM should sanitize on read
        # This tests the critical edge case where raw NaN/Inf bypasses our type adapters
        if db.dialect is SupportedSQLDialect.SQLITE:
            # Create NaN/Inf-only payload for raw JSON insertion (json.dumps can handle NaN/Inf)
            raw_attrs_with_nan = {
                "a": float("nan"),
                "b": [1, float("nan"), {"c": float("nan"), "ci": float("inf")}, [float("-inf")]],
                "d": {
                    "e": float("nan"),
                    "f": [float("nan"), {"g": float("nan"), "gi": float("inf")}],
                },
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
            # Expected sanitized version
            sanitized_nan_attrs = {
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
            # Simple NaN/Inf event for edge case testing
            raw_event_with_nan = {
                "name": "NaN Test Event",
                "timestamp": EVENT_TS,
                "attributes": raw_attrs_with_nan,
            }
            sanitized_event = {**raw_event_with_nan, "attributes": sanitized_nan_attrs}

            # Force raw NaN/Inf JSON directly into database (bypassing type adapters)
            async with db() as session:
                # Update all JSON columns with raw NaN/Inf values
                await session.execute(
                    sa.text("UPDATE spans SET attributes = :attrs").bindparams(
                        attrs=json.dumps(raw_attrs_with_nan)
                    )
                )
                await session.execute(
                    sa.text("UPDATE spans SET events = :events").bindparams(
                        events=json.dumps([raw_event_with_nan])
                    )
                )
                # Update all metadata tables
                await session.execute(
                    sa.text("UPDATE span_annotations SET metadata = :m").bindparams(
                        m=json.dumps(raw_attrs_with_nan)
                    )
                )
                await session.execute(
                    sa.text("UPDATE trace_annotations SET metadata = :m").bindparams(
                        m=json.dumps(raw_attrs_with_nan)
                    )
                )
                await session.execute(
                    sa.text("UPDATE document_annotations SET metadata = :m").bindparams(
                        m=json.dumps(raw_attrs_with_nan)
                    )
                )
                await session.execute(
                    sa.text("UPDATE datasets SET metadata = :m").bindparams(
                        m=json.dumps(raw_attrs_with_nan)
                    )
                )
                await session.execute(
                    sa.text("UPDATE dataset_versions SET metadata = :m").bindparams(
                        m=json.dumps(raw_attrs_with_nan)
                    )
                )
                await session.execute(
                    sa.text("UPDATE experiments SET metadata = :m").bindparams(
                        m=json.dumps(raw_attrs_with_nan)
                    )
                )

            # Verify raw storage: SQLite should contain unsanitized NaN/Inf values
            # Use DeepDiff because NaN != NaN in direct equality comparisons
            async with db() as session:
                # Check span attributes
                raw_attrs_result = (
                    await session.scalars(sa.text("SELECT attributes FROM spans"))
                ).first()
                raw_attrs_result = _decode_if_sqlite([raw_attrs_result], db.dialect)[0]
                assert not DeepDiff(
                    [raw_attrs_result], [raw_attrs_with_nan], ignore_nan_inequality=True
                )

                # Check span events
                raw_events_result = (
                    await session.scalars(sa.text("SELECT events FROM spans"))
                ).first()
                raw_events_result = _decode_if_sqlite([raw_events_result], db.dialect)[0]
                assert not DeepDiff(
                    [raw_events_result], [[raw_event_with_nan]], ignore_nan_inequality=True
                )

                # Check all metadata tables have raw NaN/Inf
                metadata_tables = [
                    "span_annotations",
                    "trace_annotations",
                    "document_annotations",
                    "datasets",
                    "dataset_versions",
                    "experiments",
                ]
                for table in metadata_tables:
                    raw_metadata = (
                        await session.scalars(sa.text(f"SELECT metadata FROM {table}"))
                    ).first()
                    raw_metadata = _decode_if_sqlite([raw_metadata], db.dialect)[0]
                    assert not DeepDiff(
                        [raw_metadata], [raw_attrs_with_nan], ignore_nan_inequality=True
                    )

            # CRITICAL TEST: Even with raw NaN/Inf in DB storage, ORM reads must return sanitized values
            async with db() as session:
                # Span attributes & events should be sanitized by ORM
                assert (
                    await session.scalars(select(models.Span.attributes))
                ).first() == sanitized_nan_attrs
                assert (await session.scalars(select(models.Span.events))).first() == [
                    sanitized_event
                ]

                # All metadata fields should be sanitized by ORM
                assert (
                    await session.scalars(select(models.SpanAnnotation.metadata_))
                ).first() == sanitized_nan_attrs
                assert (
                    await session.scalars(select(models.TraceAnnotation.metadata_))
                ).first() == sanitized_nan_attrs
                assert (
                    await session.scalars(select(models.DocumentAnnotation.metadata_))
                ).first() == sanitized_nan_attrs
                assert (
                    await session.scalars(select(models.Dataset.metadata_))
                ).first() == sanitized_nan_attrs
                assert (
                    await session.scalars(select(models.DatasetVersion.metadata_))
                ).first() == sanitized_nan_attrs
                assert (
                    await session.scalars(select(models.Experiment.metadata_))
                ).first() == sanitized_nan_attrs


def _decode_if_sqlite(values: Sequence[Any], dialect: SupportedSQLDialect) -> list[Any]:
    """Ensure consistent JSON decoding across dialects.

    SQLite stores JSON as TEXT; raw SELECTs return strings that must be decoded.
    PostgreSQL returns native JSONB, which SQLAlchemy maps to Python objects.
    This helper is only needed when fetching via raw SQL (not ORM), since ORM
    queries on mapped columns already return Python objects across dialects.
    """
    return list(map(json.loads, values)) if dialect is SupportedSQLDialect.SQLITE else list(values)


class TestEvaluatorPolymorphism:
    """Test polymorphic evaluator models with dataset relationships.

    Validates table inheritance, relationships, and dataset associations.
    """

    @pytest.fixture
    async def _evaluator_setup(
        self, db: DbSessionFactory
    ) -> AsyncIterator[
        tuple[
            models.Dataset,
            models.LLMEvaluator,
            models.LLMEvaluator,
            models.Prompt,
            models.PromptVersionTag,
            models.Prompt,
            models.PromptVersionTag,
        ]
    ]:
        """Create evaluators with dataset relationships and return (dataset_id, eval_id)."""
        async with db() as session:
            dataset = models.Dataset(name=f"test-dataset-{token_hex(6)}", metadata_={})
            prompt = models.Prompt(
                name=Identifier(root=f"test-prompt-{token_hex(4)}"),
                description="Test prompt",
                metadata_={},
            )
            session.add_all([dataset, prompt])
            await session.flush()

            prompt_version = models.PromptVersion(
                prompt_id=prompt.id,
                template_type=PromptTemplateType.STRING,
                template_format=PromptTemplateFormat.F_STRING,
                template=PromptStringTemplate(type="string", template="Evaluate: {input}"),
                invocation_parameters=PromptOpenAIInvocationParameters(
                    type="openai", openai=PromptOpenAIInvocationParametersContent()
                ),
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-4",
                metadata_={},
            )
            session.add(prompt_version)
            await session.flush()

            prompt_tag = models.PromptVersionTag(
                name=Identifier(root=f"v1-{token_hex(4)}"),
                prompt_id=prompt.id,
                prompt_version_id=prompt_version.id,
            )
            session.add(prompt_tag)
            await session.flush()

            eval_1 = models.LLMEvaluator(
                name=Identifier(root=f"eval-1-{token_hex(4)}"),
                description="First evaluator",
                kind="LLM",
                output_config={},
                prompt_id=prompt.id,
                prompt_version_tag_id=prompt_tag.id,
            )
            eval_2 = models.LLMEvaluator(
                name=Identifier(root=f"eval-2-{token_hex(4)}"),
                description="Second evaluator",
                kind="LLM",
                output_config={},
                prompt_id=prompt.id,
                prompt_version_tag_id=prompt_tag.id,
            )
            session.add_all([eval_1, eval_2])
            await session.flush()

            session.add_all(
                [
                    models.DatasetsEvaluators(
                        dataset_id=dataset.id,
                        evaluator_id=eval_1.id,
                        input_config={},
                    ),
                    models.DatasetsEvaluators(
                        dataset_id=dataset.id,
                        evaluator_id=eval_2.id,
                        input_config={},
                    ),
                ]
            )

            # Create a second prompt for testing relationship updates
            new_prompt = models.Prompt(
                name=Identifier(root=f"updated-prompt-{token_hex(4)}"),
                description="Updated prompt",
                metadata_={},
            )
            session.add(new_prompt)
            await session.flush()

            new_prompt_version = models.PromptVersion(
                prompt_id=new_prompt.id,
                template_type=PromptTemplateType.STRING,
                template_format=PromptTemplateFormat.F_STRING,
                template=PromptStringTemplate(type="string", template="Updated: {input}"),
                invocation_parameters=PromptOpenAIInvocationParameters(
                    type="openai", openai=PromptOpenAIInvocationParametersContent()
                ),
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-4",
                metadata_={},
            )
            session.add(new_prompt_version)
            await session.flush()

            new_prompt_tag = models.PromptVersionTag(
                name=Identifier(root=f"v2-{token_hex(4)}"),
                prompt_id=new_prompt.id,
                prompt_version_id=new_prompt_version.id,
            )
            session.add(new_prompt_tag)
            await session.flush()

        yield dataset, eval_1, eval_2, prompt, prompt_tag, new_prompt, new_prompt_tag

    async def test_llm_evaluator_polymorphism_and_dataset_relationships(
        self,
        db: DbSessionFactory,
        _evaluator_setup: tuple[
            models.Dataset,
            models.LLMEvaluator,
            models.LLMEvaluator,
            models.Prompt,
            models.PromptVersionTag,
            models.Prompt,
            models.PromptVersionTag,
        ],
    ) -> None:
        """Test LLM evaluator polymorphism, dataset relationships, and CRUD operations."""
        dataset, eval_1, eval_2, prompt, prompt_tag, new_prompt, new_prompt_tag = _evaluator_setup
        dataset_id = dataset.id
        eval_id = eval_1.id
        eval_1_name = eval_1.name
        eval_2_name = eval_2.name
        prompt_name = prompt.name
        prompt_tag_name = prompt_tag.name

        # ===== READ: Verify polymorphism and relationships =====
        async with db() as session:
            # Base class query returns subclass instances
            evaluators = (await session.scalars(select(models.Evaluator))).all()
            assert len(evaluators) == 2
            assert all(isinstance(e, models.LLMEvaluator) and e.kind == "LLM" for e in evaluators)

            # Subclass query with eager-loaded relationships
            evaluator = await session.scalar(
                select(models.LLMEvaluator)
                .where(models.LLMEvaluator.id == eval_id)
                .options(
                    selectinload(models.LLMEvaluator.prompt),
                    selectinload(models.LLMEvaluator.prompt_version_tag),
                )
            )
            assert evaluator is not None
            assert evaluator.name == eval_1_name
            assert evaluator.prompt.name == prompt_name
            assert evaluator.prompt_version_tag is not None
            assert evaluator.prompt_version_tag.name == prompt_tag_name

        async with db() as session:
            # Table-level integrity (discriminator column and composite FK)
            assert (
                await session.scalar(
                    sa.text("SELECT kind FROM evaluators WHERE id = :id").bindparams(id=eval_id)
                )
            ) == "LLM"
            assert (
                await session.scalar(
                    sa.text("SELECT id FROM llm_evaluators WHERE id = :id").bindparams(id=eval_id)
                )
            ) == eval_id

        async with db() as session:
            # Dataset relationships (junction table)
            dataset_result = await session.get(
                models.Dataset,
                dataset_id,
                options=(selectinload(models.Dataset.datasets_evaluators),),
            )
            assert dataset_result is not None
            dataset = dataset_result
            assert len(dataset.datasets_evaluators) == 2

            # Verify evaluators via join query
            evaluators = (
                await session.scalars(
                    select(models.LLMEvaluator)
                    .join(models.DatasetsEvaluators)
                    .where(models.DatasetsEvaluators.dataset_id == dataset_id)
                )
            ).all()
            assert len(evaluators) == 2
            assert {e.name for e in evaluators} == {eval_1_name, eval_2_name}
            assert all(isinstance(e, models.LLMEvaluator) for e in evaluators)

        # ===== INSERT: Create a new evaluator =====
        async with db() as session:
            # Create new evaluator using existing prompt and tag IDs
            new_eval = models.LLMEvaluator(
                name=Identifier(root=f"eval-3-{token_hex(4)}"),
                description="Third evaluator",
                kind="LLM",
                output_config={},
                prompt_id=prompt.id,
                prompt_version_tag_id=prompt_tag.id,
            )
            session.add(new_eval)
            await session.flush()
            new_eval_id = new_eval.id
            new_eval_name = new_eval.name

            # Associate with dataset
            dataset_evaluator = models.DatasetsEvaluators(
                dataset_id=dataset_id,
                evaluator_id=new_eval_id,
                input_config={},
            )
            session.add(dataset_evaluator)

        # Verify insertion
        async with db() as session:
            evaluators = (await session.scalars(select(models.Evaluator))).all()
            assert len(evaluators) == 3
            new_evaluator = await session.get(models.LLMEvaluator, new_eval_id)
            assert new_evaluator is not None
            assert new_evaluator.name == new_eval_name

        # Verify dataset relationship
        async with db() as session:
            evaluators = (
                await session.scalars(
                    select(models.LLMEvaluator)
                    .join(models.DatasetsEvaluators)
                    .where(models.DatasetsEvaluators.dataset_id == dataset_id)
                )
            ).all()
            assert len(evaluators) == 3
            assert {e.name for e in evaluators} == {
                eval_1_name,
                eval_2_name,
                new_eval_name,
            }

        # ===== UPDATE: Change evaluator's prompt relationship =====
        async with db() as session:
            # Update evaluator to use the second prompt from fixture
            evaluator = await session.get(models.LLMEvaluator, eval_id)
            assert evaluator is not None
            evaluator.prompt_id = new_prompt.id
            evaluator.prompt_version_tag_id = new_prompt_tag.id
            await session.flush()

        # Verify update with eager-loaded relationships
        async with db() as session:
            evaluator = await session.scalar(
                select(models.LLMEvaluator)
                .where(models.LLMEvaluator.id == eval_id)
                .options(
                    selectinload(models.LLMEvaluator.prompt),
                    selectinload(models.LLMEvaluator.prompt_version_tag),
                )
            )
            assert evaluator is not None
            assert evaluator.prompt.name == new_prompt.name
            assert evaluator.prompt_version_tag is not None
            assert evaluator.prompt_version_tag.name == new_prompt_tag.name
            assert evaluator.prompt_id == new_prompt.id
            assert evaluator.prompt_version_tag_id == new_prompt_tag.id

        # ===== DELETE: Remove an evaluator =====
        async with db() as session:
            # Delete the newly created evaluator
            evaluator_to_delete = await session.get(models.LLMEvaluator, new_eval_id)
            assert evaluator_to_delete is not None
            await session.delete(evaluator_to_delete)

        # Verify deletion
        async with db() as session:
            evaluators = (await session.scalars(select(models.Evaluator))).all()
            assert len(evaluators) == 2

            deleted_evaluator = await session.get(models.LLMEvaluator, new_eval_id)
            assert deleted_evaluator is None

        # Verify dataset relationship updated (junction table entry should be deleted)
        async with db() as session:
            evaluators = (
                await session.scalars(
                    select(models.LLMEvaluator)
                    .join(models.DatasetsEvaluators)
                    .where(models.DatasetsEvaluators.dataset_id == dataset_id)
                )
            ).all()
            assert len(evaluators) == 2
            assert {e.name for e in evaluators} == {eval_1_name, eval_2_name}

        # ===== RESTRICT: Cannot delete prompt in use by evaluators =====
        # Attempt to delete prompt that is being used by eval_1
        with pytest.raises(Exception):
            async with db() as session:
                prompt_to_delete = await session.get(models.Prompt, new_prompt.id)
                assert prompt_to_delete is not None
                await session.delete(prompt_to_delete)
