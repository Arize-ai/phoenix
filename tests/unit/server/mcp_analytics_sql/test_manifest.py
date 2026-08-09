from dataclasses import FrozenInstanceError

import pytest

from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.manifest import (
    AnalyticsSqlManifest,
    Area,
    TableCuration,
    manifest,
)


def test_manifest_loads_sixteen_tables() -> None:
    allowlist = load_allowlist("sqlite")
    assert len(allowlist.tables) == 16


def test_allowlists_are_cached_per_dialect_and_immutable() -> None:
    sqlite = load_allowlist("sqlite")
    postgresql = load_allowlist("postgresql")

    assert sqlite is not postgresql
    with pytest.raises(TypeError):
        sqlite.table_specs["other"] = sqlite.table_specs["spans"]  # type: ignore[index]


def test_manifest_is_immutable_policy_and_curation_only() -> None:
    tables = [table for area in manifest().areas.values() for table in area.tables.values()]
    assert tables
    with pytest.raises(FrozenInstanceError):
        tables[0].grain = "other"  # type: ignore[misc]


def test_manifest_records_defensively_copy_mutable_inputs() -> None:
    notes = {"id": "external id"}
    tables = {
        "widgets": TableCuration(
            column_notes=notes,
            virtual_columns={"derived"},  # type: ignore[arg-type]
        )
    }
    areas = {"test": Area(tables=tables)}
    document = AnalyticsSqlManifest(areas=areas)

    notes["id"] = "changed"
    tables["other"] = TableCuration()
    areas["other"] = Area(tables={})

    assert document.areas["test"].tables["widgets"].column_notes["id"] == "external id"
    assert document.areas["test"].tables["widgets"].virtual_columns == {"derived"}
    with pytest.raises(TypeError):
        document.areas["test"].tables["widgets"].column_notes["id"] = "changed"  # type: ignore[index]
