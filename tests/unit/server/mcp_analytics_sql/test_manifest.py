from phoenix.db import models
from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist, manifest_document


def test_manifest_loads_sixteen_tables() -> None:
    allowlist = load_allowlist()
    assert len(allowlist.tables) == 16


def test_manifest_column_count_at_least_141() -> None:
    manifest = manifest_document()
    count = sum(
        len(table["columns"])
        for area in manifest["areas"].values()
        for table in area["tables"].values()
    )
    assert count >= 141


def test_manifest_matches_sqlalchemy_metadata() -> None:
    allowlist = load_allowlist()
    for table_name in allowlist.tables:
        sa_table = models.Base.metadata.tables[table_name]
        manifest_cols = {col.name for col in allowlist.table_specs[table_name].columns}
        sa_cols = set()
        for col in sa_table.columns:
            sa_cols.add("metadata" if col.key == "metadata_" else col.key)
        assert manifest_cols == sa_cols, table_name


def test_discovery_reports_join_paths() -> None:
    """A caller cannot join what nothing told them about.

    Almost every question worth asking here is a join, and `spans` carries no
    project reference of its own -- reaching a project always costs a hop through
    `traces`. Without that stated, an agent either invents a `project_rowid`
    column or gives up on the question.
    """
    from phoenix.server.mcp_analytics_sql.teaching import describe_sql_schema

    schema = describe_sql_schema(detail="detailed", tables=["spans"], dialect="sqlite")
    assert (
        "-- to area root: spans.trace_rowid = traces.id -> traces.project_rowid = projects.id"
        in schema
    )
    # Stated as the key rather than as a comment: the comments now carry only
    # the inbound edges, which no foreign key on this table can express.
    assert "FOREIGN KEY (trace_rowid) REFERENCES traces (id)" in schema


def test_join_hints_never_name_a_denied_table() -> None:
    """Advertising an edge into a denied table invites a refusal.

    `span_annotations.user_id` really does reference `users`, but this surface
    never exposes that table. Reporting the edge would offer a join that
    admission then rejects, which reads as an inconsistency rather than a policy.
    """
    from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist

    allowlist = load_allowlist()
    for spec in allowlist.table_specs.values():
        for hint in spec.joins + spec.path_to_root:
            named = {side.split(".")[0] for side in hint.split(" = ")}
            assert named <= allowlist.tables, f"{hint} references a table outside the allowlist"
