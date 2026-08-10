import re
import sqlite3
from typing import Literal, cast

import pytest
import sqlglot
from sqlglot import exp

from phoenix.db.ddl import load_dialect_schema
from phoenix.db.ddl.loader import TableSchema
from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.allowlist import Allowlist, TableSpec, load_allowlist
from phoenix.server.mcp_analytics_sql.ddl import DetailLevel, render_schema_ddl, validate_ddl
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.parse import admit, parse_sql, render
from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext, rewrite

# Named `backend` rather than `dialect` on purpose: the unit conftest skips any
# test with a `dialect` parameter set to "postgresql" when running against SQLite,
# on the assumption it needs that database. These render text and touch none.
DIALECTS: list[SupportedSQLDialectName] = ["sqlite", "postgresql"]
DETAILS: list[Literal["brief", "detailed", "full"]] = ["brief", "detailed", "full"]


@pytest.mark.parametrize("backend", DIALECTS)
def test_detailed_output_starts_with_the_raw_schema_asset(backend: SupportedSQLDialectName) -> None:
    """Physical definitions come from the active dialect asset without synthesis."""
    raw = load_dialect_schema(backend)["spans"].create_table_ddl
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)

    if backend == "postgresql":
        expected = re.sub(
            r"(\b(?:CREATE\s+TABLE|REFERENCES)\s+)public\.",
            r"\1",
            raw,
            flags=re.IGNORECASE | re.MULTILINE,
        )
        assert raw.startswith("CREATE TABLE public.spans")
        assert "REFERENCES public.traces" in raw
    else:
        expected = raw

    table_and_curation = ddl.split("\n", 1)[1]
    assert table_and_curation.startswith(expected)
    assert table_and_curation[len(expected) :].startswith("\n--")


def test_postgresql_unqualification_only_changes_table_syntax() -> None:
    """Comments and literals resembling qualified names are preserved."""
    from phoenix.server.mcp_analytics_sql.ddl import _unqualify_postgresql_ddl

    raw = """CREATE TABLE public.widgets (
    parent_id INTEGER REFERENCES public.parents (id),
    label VARCHAR DEFAULT 'public.literal'
);
-- public.comment
"""
    assert (
        _unqualify_postgresql_ddl(raw)
        == """CREATE TABLE widgets (
    parent_id INTEGER REFERENCES parents (id),
    label VARCHAR DEFAULT 'public.literal'
);
-- public.comment
"""
    )


@pytest.mark.parametrize("backend", DIALECTS)
@pytest.mark.parametrize("detail", DETAILS)
def test_every_rendering_parses(backend: str, detail: DetailLevel) -> None:
    """Generated DDL fails in ways handwritten DDL does not.

    Both defects this renderer actually shipped were invisible in the output: a
    trailing comment swallowed the comma after it, so two columns merged into
    one; and `brief` emitted ``CREATE TABLE spans (...)``, which reads like DDL
    but is not valid SQL in any backend. Neither is detectable by eye, and the
    caller cannot detect them at all -- it is prose to them.
    """
    validate_ddl(render_schema_ddl(detail=detail, dialect=backend), backend)


@pytest.mark.parametrize("backend", DIALECTS)
def test_a_trailing_comment_does_not_swallow_the_separator(backend: str) -> None:
    """The comma must precede the comment on a commented column.

    ``start_time TIMESTAMP NOT NULL  -- time column,`` puts the separator inside
    the comment. The statement still parses as *something*, so this asserts the
    column count rather than merely that it parsed.
    """
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    parsed = sqlglot.parse_one(ddl, dialect="postgres" if backend == "postgresql" else "sqlite")
    rendered = {c.name for c in parsed.find_all(exp.ColumnDef)}
    expected = set(load_dialect_schema(backend)["spans"].columns)
    assert rendered == expected


@pytest.mark.parametrize("backend,expected", [("sqlite", "TIMESTAMP"), ("postgresql", "TIMESTAMP")])
def test_types_are_dialect_real_not_abstract(backend: str, expected: str) -> None:
    """The point of DDL over JSON: a type the caller can actually CAST to.

    The manifest calls `start_time` a "datetime", which is true of both backends
    and useful to neither. Only PostgreSQL carries the time zone, and a caller
    comparing timestamps needs to know which one it is talking to.
    """
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    line = next(ln for ln in ddl.splitlines() if ln.strip().startswith("start_time"))
    assert expected in line
    assert ("WITH TIME ZONE" in line) is (backend == "postgresql")


