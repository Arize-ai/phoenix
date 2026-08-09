from typing import Any, cast

import pytest
import sqlean
import sqlglot
from sqlglot import exp

# Importing the engine module applies Phoenix's extension configuration. Calling
# sqlean.extensions.enable() here would *replace* that set rather than add to it,
# silently disabling extensions other tests depend on for the rest of the session.
import phoenix.db.engines  # noqa: F401  (imported for its extension setup)
from phoenix.server.mcp_analytics_sql.allowlist import DialectName, load_allowlist
from phoenix.server.mcp_analytics_sql.catalog import _body as _index_body
from phoenix.server.mcp_analytics_sql.catalog import (
    _classify,
    _sqlite_shape,
    indexed_json_accessors,
)
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError
from phoenix.server.mcp_analytics_sql.parse import (
    AdmissionOutcome,
    admit,
    parse_sql,
    render,
    try_parse_and_admit,
)
from phoenix.server.mcp_analytics_sql.rewrite import (
    RewriteContext,
    _substitute_graphql_node_id,
    _substitute_latency_ms,
    rewrite,
)
from phoenix.server.mcp_analytics_sql.teaching import FULL_EXAMPLES


def _ctx(dialect: DialectName = "postgresql") -> RewriteContext:
    """A rewrite context."""
    return RewriteContext(allowlist=load_allowlist("sqlite"), dialect=dialect, row_limit=500)


def test_star_expansion() -> None:
    root = parse_sql("SELECT * FROM spans", dialect="postgresql")
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx()), dialect="postgresql")
    assert "spans.trace_rowid" in out
    assert not out.startswith("SELECT *")


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
    assert "EXTRACT(EPOCH FROM (end_time - start_time))" in out


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


@pytest.mark.parametrize("example_key", sorted(FULL_EXAMPLES))
def test_every_shipped_example_is_admitted(example_key: str) -> None:
    """An example in the teaching payload is a promise that it runs.

    These are the statements a caller is most likely to send verbatim, because
    we wrote them and put them in front of the caller as the way to do the
    thing. One that is refused costs more than an ordinary denial: it teaches
    that the surface is unreliable, and it does so at the moment the caller was
    following instructions rather than guessing.

    Admission is keyed on parser classes and on function names, neither of which
    is what the examples are written in, so nothing else connects the two. This
    is the only check that the payload and the policy agree.
    """
    dialect: DialectName = "postgresql" if example_key.endswith("postgresql") else "sqlite"
    root = parse_sql(FULL_EXAMPLES[example_key], dialect=dialect)
    admit(root, allowlist=load_allowlist("sqlite"), dialect=dialect)


def test_latency_ms_orders_by_duration_not_start_time() -> None:
    """Sorting must rank by how long a span took, not by when it began.

    An expression that is monotonic in start_time returns a plausible ordering
    for every query, which is why this is asserted against rows whose duration
    order is the reverse of their start order.
    """
    sql = _rendered("SELECT span_id FROM spans ORDER BY latency_ms DESC")
    assert [row[0] for row in _run_on_sqlite(sql)] == ["span-long", "span-medium", "span-short"]


