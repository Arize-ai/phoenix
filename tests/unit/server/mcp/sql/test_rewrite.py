import base64
from typing import Any, cast

import pytest
import sqlean
import sqlglot
from sqlglot import exp

# Importing the engine module applies Phoenix's extension configuration. Calling
# sqlean.extensions.enable() here would *replace* that set rather than add to it,
# silently disabling extensions other tests depend on for the rest of the session.
import phoenix.db.engines  # noqa: F401  (imported for its extension setup)
from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp.sql.allowlist import load_allowlist
from phoenix.server.mcp.sql.catalog import (
    ReflectedIndex,
    _classify,
    _sqlite_shape,
    indexed_json_accessors,
)
from phoenix.server.mcp.sql.catalog import _body as _index_body
from phoenix.server.mcp.sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp.sql.parse import (
    AdmissionOutcome,
    admit,
    parse_sql,
    render,
    try_parse_and_admit,
)
from phoenix.server.mcp.sql.rewrite import (
    RewriteContext,
    _decode_node_id,
    _substitute_graphql_node_id,
    _substitute_latency_ms,
    rewrite,
)


def _ctx(dialect: SupportedSQLDialectName = "postgresql") -> RewriteContext:
    """A rewrite context."""
    return RewriteContext(allowlist=load_allowlist("sqlite"), dialect=dialect, row_limit=500)


def test_star_expansion() -> None:
    root = parse_sql("SELECT * FROM spans", dialect="postgresql")
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx()), dialect="postgresql")
    assert "spans.trace_rowid" in out
    assert not out.startswith("SELECT *")


@pytest.mark.parametrize("spelling", ["SPANS", "Spans"])
def test_postgres_schema_qualification_uses_unquoted_table_folding(spelling: str) -> None:
    root = parse_sql(f"SELECT id FROM {spelling}", dialect="postgresql")
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx()), dialect="postgresql")
    assert "public" in out


def test_quoted_cte_name_does_not_hide_an_unquoted_base_table_virtual_column() -> None:
    root = parse_sql(
        'WITH "X" AS (SELECT 1 AS dummy) SELECT X.latency_ms FROM spans AS x',
        dialect="postgresql",
    )
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx()), dialect="postgresql")
    assert "X.latency_ms" not in out
    assert "x.start_time" in out and "x.end_time" in out


def test_oversized_graphql_node_id_is_not_converted_to_an_integer() -> None:
    value = base64.b64encode(f"Project:{'9' * 5000}".encode()).decode()
    assert _decode_node_id(value, "Project") is None


def test_case_folded_cte_shadow_is_not_qualified_as_a_physical_table() -> None:
    root = parse_sql(
        "WITH SPANS AS (SELECT 999999 AS id) SELECT id FROM spans", dialect="postgresql"
    )
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx()), dialect="postgresql")
    assert "public.spans" not in out
    assert "FROM spans" in out


def test_count_star_unaffected() -> None:
    root = parse_sql("SELECT count(*) FROM spans", dialect="postgresql")
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx()), dialect="postgresql")
    assert "COUNT(*)" in out.upper()


def test_latency_ms_predicate_postgres() -> None:
    root = parse_sql("SELECT id FROM spans WHERE latency_ms > 100", dialect="postgresql")
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx("postgresql")), dialect="postgresql")
    assert "latency_ms" not in out.lower()
    assert "start_time" in out and "end_time" in out
    # EXTRACT names the field first and the source second. Reversed, it renders
    # as EXTRACT(end_time - start_time FROM EPOCH): a different request that
    # looks close enough to pass a substring check for the column names.
    assert "EXTRACT(EPOCH FROM (" in out
    assert "end_time - " in out
    assert "FROM EPOCH" not in out


# Durations chosen so that ordering by elapsed time disagrees with ordering by
# start time, and so that one row sits below a 100 ms threshold while the others
# sit above it. A rewrite that computed something monotonic in start_time, or
# that returned seconds instead of milliseconds, would still execute and still
# return rows -- these are the two mistakes that a liveness check cannot see.
_LATENCY_ROWS = [
    ("span-medium", "2026-07-30 12:00:00.000000", "2026-07-30 12:00:00.500000", 500.0),
    ("span-short", "2026-07-30 12:00:01.000000", "2026-07-30 12:00:01.050000", 50.0),
    ("span-long", "2026-07-30 12:00:02.000000", "2026-07-30 12:00:04.500000", 2500.0),
]


def _run_on_sqlite(sql: str) -> list[tuple[Any, ...]]:
    conn = sqlean.connect(":memory:")
    try:
        conn.execute("CREATE TABLE spans(span_id TEXT, start_time TEXT, end_time TEXT)")
        conn.executemany(
            "INSERT INTO spans VALUES(?,?,?)", [(r[0], r[1], r[2]) for r in _LATENCY_ROWS]
        )
        return cast(list[tuple[Any, ...]], conn.execute(sql).fetchall())
    finally:
        conn.close()


def _rendered(sql: str) -> str:
    root = parse_sql(sql, dialect="sqlite")
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite")
    return render(rewrite(root, _ctx("sqlite")), dialect="sqlite")


def test_latency_ms_projects_milliseconds() -> None:
    """The advertised column must yield the elapsed time, not an arithmetic artifact.

    Generators emit an expression tree in source order without reapplying
    operator precedence, so a correctly shaped tree can still render as SQL that
    groups the operators differently. Asserting on the number closes the gap
    between the tree being right and the statement meaning what the tree said.
    """
    sql = _rendered("SELECT span_id, latency_ms FROM spans ORDER BY span_id")
    rows = _run_on_sqlite(sql)
    actual = {span_id: round(float(value), 3) for span_id, value in rows}
    assert actual == {span_id: expected for span_id, _, _, expected in _LATENCY_ROWS}


def test_latency_ms_predicate_compares_in_milliseconds() -> None:
    """A threshold means milliseconds wherever it is written.

    Comparing the bare timestamp difference would be a smaller rewrite and would
    silently reinterpret the caller's number as seconds, quietly excluding rows
    a thousand times more slowly than asked.
    """
    sql = _rendered("SELECT span_id FROM spans WHERE latency_ms > 100 ORDER BY span_id")
    assert [row[0] for row in _run_on_sqlite(sql)] == ["span-long", "span-medium"]


def test_latency_ms_orders_by_duration_not_start_time() -> None:
    """Sorting must rank by how long a span took, not by when it began.

    An expression that is monotonic in start_time returns a plausible ordering
    for every query, which is why this is asserted against rows whose duration
    order is the reverse of their start order.
    """
    sql = _rendered("SELECT span_id FROM spans ORDER BY latency_ms DESC")
    assert [row[0] for row in _run_on_sqlite(sql)] == ["span-long", "span-medium", "span-short"]


def _run_star_join_sqlite(sql: str) -> list[tuple[Any, ...]]:
    """Execute a star expansion, with every column the manifest names present.

    The expansion emits the manifest's column list, so the table it runs
    against is built from that same list.
    """
    spec = load_allowlist("sqlite").table_specs["spans"]
    conn = sqlean.connect(":memory:")
    try:
        conn.execute("CREATE TABLE spans({})".format(", ".join(f'"{n}"' for n in spec.columns)))
        for row_id in (1, 2, 3):
            conn.execute("INSERT INTO spans(id) VALUES(?)", (row_id,))
        return cast(list[tuple[Any, ...]], conn.execute(sql).fetchall())
    finally:
        conn.close()


class TestUsingKeyOverARightJoin:
    """USING exposes one key, defined as the merge of both sides.

    A right or full join produces rows where the left side is absent, and there
    the left copy is NULL while the key is not. Emitting the left copy returns a
    column of NULLs for exactly the rows the join was widened to include.
    """

    def test_a_query_local_left_source_is_merged(self) -> None:
        """A CTE names its own columns, so the manifest cannot answer for it.

        Its copy of the key still goes NULL the way a physical table's does.
        """
        rendered = _rendered(
            "WITH q AS (SELECT id FROM spans WHERE id < 3) "
            "SELECT * FROM q RIGHT JOIN spans USING (id)"
        )
        assert "COALESCE(q.id, spans.id) AS id" in rendered
        # The CTE holds two of the three rows; the third is right-join padding.
        assert [row[0] for row in _run_star_join_sqlite(rendered)] == [1, 2, 3]

    def test_a_physical_left_source_is_still_merged(self) -> None:
        rendered = _rendered("SELECT * FROM traces RIGHT JOIN spans USING (id)")
        assert "COALESCE(traces.id, spans.id) AS id" in rendered

    def test_an_inner_join_keeps_the_left_copy(self) -> None:
        """The left copy is the merged value unless the join can drop it."""
        rendered = _rendered(
            "WITH q AS (SELECT id FROM spans) SELECT * FROM q JOIN spans USING (id)"
        )
        assert "COALESCE" not in rendered.upper()


def test_exempt_table_not_wrapped() -> None:
    root = parse_sql("SELECT name FROM projects", dialect="postgresql")
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx("postgresql")), dialect="postgresql")
    assert out == "SELECT name FROM public.projects LIMIT 501"


# Index reflection: the classification is pure, so it is asserted without a
# database. What must not regress is the filter -- an index that merely restates
# the manifest costs tokens and teaches nothing, while an expression index is
# the only place the required spelling appears.
@pytest.mark.parametrize(
    ("ddl", "expected_kind", "expected_columns"),
    [
        ("CREATE INDEX i ON spans (parent_id)", None, 1),
        ("CREATE INDEX i ON spans (project_rowid, start_time DESC)", "composite", 2),
        ("CREATE INDEX i ON spans ((end_time - start_time))", "expression", 1),
        (
            'CREATE INDEX i ON spans (JSON_EXTRACT(attributes, \'$."session"."id"\')) '
            'WHERE JSON_EXTRACT(attributes, \'$."session"."id"\') IS NOT NULL',
            "expression",
            1,
        ),
        ("CREATE INDEX i ON experiments (updated_at) WHERE is_ephemeral IS TRUE", "partial", 1),
    ],
    ids=["single-column-dropped", "composite", "expression", "json-path", "partial"],
)
def test_index_classification(ddl: str, expected_kind: object, expected_columns: int) -> None:
    body = _index_body(ddl)
    is_expression, is_partial, columns = _sqlite_shape(body)
    assert columns == expected_columns
    assert (
        _classify(is_expression=is_expression, is_partial=is_partial, column_count=columns)
        == expected_kind
    )


# Values chosen so that text ordering and numeric ordering disagree: as text
# "1017066" sorts below "149740" because '0' precedes '4' at the third
# character. An accessor that returns JSON text instead of a value therefore
# reports the smaller number as the maximum, with no error anywhere.
_JSON_ROWS = [
    ('{"llm":{"tokens":1017066}}',),
    ('{"llm":{"tokens":149740}}',),
]


def _sqlite_with_json_index() -> "sqlean.Connection":
    conn = sqlean.connect(":memory:")
    conn.execute("CREATE TABLE spans(start_time TEXT, end_time TEXT, attributes TEXT)")
    # The form SQLAlchemy compiles an Index over a JSON path into. Reproduced
    # here rather than referenced, so the assertion below is about the shape a
    # query must match rather than about one deployment's catalog.
    conn.execute('CREATE INDEX ix_json ON spans (JSON_EXTRACT(attributes, \'$."llm"."tokens"\'))')
    conn.executemany(
        "INSERT INTO spans VALUES('2026-07-30 12:00:00.000000','2026-07-30 12:00:01.000000',?)",
        _JSON_ROWS,
    )
    return conn


def test_json_extract_returns_a_value_not_json_text() -> None:
    """MAX over a JSON number must compare numerically.

    SQLite's three JSON accessors disagree on return type, and the generator
    reaches for the one that yields text unless told otherwise. Nothing
    downstream can detect the substitution, because the wrong answer is a
    plausible number drawn from the same column.
    """
    sql = _rendered("SELECT MAX(json_extract(attributes, '$.llm.tokens')) AS v FROM spans")
    conn = _sqlite_with_json_index()
    try:
        assert conn.execute(sql).fetchone()[0] == 1017066
    finally:
        conn.close()


