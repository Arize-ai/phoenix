from phoenix.db.ddl import load_dialect_schema, load_physical_catalog


def test_generated_assets_have_unique_marker_delimited_table_sections() -> None:
    for dialect in ("postgresql", "sqlite"):
        schema = load_dialect_schema(dialect)

        assert len(schema.sections) == len(schema.order)
        assert set(schema.sections) == set(schema.order)
        assert all(
            section.create_table_ddl.startswith("CREATE TABLE ")
            for section in schema.sections.values()
        )


def test_physical_catalog_has_matching_postgresql_and_sqlite_columns() -> None:
    catalog = load_physical_catalog()

    assert len(catalog.tables) == 62
    assert [column.name for column in catalog.tables["spans"].columns] == [
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
    ]


def test_table_sections_separate_indexes_from_create_table_ddl() -> None:
    section = load_dialect_schema("sqlite").sections["spans"]

    assert "CREATE INDEX" not in section.create_table_ddl
    assert section.index_ddls
    assert all(index_ddl.startswith("CREATE INDEX ") for index_ddl in section.index_ddls)