@pytest.mark.parametrize("backend", DIALECTS)
def test_virtual_columns_are_query_only_comments(backend: str) -> None:
    """Virtual columns are advertised without changing the physical DDL."""
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    create_table_ddl = load_dialect_schema(backend)["spans"].create_table_ddl
    assert "latency_ms" not in create_table_ddl
    assert "-- query-only virtual column: latency_ms" in ddl


@pytest.mark.parametrize("backend", DIALECTS)
def test_no_table_outside_the_allowlist_is_ever_rendered(backend: str) -> None:
    """The schema text is the caller's map, so anything on it must be reachable.

    Naming a table the executor refuses costs a round trip and teaches nothing.
    """
    allowlist = load_allowlist(backend)
    ddl = render_schema_ddl(detail="detailed", dialect=backend)
    parsed = sqlglot.parse(ddl, dialect="postgres" if backend == "postgresql" else "sqlite")
    for statement in parsed:
        if isinstance(statement, exp.Create) and statement.kind == "TABLE":
            assert statement.this.this.name in allowlist.tables


def test_filters_narrow_the_rendering() -> None:
    """area, tables and search all still select, now over text rather than dicts."""
    only_spans = render_schema_ddl(tables=["spans"], detail="detailed", dialect="sqlite")
    assert "CREATE TABLE spans" in only_spans
    assert "CREATE TABLE traces" not in only_spans

    telemetry = render_schema_ddl(area="telemetry", detail="brief", dialect="sqlite")
    assert "-- area: telemetry" in telemetry
    assert "-- area: datasets" not in telemetry

    # `span_kind` is a column on exactly one table, so search must find that
    # table by column and reject the rest. An assertion that tolerated an empty
    # result would pass whether or not search worked at all.
    searched = render_schema_ddl(search="span_kind", detail="brief", dialect="sqlite")
    matched = [
        ln
        for ln in searched.splitlines()
        if ln.startswith("-- ") and ": " in ln and not ln.startswith("-- area:")
    ]
    assert matched == ["-- spans: One OpenTelemetry span"]

    # Virtual columns are queryable too, so discovery must not make them look
    # like a typo. `latency_ms` is available on spans and traces.
    virtual = render_schema_ddl(search="latency_ms", detail="brief", dialect="sqlite")
    assert "-- spans: One OpenTelemetry span" in virtual
    assert "-- traces" in virtual


def test_brief_is_a_catalogue_and_detailed_is_a_schema() -> None:
    """Brief names tables; only detailed spends tokens on columns."""
    brief = render_schema_ddl(detail="brief", dialect="sqlite")
    detailed = render_schema_ddl(detail="detailed", dialect="sqlite")
    assert "CREATE TABLE" not in brief
    assert "-- spans: One OpenTelemetry span" in brief
    assert "CREATE TABLE spans" in detailed
    assert len(brief) < len(detailed)


@pytest.mark.parametrize("backend", DIALECTS)
def test_keys_and_uniqueness_are_rendered(backend: str) -> None:
    """Without these a caller cannot tell whether a join fans out.

    `span_annotations` being unique on (name, span_rowid, identifier) is the
    difference between one annotation per span and many, which decides whether
    a query needs a GROUP BY. The first version of this renderer emitted only
    column definitions, so none of it reached the caller.
    """
    ddl = render_schema_ddl(tables=["span_annotations"], detail="detailed", dialect=backend)
    assert "PRIMARY KEY (id)" in ddl
    assert "UNIQUE (name, span_rowid, identifier)" in ddl
    assert "FOREIGN KEY (span_rowid)" in ddl
    assert "REFERENCES spans (id)" in ddl


@pytest.mark.parametrize("backend", DIALECTS)
def test_physical_ddl_includes_every_project_column(backend: str) -> None:
    """Teaching exposes the exact physical table asset."""
    ddl = render_schema_ddl(tables=["projects"], detail="detailed", dialect=backend)
    physical = load_dialect_schema(backend)["projects"].create_table_ddl
    assert "gradient_start_color" in physical
    assert "trace_retention_policy_id" in physical
    assert "gradient_start_color" in ddl
    assert "trace_retention_policy_id" in ddl