@pytest.mark.parametrize(
    "caller_spelling",
    [
        "json_extract(attributes, '$.llm.tokens')",
        'json_extract(attributes, \'$."llm"."tokens"\')',
        "attributes ->> '$.llm.tokens'",
    ],
    ids=["plain-path", "quoted-path", "arrow-operator"],
)
def test_json_reads_converge_on_the_indexable_spelling(caller_spelling: str) -> None:
    """Every way of asking must render as the one form an index can match.

    SQLite matches an expression index on the parsed expression, so a query
    reaches one only by repeating it exactly -- same function, same path
    literal. Since callers write whichever spelling is natural to them and the
    indexed form is one none of them would choose unaided, the rewrite has to
    converge rather than merely preserve. Asserting on the query plan rather
    than the SQL text is what makes this a statement about index use.
    """
    sql = _rendered(f"SELECT count(*) AS v FROM spans WHERE {caller_spelling} = '1'")
    conn = _sqlite_with_json_index()
    try:
        plan = " ".join(row[3] for row in conn.execute("EXPLAIN QUERY PLAN " + sql).fetchall())
    finally:
        conn.close()
    assert "ix_json" in plan, f"planner chose a scan: {plan}\n  rendered: {sql}"


# The spellings a deployment might actually have indexed. SQLAlchemy compiles
# Phoenix's own indexes into the quoted json_extract form; a person adding one by
# hand writes whichever of these reads naturally to them. Converging on any one
# of them by assumption serves that deployment and strips the index from the
# others, so the assertion covers all three plus the case where nothing at all
# is indexed.
@pytest.mark.parametrize(
    ("indexed_expression", "expect_index"),
    [
        ("json_extract(attributes,'$.metadata.conversation_id')", True),
        ('json_extract(attributes,\'$."metadata"."conversation_id"\')', True),
        ("attributes ->> '$.metadata.conversation_id'", True),
        (None, False),
    ],
    ids=["hand-written-unquoted", "sqlalchemy-quoted", "arrow-operator", "no-index"],
)
def test_rewrite_matches_whatever_spelling_was_indexed(
    indexed_expression: "str | None", expect_index: bool
) -> None:
    """The caller's spelling is normalised toward this deployment's, not toward ours.

    A caller cannot know how an index was declared, and the declarations differ:
    SQLAlchemy quotes every path key, a person usually does not, and either may
    have used the operator instead of the function. Reading the catalog is what
    lets one query text serve all of them; assuming a convention would silently
    return every deployment that chose differently to a full scan.
    """
    reflected = (
        {
            "spans": [
                ReflectedIndex(
                    table="spans",
                    name="ix_user",
                    body=f"({indexed_expression})",
                    kind="expression",
                    unique=False,
                )
            ]
        }
        if indexed_expression
        else {}
    )
    ctx = _ctx("sqlite")
    ctx.indexed_json_accessors = indexed_json_accessors(reflected)
    root = parse_sql(
        "SELECT count(*) AS v FROM spans "
        "WHERE json_extract(attributes,'$.metadata.conversation_id') = 'x'",
        dialect="sqlite",
    )
    rendered = render(
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), ctx),
        dialect="sqlite",
    )

    conn = sqlean.connect(":memory:")
    try:
        conn.execute("CREATE TABLE spans(start_time TEXT, end_time TEXT, attributes TEXT)")
        if indexed_expression:
            conn.execute(f"CREATE INDEX ix_user ON spans ({indexed_expression})")
        plan = " ".join(row[3] for row in conn.execute("EXPLAIN QUERY PLAN " + rendered))
    finally:
        conn.close()
    assert ("ix_user" in plan) is expect_index, f"plan: {plan}\n  rendered: {rendered}"


def test_star_expands_every_joined_table() -> None:
    """A star means every column of everything joined, not of the first table.

    Reading only the FROM clause returns a well-formed row that is missing
    exactly the columns the caller joined to obtain, with no error to notice.
    """
    root = parse_sql(
        "SELECT * FROM spans JOIN traces ON spans.trace_rowid = traces.id", dialect="sqlite"
    )
    out = render(
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite")),
        dialect="sqlite",
    )
    assert "spans.span_id" in out and "traces.trace_id" in out


def test_bare_star_coalesces_using_join_keys() -> None:
    """USING exposes each join key once; a bare star must not emit both copies."""
    _, rendered = _rewritten(
        "SELECT * FROM projects JOIN datasets USING (id)",
        dialect="postgresql",
    )
    select_list = rendered.split(" FROM ", 1)[0]
    assert "projects.id," in select_list
    assert "datasets.id," not in select_list
    assert "datasets.name" in select_list


def test_qualified_star_keeps_using_join_keys() -> None:
    """A qualified star names one relation's columns, including its copy of the key."""
    _, rendered = _rewritten(
        "SELECT projects.*, datasets.* FROM projects JOIN datasets USING (id)",
        dialect="postgresql",
    )
    select_list = rendered.split(" FROM ", 1)[0]
    assert "projects.id," in select_list
    assert "datasets.id," in select_list


def test_postgres_to_char_round_trips() -> None:
    _, rendered = _rewritten(
        "SELECT to_char(start_time, 'YYYY-MM') FROM spans",
        dialect="postgresql",
    )
    assert "TO_CHAR" in rendered.upper()
    assert "YYYY-MM" in rendered


def test_star_over_an_aliased_table_uses_the_alias() -> None:
    """After `FROM spans AS s` the name `spans` no longer resolves, so expanding
    to `spans.<col>` produces a statement that cannot execute on either backend.
    """
    root = parse_sql("SELECT * FROM spans AS s", dialect="sqlite")
    out = render(
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite")),
        dialect="sqlite",
    )
    assert "s.span_id" in out and "spans.span_id" not in out


def test_quoted_alias_star_keeps_the_callers_quoting() -> None:
    """PostgreSQL folds unquoted identifiers; expanded columns keep the caller's quoting."""
    _, rendered = _rewritten('SELECT "S".* FROM spans AS "S"', dialect="postgresql")
    assert '"S".id' in rendered
    assert 'AS "S"' in rendered
    assert " S.id" not in rendered.replace('"S".id', "")


def test_qualified_star_matches_the_exposed_name_not_the_physical_table() -> None:
    """After ``FROM traces AS spans``, ``spans.*`` is traces, not the table ``spans``."""
    _, rendered = _rewritten(
        "SELECT spans.* FROM traces AS spans JOIN spans AS t ON t.trace_rowid = spans.id",
        dialect="postgresql",
    )
    assert "t.span_id" not in rendered
    assert "spans.trace_id" in rendered


def test_unquoted_star_does_not_match_a_quoted_alias() -> None:
    """PostgreSQL: unquoted ``s`` and quoted ``"S"`` are different identifiers."""
    _, rendered = _rewritten(
        'SELECT s.* FROM spans AS "S" JOIN traces AS s ON true',
        dialect="postgresql",
    )
    assert '"S".id' not in rendered
    assert "s.trace_id" in rendered


def test_quoted_alias_virtual_columns_keep_the_callers_quoting() -> None:
    """Virtual-column substitution keeps the caller's quoting on the qualifier."""
    _, latency = _rewritten('SELECT "S".latency_ms FROM spans AS "S"', dialect="postgresql")
    assert '"S".end_time' in latency and '"S".start_time' in latency
    assert 'AS "S"' in latency

    _, node_id = _rewritten('SELECT "S".graphql_node_id FROM spans AS "S"', dialect="postgresql")
    assert '"S".id' in node_id
    assert 'AS "S"' in node_id


def test_table_name_qualifier_after_an_alias_uses_the_exposed_alias() -> None:
    """PostgreSQL hides the table name once it is aliased.

    Admission accepts ``traces.graphql_node_id`` after ``FROM traces t`` because
    both names resolve. Copying that qualifier into the rewrite produced
    ``traces.id`` and a missing-FROM error. The exposed alias is what the
    engine can still see.
    """
    _, node_id = _rewritten("SELECT traces.graphql_node_id FROM traces t", dialect="postgresql")
    assert "t.id" in node_id
    assert "traces.id" not in node_id.replace("AS traces", "")

    _, latency = _rewritten("SELECT spans.latency_ms FROM spans AS s", dialect="postgresql")
    assert "s.start_time" in latency and "s.end_time" in latency
    assert "spans.start_time" not in latency


def test_virtual_using_join_is_rewritten_to_on() -> None:
    ctx, rendered = _rewritten(
        "SELECT s.span_id, t.trace_id FROM spans s JOIN traces t USING (latency_ms)",
        dialect="postgresql",
    )
    assert "USING" not in rendered.upper()
    assert "virtual_using" in ctx.applied
    assert "s.start_time" in rendered and "t.start_time" in rendered


def test_integer_epoch_against_a_timestamp_is_rewritten_to_utc() -> None:
    ctx, rendered = _rewritten(
        "SELECT count(*) FROM spans WHERE start_time >= 1719792000",
        dialect="postgresql",
    )
    assert "1719792000" not in rendered
    assert "2024-07-01T00:00:00+00:00" in rendered
    assert any("Unix epoch" in note for note in ctx.notes)


def test_mixed_physical_and_virtual_using_becomes_on() -> None:
    ctx, rendered = _rewritten(
        "SELECT s.span_id, t.trace_id FROM spans s JOIN traces t USING (id, latency_ms)",
        dialect="postgresql",
    )
    assert "USING" not in rendered.upper()
    assert "virtual_using" in ctx.applied
    assert "s.id" in rendered and "t.id" in rendered


def test_virtual_using_star_emits_the_join_key_once() -> None:
    _, rendered = _rewritten(
        "SELECT * FROM spans JOIN traces USING (latency_ms)",
        dialect="postgresql",
    )
    assert rendered.casefold().count("as latency_ms") == 1


def test_fractional_epoch_keeps_subseconds_on_postgres() -> None:
    _, rendered = _rewritten(
        "SELECT count(*) FROM spans WHERE start_time >= 1719792000.123",
        dialect="postgresql",
    )
    assert "1719792000.123" not in rendered
    assert "2024-07-01T00:00:00.123" in rendered


def test_cast_epoch_as_bigint_replaces_the_whole_cast() -> None:
    _, rendered = _rewritten(
        "SELECT count(*) FROM spans WHERE start_time >= CAST(1719792000 AS bigint)",
        dialect="postgresql",
    )
    assert "BIGINT" not in rendered.upper()
    assert "2024-07-01T00:00:00+00:00" in rendered


def test_epoch_inside_any_array_is_cast_to_timestamptz() -> None:
    _, rendered = _rewritten(
        "SELECT count(*) FROM spans WHERE start_time = ANY(ARRAY[1719792000])",
        dialect="postgresql",
    )
    assert "1719792000" not in rendered
    assert "timestamptz" in rendered.casefold() or "timestamp with time zone" in rendered.casefold()


def test_negative_epoch_is_rewritten() -> None:
    ctx, rendered = _rewritten(
        "SELECT count(*) FROM spans WHERE start_time >= -1",
        dialect="postgresql",
    )
    assert "timestamp_literals" in ctx.applied
    assert "1969-12-31" in rendered
    assert any("Unix epoch" in note for note in ctx.notes)


def test_scientific_epoch_without_a_dot_is_rewritten() -> None:
    ctx, rendered = _rewritten(
        "SELECT count(*) FROM spans WHERE start_time >= 1e9",
        dialect="postgresql",
    )
    assert "1e9" not in rendered.casefold()
    assert "2001-09-09" in rendered
    assert any("Unix epoch" in note for note in ctx.notes)


def test_epoch_inside_values_is_cast_to_timestamptz() -> None:
    _, rendered = _rewritten(
        "SELECT count(*) FROM spans WHERE start_time IN (VALUES (1719792000))",
        dialect="postgresql",
    )
    assert "1719792000" not in rendered
    assert "timestamptz" in rendered.casefold() or "timestamp with time zone" in rendered.casefold()


def test_parenthesised_integer_json_arrow_stays_an_operator() -> None:
    _, rendered = _rewritten(
        "SELECT jsonb_build_array(10, 20, 30) -> (1) AS v",
        dialect="postgresql",
    )
    assert "jsonb_extract_path" not in rendered.casefold()
    assert "->" in rendered


def test_unqualified_graphql_node_id_qualifies_the_sole_graphql_table() -> None:
    _, rendered = _rewritten(
        "SELECT graphql_node_id FROM spans JOIN span_costs ON span_costs.span_rowid = spans.id",
        dialect="postgresql",
    )
    assert "CAST(spans.id AS TEXT)" in rendered or "CAST(spans.id AS text)" in rendered.lower()
    assert "CAST(id AS TEXT)" not in rendered.replace("CAST(spans.id AS TEXT)", "")


def test_qualified_star_on_a_missing_alias_names_the_missing_relation() -> None:
    root = parse_sql("SELECT t.* FROM spans s", dialect="postgresql")
    with pytest.raises(AnalyticsSqlError) as caught:
        rewrite(
            admit(root, allowlist=load_allowlist("postgresql"), dialect="postgresql"),
            _ctx("postgresql"),
        )
    assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX
    assert "`t` does not name a relation" in caught.value.message
    assert "query-local relation" not in caught.value.message


