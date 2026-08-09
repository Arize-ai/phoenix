import pytest

from phoenix.db import models
from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist, manifest_document


def test_manifest_loads_sixteen_tables() -> None:
    allowlist = load_allowlist("sqlite")
    assert len(allowlist.tables) == 16


def test_allowlists_are_cached_per_dialect_and_immutable() -> None:
    sqlite = load_allowlist("sqlite")
    postgresql = load_allowlist("postgresql")

    assert sqlite is not postgresql
    with pytest.raises(TypeError):
        sqlite.table_specs["other"] = sqlite.table_specs["spans"]  # type: ignore[index]


def test_manifest_column_count_at_least_141() -> None:
    manifest = manifest_document()
    count = sum(
        len(table["columns"])
        for area in manifest["areas"].values()
        for table in area["tables"].values()
    )
    assert count >= 141


def test_manifest_matches_sqlalchemy_metadata() -> None:
    allowlist = load_allowlist("sqlite")
    for table_name in allowlist.tables:
        sa_table = models.Base.metadata.tables[table_name]
        manifest_cols = {col.name for col in allowlist.table_specs[table_name].columns}
        sa_cols = set()
        for col in sa_table.columns:
            sa_cols.add("metadata" if col.key == "metadata_" else col.key)
        assert manifest_cols == sa_cols, table_name