def test_allowlist_physical_columns_come_from_the_ddl_asset() -> None:
    spec = load_allowlist("sqlite").table_specs["projects"]
    expected = load_dialect_schema("sqlite")["projects"].columns
    assert spec.columns == expected
    assert {"gradient_start_color", "trace_retention_policy_id"} <= set(spec.columns)


def test_postgresql_quoted_physical_columns_keep_their_case_semantics() -> None:
    """The loader records physical quoting rather than treating case as presentation."""
    spec = TableSpec(
        name="generated_widget",
        area="test",
        grain="",
        columns=("id", "MixedCase"),
        quoted_columns=frozenset({"MixedCase"}),
    )
    allowlist = Allowlist(
        tables=frozenset({"generated_widget"}),
        table_specs={"generated_widget": spec},
        areas={"test": frozenset({"generated_widget"})},
        pg_schema="public",
    )

    admitted = admit(
        parse_sql('SELECT "MixedCase" FROM generated_widget', dialect="postgresql"),
        allowlist=allowlist,
        dialect="postgresql",
    )
    assert render(admitted, dialect="postgresql") == 'SELECT "MixedCase" FROM generated_widget'

    with pytest.raises(AnalyticsSqlError) as caught:
        admit(
            parse_sql("SELECT mixedcase FROM generated_widget", dialect="postgresql"),
            allowlist=allowlist,
            dialect="postgresql",
        )
    assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED

    expanded = rewrite(
        admit(
            parse_sql("SELECT * FROM generated_widget AS w", dialect="postgresql"),
            allowlist=allowlist,
            dialect="postgresql",
        ),
        RewriteContext(allowlist=allowlist, dialect="postgresql", row_limit=10),
    )
    assert 'w."MixedCase"' in render(expanded, dialect="postgresql")