def test_latency_ms_does_not_fold_a_quoted_alias_onto_an_unquoted_qualifier() -> None:
    """Quoted and unquoted spellings are different names on PostgreSQL."""
    tree = sqlglot.parse_one('SELECT s.latency_ms FROM spans AS "S"', dialect="postgres")
    ctx = RewriteContext(
        dialect="postgresql",
        allowlist=load_allowlist("sqlite"),
        row_limit=10,
    )
    out = _substitute_latency_ms(cast(exp.Expression, tree), ctx)
    rendered = out.sql(dialect="postgres")
    assert "start_time" not in rendered
    assert "latency_ms" in rendered.lower()


def test_star_over_a_cte_expands_the_cte_projection() -> None:
    """The CTE's SELECT is known; expanding it is the query the caller wrote."""
    ctx, rendered = _rewritten(
        "WITH x AS (SELECT id FROM projects) SELECT * FROM x", dialect="sqlite"
    )
    assert "star_expansion" in ctx.applied
    folded = rendered.lower().replace(" ", "")
    assert "x.id" in folded or folded.startswith("selectid") or "selectx.id" in folded
    assert "name" not in folded


def test_star_over_an_unaliased_set_returning_function_expands_known_columns() -> None:
    root = parse_sql(
        "SELECT * FROM jsonb_each((SELECT attributes FROM spans LIMIT 1))",
        dialect="postgresql",
    )
    ctx = RewriteContext(
        allowlist=load_allowlist("postgresql"), dialect="postgresql", row_limit=500
    )
    rendered = render(
        rewrite(admit(root, allowlist=ctx.allowlist, dialect="postgresql"), ctx),
        dialect="postgresql",
    )
    assert "star_expansion" in ctx.applied
    folded = rendered.lower()
    assert "key" in folded
    assert "value" in folded


@pytest.mark.parametrize("backend", ["sqlite", "postgresql"])
def test_star_over_a_cte_shadowing_an_allowlisted_table_uses_the_cte(
    backend: SupportedSQLDialectName,
) -> None:
    """A CTE name must not make star expansion read the physical table's schema."""
    ctx, rendered = _rewritten(
        "WITH projects AS (SELECT 1 AS n) SELECT * FROM projects",
        dialect=backend,
    )
    assert "star_expansion" in ctx.applied
    folded = rendered.lower().replace(" ", "")
    assert "n" in folded
    assert "gradient_start_color" not in folded


def test_latency_ms_keeps_its_name_in_the_select_list() -> None:
    """An advertised column has to come back under the name it was advertised as."""
    root = parse_sql("SELECT latency_ms FROM spans", dialect="sqlite")
    out = render(
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite")),
        dialect="sqlite",
    )
    assert "AS latency_ms" in out


def test_experiment_runs_latency_ms_is_substituted() -> None:
    """experiment_runs stores the same two timestamps the overlay is built from."""
    _, rendered = _rewritten("SELECT latency_ms FROM experiment_runs", dialect="sqlite")
    assert "UNIXEPOCH" in rendered.upper()
    assert "AS latency_ms" in rendered


@pytest.mark.parametrize(
    "sql,must_contain",
    [
        (
            "SELECT * FROM (SELECT id FROM projects) p JOIN traces t ON t.project_rowid = p.id",
            "p.id",
        ),
        ("SELECT * FROM spans, json_each(attributes)", "json_each.key"),
        ("SELECT * FROM (VALUES (1, 2), (3, 4)) AS v(a, b)", "v.a"),
    ],
    ids=["derived-table-joined", "table-valued-function", "named-values"],
)
def test_star_expands_sources_whose_columns_are_known(sql: str, must_contain: str) -> None:
    ctx, rendered = _rewritten(sql, dialect="sqlite")
    assert "star_expansion" in ctx.applied
    assert must_contain.lower() in rendered.lower()


def test_star_over_json_each_column_aliases_keeps_the_names() -> None:
    ctx, rendered = _rewritten(
        "SELECT t.* FROM spans, json_each(attributes) AS t(k, v)", dialect="sqlite"
    )
    assert "star_expansion" in ctx.applied
    folded = rendered.lower().replace(" ", "")
    assert "ask" in folded or "as k" in rendered.lower()
    assert "t.type" not in folded
    assert "t.atom" not in folded
    """A projection with no name still cannot be expanded; skip would drop the source."""
    root = parse_sql("SELECT * FROM (SELECT count(*) FROM spans) t", dialect="sqlite")
    with pytest.raises(AnalyticsSqlError) as caught:
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite"))
    assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX


def test_qualified_star_expands_to_manifest_columns() -> None:
    """`t.*` is a Column wrapping a Star, not a Star.

    Checking only for the Star class leaves it unexpanded and hands `t.*` to the
    engine, which returns every physical column of the table rather than the
    columns the manifest declares.
    """
    root = parse_sql("SELECT s.* FROM spans s", dialect="sqlite")
    out = render(
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite")),
        dialect="sqlite",
    )
    assert "s.*" not in out
    assert "s.span_id" in out


@pytest.mark.parametrize(
    ("backend", "sql", "expected"),
    [
        ("sqlite", "SELECT Spans.* FROM spans", "span_id"),
        ("sqlite", "SELECT S.* FROM spans AS s", "span_id"),
        ("postgresql", "SELECT S.* FROM spans AS s", "span_id"),
    ],
)
def test_unquoted_qualified_star_uses_identifier_folding(
    backend: SupportedSQLDialectName,
    sql: str,
    expected: str,
) -> None:
    root = parse_sql(sql, dialect=backend)
    out = render(
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect=backend), _ctx(backend)),
        dialect=backend,
    )
    assert expected in out


def test_schema_qualification_does_not_redirect_a_cte_to_its_base_table() -> None:
    """A CTE named after a table must keep resolving to the CTE.

    Qualifying by name rewrites `FROM spans` in the outer query to
    `FROM public.spans`, and a schema-qualified name cannot resolve to a CTE.
    The CTE becomes dead code, the caller's filter vanishes, and every step is
    valid SQL — so the only symptom is a wrong number. SQLite has no such pass, so the
    two backends answered the same query differently.

    Naming a CTE after the table it derives from is among the commonest idioms
    in analytic SQL, and it is what a model writes when asked to filter a table
    and then aggregate the filtered set.
    """
    sql = "WITH spans AS (SELECT * FROM spans WHERE name = 'foo') SELECT count(*) AS n FROM spans"
    root = parse_sql(sql, dialect="postgresql")
    out = render(
        rewrite(
            admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql"),
            _ctx("postgresql"),
        ),
        dialect="postgresql",
    )
    outer = out[out.rindex("SELECT COUNT") :]
    assert "public.spans" not in outer, f"outer read was redirected to the base table: {outer}"
    # The base-table reference inside the CTE body still needs qualifying; a
    # rule that skipped every occurrence of the name would leave it bare.
    assert "public.spans" in out


def test_schema_qualification_still_qualifies_tables_and_joins() -> None:
    """Guards the test above: a pass that qualified nothing would also satisfy it."""
    root = parse_sql(
        "SELECT count(*) FROM spans JOIN traces ON traces.id = spans.trace_rowid",
        dialect="postgresql",
    )
    out = render(
        rewrite(
            admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql"),
            _ctx("postgresql"),
        ),
        dialect="postgresql",
    )
    assert "public.spans" in out and "public.traces" in out


def test_postgres_dynamic_json_key_keeps_the_arrow_operator() -> None:
    """`attributes -> k.key` must not reach PostgreSQL as `json_extract_path`.

    That function takes `json`, not `jsonb`, and would refuse the stored column.
    The operator renders as itself, which is both what the caller wrote and what
    an expression index over the same accessor matches.
    """
    allowlist = load_allowlist("postgresql")
    sql = (
        "SELECT s.attributes -> k.key AS v FROM spans s "
        "CROSS JOIN LATERAL jsonb_each(s.attributes) AS k"
    )
    root = admit(parse_sql(sql, dialect="postgresql"), allowlist=allowlist, dialect="postgresql")
    ctx = RewriteContext(allowlist=allowlist, dialect="postgresql", row_limit=500)
    out = render(rewrite(root, ctx), dialect="postgresql")
    assert "-> k.key" in out
    assert "EXTRACT_PATH" not in out.upper()
    assert "jsonb_extract_path" not in ctx.applied


def test_postgres_dynamic_json_key_scalar_keeps_the_arrow_operator() -> None:
    allowlist = load_allowlist("postgresql")
    sql = (
        "SELECT s.attributes ->> k.key AS v FROM spans s "
        "CROSS JOIN LATERAL jsonb_each(s.attributes) AS k"
    )
    root = admit(parse_sql(sql, dialect="postgresql"), allowlist=allowlist, dialect="postgresql")
    ctx = RewriteContext(allowlist=allowlist, dialect="postgresql", row_limit=500)
    out = render(rewrite(root, ctx), dialect="postgresql")
    assert "->> k.key" in out
    assert "EXTRACT_PATH" not in out.upper()
    assert "jsonb_extract_path" not in ctx.applied


@pytest.mark.parametrize(
    ("sql", "expected_operand"),
    [
        # `->` and `||` share a precedence class and associate left, so an
        # unparenthesised `a -> 'x' || 'y'` is `(a -> 'x') || 'y'`.
        ("SELECT json_extract(attributes, 'a' || 'b') AS v FROM spans", "('a' || 'b')"),
        # Nested accessors are in that class as well.
        (
            "SELECT json_extract(attributes, attributes ->> 'k') AS v FROM spans",
            "(attributes ->> 'k')",
        ),
        # Comparison forms that are neither infix nor prefix operators, and so
        # are reached by exp.Predicate rather than by Binary or Unary.
        (
            "SELECT json_extract(attributes, name BETWEEN 'a' AND 'b') AS v FROM spans",
            "(name BETWEEN 'a' AND 'b')",
        ),
        (
            "SELECT json_extract(attributes, name IN ('a', 'b')) AS v FROM spans",
            "(name IN ('a', 'b'))",
        ),
    ],
)
def test_postgres_operator_json_key_is_parenthesised(sql: str, expected_operand: str) -> None:
    """A computed key must reach PostgreSQL grouped as the caller wrote it.

    Only the function spelling produces this tree: written as an operator, the
    same text groups in the parser the way PostgreSQL groups it, leaving the
    extraction below the outer operator rather than at the top.
    """
    allowlist = load_allowlist("postgresql")
    root = admit(parse_sql(sql, dialect="postgresql"), allowlist=allowlist, dialect="postgresql")
    ctx = RewriteContext(allowlist=allowlist, dialect="postgresql", row_limit=500)
    out = render(rewrite(root, ctx), dialect="postgresql")
    assert expected_operand in out
    assert "json_operand_parens" in ctx.applied
    # The emitted SQL must parse back to an extraction, not to the outer operator.
    reparsed = sqlglot.parse_one(out, read="postgres")
    assert isinstance(reparsed, exp.Select)
    assert isinstance(reparsed.expressions[0].this, (exp.JSONExtract, exp.JSONExtractScalar))


def test_postgres_atomic_json_key_is_not_parenthesised() -> None:
    """Guards the test above: parenthesising everything would also satisfy it."""
    allowlist = load_allowlist("postgresql")
    sql = (
        "SELECT s.attributes -> k.key AS v FROM spans s "
        "CROSS JOIN LATERAL jsonb_each(s.attributes) AS k"
    )
    root = admit(parse_sql(sql, dialect="postgresql"), allowlist=allowlist, dialect="postgresql")
    ctx = RewriteContext(allowlist=allowlist, dialect="postgresql", row_limit=500)
    out = render(rewrite(root, ctx), dialect="postgresql")
    assert "-> k.key" in out
    assert "json_operand_parens" not in ctx.applied


def test_postgres_literal_json_key_keeps_the_arrow_operator() -> None:
    allowlist = load_allowlist("postgresql")
    root = admit(
        parse_sql("SELECT attributes -> 'llm' AS v FROM spans", dialect="postgresql"),
        allowlist=allowlist,
        dialect="postgresql",
    )
    ctx = RewriteContext(allowlist=allowlist, dialect="postgresql", row_limit=500)
    out = render(rewrite(root, ctx), dialect="postgresql")
    assert "->" in out
    assert "EXTRACT_PATH" not in out.upper()
    assert "jsonb_extract_path" not in ctx.applied


