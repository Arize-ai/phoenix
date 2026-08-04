import re
import sqlite3
from typing import Literal, cast

import pytest
import sqlglot
from sqlglot import exp

from phoenix.server.mcp_analytics_sql.allowlist import DialectName, load_allowlist
from phoenix.server.mcp_analytics_sql.ddl import render_schema_ddl, validate_ddl
from phoenix.server.mcp_analytics_sql.parse import AdmissionOutcome

# Named `backend` rather than `dialect` on purpose: the unit conftest skips any
# test with a `dialect` parameter set to "postgresql" when running against SQLite,
# on the assumption it needs that database. These render text and touch none.
DIALECTS: list[DialectName] = ["sqlite", "postgresql"]
DETAILS: list[Literal["brief", "detailed", "full"]] = ["brief", "detailed", "full"]


@pytest.mark.parametrize("backend", DIALECTS)
@pytest.mark.parametrize("detail", DETAILS)
def test_every_rendering_parses(backend: str, detail: str) -> None:
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
    spec = load_allowlist().table_specs["spans"]
    expected = {c.name for c in spec.columns} | set(spec.virtual_columns)
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
def test_virtual_columns_are_rendered_like_real_ones(backend: str) -> None:
    """`latency_ms` is usable wherever a column is, so it is written as one.

    Marking it in a way that made it look second-class would invite a caller to
    avoid it in GROUP BY or ORDER BY, where it works. That it is computed is
    said once in the preamble instead of on each of its ~25 occurrences, so the
    column line itself carries no annotation.
    """
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    line = next(ln for ln in ddl.splitlines() if ln.strip().startswith("latency_ms"))
    assert line.strip().startswith("latency_ms ")
    assert "--" not in line


@pytest.mark.parametrize("backend", DIALECTS)
def test_no_table_outside_the_allowlist_is_ever_rendered(backend: str) -> None:
    """The schema text is the caller's map, so anything on it must be reachable.

    Naming a table the executor refuses costs a round trip and teaches nothing.
    """
    allowlist = load_allowlist()
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
    assert matched == ["-- spans: One row per span"]


def test_brief_is_a_catalogue_and_detailed_is_a_schema() -> None:
    """Brief names tables; only detailed spends tokens on columns."""
    brief = render_schema_ddl(detail="brief", dialect="sqlite")
    detailed = render_schema_ddl(detail="detailed", dialect="sqlite")
    assert "CREATE TABLE" not in brief
    assert "-- spans: One row per span" in brief
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
    assert "FOREIGN KEY (span_rowid) REFERENCES spans (id)" in ddl


@pytest.mark.parametrize("backend", DIALECTS)
def test_no_foreign_key_points_outside_the_allowlist(backend: str) -> None:
    """An edge the executor refuses must not appear on the caller's map.

    Rendering one would advertise a join whose only outcome is a refusal, and
    would name a table the surface otherwise never mentions. Asserted over the
    whole schema rather than per column, because it must hold for any column
    later exposed, not only for the ones hidden today.
    """
    allowlist = load_allowlist()
    ddl = render_schema_ddl(detail="detailed", dialect=backend)
    referenced = re.findall(r"REFERENCES (\w+)", ddl)
    assert referenced, "the assertion is vacuous if nothing renders a foreign key"
    assert set(referenced) <= allowlist.tables


@pytest.mark.parametrize("backend", DIALECTS)
def test_constraints_follow_every_column(backend: str) -> None:
    """SQL requires it, and getting it wrong yields DDL that does not parse.

    Virtual columns are appended after the real ones, so a constraint block
    written before them would land mid-list. Asserted on position rather than
    on parseability alone, since a misplaced constraint can still parse as a
    strangely-named column.
    """
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    body = ddl[ddl.index("CREATE TABLE spans") : ddl.index(");")]
    lines = [ln.strip() for ln in body.splitlines()[1:] if ln.strip()]
    keywords = ("PRIMARY KEY", "UNIQUE", "FOREIGN KEY", "CHECK")
    first_constraint = next(i for i, ln in enumerate(lines) if ln.startswith(keywords))
    assert not any(ln.startswith(keywords) for ln in lines[:first_constraint])
    assert all(ln.startswith(keywords) for ln in lines[first_constraint:])


@pytest.mark.parametrize("backend", DIALECTS)
def test_hidden_columns_are_absent_from_the_schema(backend: str) -> None:
    """Decoration and dead references are not worth a caller's tokens.

    `gradient_start_color` styles a project in the UI and answers no analytical
    question. `trace_retention_policy_id` references a table outside the
    allowlist, so it is an integer that resolves to nothing reachable.
    """
    ddl = render_schema_ddl(tables=["projects"], detail="detailed", dialect=backend)
    for column in ("gradient_start_color", "gradient_end_color", "trace_retention_policy_id"):
        assert column not in ddl
    assert "name" in ddl and "PRIMARY KEY (id)" in ddl


def test_the_manifest_still_lists_every_real_column() -> None:
    """Hiding is declared beside the column list, never by deleting from it.

    Deleting would make a column dropped by a migration indistinguishable from
    one deliberately withheld, and `test_manifest_matches_sqlalchemy_metadata`
    would stop catching real drift.
    """
    spec = load_allowlist().table_specs["projects"]
    listed = {column.name for column in spec.columns}
    assert {"gradient_start_color", "trace_retention_policy_id"} <= listed
    assert spec.hidden_columns <= listed
    assert not any(c.name in spec.hidden_columns for c in spec.exposed_columns)