def test_allowlist_rejects_case_insensitive_physical_virtual_collisions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SQLite has case-insensitive identifiers, so a virtual overlay cannot share one."""
    from types import MappingProxyType

    from phoenix.server.mcp_analytics_sql import allowlist as allowlist_module
    from phoenix.server.mcp_analytics_sql.manifest import (
        AnalyticsSqlManifest,
        Area,
        TableCuration,
    )

    test_manifest = AnalyticsSqlManifest(
        areas=MappingProxyType(
            {
                "test": Area(
                    tables=MappingProxyType(
                        {"widgets": TableCuration(virtual_columns=frozenset({"mixedcase"}))}
                    )
                )
            }
        )
    )
    schema = {
        "widgets": TableSchema(
            create_table_ddl='CREATE TABLE widgets ("MixedCase" TEXT);',
            columns=("MixedCase",),
            quoted_columns=frozenset({"MixedCase"}),
        )
    }
    monkeypatch.setattr(allowlist_module, "manifest", lambda: test_manifest)
    monkeypatch.setattr(allowlist_module, "load_dialect_schema", lambda dialect: schema)
    allowlist_module.load_allowlist.cache_clear()
    try:
        with pytest.raises(ValueError, match="physical/virtual column collisions"):
            allowlist_module.load_allowlist("sqlite")
    finally:
        allowlist_module.load_allowlist.cache_clear()


@pytest.mark.parametrize(
    ("time_column", "column_notes", "error"),
    [
        ("missing_time", {}, "time column not exposed"),
        (None, {"missing_note": "stale"}, "notes for columns not exposed"),
    ],
)
def test_allowlist_rejects_curation_for_unexposed_columns(
    monkeypatch: pytest.MonkeyPatch,
    time_column: str | None,
    column_notes: dict[str, str],
    error: str,
) -> None:
    """DDL migrations must not leave incorrect column guidance behind."""
    from types import MappingProxyType

    from phoenix.server.mcp_analytics_sql import allowlist as allowlist_module
    from phoenix.server.mcp_analytics_sql.manifest import (
        AnalyticsSqlManifest,
        Area,
        TableCuration,
    )

    test_manifest = AnalyticsSqlManifest(
        areas=MappingProxyType(
            {
                "test": Area(
                    tables=MappingProxyType(
                        {
                            "widgets": TableCuration(
                                time_column=time_column,
                                column_notes=column_notes,
                            )
                        }
                    )
                )
            }
        )
    )
    schema = {
        "widgets": TableSchema(
            create_table_ddl="CREATE TABLE widgets (id INTEGER);",
            columns=("id",),
            quoted_columns=frozenset(),
        )
    }
    monkeypatch.setattr(allowlist_module, "manifest", lambda: test_manifest)
    monkeypatch.setattr(allowlist_module, "load_dialect_schema", lambda dialect: schema)
    allowlist_module.load_allowlist.cache_clear()
    try:
        with pytest.raises(ValueError, match=error):
            allowlist_module.load_allowlist("sqlite")
    finally:
        allowlist_module.load_allowlist.cache_clear()


@pytest.mark.parametrize("backend", DIALECTS)
def test_raw_foreign_keys_can_name_nonallowlisted_tables(backend: str) -> None:
    """The loader asset is authoritative even when an FK target is not queryable."""
    ddl = render_schema_ddl(tables=["projects"], detail="detailed", dialect=backend)
    assert "REFERENCES project_trace_retention_policies (id)" in ddl


def test_the_full_schema_executes() -> None:
    """The strongest check available without a server: run it.

    Execution catches what parsing does not -- a constraint naming a column the
    table no longer exposes, a constraint emitted before the last column, a type
    spelling no backend accepts. All three have been shipped by this renderer,
    and none of them changes whether the text parses.
    """
    ddl = render_schema_ddl(detail="detailed", dialect="sqlite")
    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(ddl)
        created = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
    finally:
        connection.close()
    assert created == set(re.findall(r"CREATE TABLE (\w+)", ddl))


@pytest.mark.parametrize("backend", DIALECTS)
def test_enumerated_columns_declare_their_permitted_values(backend: str) -> None:
    """CHECK is the only place a column's allowed literals are written down.

    Nothing else says `status_code` is one of OK, ERROR, UNSET. A caller
    guessing 'error' gets zero rows and no indication why, which reads as
    absent data rather than a wrong literal.
    """
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    assert "status_code" in ddl
    assert all(status in ddl for status in ("'OK'", "'ERROR'", "'UNSET'"))
    annotations = render_schema_ddl(tables=["span_annotations"], detail="detailed", dialect=backend)
    assert "annotator_kind" in annotations
    assert all(kind in annotations for kind in ("'LLM'", "'CODE'", "'HUMAN'"))
    assert "source" in annotations
    assert all(source in annotations for source in ("'API'", "'APP'"))


@pytest.mark.parametrize("backend", DIALECTS)
def test_foreign_keys_and_curation_are_rendered(backend: str) -> None:
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)

    assert "FOREIGN KEY (trace_rowid)" in ddl
    assert "REFERENCES traces (id)" in ddl
    assert "-- Prefer llm_token_count_* over JSON" in ddl
    assert "-- join:" not in ddl
    assert "-- to area root:" not in ddl


@pytest.mark.parametrize("backend", DIALECTS)
def test_misleading_columns_carry_a_note(backend: str) -> None:
    """`parent_id` is the trap this exists for.

    It is a VARCHAR holding a `span_id`, with no foreign key, so the obvious
    self-join against `spans.id` compares a string to an integer and returns
    nothing at all rather than failing.
    """
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    line = next(ln for ln in ddl.splitlines() if ln.startswith("-- parent_id:"))
    assert "span_id" in line and "not spans.id" in line


def test_an_empty_selection_says_which_filter_matched_nothing() -> None:
    """Silence cannot distinguish a typo from an empty deployment."""
    from phoenix.server.mcp_analytics_sql.teaching import describe_sql_schema

    for kwargs in ({"tables": ["users"]}, {"search": "zzzz"}, {"area": "nope"}):
        text = describe_sql_schema(dialect="sqlite", **kwargs)
        assert "No allowlisted table matched" in text
        assert str(list(kwargs.values())[0]) in text


@pytest.mark.parametrize("backend", DIALECTS)
def test_star_expansion_matches_physical_ddl_and_virtual_columns(
    backend: SupportedSQLDialectName,
) -> None:
    """Star expansion preserves DDL order and appends query-only overlays."""
    import sqlglot

    from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext, _expand_stars

    allowlist = load_allowlist(backend)
    sqlglot_dialect = "postgres" if backend == "postgresql" else "sqlite"
    for table in sorted(allowlist.tables):
        spec = allowlist.table_specs[table]
        expected = [
            *load_dialect_schema(backend)[table].columns,
            *sorted(spec.virtual_columns),
        ]
        ctx = RewriteContext(
            dialect=backend,
            allowlist=allowlist,
            row_limit=10,
        )
        expanded = _expand_stars(
            cast(
                exp.Expression, sqlglot.parse_one(f"SELECT * FROM {table}", dialect=sqlglot_dialect)
            ),
            ctx,
        )
        emitted = [column.name for column in expanded.find_all(exp.Column)]
        assert emitted == expected, f"{table}: SELECT * disagrees with the query projection"


def test_published_index_spellings_survive_the_parser() -> None:
    """What the surface tells a caller to write must round-trip through it.

    `describeSqlSchema` publishes reflected index definitions under a heading
    saying to reproduce the expression exactly, so a spelling this package
    cannot itself carry is worse than none: it sends the caller to a
    documentation string that fails when used.

    SQLGlot's PostgreSQL parser binds `::` to the whole extraction rather than
    to the literal, so `a #>> b::text[]` -- the form `pg_get_indexdef` emits --
    parses as `CAST(a #>> b AS TEXT[])` and errors on execution. Dropping that
    redundant cast is a workaround, not a policy: admission allows array casts,
    and the restriction it once fell foul of exists to block catalog types like
    regclass, not arrays.
    """

    from phoenix.server.mcp_analytics_sql.catalog import _body

    published = _body(
        "CREATE INDEX ix ON spans USING btree "
        "((((attributes #>> '{session,id}'::text[]))::character varying))"
    )
    assert "::text[]" not in published

    # The published text must parse to the same thing it parses to a second
    # time -- which the cast-bearing form does too, since the tree is wrong
    # from the start -- so assert the operand instead: no array cast survives
    # to be mis-bound.
    parsed = sqlglot.parse_one(
        f"SELECT count(*) FROM spans WHERE {published} IS NOT NULL", dialect="postgres"
    )
    assert not [c for c in parsed.find_all(exp.DataType) if c.this == exp.DataType.Type.ARRAY]


def test_the_array_cast_workaround_only_touches_json_operands() -> None:
    """Stripping a cast that resolves a polymorphic argument breaks the index.

    The workaround exists because SQLGlot mis-parses `a #>> b::text[]`. A
    blanket `(?<=')::text[]` also caught casts doing real work:
    `array_length('{a,b}'::text[], 1)` became `array_length('{a,b}', 1)`, which
    PostgreSQL refuses with "could not determine polymorphic type". That is the
    same defect the workaround exists to fix -- the surface publishing a
    spelling it cannot run -- moved from `#>>` to any operator-written index
    over an array literal, which is exactly the population live reflection
    serves.
    """
    from phoenix.server.mcp_analytics_sql.catalog import _body

    stripped = _body("CREATE INDEX i ON spans (((attributes #>> '{a,b}'::text[])))")
    assert "::text[]" not in stripped

    for kept in (
        "CREATE INDEX i ON spans ((array_length('{a,b}'::text[], 1)))",
        "CREATE INDEX i ON spans (tags) WHERE tags = '{a}'::text[]",
    ):
        assert "::text[]" in _body(kept), f"a load-bearing cast was stripped from {kept}"


def test_no_allowlisted_table_reuses_a_timestamp_column_name_for_another_type() -> None:
    """The timestamp check matches by name, which is only sound while names agree.

    Resolving every reference back to its table would be stronger, but the
    hidden-column check already matches by name for the same reason, and the
    property that makes it safe is checkable: no allowlisted table gives
    `start_time`, `end_time`, `created_at`, `updated_at`, `deleted_at` or
    `span_start_time` to a column of another type. A migration that broke that
    would make the refusal fire on the wrong column, so it fails here instead.
    """
    from phoenix.db.models import Base
    from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
    from phoenix.server.mcp_analytics_sql.normalize import timestamp_column_names

    tables = load_allowlist("sqlite").tables
    names = timestamp_column_names(tables)
    assert names, "no timestamp columns found; the check would be vacuous"
    offenders = [
        f"{table_name}.{column.name}"
        for table_name, table in Base.metadata.tables.items()
        if table_name in tables
        for column in table.columns
        if column.name in names and "TIMESTAMP" not in str(column.type).upper()
    ]
    assert not offenders, f"non-timestamp columns share a timestamp name: {offenders}"