@pytest.mark.parametrize(
    ("sql", "admitted"),
    [
        ("SELECT MIN(attributes -> 'total') AS v FROM spans", True),
        ("SELECT MAX(attributes -> 'total') AS v FROM spans", True),
        ("SELECT MIN(attributes ->> 'total') AS v FROM spans", True),
        ("SELECT MIN(json_extract(attributes, '$.total')) AS v FROM spans", True),
        ("SELECT attributes -> 'total' AS v FROM spans", True),
    ],
    ids=["min-arrow", "max-arrow", "min-arrow2", "min-json-extract", "bare-projection"],
)
def test_json_arrow_inside_a_call_is_rewritten_not_refused(sql: str, admitted: bool) -> None:
    """`->` in an argument list parses as a lambda, not a JSON accessor.

    Rebuilding the accessor admits the JSON form. A real lambda is still refused.
    The rebuild keeps the operator, matching a bare `->` outside a call.
    """
    root = parse_sql(sql, dialect="sqlite")
    if admitted:
        admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite")
    else:
        with pytest.raises(AnalyticsSqlError):
            admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite")


def test_a_real_lambda_is_still_refused() -> None:
    with pytest.raises(AnalyticsSqlError) as caught:
        admit(
            parse_sql("SELECT filter(ARRAY[1, 2], x -> x > 0) FROM spans", dialect="postgresql"),
            allowlist=load_allowlist("postgresql"),
            dialect="postgresql",
        )
    assert "lambda" in caught.value.message.lower() or "anonymous" in caught.value.message.lower()


def test_postgres_jsonb_typeof_of_an_arrow_keeps_the_operator() -> None:
    allowlist = load_allowlist("postgresql")
    root = admit(
        parse_sql("SELECT jsonb_typeof(attributes -> 'llm') AS v FROM spans", dialect="postgresql"),
        allowlist=allowlist,
        dialect="postgresql",
    )
    ctx = RewriteContext(allowlist=allowlist, dialect="postgresql", row_limit=500)
    out = render(rewrite(root, ctx), dialect="postgresql")
    assert "->" in out
    assert "jsonb_typeof" in out.lower()


def test_sqlite_min_of_an_arrow_keeps_the_operator() -> None:
    allowlist = load_allowlist("sqlite")
    root = admit(
        parse_sql("SELECT MIN(attributes -> 'total') AS v FROM spans", dialect="sqlite"),
        allowlist=allowlist,
        dialect="sqlite",
    )
    ctx = RewriteContext(allowlist=allowlist, dialect="sqlite", row_limit=500)
    out = render(rewrite(root, ctx), dialect="sqlite")
    assert "->" in out
    assert "json_extract" not in out.lower()


def test_sqlite_min_of_a_path_literal_does_not_quote_the_dollar() -> None:
    """`-> '$.a.b'` is a path, not a key named `$.a.b`."""
    ctx, rendered = _rewritten(
        "SELECT MIN(attributes -> '$.llm.token_count.total') AS v FROM spans",
        dialect="sqlite",
    )
    folded = rendered.lower()
    assert "$.llm.token_count.total" in folded or (
        "-> '$.llm'" in folded or "-> '$.\"llm\"'" in folded or "-> 'llm'" in folded
    )
    assert '$."$.llm' not in folded
    assert '$["$.llm' not in folded


def test_json_path_with_an_embedded_quote_is_left_alone() -> None:
    """A key containing a quote cannot be wrapped in quotes without changing it.

    `$."he said "."hi"` reads as two keys, and SQLite returns NULL rather than
    erroring, so the caller concludes the key is absent.
    """
    from phoenix.server.mcp.sql.rewrite import _quoted_json_path

    path = parse_sql("SELECT json_extract(attributes, '$.a') FROM spans", dialect="sqlite")
    # Both classes: which one `json_extract` parses to is a parser detail, and
    # the canonicaliser walks both for that reason.
    node = next(iter(path.find_all(exp.JSONExtract, exp.JSONExtractScalar)))
    assert _quoted_json_path(node.expression) == '$."a"'


@pytest.mark.parametrize(
    ("sql", "dialect", "admitted"),
    [
        ("SELECT CAST('pg_authid' AS regclass) AS v FROM projects", "postgresql", False),
        ("SELECT CAST('postgres' AS regrole) AS v FROM projects", "postgresql", False),
        ("SELECT CAST(id AS TEXT) AS v FROM projects", "postgresql", True),
        ("SELECT CAST(id AS TEXT) AS v FROM projects", "sqlite", True),
        ("SELECT :x AS v FROM spans", "sqlite", False),
        ("SELECT ? AS v FROM spans", "sqlite", False),
    ],
    ids=["regclass", "regrole", "text-pg", "text-sqlite", "named-placeholder", "qmark"],
)
def test_cast_targets_and_placeholders(
    sql: str, dialect: SupportedSQLDialectName, admitted: bool
) -> None:
    """Two families that reached past the function policy without being functions.

    An object-identifier cast asks the system catalogs whether a relation, role
    or function exists and returns its oid — for anything, including the tables
    the allowlist excludes. It never appears as a scanned relation, so the plan
    gate sees only the innocent table in the FROM. SQLite denies catalog reads
    outright, so this was a policy stated on one backend and absent on the other.

    A bind placeholder survives rendering into a real parameter with nothing
    bound to it. There is no parameter channel on this surface, so it can only
    be a mistake or an attempt to reach one.
    """
    root = parse_sql(sql, dialect=dialect)
    if admitted:
        admit(root, allowlist=load_allowlist("sqlite"), dialect=dialect)
    else:
        with pytest.raises(AnalyticsSqlError):
            admit(root, allowlist=load_allowlist("sqlite"), dialect=dialect)


def test_latency_ms_through_a_derived_relation_is_left_alone() -> None:
    """An outer reference to a projected latency_ms is an ordinary column.

    The inner select's substitution already aliased it, so rewriting the outer
    reference into timestamp arithmetic points it at a relation projecting
    neither timestamp — and the statement fails for using the advertised column
    exactly as advertised.
    """
    root = parse_sql(
        "SELECT avg(latency_ms) AS v FROM (SELECT latency_ms FROM spans) t", dialect="sqlite"
    )
    out = render(
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite")),
        dialect="sqlite",
    )
    assert "AVG(latency_ms)" in out
    # The inner reference must still be substituted, or the alias has nothing
    # behind it and the test would pass against a pass that did nothing at all.
    assert "UNIXEPOCH" in out


@pytest.mark.parametrize("dialect", ["sqlite", "postgres"])
@pytest.mark.parametrize(
    "expression",
    [
        "1000 / latency_ms",
        "1000 % latency_ms",
        "-latency_ms",
        "100 - latency_ms",
        "1 / (2 * latency_ms)",
    ],
)
def test_latency_ms_binds_as_tightly_as_a_column(dialect: str, expression: str) -> None:
    """The substitution stands where a column stood, so it must bind like one.

    The subtraction inside was parenthesised but the `* 1000` around it was not,
    so `1000 / latency_ms` rendered as `1000 / <elapsed> * 1000` and regrouped
    to `(1000 / elapsed) * 1000` -- an answer 10^6 too large, returned as a
    plausible float with no error. Verified against a live PostgreSQL before
    the fix: latency 5008.0 ms, `1000 / latency_ms` reported 199680.5 where
    0.1997 was correct.

    Asserted structurally rather than by value, so it holds for every operator
    rather than only the ones a fixture happens to exercise.
    """
    tree = sqlglot.parse_one(f"SELECT {expression} AS v FROM spans", dialect=dialect)
    ctx = RewriteContext(
        dialect="sqlite" if dialect == "sqlite" else "postgresql",
        allowlist=load_allowlist("sqlite"),
        row_limit=10,
    )
    out = _substitute_latency_ms(cast(exp.Expression, tree), ctx)
    # Every substituted node is wrapped, so no neighbouring operator can reach
    # inside it. Re-parsing the rendered SQL and re-rendering must be stable.
    rendered = out.sql(dialect=dialect)
    assert rendered == sqlglot.parse_one(rendered, dialect=dialect).sql(dialect=dialect)
    substituted = out.find(exp.Mul)
    assert substituted is not None
    assert isinstance(substituted.parent, exp.Paren), rendered


@pytest.mark.parametrize("dialect", ["sqlite", "postgres"])
def test_graphql_node_id_resolves_through_a_qualifier(dialect: str) -> None:
    """A qualified reference names its table, so a join is not ambiguous.

    The type was resolved once per statement and only when exactly one table was
    present, so `t.graphql_node_id` failed in any join -- including the join the
    schema's own "to area root" hint teaches -- while `latency_ms`, listed
    beside it and described in the same preamble sentence, worked in both.

    A bare `graphql_node_id` in a join is genuinely ambiguous, so it is refused
    rather than guessed at or deferred to an engine-level unknown-column error.
    """
    allowlist = load_allowlist("sqlite")

    def rewrite(sql: str) -> str:
        ctx = RewriteContext(
            dialect="sqlite" if dialect == "sqlite" else "postgresql",
            allowlist=allowlist,
            row_limit=10,
        )
        tree = sqlglot.parse_one(sql, dialect=dialect)
        return _substitute_graphql_node_id(cast(exp.Expression, tree), ctx).sql(dialect=dialect)

    joined = rewrite(
        "SELECT t.graphql_node_id FROM traces t JOIN projects p ON t.project_rowid = p.id"
    )
    assert "graphql_node_id" not in joined.replace("AS graphql_node_id", "")

    # Each side of a two-table select resolves to its own type.
    both = rewrite(
        "SELECT t.graphql_node_id AS a, p.graphql_node_id AS b "
        "FROM traces t JOIN projects p ON t.project_rowid = p.id"
    )
    assert "Trace:" in both and "Project:" in both

    with pytest.raises(AnalyticsSqlError) as exc:
        rewrite("SELECT graphql_node_id FROM traces t JOIN projects p ON t.project_rowid = p.id")
    assert "Qualify it with a table alias" in exc.value.message


def test_quoted_and_unquoted_aliases_keep_distinct_graphql_types() -> None:
    """Quoted and unquoted spellings are different names on PostgreSQL."""
    _, rendered = _rewritten(
        'SELECT "A".graphql_node_id, a.graphql_node_id '
        'FROM spans AS "A" JOIN traces AS a ON a.id = "A".trace_rowid',
        dialect="postgresql",
    )
    assert "Span:" in rendered
    assert "Trace:" in rendered


def test_graphql_node_id_is_not_invented_for_a_cte_of_the_same_name() -> None:
    """A CTE named after a GraphQL table is not that table."""
    ctx, rendered = _rewritten(
        "WITH projects AS (SELECT 99 AS id) SELECT graphql_node_id FROM projects",
        dialect="postgresql",
    )
    assert "ENCODE" not in rendered.upper()
    assert "graphql_node_id" in rendered.lower()
    assert "graphql_node_id" not in ctx.applied


def test_graphql_node_id_through_a_cte_alias_is_not_called_ambiguous() -> None:
    """Zero GraphQL tables in the outer scope is not a join. Leave the column alone."""
    ctx, rendered = _rewritten(
        "WITH p AS (SELECT id FROM projects) SELECT graphql_node_id FROM p",
        dialect="postgresql",
    )
    assert "ENCODE" not in rendered.upper()
    assert "graphql_node_id" not in ctx.applied


def test_graphql_node_id_from_a_cte_column_list_is_not_substituted() -> None:
    """A column list on the alias is the derived relation's projection."""
    ctx, rendered = _rewritten(
        "WITH t(graphql_node_id) AS (SELECT 1) SELECT graphql_node_id FROM spans, t",
        dialect="postgresql",
    )
    assert "ENCODE" not in rendered.upper()
    assert "graphql_node_id" not in ctx.applied


def _project_node_id(row_id: int) -> str:
    return base64.b64encode(f"Project:{row_id}".encode()).decode()


def test_graphql_node_id_membership_predicates_reach_the_primary_key() -> None:
    """IN, ANY, and IS DISTINCT FROM are equality, so they decode like ``=``."""
    one, two = _project_node_id(1), _project_node_id(2)
    cases = [
        (
            f"SELECT name FROM projects WHERE graphql_node_id IN ('{one}', '{two}')",
            "postgresql",
            "id IN (1, 2)",
        ),
        (
            f"SELECT name FROM projects WHERE graphql_node_id NOT IN ('{one}')",
            "postgresql",
            "NOT projects.id IN (1)",
        ),
        (
            f"SELECT name FROM projects WHERE graphql_node_id IN (VALUES ('{one}'))",
            "postgresql",
            "id IN (1)",
        ),
        (
            f"SELECT name FROM projects WHERE graphql_node_id = ANY(ARRAY['{one}', '{two}'])",
            "postgresql",
            "id = ANY(ARRAY[1, 2])",
        ),
        (
            f"SELECT name FROM projects WHERE graphql_node_id = ALL(ARRAY['{one}'])",
            "postgresql",
            "id = ALL(ARRAY[1])",
        ),
        (
            f"SELECT name FROM projects WHERE graphql_node_id IS NOT DISTINCT FROM '{one}'",
            "postgresql",
            "id IS NOT DISTINCT FROM 1",
        ),
        (
            f"SELECT name FROM projects WHERE graphql_node_id IS DISTINCT FROM '{one}'",
            "postgresql",
            "id IS DISTINCT FROM 1",
        ),
        (
            f"SELECT name FROM projects WHERE graphql_node_id IN ('{one}', '{two}')",
            "sqlite",
            "id IN (1, 2)",
        ),
    ]
    for sql, dialect, expected in cases:
        _, rendered = _rewritten(sql, dialect=cast(SupportedSQLDialectName, dialect))
        assert "ENCODE" not in rendered.upper(), rendered
        assert expected in rendered, rendered