def test_exempt_table_not_wrapped() -> None:
    root = parse_sql("SELECT name FROM projects", dialect="postgresql")
    root = admit(root, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    out = render(rewrite(root, _ctx("postgresql")), dialect="postgresql")
    assert "AS projects" not in out or "SELECT" in out


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
    reflected = {"spans": [{"on": f"({indexed_expression})"}]} if indexed_expression else {}
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


def test_star_over_a_query_local_relation_is_a_normal_refusal() -> None:
    """The columns of a CTE are whatever its SELECT produced, which the manifest cannot know.

    Refusing is right; refusing with a bare ValueError is not, because it escapes
    the error envelope and reaches the caller as an internal failure for
    ordinary SQL.
    """
    root = parse_sql("WITH x AS (SELECT id FROM projects) SELECT * FROM x", dialect="sqlite")
    with pytest.raises(AnalyticsSqlError):
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite"))


def test_latency_ms_keeps_its_name_in_the_select_list() -> None:
    """An advertised column has to come back under the name it was advertised as."""
    root = parse_sql("SELECT latency_ms FROM spans", dialect="sqlite")
    out = render(
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite")),
        dialect="sqlite",
    )
    assert "AS latency_ms" in out


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM (SELECT id FROM projects) p JOIN traces t ON t.project_rowid = p.id",
        "SELECT * FROM spans, json_each(attributes)",
    ],
    ids=["derived-table-joined", "table-valued-function"],
)
def test_star_refuses_sources_the_manifest_cannot_describe(sql: str) -> None:
    """A source whose columns come from the query, not the manifest, must refuse.

    Skipping it returns the other sources' columns and none of these, which is a
    well-formed answer missing exactly what the caller joined or unnested for.
    The CTE spelling of the same query already refused, so silently dropping
    these gave one query shape two different outcomes.
    """
    root = parse_sql(sql, dialect="sqlite")
    with pytest.raises(AnalyticsSqlError):
        rewrite(admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite"), _ctx("sqlite"))


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


@pytest.mark.parametrize(
    ("sql", "admitted"),
    [
        ("SELECT MIN(attributes -> 'total') AS v FROM spans", False),
        ("SELECT MAX(attributes -> 'total') AS v FROM spans", False),
        ("SELECT MIN(attributes ->> 'total') AS v FROM spans", True),
        ("SELECT MIN(json_extract(attributes, '$.total')) AS v FROM spans", True),
        ("SELECT attributes -> 'total' AS v FROM spans", True),
    ],
    ids=["min-arrow", "max-arrow", "min-arrow2", "min-json-extract", "bare-projection"],
)
def test_json_arrow_inside_a_call_is_refused(sql: str, admitted: bool) -> None:
    """`->` in an argument list parses as a lambda arrow, not a JSON accessor.

    No JSONExtract node is produced, so the canonicalisation pass finds nothing
    to convert and a raw `->` reaches SQLite, where it yields JSON *text*. MIN
    and MAX then compare lexicographically and return the wrong row, while SUM
    and AVG coerce and stay correct — so spot-checking the aggregates finds
    nothing wrong. Measured before the fix: MIN returned 1017066 and MAX
    returned 900 over values whose true extremes are the reverse.

    The node escapes the function policy entirely because `exp.Lambda` is not an
    `exp.Func`, so the enumeration that covers every function class never sees
    it. The two spellings that work are admitted, so this refuses a broken
    spelling rather than a capability.
    """
    root = parse_sql(sql, dialect="sqlite")
    if admitted:
        admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite")
    else:
        with pytest.raises(AnalyticsSqlError):
            admit(root, allowlist=load_allowlist("sqlite"), dialect="sqlite")


def test_json_path_with_an_embedded_quote_is_left_alone() -> None:
    """A key containing a quote cannot be wrapped in quotes without changing it.

    `$."he said "."hi"` reads as two keys, and SQLite returns NULL rather than
    erroring, so the caller concludes the key is absent.
    """
    from phoenix.server.mcp_analytics_sql.rewrite import _quoted_json_path

    path = parse_sql("SELECT json_extract(attributes, '$.a') FROM spans", dialect="sqlite")
    node = next(iter(path.find_all(__import__("sqlglot").exp.JSONExtract)))
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
def test_cast_targets_and_placeholders(sql: str, dialect: DialectName, admitted: bool) -> None:
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

    Only a bare `graphql_node_id` in a join is genuinely ambiguous, and that is
    still left alone rather than guessed at.
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

    # Unqualified in a join stays untouched: two candidate types, no basis to pick.
    ambiguous = rewrite(
        "SELECT graphql_node_id FROM traces t JOIN projects p ON t.project_rowid = p.id"
    )
    assert "graphql_node_id" in ambiguous
    assert "Trace:" not in ambiguous and "Project:" not in ambiguous


def _rewrite_context(
    sql: str, *, dialect: DialectName = "postgresql"
) -> tuple[RewriteContext, str]:
    from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
    from phoenix.server.mcp_analytics_sql.parse import admit, parse_sql, render
    from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext, rewrite

    allowlist = load_allowlist("sqlite")
    root = admit(parse_sql(sql, dialect=dialect), allowlist=allowlist, dialect=dialect)
    ctx = RewriteContext(
        allowlist=allowlist,
        dialect=dialect,
        row_limit=10,
    )
    return ctx, render(rewrite(root, ctx), dialect=dialect)


def _rewritten(sql: str, *, dialect: DialectName = "postgresql") -> tuple[RewriteContext, str]:
    ctx, rendered = _rewrite_context(sql, dialect=dialect)
    return ctx, rendered


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
            dialect=cast(DialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.ADMIT, result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_naive_time_of_day_is_refused_with_the_fix_named(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01 14:30:00'",
            dialect=cast(DialectName, backend),
        )
        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "+00:00" in result.detail

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_bare_date_is_admitted(self, backend: str) -> None:
        result = try_parse_and_admit(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01'",
            dialect=cast(DialectName, backend),
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

    def test_postgres_leaves_the_spelling_alone(self) -> None:
        """PostgreSQL parses the literal, so rewriting it would be churn."""
        _, rendered = _rewritten(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01T00:00:00Z'",
            dialect="postgresql",
        )
        assert "'2026-07-01T00:00:00Z'" in rendered

    @pytest.mark.parametrize("backend", ["postgresql", "sqlite"])
    def test_a_bare_date_reports_the_assumption(self, backend: str) -> None:
        """Admitted rather than refused, so the assumption has to be stated."""
        ctx, _ = _rewrite_context(
            "SELECT count(*) FROM spans WHERE start_time >= '2026-07-01'",
            dialect=cast(DialectName, backend),
        )
        assert any("UTC" in note for note in ctx.notes), ctx.notes


class TestOneSharedResolver:
    """Every reference a rewrite may edit resolves the same way.

    Four passes previously carried four scope models and disagreed; C1, C2, C3,
    C5 and C6 are those disagreements. Each is pinned here against the shape
    that produced it.
    """

    @staticmethod
    def _rewritten(sql: str, dialect: DialectName = "sqlite") -> str:
        read = "postgres" if dialect == "postgresql" else dialect
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect=dialect, row_limit=500)
        return rewrite(sqlglot.parse_one(sql, read=read), ctx).sql(dialect=read)

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
        return rewrite(tree, ctx).sql(dialect="sqlite")

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
    def _noted(sql: str, dialect: DialectName = "sqlite") -> bool:
        read = "postgres" if dialect == "postgresql" else dialect
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect=dialect, row_limit=500)
        rewrite(sqlglot.parse_one(sql, read=read), ctx)
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

        rendered = rewrite(tree, ctx).sql(dialect="sqlite")

        assert "JSON_EXTRACT" in rendered.upper()
        assert any("without a cast" in note for note in ctx.notes)
