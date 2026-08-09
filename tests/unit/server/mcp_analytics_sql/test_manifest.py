import pytest

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


def test_manifest_is_policy_and_curation_only() -> None:
    manifest = manifest_document()
    tables = [table for area in manifest["areas"].values() for table in area["tables"].values()]
    assert tables
    assert all("columns" not in table and "hidden_columns" not in table for table in tables)
