import pytest

from phoenix.db.ddl import load_dialect_schema


def test_generated_assets_have_unique_marker_delimited_table_sections() -> None:
    for dialect in ("postgresql", "sqlite"):
        schema = load_dialect_schema(dialect)

        assert schema
        assert all(table.create_table_ddl.startswith("CREATE TABLE ") for table in schema.values())


def test_active_schema_contains_spans_physical_metadata() -> None:
    schema = load_dialect_schema("sqlite")

    assert schema["spans"].columns == (
        "id",
        "trace_rowid",
        "span_id",
        "parent_id",
        "name",
        "span_kind",
        "start_time",
        "end_time",
        "attributes",
        "events",
        "status_code",
        "status_message",
        "cumulative_error_count",
        "cumulative_llm_token_count_prompt",
        "cumulative_llm_token_count_completion",
        "llm_token_count_prompt",
        "llm_token_count_completion",
    )


def test_active_schema_normalizes_quoted_column_identifiers() -> None:
    schema = load_dialect_schema("sqlite")

    assert "key" in schema["builtin_evaluators"].columns


def test_table_ddl_excludes_following_indexes() -> None:
    table = load_dialect_schema("sqlite")["spans"]

    assert "CREATE INDEX" not in table.create_table_ddl


def test_cached_schema_mappings_are_immutable() -> None:
    schema = load_dialect_schema("sqlite")

    with pytest.raises(TypeError):
        schema["other"] = schema["spans"]  # type: ignore[index]