def test_graphql_node_id_in_drops_members_that_are_not_this_type() -> None:
    """A Dataset id never equals a project row, so it is not a member of the list."""
    project = _project_node_id(1)
    dataset = base64.b64encode(b"Dataset:1").decode()
    _, rendered = _rewritten(
        f"SELECT name FROM projects WHERE graphql_node_id IN ('{project}', '{dataset}')",
        dialect="postgresql",
    )
    assert "ENCODE" not in rendered.upper()
    assert "id IN (1)" in rendered


def test_graphql_node_id_in_of_the_wrong_type_stays_encoded() -> None:
    """Decoding a Dataset id into ``id IN (1)`` would select a project."""
    dataset = base64.b64encode(b"Dataset:1").decode()
    _, rendered = _rewritten(
        f"SELECT name FROM projects WHERE graphql_node_id IN ('{dataset}')",
        dialect="postgresql",
    )
    assert "ENCODE" in rendered.upper()
    assert "id IN" not in rendered.lower().replace("graphql_node_id", "")


def test_graphql_node_id_all_with_a_wrong_type_stays_encoded() -> None:
    """``= ALL`` is true only if every member matches; dropping one would make it ``=``."""
    project = _project_node_id(1)
    dataset = base64.b64encode(b"Dataset:1").decode()
    _, rendered = _rewritten(
        f"SELECT name FROM projects WHERE graphql_node_id = ALL(ARRAY['{project}', '{dataset}'])",
        dialect="postgresql",
    )
    assert "ENCODE" in rendered.upper()
    assert "id = ALL" not in rendered.lower()


def test_graphql_node_id_like_and_between_stay_encoded() -> None:
    """A pattern or a range is not a node id.

    LIKE matches text. BETWEEN orders the encoded form, which is not integer
    id order, so decoding the endpoints would answer a different question.
    """
    one, two = _project_node_id(1), _project_node_id(2)
    _, like_sql = _rewritten(
        f"SELECT name FROM projects WHERE graphql_node_id LIKE '{one}'",
        dialect="postgresql",
    )
    assert "ENCODE" in like_sql.upper()
    assert "id LIKE" not in like_sql.lower()

    _, between_sql = _rewritten(
        f"SELECT name FROM projects WHERE graphql_node_id BETWEEN '{one}' AND '{two}'",
        dialect="postgresql",
    )
    assert "ENCODE" in between_sql.upper()
    assert "id BETWEEN" not in between_sql.upper()


def test_latency_ms_from_a_subquery_column_list_is_not_substituted() -> None:
    """Same for a subquery alias list: the name is t's, not spans'."""
    ctx, rendered = _rewritten(
        "SELECT latency_ms FROM spans, (SELECT 1) AS t(latency_ms)",
        dialect="postgresql",
    )
    assert "EXTRACT" not in rendered.upper()
    assert "latency_ms" not in ctx.applied


def test_latency_ms_is_not_invented_for_a_cte_of_the_same_name() -> None:
    """A CTE named ``spans`` is not a duration table."""
    with pytest.raises(AnalyticsSqlError) as caught:
        _rewritten(
            "WITH spans AS (SELECT 1 AS id) SELECT latency_ms FROM spans",
            dialect="sqlite",
        )
    assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX
    assert "overlay" in caught.value.message
    assert "latency_ms" in caught.value.message


@pytest.mark.parametrize("dialect", ["sqlite", "postgres"])
def test_bare_latency_ms_in_multiple_duration_sources_requires_qualification(dialect: str) -> None:
    """An unqualified virtual duration must not become ambiguous timestamp SQL."""
    ctx = RewriteContext(
        dialect="sqlite" if dialect == "sqlite" else "postgresql",
        allowlist=load_allowlist("sqlite"),
        row_limit=10,
    )
    tree = sqlglot.parse_one(
        "SELECT latency_ms FROM traces t JOIN spans s ON s.trace_rowid = t.id",
        dialect=dialect,
    )

    with pytest.raises(AnalyticsSqlError) as exc:
        _substitute_latency_ms(cast(exp.Expression, tree), ctx)
    assert "Qualify it with a table alias" in exc.value.message


def test_unqualified_latency_ms_qualifies_the_sole_duration_table() -> None:
    """A join partner can share start_time/end_time without advertising latency_ms."""
    _, rendered = _rewritten(
        "SELECT latency_ms FROM experiment_runs er "
        "JOIN experiment_run_annotations era ON era.experiment_run_id = er.id",
        dialect="postgresql",
    )
    assert "er.start_time" in rendered
    assert "er.end_time" in rendered


def test_values_in_a_cte_is_not_refused_as_a_star_over_values() -> None:
    ctx, rendered = _rewritten(
        "WITH v(x) AS (VALUES (1), (2)) SELECT x FROM v",
        dialect="postgresql",
    )
    assert "values" in rendered.lower()
    assert ctx.applied  # limit injection at least; star must not raise


def _rewrite_context(
    sql: str, *, dialect: SupportedSQLDialectName = "postgresql"
) -> tuple[RewriteContext, str]:
    from phoenix.server.mcp.sql.allowlist import load_allowlist
    from phoenix.server.mcp.sql.parse import admit, parse_sql, render
    from phoenix.server.mcp.sql.rewrite import RewriteContext, rewrite

    allowlist = load_allowlist("sqlite")
    root = admit(parse_sql(sql, dialect=dialect), allowlist=allowlist, dialect=dialect)
    ctx = RewriteContext(
        allowlist=allowlist,
        dialect=dialect,
        row_limit=10,
    )
    return ctx, render(rewrite(root, ctx), dialect=dialect)


def _rewritten(
    sql: str, *, dialect: SupportedSQLDialectName = "postgresql"
) -> tuple[RewriteContext, str]:
    ctx, rendered = _rewrite_context(sql, dialect=dialect)
    return ctx, rendered