@pytest.mark.parametrize("backend", DIALECTS)
def test_the_full_schema_references_only_tables_it_defines(backend: str) -> None:
    """Closure on the whole schema, where it genuinely must hold.

    Per-area responses are descriptions and may point outward, but the complete
    rendering is the closed set: a REFERENCES to a table absent from it means a
    table was dropped from the manifest while something still keys to it, which
    would leave a caller with an edge to a relation the surface never mentions.
    """
    ddl = render_schema_ddl(detail="detailed", dialect=backend)
    defined = set(re.findall(r"CREATE TABLE (\w+)", ddl))
    referenced = set(re.findall(r"REFERENCES (\w+)", ddl))
    assert referenced, "the assertion is vacuous if nothing renders a foreign key"
    assert referenced <= defined, f"dangling: {sorted(referenced - defined)}"


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
    assert "CHECK (status_code IN ('OK', 'ERROR', 'UNSET'))" in ddl
    annotations = render_schema_ddl(tables=["span_annotations"], detail="detailed", dialect=backend)
    assert "CHECK (annotator_kind IN ('LLM', 'CODE', 'HUMAN'))" in annotations
    assert "CHECK (source IN ('API', 'APP'))" in annotations


@pytest.mark.parametrize("backend", DIALECTS)
def test_join_comments_do_not_repeat_the_foreign_keys(backend: str) -> None:
    """A key states the outbound edge; the comments carry only what it cannot.

    Exactly half of these comments duplicated a rendered REFERENCES clause. The
    inbound direction has no key to carry it, and it is how a caller finds the
    tables worth joining to the one they started from.
    """
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    assert "FOREIGN KEY (trace_rowid) REFERENCES traces (id)" in ddl
    assert "-- join: spans.trace_rowid = traces.id" not in ddl
    assert "-- join: span_costs.span_rowid = spans.id" in ddl


@pytest.mark.parametrize("backend", DIALECTS)
def test_misleading_columns_carry_a_note(backend: str) -> None:
    """`parent_id` is the trap this exists for.

    It is a VARCHAR holding a `span_id`, with no foreign key, so the obvious
    self-join against `spans.id` compares a string to an integer and returns
    nothing at all rather than failing.
    """
    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    line = next(ln for ln in ddl.splitlines() if ln.strip().startswith("parent_id"))
    assert "span_id" in line and "not spans.id" in line


def test_an_empty_selection_says_which_filter_matched_nothing() -> None:
    """Silence cannot distinguish a typo from an empty deployment."""
    from phoenix.server.mcp_analytics_sql.teaching import describe_sql_schema

    for kwargs in ({"tables": ["users"]}, {"search": "zzzz"}, {"area": "nope"}):
        text = describe_sql_schema(dialect="sqlite", **kwargs)
        assert "No allowlisted table matched" in text
        assert str(list(kwargs.values())[0]) in text


@pytest.mark.parametrize("backend", DIALECTS)
def test_star_expansion_matches_the_advertised_columns(backend: DialectName) -> None:
    """What `SELECT *` returns must be what the CREATE TABLE block lists.

    The two were derived from different lists: the DDL printed exposed plus
    virtual columns, star expansion emitted exposed only. A caller who used `*`
    to learn a table's shape concluded `latency_ms` and `graphql_node_id` did
    not exist, while the schema in the same response said they did.

    Compared against the renderer rather than a fixed list, so adding a virtual
    column to one side and not the other fails here.
    """
    import sqlglot

    from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext, _expand_stars

    allowlist = load_allowlist()
    sqlglot_dialect = "postgres" if backend == "postgresql" else "sqlite"
    for table in sorted(allowlist.tables):
        ddl = render_schema_ddl(tables=[table], detail="detailed", dialect=backend)
        listed = [
            line.split()[0]
            for line in ddl.splitlines()
            if line.startswith("  ")
            and not line.strip().startswith(("PRIMARY", "UNIQUE", "FOREIGN", "CHECK"))
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
        assert emitted == listed, f"{table}: SELECT * disagrees with the advertised schema"


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


@pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
def test_published_json_paths_are_expressions_a_caller_can_run(backend: str) -> None:
    """A published path has to be written in the dialect it is published for.

    The manifest stores a logical path, `attributes.session.id`, which is not
    SQL. PostgreSQL reads three dotted parts as schema.table.column and fails
    with `missing FROM-clause entry for table "session"` -- admitted by this
    surface, then rejected by the engine, which is the document-versus-executor
    divergence the suite exists to close. Every rendered path is therefore
    submitted through admission here.
    """
    from phoenix.server.mcp_analytics_sql.parse import try_parse_and_admit

    ddl = render_schema_ddl(tables=["spans"], detail="detailed", dialect=backend)
    paths = [
        line.split("-- populated JSON path:", 1)[1].strip()
        for line in ddl.splitlines()
        if "-- populated JSON path:" in line
    ]
    assert paths, "spans publishes blessed attribute paths; the test is vacuous without them"
    for path in paths:
        result = try_parse_and_admit(
            f"SELECT {path} AS v FROM spans", dialect=cast(DialectName, backend)
        )
        assert result.outcome is AdmissionOutcome.ADMIT, f"{path!r} -> {result.detail}"
        assert "." not in path.split("'")[0], f"{path!r} is a logical path, not an expression"


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

    tables = load_allowlist().tables
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