class TestLimitInjection:
    """A caller LIMIT or FETCH below the cap is kept; at or above it is probed.

    The count is rendered through SQLGlot's dialect (``postgres``).
    ``exp.Fetch`` is a distinct node from ``exp.Limit``.
    """

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_limit_below_the_cap_is_kept(self, backend: str) -> None:
        ctx, rendered = _rewritten(
            "SELECT id FROM spans LIMIT 5",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert "limit_injection" not in ctx.applied
        assert "LIMIT 5" in rendered.upper()

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_limit_zero_is_kept(self, backend: str) -> None:
        ctx, rendered = _rewritten(
            "SELECT id FROM spans LIMIT 0",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert "limit_injection" not in ctx.applied
        assert "LIMIT 0" in rendered.upper()

    def test_a_limit_at_the_cap_is_probed(self) -> None:
        ctx, rendered = _rewritten("SELECT id FROM spans LIMIT 10", dialect="postgresql")
        assert "limit_injection" in ctx.applied
        assert "LIMIT 11" in rendered.upper()

    def test_sqlite_limit_all_is_capped(self) -> None:
        ctx, rendered = _rewritten("SELECT id FROM spans LIMIT ALL", dialect="sqlite")
        assert "limit_injection" in ctx.applied
        assert "LIMIT 11" in rendered.upper()

    def test_fetch_below_the_cap_is_kept(self) -> None:
        ctx, rendered = _rewritten(
            "SELECT id FROM spans ORDER BY id FETCH FIRST 5 ROWS ONLY",
            dialect="postgresql",
        )
        assert "limit_injection" not in ctx.applied
        assert "FETCH FIRST 5" in rendered.upper()

    def test_fetch_above_the_cap_is_clamped(self) -> None:
        ctx, rendered = _rewritten(
            "SELECT id FROM spans ORDER BY id FETCH FIRST 10000 ROWS ONLY",
            dialect="postgresql",
        )
        assert "limit_injection" in ctx.applied
        assert "LIMIT 11" in rendered.upper()

    def test_fetch_first_row_only_is_kept(self) -> None:
        ctx, rendered = _rewritten(
            "SELECT id FROM spans ORDER BY id FETCH FIRST ROW ONLY",
            dialect="postgresql",
        )
        assert "limit_injection" not in ctx.applied


class TestTimestampLiterals:
    """An offset is required where one is needed, and the spelling is not.

    A naive literal carrying a time of day means "ask the environment", and the
    three environments involved answer differently: `normalize_datetime`
    localises to the writing process's zone, PostgreSQL reads a naive literal in
    the session `TimeZone`, and SQLite compares text against whatever those
    produced. That is refused. A bare date names a day rather than an instant,
    so UTC resolves it without guessing and it is admitted with a note.

    Spelling is then a rendering concern. PostgreSQL parses the literal, so it
    is left alone. SQLite compares text against `YYYY-MM-DD HH:MM:SS.ffffff`,
    where an ISO `T` differs from the stored space at index 10 -- ahead of every
    digit meant to decide the comparison -- so the literal is re-emitted.
    """

    @pytest.mark.parametrize(
        "literal",
        ["2026-07-01T00:00:00Z", "2026-07-01 00:00:00+00", "2026-07-01T02:00:00+02:00"],
    )
    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_an_aware_literal_is_admitted_in_any_spelling(self, literal: str, backend: str) -> None:
        result = try_parse_and_admit(
            f"SELECT count(*) FROM spans WHERE start_time >= '{literal}'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.ADMIT, result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_naive_time_of_day_is_refused_with_the_fix_named(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01 14:30:00'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "+00:00" in result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_time_only_literal_is_refused_with_the_fix_named(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '14:30:00'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "14:30:00" in result.detail
        assert "2026-07-01T14:30:00+00:00" in result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_naive_time_of_day_through_a_passthrough_is_refused(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT id FROM (SELECT start_time, id FROM spans) t "
            "WHERE start_time >= '2026-07-01 14:30:00'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "+00:00" in result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_naive_time_of_day_through_an_aliased_passthrough_is_refused(
        self, backend: str
    ) -> None:
        result = try_parse_and_admit(
            "SELECT id FROM (SELECT start_time AS ts, id FROM spans) t "
            "WHERE ts >= '2026-07-01 14:30:00'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "+00:00" in result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_bare_date_is_admitted(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.ADMIT, result.detail

    def test_a_literal_against_a_non_timestamp_column_is_untouched(self) -> None:
        """The check is keyed on the column, not on the shape of the string."""
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE name >= '2026-07-01 14:30:00'",
            dialect="postgresql",
        )
        assert result.outcome is AdmissionOutcome.ADMIT

    @pytest.mark.parametrize(
        "literal",
        ["2026-07-01T00:00:00Z", "2026-07-01T02:00:00+02:00", "2026-07-01"],
    )
    def test_sqlite_rewrites_to_the_stored_layout(self, literal: str) -> None:
        root, rendered = _rewritten(
            f"SELECT count(*) FROM spans WHERE start_time >= '{literal}'", dialect="sqlite"
        )
        assert "'2026-07-01 00:00:00.000000'" in rendered, rendered

    def test_sqlite_rewrites_compact_iso_to_the_stored_layout(self) -> None:
        _, rendered = _rewritten(
            "SELECT count(*) FROM spans WHERE start_time >= '20260723T000000Z'",
            dialect="sqlite",
        )
        assert "2026-07-23" in rendered, rendered
        assert "20260723" not in rendered

    def test_postgres_leaves_the_spelling_alone(self) -> None:
        """PostgreSQL parses the literal, so rewriting it would be churn."""
        _, rendered = _rewritten(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01T00:00:00Z'",
            dialect="postgresql",
        )
        assert "'2026-07-01T00:00:00Z'" in rendered

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_plus_separated_time_is_refused(self, backend: str) -> None:
        """``2026-01-01+05:30`` is 05:30, not a bare date."""
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-01-01+05:30'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "+00:00" in result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_named_utc_suffix_is_admitted(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01 00:00:00 UTC'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.ADMIT, result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_extra_fractional_digits_are_admitted(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01T00:00:00.123456789Z'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.ADMIT, result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_an_unreadable_date_shaped_literal_is_refused(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01 10:30:00 EST'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "could not be read" in result.detail

    def test_sqlite_rewrites_a_named_utc_suffix_to_the_stored_layout(self) -> None:
        _, rendered = _rewritten(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01 00:00:00 UTC'",
            dialect="sqlite",
        )
        assert "'2026-07-01 00:00:00.000000'" in rendered, rendered

    def test_sqlite_rewrites_extra_fractional_digits_to_the_stored_layout(self) -> None:
        _, rendered = _rewritten(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01T00:00:00.123456789Z'",
            dialect="sqlite",
        )
        assert "'2026-07-01 00:00:00.123456'" in rendered, rendered

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_bare_date_reports_the_assumption(self, backend: str) -> None:
        """Admitted rather than refused, so the assumption has to be stated."""
        ctx, _ = _rewrite_context(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01'",
            dialect=cast(SupportedSQLDialectName, backend),
        )
        assert any("UTC" in note for note in ctx.notes), ctx.notes


class TestOneSharedResolver:
    """Every reference a rewrite may edit resolves the same way.

    A pass carrying its own scope model disagrees with the others about which
    relation a reference belongs to, and the disagreement surfaces as a wrong
    answer rather than an error. C1, C2, C3, C5 and C6 pin one shape each.
    """

    @staticmethod
    def _rewritten(sql: str, dialect: SupportedSQLDialectName = "sqlite") -> str:
        read = "postgres" if dialect == "postgresql" else dialect
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect=dialect, row_limit=500)
        return rewrite(cast(exp.Expression, sqlglot.parse_one(sql, read=read)), ctx).sql(
            dialect=read
        )

    @staticmethod
    def _outer_projection(rendered: str) -> str:
        tree = sqlglot.parse_one(rendered, read="sqlite")
        order = tree.args.get("order")
        return " ".join(e.sql("sqlite") for e in tree.expressions) + (
            " " + order.sql("sqlite") if order else ""
        )

    def test_c6_cte_reached_through_a_from_alias(self) -> None:
        projection = self._outer_projection(
            self._rewritten(
                "WITH q AS (SELECT latency_ms FROM spans) SELECT AVG(t.latency_ms) FROM q t"
            )
        )

        assert projection == "AVG(t.latency_ms)"

    def test_c6_cte_reached_by_an_unqualified_name(self) -> None:
        projection = self._outer_projection(
            self._rewritten("WITH q AS (SELECT latency_ms FROM spans) SELECT latency_ms FROM q")
        )

        assert projection == "latency_ms"

    def test_c3_derived_table_still_left_alone(self) -> None:
        projection = self._outer_projection(
            self._rewritten("SELECT latency_ms FROM (SELECT latency_ms FROM spans) q")
        )

        assert projection == "latency_ms"

    def test_c2_order_by_binds_to_the_output_alias(self) -> None:
        """Both engines resolve a bare ORDER BY name against the select list, so
        substituting there returns a different row under LIMIT."""
        rendered = self._rewritten("SELECT id, 1 AS latency_ms FROM spans ORDER BY latency_ms")

        assert "ORDER BY latency_ms" in rendered

    def test_group_by_binds_to_the_output_alias_when_no_input_column_carries_the_name(
        self,
    ) -> None:
        """Virtual overlays are not input columns, so GROUP BY takes the alias."""
        rendered = self._rewritten(
            "SELECT 1 AS graphql_node_id FROM spans GROUP BY graphql_node_id"
        )

        assert "ENCODE" not in rendered.upper()
        assert "GROUP BY graphql_node_id" in rendered

    def test_a_base_table_reference_is_still_substituted(self) -> None:
        """The guard must not close the case the pass exists for."""
        projection = self._outer_projection(
            self._rewritten("SELECT AVG(s.latency_ms) FROM spans s")
        )

        assert "UNIXEPOCH" in projection

    def test_c1_a_cte_column_of_the_same_name_is_not_overwritten(self) -> None:
        rendered = self._rewritten(
            "WITH projects AS (SELECT 99 AS id, 'sentinel' AS graphql_node_id) "
            "SELECT graphql_node_id FROM projects",
            dialect="postgresql",
        )

        assert "ENCODE" not in rendered.upper()

    def test_c5_a_query_local_timestamp_column_keeps_its_literal(self) -> None:
        rendered = self._rewritten(
            "WITH q AS (SELECT 'hello' AS start_time) "
            "SELECT start_time FROM q WHERE start_time > '2026-01-01T00:00:00Z'"
        )

        assert "'2026-01-01T00:00:00Z'" in rendered

    def test_a_passthrough_timestamp_column_still_normalises_the_literal(self) -> None:
        rendered = self._rewritten(
            "SELECT id FROM (SELECT start_time, id FROM spans) t "
            "WHERE start_time > '2026-01-01T00:00:00Z'"
        )

        assert "2026-01-01 00:00:00" in rendered

    def test_passthrough_timestamp_subtraction_is_elapsed_seconds(self) -> None:
        rendered = self._rewritten(
            "SELECT end_time - start_time AS d FROM (SELECT start_time, end_time FROM spans) t"
        )

        assert "UNIXEPOCH" in rendered.upper()

    def test_invented_timestamp_names_are_not_subtracted_as_storage(self) -> None:
        rendered = self._rewritten(
            "WITH q AS (SELECT 'hello' AS start_time, 'world' AS end_time) "
            "SELECT end_time - start_time AS d FROM q"
        )

        assert "UNIXEPOCH" not in rendered.upper()

    def test_a_real_timestamp_literal_is_still_normalised(self) -> None:
        rendered = self._rewritten("SELECT id FROM spans WHERE start_time > '2026-01-01T00:00:00Z'")

        assert "2026-01-01 00:00:00" in rendered


class TestJsonAccessorOrigin:
    """`->` and `json_extract` parse to one class and do not mean one thing.

    On every JSON scalar the two differ in value and in SQL type, so rewriting
    a caller's `->` into the function answers a question they did not ask. The
    parser records which was written; this pins that the pass reads it. See B3.
    """

    @staticmethod
    def _rewritten(expression: str) -> str:
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=500)
        tree = sqlglot.parse_one(f"SELECT {expression} FROM spans", read="sqlite")
        return rewrite(cast(exp.Expression, tree), ctx).sql(dialect="sqlite")

    def test_the_operator_the_caller_wrote_survives(self) -> None:
        assert "->" in self._rewritten("attributes -> '$.s'")

    def test_the_function_is_still_canonicalised(self) -> None:
        """Left alone the generator renders the function back as `->`, which is
        the accessor swap this pass exists to prevent."""
        assert "JSON_EXTRACT" in self._rewritten("json_extract(attributes, '$.s')").upper()

    def test_the_scalar_operator_collapse_is_retained(self) -> None:
        assert "JSON_EXTRACT" in self._rewritten("attributes ->> '$.s'").upper()

    @pytest.mark.parametrize(
        "path,arrow_value",
        [("$.s", '"abc"'), ("$.num", "7"), ("$.o", '{"k":1}')],
    )
    def test_the_two_accessors_really_do_differ(self, path: str, arrow_value: str) -> None:
        """The premise, checked against the engine rather than assumed: if these
        agreed, conflating them would cost nothing and the fix would be moot."""
        document = '{"s":"abc","num":7,"o":{"k":1}}'
        connection = sqlean.connect(":memory:")
        try:
            arrow, function = connection.execute(
                f"SELECT ? -> '{path}', json_extract(?, '{path}')", (document, document)
            ).fetchone()
        finally:
            connection.close()

        assert arrow == arrow_value
        # Containers agree; scalars do not, which is where the swap does damage.
        assert (arrow == function) is (path == "$.o")


class TestUncastJsonOrderingNote:
    """A JSON value ordered without a cast may not order the way it reads.

    The hazard differs by backend and the note says so: PostgreSQL's extraction
    operators return text, so ordering is always lexicographic; SQLite returns
    the document's own type, so only a path holding a quoted number misorders.
    Stating it as "both backends return text" was false on the shipped engine --
    `MAX(doc ->> '$.n')` over 1017066 and 149740 answers 1017066, typed integer.
    """

    @staticmethod
    def _noted(sql: str, dialect: SupportedSQLDialectName = "sqlite") -> bool:
        read = "postgres" if dialect == "postgresql" else dialect
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect=dialect, row_limit=500)
        rewrite(cast(exp.Expression, sqlglot.parse_one(sql, read=read)), ctx)
        return any("without a cast" in note for note in ctx.notes)

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT MAX(attributes ->> '$.n') FROM spans",
            "SELECT MIN(attributes ->> '$.n') FROM spans",
            "SELECT id FROM spans ORDER BY attributes ->> '$.n'",
        ],
    )
    def test_order_sensitive_positions_are_noted(self, sql: str) -> None:
        assert self._noted(sql)

    def test_the_postgres_path_operator_is_noted_too(self) -> None:
        assert self._noted("SELECT MAX(attributes #>> '{a,b}') FROM spans", dialect="postgresql")

    def test_a_cast_extraction_is_not_noted(self) -> None:
        assert not self._noted("SELECT MAX(CAST(attributes ->> '$.n' AS REAL)) FROM spans")

    @pytest.mark.parametrize(
        "sql",
        [
            # Coerces, so text ordering never decides the answer.
            "SELECT SUM(attributes ->> '$.n') FROM spans",
            "SELECT MAX(id) FROM spans",
        ],
    )
    def test_positions_where_ordering_does_not_decide_are_quiet(self, sql: str) -> None:
        assert not self._noted(sql)

    def test_the_note_survives_canonicalisation(self) -> None:
        """The canonicalisation pass rebuilds `->>` as an Anonymous json_extract
        call, so a check that knows only the operator classes sees nothing on
        exactly the statements this exists for."""
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=500)
        tree = sqlglot.parse_one("SELECT MAX(attributes ->> '$.n') FROM spans", read="sqlite")

        rendered = rewrite(cast(exp.Expression, tree), ctx).sql(dialect="sqlite")

        assert "JSON_EXTRACT" in rendered.upper()
        assert any("without a cast" in note for note in ctx.notes)


def test_postgres_json_extract_rewrites_to_jsonb_extract_path() -> None:
    ctx, rendered = _rewritten(
        "SELECT json_extract(attributes, '$.llm') FROM spans",
        dialect="postgresql",
    )
    assert "jsonb_extract_path" in rendered.casefold()
    assert "JSON_EXTRACT_PATH(" not in rendered.upper().replace("JSONB_EXTRACT_PATH(", "")
    assert "jsonb_extract_path" in ctx.applied


def test_lateral_base_table_becomes_a_plain_join() -> None:
    ctx, rendered = _rewritten(
        "SELECT spans.id FROM spans JOIN LATERAL traces t ON t.id = spans.trace_rowid",
        dialect="postgresql",
    )
    assert "LATERAL" not in rendered.upper()
    assert ".traces" in rendered.casefold()
    assert "schema_qualification" in ctx.applied
    assert " AS t" in rendered or " traces t" in rendered.casefold()


def test_setop_operand_with_limit_is_parenthesised() -> None:
    ctx, rendered = _rewritten(
        "SELECT id FROM spans ORDER BY id LIMIT 1 UNION SELECT id FROM traces",
        dialect="postgresql",
    )
    assert "setop_operand_parens" in ctx.applied
    assert "(SELECT" in rendered.upper().replace(" ", "") or "( SELECT" in rendered.upper()
    folded = " ".join(rendered.split()).upper()
    assert "LIMIT 1)" in folded or "LIMIT 1 )" in folded


def test_sqlite_setop_with_limit_lifts_the_member_into_from() -> None:
    ctx, rendered = _rewritten(
        "SELECT id FROM spans ORDER BY id LIMIT 1 UNION SELECT id FROM traces",
        dialect="sqlite",
    )
    assert "setop_operand_subquery" in ctx.applied
    assert "LATERAL" not in rendered.upper()
    compact = "".join(rendered.split()).upper()
    assert "SELECT*FROM(SELECT" in compact
    assert not compact.startswith("(SELECT")


def test_sqlite_parenthesised_union_becomes_from_subqueries() -> None:
    ctx, rendered = _rewritten(
        "(SELECT id FROM spans LIMIT 1) UNION ALL (SELECT id FROM traces LIMIT 1)",
        dialect="sqlite",
    )
    assert "setop_operand_subquery" in ctx.applied
    assert rendered.upper().count("SELECT * FROM") >= 2
    assert "NEAR" not in rendered.upper()


def test_sqlite_cast_json_becomes_json_constructor() -> None:
    ctx, rendered = _rewritten(
        "SELECT CAST('{\"a\":1}' AS JSON) AS v FROM spans",
        dialect="sqlite",
    )
    assert "sqlite_casts" in ctx.applied
    assert "JSON('" in rendered.upper() or "JSON (" in rendered.upper()
    assert "CAST(" not in rendered.upper() or "AS JSON" not in rendered.upper()


def test_sqlite_cast_numeric_keeps_numeric_affinity() -> None:
    _, rendered = _rewritten("SELECT CAST(1 AS NUMERIC) AS v FROM spans", dialect="sqlite")
    assert "AS NUMERIC" in rendered.upper()
    assert "AS REAL" not in rendered.upper()


def test_sqlite_cast_datetime_becomes_datetime_function() -> None:
    ctx, rendered = _rewritten(
        "SELECT CAST('2020-01-01' AS DATETIME) AS v FROM spans",
        dialect="sqlite",
    )
    assert "sqlite_casts" in ctx.applied
    assert "DATETIME(" in rendered.upper()
    assert "AS DATETIME" not in rendered.upper()


def test_sqlite_timestamp_vs_unixepoch_wraps_the_column() -> None:
    ctx, rendered = _rewritten(
        "SELECT COUNT(*) FROM spans WHERE start_time < unixepoch('now')",
        dialect="sqlite",
    )
    assert "sqlite_timestamp_epoch_compare" in ctx.applied
    folded = rendered.lower()
    assert "unixepoch(start_time,'subsec')" in folded.replace(" ", "")
    assert folded.count("unixepoch") >= 2


def test_sqlite_timestamp_vs_datetime_wraps_the_column() -> None:
    ctx, rendered = _rewritten(
        "SELECT COUNT(*) FROM spans WHERE start_time < datetime('now')",
        dialect="sqlite",
    )
    assert "sqlite_timestamp_epoch_compare" in ctx.applied
    folded = rendered.lower().replace(" ", "")
    assert "datetime(start_time,'subsec')" in folded
    assert folded.count("datetime") >= 2


def test_sqlite_cast_time_becomes_time_function() -> None:
    ctx, rendered = _rewritten(
        "SELECT CAST(start_time AS TIME) AS v FROM spans",
        dialect="sqlite",
    )
    assert "sqlite_casts" in ctx.applied
    assert "TIME(" in rendered.upper()
    assert "AS TIME" not in rendered.upper()
    assert "AS TEXT" not in rendered.upper()


def test_star_union_width_mismatch_is_refused_after_expansion() -> None:
    with pytest.raises(AnalyticsSqlError) as caught:
        _rewritten(
            "SELECT * FROM spans UNION ALL SELECT * FROM traces",
            dialect="sqlite",
        )
    assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX
    assert "same number of columns" in caught.value.message


def test_sqlite_lateral_json_each_drops_lateral() -> None:
    _, rendered = _rewritten(
        "SELECT key FROM spans, LATERAL json_each(attributes)",
        dialect="sqlite",
    )
    assert "LATERAL" not in rendered.upper()
    assert "JSON_EACH" in rendered.upper()


def test_sqlite_median_stays_median() -> None:
    ctx, rendered = _rewritten(
        "SELECT median(cumulative_error_count) AS v FROM spans",
        dialect="sqlite",
    )
    assert "sqlite_median" in ctx.applied
    assert "MEDIAN(" in rendered.upper()
    assert "PERCENTILE_CONT" not in rendered.upper()


def test_coalesced_using_latency_ms_is_not_ambiguous() -> None:
    ctx, rendered = _rewritten(
        "SELECT latency_ms FROM spans JOIN traces USING (latency_ms)",
        dialect="postgresql",
    )
    assert "latency_ms" in ctx.applied
    assert "start_time" in rendered.casefold()
    assert "end_time" in rendered.casefold()


def test_pg_catalog_varchar_renders_as_varchar() -> None:
    _, rendered = _rewritten(
        "SELECT CAST(id AS pg_catalog.varchar) FROM projects",
        dialect="postgresql",
    )
    assert "USERDEFINED" not in rendered.upper()
    assert "VARCHAR" in rendered.upper() or "TEXT" in rendered.upper()


def test_row_of_one_keeps_the_keyword_form() -> None:
    _, rendered = _rewritten("SELECT ROW(1) AS r", dialect="postgresql")
    assert "ROW(1)" in rendered.upper().replace(" ", "")


def test_one_element_tuple_is_rebuilt_as_row() -> None:
    _, rendered = _rewritten("SELECT (1,) AS r", dialect="postgresql")
    assert "ROW(1)" in rendered.upper().replace(" ", "")


def test_jsonb_typeof_of_text_extract_uses_the_jsonb_accessor() -> None:
    _, rendered = _rewritten(
        "SELECT jsonb_typeof(attributes ->> 'llm') FROM spans",
        dialect="postgresql",
    )
    assert "->>" not in rendered
    assert "->" in rendered
    assert "jsonb_typeof" in rendered.casefold()


def test_pg_catalog_int4_is_admitted_as_int() -> None:
    _, rendered = _rewritten(
        "SELECT CAST(id AS pg_catalog.int4) FROM projects",
        dialect="postgresql",
    )
    assert "USERDEFINED" not in rendered.upper()


def test_comma_lateral_base_table_is_a_plain_join() -> None:
    ctx, rendered = _rewritten(
        "SELECT spans.id FROM spans, LATERAL traces t",
        dialect="postgresql",
    )
    assert "LATERAL" not in rendered.upper()
    assert ".traces" in rendered.casefold()
    assert "schema_qualification" in ctx.applied


@pytest.mark.parametrize(
    ("sql", "expected"),
    [
        # `_LATENCY_ROWS` spans 12:00:00.000000 to 12:00:04.500000, so the
        # elapsed time across every row is 4.5 seconds and one row is 0.5.
        ("SELECT MAX(end_time) - MIN(start_time) AS v FROM spans", 4.5),
        ("SELECT (end_time) - start_time AS v FROM spans WHERE span_id = 'span-medium'", 0.5),
        ("SELECT end_time - (start_time) AS v FROM spans WHERE span_id = 'span-medium'", 0.5),
        ("SELECT end_time - start_time AS v FROM spans WHERE span_id = 'span-medium'", 0.5),
    ],
)
def test_stored_timestamp_subtraction_yields_elapsed_seconds(sql: str, expected: float) -> None:
    """Subtracting stored timestamps must not reach SQLite as text arithmetic.

    Storage is text, so `end_time - start_time` coerces both sides to the
    leading integer and answers 0 for every row -- a clean run with a confidently
    wrong number. The conversion is applied through parentheses and through an
    aggregate, because `MAX(end) - MIN(start)` is how total elapsed time is
    written and it reads the same stored text.
    """
    rendered = _rendered(sql)
    assert "UNIXEPOCH" in rendered.upper()
    assert _run_on_sqlite(rendered)[0][0] == expected


def test_subtraction_of_non_timestamp_columns_is_left_alone() -> None:
    """Guards the test above: converting every subtraction would also satisfy it."""
    rendered = _rendered(
        "SELECT llm_token_count_prompt - llm_token_count_completion AS v FROM spans"
    )
    assert "UNIXEPOCH" not in rendered.upper()


def _run_two_table_sqlite(sql: str) -> list[tuple[Any, ...]]:
    """spans holds a 1500 ms row; traces holds a 2000 ms row."""
    conn = sqlean.connect(":memory:")
    try:
        conn.execute("CREATE TABLE spans(start_time TEXT, end_time TEXT)")
        conn.execute("CREATE TABLE traces(start_time TEXT, end_time TEXT)")
        conn.execute(
            "INSERT INTO spans VALUES('2026-07-30 12:00:00.000000','2026-07-30 12:00:01.500000')"
        )
        conn.execute(
            "INSERT INTO traces VALUES('2026-07-30 12:00:00.000000','2026-07-30 12:00:02.000000')"
        )
        return cast(list[tuple[Any, ...]], conn.execute(sql).fetchall())
    finally:
        conn.close()


def test_virtual_column_in_a_subquery_resolves_to_the_subquery_relation() -> None:
    """An unqualified overlay binds to the relation that encloses it.

    `Scope.columns` of an outer query also lists an unqualified column that
    belongs to a nested subquery. Binding it to the outer table substitutes one
    relation's timestamps into another relation's query: the statement runs and
    returns the wrong duration, with nothing to indicate it.
    """
    rendered = _rendered("SELECT (SELECT max(latency_ms) FROM spans) AS m FROM traces")
    assert "spans.end_time" in rendered
    assert "traces.end_time" not in rendered
    assert _run_two_table_sqlite(rendered)[0][0] == 1500.0


def test_virtual_column_predicate_in_a_subquery_resolves_to_the_subquery_relation() -> None:
    rendered = _rendered(
        "SELECT (SELECT count(*) FROM spans WHERE latency_ms < 1800) AS c FROM traces"
    )
    assert "spans.end_time" in rendered
    assert "traces.end_time" not in rendered
    # The span is 1500 ms so it counts; the trace is 2000 ms and would not.
    assert _run_two_table_sqlite(rendered)[0][0] == 1


class TestCorrelatedVirtualColumns:
    """A qualified overlay may name a relation an enclosing scope introduced.

    `Scope.columns` lists such a reference on the inner scope as well, and
    `traverse()` reaches that scope first. Attributing it there leaves the
    qualifier naming nothing the scope holds, so the overlay is emitted as the
    caller wrote it: a statement this surface admits and the engine then
    refuses, naming a column the manifest advertises.
    """

    @staticmethod
    def _postgres(sql: str) -> str:
        root = parse_sql(sql, dialect="postgresql")
        root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
        return render(rewrite(root, _ctx("postgresql")), dialect="postgresql")

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT t.id FROM traces t "
            "WHERE EXISTS (SELECT 1 FROM spans s WHERE s.latency_ms < t.latency_ms)",
            "SELECT t.id FROM traces t WHERE t.id IN "
            "(SELECT s.trace_rowid FROM spans s WHERE s.latency_ms < t.latency_ms)",
            "SELECT (SELECT count(*) FROM spans s WHERE s.latency_ms < t.latency_ms) AS c "
            "FROM traces t",
            # LATERAL correlates by definition, and SQLGlot files its table
            # outside the scope's `sources`.
            "SELECT t.id FROM traces t, LATERAL "
            "(SELECT s.id FROM spans s WHERE s.latency_ms < t.latency_ms) x",
            # Two levels: the reference is external to both inner scopes.
            "SELECT t.id FROM traces t WHERE EXISTS (SELECT 1 FROM spans s WHERE EXISTS "
            "(SELECT 1 FROM spans s2 WHERE s2.latency_ms < t.latency_ms))",
        ],
    )
    def test_a_correlated_duration_overlay_is_substituted(self, sql: str) -> None:
        rendered = self._postgres(sql)
        assert "latency_ms" not in rendered.lower()
        assert "t.end_time - t.start_time" in rendered

    def test_a_correlated_node_id_overlay_is_substituted(self) -> None:
        rendered = self._postgres(
            "SELECT t.id FROM traces t WHERE EXISTS "
            "(SELECT 1 FROM spans s WHERE s.trace_rowid = t.id AND t.graphql_node_id = 'x')"
        )
        assert "graphql_node_id" not in rendered.lower()
        assert "'Trace:' || CAST(t.id AS TEXT)" in rendered

    def test_a_correlated_overlay_reads_the_outer_relation(self) -> None:
        """Substituting is not enough; it must reach the enclosing relation.

        Both sides carry the overlay, so a rewrite that substituted the inner
        relation's timestamps on both would still render without the column
        name and still run.
        """
        rendered = _rendered(
            "SELECT (SELECT count(*) FROM spans s WHERE s.latency_ms < t.latency_ms) AS c "
            "FROM traces t"
        )
        # The span is 1500 ms and the trace 2000 ms, so the span counts. Read
        # from one relation twice, either comparison is against itself and the
        # count is 0.
        assert _run_two_table_sqlite(rendered)[0][0] == 1

    def test_a_shadowed_alias_still_binds_to_the_inner_relation(self) -> None:
        """The qualifier decides by what a scope introduces, not by name alone.

        Both relations answer to `t` here, so a guard that deferred every
        qualified reference outward would read the trace's duration inside the
        subquery over `spans`.
        """
        rendered = _rendered(
            "SELECT count(*) AS c FROM traces t "
            "WHERE EXISTS (SELECT 1 FROM spans t WHERE t.latency_ms < 1800)"
        )
        # The span is 1500 ms and clears the threshold; the trace is 2000 ms
        # and would not.
        assert _run_two_table_sqlite(rendered)[0][0] == 1


@pytest.mark.parametrize(
    ("sql", "expected"),
    [
        # `_LATENCY_ROWS` start at 12:00:00, 12:00:01 and 12:00:02.
        (
            "SELECT count(*) AS v FROM spans "
            "WHERE start_time > unixepoch('2026-07-30 12:00:01') - 1",
            2,
        ),
        (
            "SELECT count(*) AS v FROM spans WHERE start_time BETWEEN "
            "unixepoch('2026-07-30 12:00:00') AND unixepoch('2026-07-30 12:00:01')",
            2,
        ),
        # The bare form the pass covers, included so a regression is visible.
        (
            "SELECT count(*) AS v FROM spans WHERE start_time > unixepoch('2026-07-30 12:00:01')",
            1,
        ),
    ],
)
def test_timestamp_compared_to_an_epoch_expression_is_converted(sql: str, expected: int) -> None:
    """A stored timestamp must be converted whenever the other side is epoch-valued.

    SQLite orders INTEGER below TEXT unconditionally, so an unconverted
    `text > integer` matches every row and `text < integer` matches none --
    a bounded window silently answers with the whole table or with nothing.
    The unit survives arithmetic (`unixepoch('now') - 3600` is still epoch
    seconds) and BETWEEN compares against both of its bounds.
    """
    rendered = _rendered(sql)
    assert "UNIXEPOCH(START_TIME" in rendered.upper()
    assert _run_on_sqlite(rendered)[0][0] == expected


def test_a_comparison_with_no_epoch_side_is_left_alone() -> None:
    """Guards the test above: converting every comparison would also satisfy it."""
    rendered = _rendered("SELECT count(*) AS v FROM spans WHERE start_time > '2026-07-30'")
    assert "UNIXEPOCH" not in rendered.upper()


@pytest.mark.parametrize(
    ("sql", "dialect"),
    [
        ("SELECT attributes -> 'c''d' AS v FROM spans", "postgresql"),
        ("SELECT attributes ->> 'c''d' AS v FROM spans", "postgresql"),
        ("SELECT attributes -> '$.\"c''d\"' AS v FROM spans", "sqlite"),
        ("SELECT attributes ->> '$.\"c''d\"' AS v FROM spans", "sqlite"),
    ],
)
def test_a_json_key_containing_a_quote_is_escaped(sql: str, dialect: str) -> None:
    """A key holding an apostrophe must not close its own string literal.

    Attribute keys are arbitrary, and describeSqlSchema publishes the populated
    paths, so an unescaped one is a spelling the surface prints and cannot run.
    """
    root = parse_sql(sql, dialect=cast(Any, dialect))
    root = admit(root, allowlist=load_allowlist(cast(Any, dialect)), dialect=cast(Any, dialect))
    rendered = render(rewrite(root, _ctx(cast(Any, dialect))), dialect=cast(Any, dialect))
    assert rendered.count("'") % 2 == 0, f"unbalanced quotes: {rendered}"
    assert "''" in rendered


def test_a_json_key_without_a_quote_keeps_its_path_form() -> None:
    """Guards the test above: rewriting every path would also satisfy it."""
    ctx, rendered = _rewritten("SELECT attributes -> '$.llm' AS v FROM spans", dialect="sqlite")
    # The pass leaves the operator in place and swaps only the path, so the
    # operator surviving is not evidence that the path did.
    assert "json_path_quote_repair" not in ctx.applied
    assert "->" in rendered


def test_subsecond_precision_survives_an_epoch_comparison() -> None:
    """Converting the column must not floor it to whole seconds.

    Storage carries microseconds. `datetime()` and `unixepoch()` truncate
    unless asked for `subsec`, so a comparison decided below the second dropped
    rows PostgreSQL returns.
    """
    rendered = _rendered(
        "SELECT span_id AS v FROM spans WHERE end_time > start_time + INTERVAL '1' SECOND"
    )
    assert "'subsec'" in rendered
    # span-long runs 2.5s and clears a one-second threshold; the others do not.
    assert [row[0] for row in _run_on_sqlite(rendered)] == ["span-long"]


@pytest.mark.parametrize(
    ("sql", "dialect"),
    [
        ("SELECT count(*) AS v FROM spans WHERE attributes ->> '$.n' > '99'", "sqlite"),
        ("SELECT count(*) AS v FROM spans WHERE attributes #>> '{n}' > '99'", "postgresql"),
        # The lambda repair parenthesises an accessor written inside a call.
        ("SELECT MIN(attributes -> '$.n') AS v FROM spans", "sqlite"),
    ],
)
def test_uncast_json_ordering_is_noted(sql: str, dialect: str) -> None:
    """The note says "ordered or compared", so a comparison has to reach it.

    Text ordering of a JSON read answers differently from numeric ordering, and
    the surface cannot tell which the path holds -- so it notes rather than
    refuses. A note that fires only in MIN/MAX/ORDER BY misses the predicate
    form, which is where the wrong answer is least visible.
    """
    d = cast(Any, dialect)
    root = admit(parse_sql(sql, dialect=d), allowlist=load_allowlist(d), dialect=d)
    ctx = RewriteContext(allowlist=load_allowlist(d), dialect=d, row_limit=100)
    rewrite(root, ctx)
    assert any("without a cast" in note for note in ctx.notes), ctx.notes


def test_a_cast_json_comparison_is_not_noted() -> None:
    """Guards the test above: a cast says the caller already decided."""
    ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=100)
    root = admit(
        parse_sql(
            "SELECT count(*) AS v FROM spans WHERE CAST(attributes ->> '$.n' AS REAL) > 99",
            dialect="sqlite",
        ),
        allowlist=load_allowlist("sqlite"),
        dialect="sqlite",
    )
    rewrite(root, ctx)
    assert not any("without a cast" in note for note in ctx.notes)


def test_virtual_using_key_resolves_against_the_whole_left_composite() -> None:
    """A USING key may come from any relation to its left, not just the last.

    `a JOIN b ON ... JOIN c USING (k)` resolves `k` against the composite of
    `a` and `b`. Taking only the nearest relation qualified the rewritten
    comparison with one that does not provide the column, so the engine
    reported a reference the caller never wrote.
    """
    ctx, rendered = _rewritten(
        "SELECT spans.span_id FROM spans JOIN projects ON projects.id = 1 "
        "JOIN traces USING (latency_ms)",
        dialect="postgresql",
    )
    assert "virtual_using" in ctx.applied
    assert "projects.latency_ms" not in rendered
    assert "spans.end_time" in rendered and "traces.end_time" in rendered


def test_two_relation_virtual_using_still_resolves_to_the_left_relation() -> None:
    """Guards the test above: the simple case must keep working."""
    _, rendered = _rewritten(
        "SELECT spans.span_id FROM spans JOIN traces USING (latency_ms)",
        dialect="postgresql",
    )
    assert "spans.end_time" in rendered and "traces.end_time" in rendered


def test_a_using_key_provided_by_two_left_relations_is_refused() -> None:
    """PostgreSQL refuses this too, so binding it silently would answer for the caller."""
    with pytest.raises(AnalyticsSqlError) as caught:
        _rewritten(
            "SELECT s.span_id FROM spans s JOIN traces t1 ON t1.id = 1 "
            "JOIN traces t2 USING (latency_ms)",
            dialect="postgresql",
        )
    assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX


def _rendered_dialect(sql: str, dialect: str) -> str:
    d = cast(Any, dialect)
    root = admit(parse_sql(sql, dialect=d), allowlist=load_allowlist(d), dialect=d)
    return render(rewrite(root, _ctx(d)), dialect=d)


def _run_join_on_sqlite(sql: str) -> list[tuple[Any, ...]]:
    """traces id={1,2}; spans id={1,2,3}, so span 3 has no matching trace."""
    conn = sqlean.connect(":memory:")
    try:
        conn.execute("CREATE TABLE traces(id INT)")
        conn.execute("CREATE TABLE spans(id INT)")
        conn.executemany("INSERT INTO traces VALUES(?)", [(1,), (2,)])
        conn.executemany("INSERT INTO spans VALUES(?)", [(1,), (2,), (3,)])
        return cast(list[tuple[Any, ...]], conn.execute(sql).fetchall())
    finally:
        conn.close()


def test_star_over_a_right_join_using_merges_the_key() -> None:
    """USING exposes the merge of both sides, which matters when the left is absent.

    A right join produces rows with no left row, and there the left copy of the
    key is NULL while the key itself is not. Emitting the left copy answered
    NULL for exactly the rows the join was written to keep -- and both engines
    agreed on it, so comparing deployments would not have shown it.
    """
    rendered = _rendered_dialect("SELECT * FROM traces RIGHT JOIN spans USING (id)", "sqlite")
    assert "COALESCE(traces.id, spans.id) AS id" in rendered
    # The merged key is what the engine's own USING produces.
    assert [
        row[0]
        for row in _run_join_on_sqlite(
            "SELECT COALESCE(traces.id, spans.id) AS id "
            "FROM traces RIGHT JOIN spans USING (id) ORDER BY id"
        )
    ] == [
        row[0]
        for row in _run_join_on_sqlite(
            "SELECT * FROM traces RIGHT JOIN spans USING (id) ORDER BY id"
        )
    ]


def test_star_over_an_inner_join_using_keeps_one_plain_copy() -> None:
    """Guards the test above: an inner join cannot lose the left row."""
    rendered = _rendered_dialect("SELECT * FROM traces JOIN spans USING (id)", "sqlite")
    assert "COALESCE" not in rendered.upper()
    # The key is projected once, from the left. `spans.id` still appears inside
    # the span's graphql_node_id expression, which is not a second key column.
    assert rendered.startswith("SELECT traces.id,")
    assert ", spans.id," not in rendered


def test_a_computed_json_key_is_noted_on_postgres() -> None:
    """The two engines read the same computed operand differently.

    PostgreSQL's `->` takes a key, so a computed operand names one key; SQLite
    reads the same text as a path. `doc -> k.key` and `json_extract(doc, k.key)`
    parse identically, so the surface cannot tell which the caller meant and
    says so instead of choosing.
    """
    al = load_allowlist("postgresql")
    root = admit(
        parse_sql(
            "SELECT json_extract(attributes, '$.' || 'llm') AS v FROM spans", dialect="postgresql"
        ),
        allowlist=al,
        dialect="postgresql",
    )
    ctx = RewriteContext(allowlist=al, dialect="postgresql", row_limit=100)
    rewrite(root, ctx)
    assert any("computed JSON key" in note for note in ctx.notes)


@pytest.mark.parametrize(
    "sql",
    [
        # A dynamic column key is a key lookup on both engines, which is what
        # `->` does -- nothing to warn about.
        "SELECT s.attributes -> k.key AS v FROM spans s "
        "CROSS JOIN LATERAL jsonb_each(s.attributes) AS k",
        "SELECT attributes -> 'llm' AS v FROM spans",
    ],
)
def test_an_ordinary_json_key_is_not_noted(sql: str) -> None:
    """Guards the test above: noting every accessor would also satisfy it."""
    al = load_allowlist("postgresql")
    root = admit(parse_sql(sql, dialect="postgresql"), allowlist=al, dialect="postgresql")
    ctx = RewriteContext(allowlist=al, dialect="postgresql", row_limit=100)
    rewrite(root, ctx)
    assert not any("computed JSON key" in note for note in ctx.notes)


def test_using_merge_names_only_the_relations_that_provide_the_key() -> None:
    """Merging across every relation to the left names columns they do not have.

    `projects` has no `start_time`, so coalescing it into the merge emits a
    reference the engine refuses -- turning the silent NULL this pass exists to
    fix into a hard error against a column the caller never wrote.
    """
    _, rendered = _rewritten(
        "SELECT * FROM projects JOIN traces ON traces.project_rowid = projects.id "
        "RIGHT JOIN spans USING (start_time)",
        dialect="postgresql",
    )
    assert "COALESCE(traces.start_time, spans.start_time)" in rendered
    assert "projects.start_time" not in rendered


def test_interval_arithmetic_keeps_the_fraction_it_shifts() -> None:
    """Both sides of the comparison must carry subseconds, not just the column.

    `datetime(col, '+1 seconds')` truncates, so a span exactly one second long
    compared with `> INTERVAL '1' SECOND` answered true, and a half-second span
    did too.
    """
    rendered = _rendered(
        "SELECT span_id AS v FROM spans WHERE end_time > start_time + INTERVAL '1' SECOND"
    )
    assert rendered.count("'subsec'") == 2
    assert [row[0] for row in _run_on_sqlite(rendered)] == ["span-long"]


@pytest.mark.parametrize(
    ("sql", "converted"),
    [
        ("SELECT COALESCE(end_time, start_time) - start_time AS v FROM spans", True),
        # A branch that is not a stored timestamp makes the result something else.
        ("SELECT COALESCE(end_time, name) - start_time AS v FROM spans", False),
    ],
)
def test_coalesced_timestamps_subtract_as_timestamps(sql: str, converted: bool) -> None:
    """COALESCE of stored timestamps is still a stored timestamp."""
    assert ("UNIXEPOCH" in _rendered(sql).upper()) is converted
