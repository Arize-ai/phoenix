"""Admission regression corpus and the parser behaviours admission depends on.

``admission_corpus.py`` holds every statement admission is known to have got
wrong at some point, together with the outcome it must now produce. Each entry
carries a note explaining what the statement exercises, so a failure says what
broke without needing outside context. Add a case whenever a new bypass is
found; never delete one.

The corpus remains declarative data rather than test logic. Admission is an
allowlist, and the cheapest way to weaken an allowlist is to widen it while the
tests keep passing, so the record of what must stay refused is easy to review.

``test_parser_contract`` covers a different risk. Admission is only as sound as
the parser beneath it, and two of its guarantees are properties of SQLGlot
rather than of our code: that multi-statement input is visible rather than
silently truncated, and that comments are dropped only when explicitly asked.
Those assumptions are worth asserting directly, because a parser upgrade can
change them without any corpus entry failing.
"""

from __future__ import annotations

from typing import cast

import pytest
from sqlglot import exp, parse, parse_one

from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.parse import (
    _ALLOWED_STRUCTURAL_CLASSES,
    MAX_TREE_DEPTH,
    AdmissionOutcome,
    AdmissionResult,
    _timestamp_comparison_pairs,
    _tree_depth,
    admit_sql,
    query_local_columns,
    try_parse_and_admit,
)
from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext, rewrite
from tests.unit.server.mcp_analytics_sql.admission_corpus import CASES, AdmissionCase
from tests.unit.server.mcp_analytics_sql.admission_fixtures import minimal_admission_allowlist

DIALECT: SupportedSQLDialectName = "postgresql"


def _depth_of(sql: str, dialect: str) -> int:
    """Measured with the real metric, so a change to it cannot pass unnoticed here."""
    return _tree_depth(
        cast(
            exp.Expression, parse_one(sql, read="postgres" if dialect == "postgresql" else dialect)
        )
    )


def _outcome(result: AdmissionResult) -> AdmissionOutcome:
    return result.outcome


def _case_id(case: AdmissionCase) -> str:
    return f"{case.dialect[:2]}-{case.note[:44]}"


@pytest.mark.parametrize("case", CASES, ids=[_case_id(case) for case in CASES])
def test_admission_corpus(case: AdmissionCase) -> None:
    # Most statements behave identically on both backends, so the dialect is
    # optional and defaults to Postgres. Cases that name one are asserting a
    # decision that differs between engines -- typically a function only one of
    # them can execute.
    result = try_parse_and_admit(
        case.sql, dialect=case.dialect, allowlist=minimal_admission_allowlist()
    )
    assert _outcome(result) == case.expect, (
        f"{case.note}\n  dialect: {case.dialect}\n  sql: {case.sql}"
    )


def test_corpus_is_not_shrinking() -> None:
    """A corpus that quietly loses cases stops defending anything.

    The count is asserted rather than derived so that deleting a case is a
    deliberate edit to this line, not a silent side effect of editing the data.
    """
    assert len(CASES) >= 76
    keys = [(case.sql, case.dialect) for case in CASES]
    assert len(set(keys)) == len(keys), "duplicate statement/dialect pair in corpus"


def test_admitted_statements_render_without_comments() -> None:
    """Comments must not reach the database, whatever they contain.

    A comment can carry an entire second statement. Nothing executes it, but the
    rendered string is what gets logged, audited, and read by a human deciding
    whether the surface is behaving, so it must not contain text the caller
    smuggled in.
    """
    sql = "SELECT id FROM spans /* /* */ ; DROP TABLE api_keys */"
    result = try_parse_and_admit(sql, dialect=DIALECT, allowlist=minimal_admission_allowlist())
    assert result.outcome == AdmissionOutcome.ADMIT
    assert result.rendered_sql is not None
    assert "/*" not in result.rendered_sql
    assert "DROP TABLE" not in result.rendered_sql


def test_parser_contract() -> None:
    """Assumptions about the parser that admission relies on to be correct."""
    multi = "SELECT id FROM spans; DROP TABLE users"

    statements = parse(multi, read="postgres")
    assert len(statements) == 2, (
        "parse() must expose every statement so the multi-statement check can see them"
    )

    # A parser that returned only the first statement here would make the second
    # invisible to admission while still reaching the database as rendered text.
    first = parse_one(multi, read="postgres")
    assert isinstance(first, exp.Block) or "DROP TABLE" in first.sql(dialect="postgres"), (
        "parse_one must not silently discard trailing statements"
    )

    # Comment stripping is opt-in, which is why admission must pass comments=False
    # explicitly rather than trusting the default.
    tree = parse_one("SELECT id FROM spans /* payload */", read="postgres")
    assert "payload" in tree.sql(dialect="postgres")
    assert "payload" not in tree.sql(dialect="postgres", comments=False)

    for sql in ("SELECT id FROM spans;;", "SELECT id FROM spans; -- trailing comment"):
        assert (
            try_parse_and_admit(
                sql, dialect="postgresql", allowlist=minimal_admission_allowlist()
            ).outcome
            is AdmissionOutcome.ADMIT
        )


class TestDdlColumnsAreQueryable:
    """Every physical DDL column is admitted alongside virtual overlays."""

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT user_id FROM datasets",
            "SELECT d.user_id FROM datasets AS d",
            "SELECT gradient_start_color FROM projects",
            "SELECT p.trace_retention_policy_id FROM projects p",
            "SELECT id FROM projects WHERE gradient_end_color = '#fff'",
            "SELECT count(*) FROM datasets GROUP BY user_id",
        ],
    )
    def test_formerly_hidden_columns_are_queryable(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="sqlite")

    def test_an_unknown_column_has_a_suggestion(self) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                "SELECT span_kindd FROM spans", allowlist=load_allowlist("sqlite"), dialect="sqlite"
            )
        assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED
        assert "is not a column of that table" in caught.value.message
        assert "Did you mean span_kind" in caught.value.message

    def test_a_subquery_table_cannot_validate_an_outer_column(self) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                "SELECT status_message FROM traces WHERE EXISTS (SELECT 1 FROM spans)",
                allowlist=load_allowlist("sqlite"),
                dialect="sqlite",
            )
        assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED

    @pytest.mark.parametrize(
        "sql,expected",
        [
            ("SELECT latency_m FROM spans", "latency_ms"),
            ("SELECT graphql_node_i FROM projects", "graphql_node_id"),
        ],
    )
    def test_an_advertised_column_can_be_suggested(self, sql: str, expected: str) -> None:
        """A virtual column is a column to the caller, and `latency_ms` is the
        most advertised name on this surface -- so the likeliest typo of all got
        no suggestion while rarer ones did."""
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="sqlite")

        assert f"Did you mean {expected}" in caught.value.message

    @pytest.mark.parametrize(
        "sql,physical",
        [
            ("SELECT user_idd FROM datasets", "user_id"),
            ("SELECT gradient_start_colr FROM projects", "gradient_start_color"),
            ("SELECT trace_retention_policy_idd FROM projects", "trace_retention_policy_id"),
        ],
    )
    def test_a_near_miss_on_a_physical_name_is_suggested(self, sql: str, physical: str) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="sqlite")
        assert f"Did you mean {physical}" in caught.value.message

    def test_an_unqualified_reference_is_reported_against_every_table_checked(self) -> None:
        """Naming one of them would assert something narrower than what was tested."""
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                "SELECT nosuchthing FROM spans JOIN traces ON spans.trace_rowid = traces.id",
                allowlist=load_allowlist("sqlite"),
                dialect="sqlite",
            )
        assert "not a column of any table in scope (spans, traces)" in caught.value.message

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT name FROM projects",
            "SELECT id, name FROM datasets",
            "SELECT s.name FROM spans s JOIN traces t ON s.trace_rowid = t.id",
        ],
    )
    def test_physical_columns_are_untouched(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="sqlite")


class TestUnquotedPhysicalColumnsUsePostgresqlFolding:
    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT GRADIENT_START_COLOR FROM projects",
            "SELECT Gradient_Start_Color FROM projects",
            "SELECT gRaDiEnT_sTaRt_CoLoR FROM projects",
            "SELECT USER_ID FROM span_annotations",
            "SELECT p.TRACE_RETENTION_POLICY_ID FROM projects p",
            "SELECT count(*) FROM datasets GROUP BY USER_ID",
        ],
    )
    def test_case_variants_of_a_physical_column_are_admitted(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")

    def test_a_quoted_case_variant_is_not_the_lowercase_physical_column(self) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                'SELECT "USER_ID" FROM span_annotations',
                allowlist=load_allowlist("sqlite"),
                dialect="postgresql",
            )
        assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED

    @pytest.mark.parametrize("dialect", ["sqlite", "postgresql"])
    def test_unquoted_table_names_use_engine_case_folding(
        self, dialect: SupportedSQLDialectName
    ) -> None:
        for sql in ("SELECT id FROM SPANS", "SELECT id FROM Spans"):
            admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect=dialect)

    def test_a_quoted_case_variant_is_not_the_lowercase_table(self) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                'SELECT id FROM "SPANS"',
                allowlist=load_allowlist("sqlite"),
                dialect="postgresql",
            )
        assert caught.value.code is ErrorCode.RELATION_NOT_ALLOWED

    @pytest.mark.parametrize("dialect", ["sqlite", "postgresql"])
    def test_an_unquoted_alias_uses_engine_case_folding(
        self, dialect: SupportedSQLDialectName
    ) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                "SELECT s.nope FROM spans AS S",
                allowlist=load_allowlist("sqlite"),
                dialect=dialect,
            )
        assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED

    def test_raw_foreign_key_target_outside_the_schema_surface_is_refused(self) -> None:
        """DDL references can explain storage without widening what SQL may read."""
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                "SELECT id FROM project_trace_retention_policies",
                allowlist=load_allowlist("sqlite"),
                dialect="sqlite",
            )
        assert caught.value.code is ErrorCode.RELATION_NOT_ALLOWED


class TestJoinStructure:
    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT p.id FROM projects p "
            "JOIN (SELECT '#x' AS gradient_start_color) g USING (gradient_start_color)",
            "SELECT p.id FROM projects p "
            "JOIN (SELECT '#x' AS gradient_start_color) g USING (GRADIENT_START_COLOR)",
            "SELECT d.id FROM datasets d JOIN (SELECT 1 AS user_id) g USING (user_id)",
        ],
    )
    def test_using_a_physical_column_is_admitted(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")

    def test_natural_join_is_refused_outright(self) -> None:
        """Its implicit keys change when the physical schema evolves."""
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                "SELECT count(*) FROM datasets NATURAL JOIN dataset_versions",
                allowlist=load_allowlist("sqlite"),
                dialect="postgresql",
            )
        assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX
        assert "NATURAL JOIN" in caught.value.message

    def test_using_a_physical_column_still_works(self) -> None:
        admit_sql(
            "SELECT count(*) FROM spans JOIN traces USING (id)",
            allowlist=load_allowlist("sqlite"),
            dialect="postgresql",
        )


class TestWholeRowReferencesAreRefused:
    """Naming a relation selects every column in it, hidden ones included.

    `SELECT p FROM projects p` and `SELECT CAST(p AS TEXT) FROM projects p` both
    returned the full record on PostgreSQL -- gradient colours and all -- while
    the same columns were refused when named. The construct parses as an
    ordinary unqualified column whose name happens to be the relation's, so
    every per-column rule was inapplicable: the check reads column names and
    this names no column.

    `exp.Dot` is the same escape inverted: `(d).user_id` reaches a field of that
    row without producing a column node for it.
    """

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT p FROM projects p",
            "SELECT CAST(p AS TEXT) FROM projects p",
            "SELECT projects FROM projects",
            "SELECT count(*) FROM projects p WHERE p IS NOT NULL",
            "SELECT (d).user_id FROM datasets d",
        ],
    )
    def test_row_valued_references_are_refused(self, sql: str) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")
        assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT p.name FROM projects p",
            "SELECT name FROM projects",
            "SELECT * FROM projects",
            "SELECT s.name FROM spans s JOIN traces t ON s.trace_rowid = t.id",
            "SELECT count(*) FROM projects WHERE name IS NOT NULL",
            # `(srf(...)).field` is how PostgreSQL projects one field of a
            # set-returning function's result, and is the statement
            # `allowlist.py` cites as the reason the plan gate's function set
            # exists. A blanket refusal of exp.Dot removed it, so the code
            # refused the example its own comment used to justify a design.
            "SELECT (jsonb_each(attributes)).key FROM spans",
        ],
    )
    def test_ordinary_column_references_still_work(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")


class TestAliasCannotShadowACTE:
    """A table aliased to a CTE's name disappears from the scope map.

    `Scope.sources` is keyed by reference name, so `FROM projects AS x, x`
    alongside `WITH x AS (...)` leaves only the CTE. Every check built on that
    map then skips the table: the relation check never saw it, and the
    hidden-column check found an empty map and moved on -- so `projects`'s
    withheld columns were readable on SQLite. With a non-allowlisted table the
    same shape reached the post-rewrite assertion and escaped as AssertionError.

    PostgreSQL rejects the statement outright, so accepting it was a divergence
    as well as a leak.
    """

    @pytest.mark.parametrize(
        "sql",
        [
            "WITH x AS (SELECT 1 AS v) SELECT gradient_start_color FROM projects AS x, x",
            "WITH x AS (SELECT 1 AS v) SELECT count(*) FROM users AS x, x",
            "WITH x AS (SELECT 1 AS v) SELECT count(*) FROM projects AS x JOIN x ON 1 = 1",
        ],
    )
    def test_the_collision_is_refused(self, sql: str) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="sqlite")
        assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX

    @pytest.mark.parametrize(
        "sql",
        [
            "WITH x AS (SELECT 1 AS v) SELECT count(*) FROM x",
            "WITH projects AS (SELECT 1 AS v) SELECT count(*) FROM projects",
            "SELECT count(*) FROM projects AS p",
            # A CTE and a table alias sharing a name in *different* scopes is
            # legal, unambiguous, and executes on both engines. The first
            # version of this check refused it, because it looked for the cause
            # -- any alias equal to any CTE name anywhere in the statement --
            # rather than for the effect. `t` is simultaneously the commonest
            # CTE name and the commonest table alias, so the false positive was
            # easy to reach.
            "WITH t AS (SELECT 1 AS v) SELECT n FROM (SELECT count(*) AS n FROM spans AS t) q",
            "WITH s AS (SELECT id FROM projects) "
            "SELECT (SELECT count(*) FROM spans AS s) AS n FROM s",
        ],
    )
    def test_legitimate_cte_use_is_unaffected(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="sqlite")


class TestCastTargetsAreRestrictedToDataTypes:
    """The cast allowlist blocks catalog lookups, not unfamiliar spellings.

    `CAST('pg_authid' AS regclass)` consults the system catalogs for any
    relation, role or function, and never appears as a scanned relation, so the
    plan gate cannot see it. That is the reason the list exists.

    An array of an allowed element type reaches nothing the element type does
    not, and refusing it made the surface reject its own output: PostgreSQL
    renders the operand of `#>>` as `'{a,b}'::text[]`, so `describeSqlSchema`
    published an index spelling under a heading telling the caller to reproduce
    it exactly, and admission then refused it.

    The `#>>` case is written here with the cast parenthesised, which is the
    spelling this surface asks for. The unparenthesised form is refused for
    being ambiguous rather than for its cast target, and is pinned in
    `TestPathCastAmbiguityIsRefused`.
    """

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT count(*) FROM spans WHERE id = ANY('{1,2}'::int[])",
            "SELECT count(*) FROM spans WHERE (attributes #>> ('{session,id}'::text[])) IS NOT NULL",
            "SELECT CAST(id AS TEXT) AS v FROM spans",
        ],
    )
    def test_arrays_of_allowed_types_are_admitted(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT CAST('pg_authid' AS regclass) AS v FROM spans",
            "SELECT CAST('postgres' AS regrole) AS v FROM spans",
            "SELECT CAST('sum' AS regproc) AS v FROM spans",
        ],
    )
    def test_object_identifier_types_are_still_refused(self, sql: str) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")
        assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX


class TestPathCastAmbiguityIsRefused:
    """A cast straight after `#>`/`#>>` has two readings and the parse keeps neither.

    SQLGlot binds the cast to the whole extraction, so `a #>> b::text[]` becomes
    `CAST(a #>> b AS TEXT[])`. A caller who writes `CAST(a #>> b AS text[])`
    deliberately gets that identical tree, and means something else by it: the
    extracted string parsed as an array literal, which is a real operation.

    Since the two are indistinguishable after parsing, choosing either one for
    the caller answers a question somebody did not ask. Refusing costs a round
    trip and names two spellings that cannot be misread.

    Upstream: https://github.com/tobymao/sqlglot/issues/8035
    """

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT attributes #>> '{a,b}'::text[] AS v FROM spans",
            "SELECT attributes #> '{a,b}'::text[] AS v FROM spans",
            "SELECT count(*) FROM spans WHERE (attributes #>> '{s,id}'::text[]) IS NOT NULL",
            # The same tree, reached by writing the cast out. Refused for the same
            # reason: nothing here distinguishes it from the line above.
            "SELECT CAST(attributes #>> '{a,b}' AS text[]) AS v FROM spans",
        ],
    )
    def test_bare_cast_after_a_path_operator_is_refused(self, sql: str) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")
        assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX

    @pytest.mark.parametrize(
        ("sql", "expected"),
        [
            # Cast the path. Verified against PostgreSQL 17: returns the extracted
            # value, and reaches an expression index built on the same path.
            (
                "SELECT attributes #>> ('{a,b}'::text[]) AS v FROM spans",
                "SELECT attributes #>> (CAST('{a,b}' AS TEXT[])) AS v FROM spans",
            ),
            # Cast the extracted value. Verified against PostgreSQL 17: parses the
            # extracted string as an array literal.
            (
                "SELECT (attributes #>> '{a,b}')::text[] AS v FROM spans",
                "SELECT CAST((attributes #>> '{a,b}') AS TEXT[]) AS v FROM spans",
            ),
            # No cast at all, which is what the path literal needs and what
            # describeSqlSchema publishes.
            (
                "SELECT attributes #>> '{a,b}' AS v FROM spans",
                "SELECT attributes #>> '{a,b}' AS v FROM spans",
            ),
        ],
    )
    def test_both_unambiguous_spellings_are_admitted(self, sql: str, expected: str) -> None:
        _, rendered = admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")
        assert rendered == expected

    @pytest.mark.parametrize(
        "sql",
        [
            # `->` and `->>` take a key, not a path, so a cast after them has only
            # the one reading and casting an extracted value is ordinary work.
            "SELECT CAST(attributes ->> 'n' AS INTEGER) AS v FROM spans",
            "SELECT CAST(attributes ->> 'n' AS text[]) AS v FROM spans",
            "SELECT count(*) FROM spans WHERE id = ANY('{1,2}'::int[])",
        ],
    )
    def test_the_refusal_does_not_reach_ordinary_casts(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")

    def test_the_message_names_both_spellings(self) -> None:
        result = try_parse_and_admit(
            "SELECT attributes #>> '{a,b}'::text[] AS v FROM spans", dialect="postgresql"
        )
        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        # A refusal a caller cannot act on costs them a round trip and teaches
        # nothing, so both working spellings have to appear in the text.
        assert "#>> (b::text[])" in result.detail
        assert "(a #>> b)::text[]" in result.detail


class TestScopeInvariantIsPerScope:
    """One resolved occurrence must not vouch for a shadowed one elsewhere.

    The check collected every resolved table name across the statement and then
    tested each table node against that flat set, so `projects` read normally in
    one subquery masked `projects` lost to a CTE collision in another. SQLite
    ran the result and PostgreSQL rejected it outright, which is the divergence
    the refusal exists to prevent.
    """

    def test_a_masked_shadow_is_still_refused(self) -> None:
        sql = (
            "WITH x AS (SELECT 1 AS v) "
            "SELECT (SELECT count(*) FROM projects) AS a, "
            "(SELECT count(*) FROM projects AS x, x) AS b"
        )
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")
        assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT (SELECT count(*) FROM projects) AS a, (SELECT count(*) FROM spans) AS b",
            "SELECT s.id FROM spans s, LATERAL (SELECT 1 AS v) z",
            "WITH t AS (SELECT 1 AS v) SELECT n FROM (SELECT count(*) AS n FROM spans AS t) q",
        ],
    )
    def test_independent_scopes_are_unaffected(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT (d).user_id FROM datasets d",
        "SELECT ((d)).user_id FROM datasets d",
        "SELECT (((d))).user_id FROM datasets d",
    ],
)
def test_composite_access_is_refused_at_any_paren_depth(sql: str) -> None:
    """The rule unwrapped one parenthesis, so nesting fell through to its neighbour.

    Both spellings were refused either way -- the row-valued rule scans columns
    at any depth -- but the two are described as covering the escape from both
    sides, and only one of them was depth-independent. Narrowing that rule later
    would have reopened this with nothing to catch it.
    """
    with pytest.raises(AnalyticsSqlError) as caught:
        admit_sql(sql, allowlist=load_allowlist("sqlite"), dialect="postgresql")
    assert "Composite field access" in caught.value.message


@pytest.mark.parametrize(
    "dialect,refused,suggested",
    [
        (
            "sqlite",
            "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY id) FROM spans",
            "percentile(x, p)",
        ),
        ("postgresql", "SELECT percentile(id, 50) FROM spans", "WITHIN GROUP"),
    ],
)
def test_a_refusal_names_the_spelling_that_works(
    dialect: str, refused: str, suggested: str
) -> None:
    """A refusal a caller cannot act on costs a round trip to learn what we knew.

    These are not missing capabilities. They are the same statistic under
    another name, and the surface allows both -- so refusing without saying so
    sends the caller to rediscover a fact this package already holds.

    Suggesting is only safe because `test_percentile_parity.py` asserts the two
    agree, across nulls, empty input, single rows and the range extremes. A near
    neighbour would be worse than silence: a caller who took the suggestion
    would get a plausible answer to a different question.

    Lives here rather than beside those parity tests, which are postgres-only at
    module level -- put there, this asserted nothing on a default run.
    """
    with pytest.raises(AnalyticsSqlError) as caught:
        admit_sql(
            refused,
            allowlist=load_allowlist("sqlite"),
            dialect=cast(SupportedSQLDialectName, dialect),
        )
    assert suggested in caught.value.message


class TestLossyShapesAreRefused:
    """Shapes that render without complaint into something meaning less.

    Strict rendering catches a generator that cannot express a node. It does not
    catch a node the generator expresses as something else, nor one a pass of
    ours drops before the generator sees it. Those are refused here. See item 4.
    """

    @staticmethod
    def _admit(sql: str) -> AdmissionResult:
        return try_parse_and_admit(sql, dialect="sqlite")

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT * EXCEPT (id) FROM spans",
            "SELECT * REPLACE (id AS x) FROM spans",
        ],
    )
    def test_star_modifiers_are_refused(self, sql: str) -> None:
        """The star is rebuilt from the manifest, so the modifier is dropped and
        every column comes back -- the opposite of what was asked."""
        result = self._admit(sql)

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "Name the columns you want" in result.detail

    def test_with_ties_is_refused(self) -> None:
        result = self._admit("SELECT id FROM spans ORDER BY id FETCH FIRST 5 ROWS WITH TIES")

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "WITH TIES" in result.detail

    def test_hex_literals_are_refused(self) -> None:
        """`0x1f` and `x'1f'` collapse to one node, so an integer written in hex
        would execute as a blob. Refuses the blob spelling too, deliberately."""
        result = self._admit("SELECT id FROM spans WHERE id = 0x1f")

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "decimal" in result.detail

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT * FROM spans",
            "SELECT id FROM spans ORDER BY id FETCH FIRST 5 ROWS ONLY",
            "SELECT id FROM spans ORDER BY id LIMIT 5",
            "SELECT id FROM spans WHERE id = 31",
        ],
    )
    def test_the_ordinary_spellings_still_admit(self, sql: str) -> None:
        assert self._admit(sql).outcome is AdmissionOutcome.ADMIT


class TestTimestampComparisonCoverage:
    """Every spelling of a comparison against a timestamp column, not some.

    A literal beside `=` was refused when naive and rewritten to storage format
    when aware. The same literal inside `IN` got neither, and a double-quoted
    one was not seen as a literal at all. See D4 and D5.
    """

    @staticmethod
    def _admit(sql: str) -> AdmissionResult:
        return try_parse_and_admit(sql, dialect="sqlite")

    def test_a_naive_literal_in_an_in_list_is_refused(self) -> None:
        result = self._admit("SELECT id FROM spans WHERE start_time IN ('2026-01-01T10:30:00')")

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "time of day" in result.detail

    def test_an_aware_literal_in_an_in_list_is_rewritten(self) -> None:
        """Left alone it compares an ISO `T` against a stored space, which
        matches nothing and reports nothing."""
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=500)
        tree = parse_one(
            "SELECT id FROM spans WHERE start_time IN ('2026-01-01T00:00:00Z')", read="sqlite"
        )

        rendered = rewrite(cast(exp.Expression, tree), ctx).sql(dialect="sqlite")

        assert "2026-01-01 00:00:00" in rendered
        assert "timestamp_literals" in ctx.applied

    @pytest.mark.parametrize(
        "sql,dialect",
        [
            ("SELECT id FROM spans WHERE start_time IS DISTINCT FROM '{}'", "sqlite"),
            ("SELECT id FROM spans WHERE start_time IS NOT DISTINCT FROM '{}'", "sqlite"),
            ("SELECT id FROM spans WHERE start_time IS '{}'", "sqlite"),
            ("SELECT CASE start_time WHEN '{}' THEN 1 ELSE 0 END FROM spans", "sqlite"),
            ("SELECT id FROM spans WHERE start_time = ANY(ARRAY['{}'])", "postgresql"),
        ],
    )
    def test_a_naive_literal_is_refused_in_a_comparison_that_is_not_spelled_as_one(
        self, sql: str, dialect: str
    ) -> None:
        """Each of these compares without producing a comparison node, or with
        one the enumeration had not named, so each admitted a naive literal.

        Executed, that is silent: `IS DISTINCT FROM` over a stored instant
        returned every row including the one naming it, because the caller's ISO
        spelling never equals the stored space-separated form.
        """
        result = try_parse_and_admit(
            sql.format("2026-01-01T10:30:00"), dialect=cast(SupportedSQLDialectName, dialect)
        )

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "time of day" in result.detail

    @pytest.mark.parametrize(
        "sql,dialect",
        [
            ("SELECT id FROM spans WHERE (start_time) = ('{}')", "sqlite"),
            ("SELECT id FROM spans WHERE (start_time) = ('{}')", "postgresql"),
            ("SELECT id FROM spans WHERE (start_time, id) = ('{}', 1)", "sqlite"),
            ("SELECT id FROM spans WHERE (start_time, id) = ('{}', 1)", "postgresql"),
            ("SELECT id FROM spans WHERE (start_time) BETWEEN ('{}') AND ('2026-02-01')", "sqlite"),
            ("SELECT id FROM spans WHERE (start_time) IN (('{}'))", "sqlite"),
            # Rows nested inside rows, and rows spelled as VALUES. One pass of
            # unwrapping answers only the depth it happens to meet.
            ("SELECT id FROM spans WHERE (id, (name, start_time)) = (1, ('x', '{}'))", "sqlite"),
            ("SELECT id FROM spans WHERE ((start_time, id), 0) = (('{}', 1), 0)", "sqlite"),
            ("SELECT id FROM spans WHERE start_time IN (VALUES ('{}'))", "sqlite"),
            # A cast of a literal states a value rather than computing one, so
            # the operand is there to be found.
            ("SELECT id FROM spans WHERE start_time = CAST('{}' AS TEXT)", "sqlite"),
            ("SELECT id FROM spans WHERE (id, start_time) = (1, CAST('{}' AS TEXT))", "sqlite"),
            ("SELECT id FROM spans WHERE (id, start_time) IN ((1, '{}'))", "sqlite"),
        ],
    )
    def test_grouping_and_row_syntax_do_not_hide_an_operand(self, sql: str, dialect: str) -> None:
        """Both checks match on the operand node, so an operand left wrapped is
        one they cannot see -- and on SQLite the ISO spelling then matches no
        rows where the stored spelling matches, answering wrong in silence.
        """
        result = try_parse_and_admit(
            sql.format("2026-01-01T10:30:00"), dialect=cast(SupportedSQLDialectName, dialect)
        )

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "time of day" in result.detail

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT id FROM spans WHERE start_time = '{}' || ''",
            "SELECT id FROM spans WHERE start_time = (SELECT '{}')",
            "SELECT id FROM spans WHERE date(start_time) = '{}'",
            "SELECT CAST(start_time AS TEXT) FROM spans WHERE id = 1",
        ],
    )
    def test_a_computed_operand_is_the_standing_limit_and_is_admitted(self, sql: str) -> None:
        """Recorded so the boundary is a decision rather than an oversight.

        Each of these computes a value instead of naming one, on whichever side,
        and rewriting a literal beside it would change a comparison the caller
        authored. On SQLite the cost is a predicate that matches nothing rather
        than an error, which is where to look first if one is reported.
        """
        result = try_parse_and_admit(sql.format("2026-01-01T10:30:00"), dialect="sqlite")

        assert result.outcome is AdmissionOutcome.ADMIT

    def test_nesting_deeper_than_the_parser_returns_an_outcome(self) -> None:
        """The parser descends recursively, so about a hundred parentheses
        exhaust the stack rather than failing to parse. Uncaught it escapes the
        error envelope as a masked internal failure."""
        sql = "SELECT id FROM spans WHERE id = " + "(" * 200 + "1" + ")" * 200

        result = try_parse_and_admit(sql, dialect="sqlite")

        assert result.outcome is AdmissionOutcome.PARSE_ERROR

    @pytest.mark.parametrize("levels", [90, 150, 400])
    def test_a_tree_too_deep_for_a_later_stage_is_refused_at_admission(self, levels: int) -> None:
        """Guarding the parser alone leaves the class open.

        Every stage after it walks the tree recursively, so a statement the
        parser accepts can still exhaust the stack in the generator -- and there
        the failure is not a refusal but the masked internal failure the guard
        exists to prevent. Ninety nested subqueries parse and then die in
        `render`, so the whole pipeline is exercised here rather than admission
        alone.
        """
        sql = "SELECT id FROM " + "(SELECT id FROM " * levels + "spans" + ")" * levels
        allowlist = load_allowlist("sqlite")

        with pytest.raises(AnalyticsSqlError) as caught:
            root = admit_sql(sql, allowlist=allowlist, dialect="sqlite")[0]
            ctx = RewriteContext(allowlist=allowlist, dialect="sqlite", row_limit=5)
            rewrite(root, ctx).sql(dialect="sqlite")

        assert caught.value.code in (ErrorCode.UNSUPPORTED_SYNTAX, ErrorCode.PARSE_ERROR)

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT id FROM spans WHERE " + " OR ".join(f"name = 'v{i}'" for i in range(400)),
            "SELECT id FROM spans WHERE " + " AND ".join(f"name <> 'v{i}'" for i in range(400)),
            "SELECT " + " || ".join(["name"] * 400) + " FROM spans",
            " UNION ALL ".join(["SELECT id FROM spans"] * 300),
        ],
    )
    def test_a_long_run_of_one_operator_is_not_nesting(self, sql: str) -> None:
        """A run of one operator parses left-deep, one node per term, so counting
        the nodes measures the caller's typing rather than the stack.

        Every stage handles such a run iteratively -- these render at two
        thousand terms -- and enumerating ids in a four-hundred-term `OR` is an
        ordinary thing for a caller to write. Measuring it as depth refused them.
        """
        assert try_parse_and_admit(sql, dialect="sqlite").outcome is AdmissionOutcome.ADMIT

    def test_the_depth_bound_is_far_above_anything_real(self) -> None:
        """A bound picked by feel is a bound that refuses a real query one day.

        The deepest statement in the corpus and the liveness suite is nine
        levels; the generator fails somewhere above 258.
        """
        deepest = max(_depth_of(case.sql, case.dialect) for case in CASES)

        assert deepest * 5 < MAX_TREE_DEPTH, f"corpus reached depth {deepest}"
        assert MAX_TREE_DEPTH < 258, "must stay below what the generator survives"

    def test_an_aware_literal_behind_grouping_is_still_rewritten(self) -> None:
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=500)
        tree = parse_one(
            "SELECT id FROM spans WHERE (id, (name, start_time)) "
            "= (1, ('x', '2026-01-01T00:00:00Z'))",
            read="sqlite",
        )

        rendered = rewrite(cast(exp.Expression, tree), ctx).sql(dialect="sqlite")

        assert "2026-01-01 00:00:00" in rendered
        assert "timestamp_literals" in ctx.applied

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT id FROM spans WHERE start_time = ANY(SELECT created_at FROM datasets "
            "WHERE name = '2026-01-01 00:00:00')",
            'SELECT id FROM spans WHERE start_time = ANY(SELECT "created_at" FROM datasets)',
        ],
    )
    def test_a_value_inside_an_any_subquery_belongs_to_that_subquery(self, sql: str) -> None:
        """`= ANY(SELECT ...)` compares against what the subquery returns, so a
        value written inside it sits beside that subquery's own columns.

        Pairing it with the outer timestamp column refuses valid PostgreSQL and
        rewrites a literal the caller is comparing against their own data.
        """
        assert try_parse_and_admit(sql, dialect="postgresql").outcome is AdmissionOutcome.ADMIT

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT id FROM spans WHERE start_time IS DISTINCT FROM '{}'",
            "SELECT CASE start_time WHEN '{}' THEN 1 ELSE 0 END FROM spans",
        ],
    )
    def test_an_aware_literal_is_rewritten_in_those_same_spellings(self, sql: str) -> None:
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=500)
        tree = parse_one(sql.format("2026-01-01T00:00:00Z"), read="sqlite")

        rendered = rewrite(cast(exp.Expression, tree), ctx).sql(dialect="sqlite")

        assert "2026-01-01 00:00:00" in rendered
        assert "timestamp_literals" in ctx.applied

    def test_a_double_quoted_operand_is_refused(self) -> None:
        """SQLite reads it as an identifier, so it is not a literal and every
        check above looks past it."""
        result = self._admit('SELECT id FROM spans WHERE start_time > "2026-01-01T00:00:00Z"')

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "double quotes name identifiers" in result.detail

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT id FROM spans WHERE start_time > end_time",
            "SELECT id FROM spans WHERE start_time > '2026-01-01T00:00:00Z'",
            "SELECT id FROM spans WHERE start_time IN ('2026-01-01T00:00:00Z')",
        ],
    )
    def test_legitimate_comparisons_still_admit(self, sql: str) -> None:
        assert self._admit(sql).outcome is AdmissionOutcome.ADMIT


class TestStructuralPolicyIsDefaultDeny:
    """The seam between the function and table allowlists now has an answer.

    Everything the parser can build that is neither a function nor a table
    source used to be governed by a five-entry denylist, so a class nobody had
    considered was admitted. Three defects were found there in one night, none
    of them by a check. See D1.
    """

    @staticmethod
    def _admit(sql: str, dialect: SupportedSQLDialectName = "postgresql") -> AdmissionResult:
        return try_parse_and_admit(sql, dialect=dialect)

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT id FROM spans WHERE id <> 1",
            "SELECT id FROM spans WHERE id >= 1 AND id <= 9",
            "SELECT CASE WHEN id > 1 THEN 'a' ELSE 'b' END FROM spans",
            "SELECT CASE id WHEN 1 THEN 'a' ELSE 'b' END FROM spans",
            "SELECT DISTINCT name, span_kind FROM spans",
            "SELECT name, COUNT(*) AS c FROM spans GROUP BY name HAVING COUNT(*) > 2",
            "SELECT SUM(id) OVER (PARTITION BY name ORDER BY id ROWS 3 PRECEDING) FROM spans",
            "SELECT id FROM spans WHERE id NOT IN (SELECT id FROM traces)",
            "SELECT id FROM spans WHERE EXISTS (SELECT 1 FROM traces t WHERE t.id = 1)",
            "WITH a AS (SELECT id FROM spans), b AS (SELECT id FROM a) SELECT id FROM b",
            "SELECT id FROM spans UNION ALL SELECT id FROM traces ORDER BY id",
            "SELECT COALESCE(t.id, 0) FROM spans s LEFT JOIN traces t ON s.trace_rowid = t.id",
            "SELECT name || '!' FROM spans",
            "SELECT CAST(id AS REAL) / 2 FROM spans",
            "SELECT id FROM spans ORDER BY name NULLS LAST",
            "SELECT id FROM spans ORDER BY id FETCH FIRST 5 ROWS ONLY",
        ],
    )
    def test_the_ordinary_analytics_grammar_still_admits(self, sql: str) -> None:
        """The allowlist is a floor derived from evidence, so the constructs it
        was derived from must keep working -- on both backends."""
        for dialect in ("postgresql", "sqlite"):
            result = self._admit(sql, dialect)
            assert result.outcome is AdmissionOutcome.ADMIT, f"{dialect}: {sql} -> {result.detail}"

    @pytest.mark.parametrize(
        "sql,construct",
        [
            ("SELECT start_time AT TIME ZONE 'UTC' FROM spans", "AtTimeZone"),
            ("SELECT (ARRAY[1,2])[1] FROM spans", "Bracket"),
        ],
    )
    def test_an_unconsidered_construct_is_refused(self, sql: str, construct: str) -> None:
        """Both were admitted before, decided by nothing."""
        result = self._admit(sql)

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert construct in result.detail

    def test_every_admitted_construct_is_classified_as_comparing_or_not(self) -> None:
        """Forces the timestamp decision when a construct is admitted, not later.

        Admitting a construct and deciding whether it compares values are two
        lists kept in agreement by hand, and spellings kept drifting between
        them -- each admitted, none reaching the timestamp machinery, so a naive
        literal beside one was neither refused nor rewritten and the comparison
        quietly answered wrong.

        The three sets are written out rather than derived from each other, and
        their union is asserted equal to the allowlist. Deriving one by
        subtraction makes that assertion a tautology, which absorbs exactly the
        unclassified class it exists to catch.
        """
        comparing = {
            "EQ",
            "NEQ",
            "GT",
            "GTE",
            "LT",
            "LTE",
            "NullSafeEQ",
            "NullSafeNEQ",
            "Is",
            "Between",
            "In",
            "Any",
        }
        # Carry operands through without comparing anything themselves, so a
        # value inside one must be unwrapped to reach the checks. Missing this
        # category let a pair of parentheses defeat the whole machinery.
        transparent = {"Paren", "Tuple"}
        # Operators, clauses, identifiers, literals and containers. A value
        # compared under one of these reaches a comparison node first.
        not_comparing = {
            "Add",
            "Alias",
            "All",
            "Block",
            "Boolean",
            "CTE",
            "Column",
            "Copy",
            "Credentials",
            "Cube",
            "DPipe",
            "DataType",
            "Distinct",
            "Div",
            "Dot",
            "Drop",
            "Escape",
            "Except",
            "Fetch",
            "Filter",
            "From",
            "Glob",
            "Group",
            "GroupingSets",
            "Having",
            "Identifier",
            "Intersect",
            "Interval",
            "Into",
            "JSONKeyValue",
            "JSONPath",
            "JSONPathKey",
            "JSONPathRoot",
            "Join",
            "Lateral",
            "Like",
            "Limit",
            "LimitOptions",
            "Literal",
            "Lock",
            "Mod",
            "Mul",
            "Neg",
            "Not",
            "Null",
            "ObjectIdentifier",
            "Offset",
            "Order",
            "Ordered",
            "Rollup",
            "Select",
            "Star",
            "Sub",
            "Subquery",
            "Table",
            "TableAlias",
            "Union",
            "Values",
            "Var",
            "Where",
            "Window",
            "WindowSpec",
            "With",
            "WithinGroup",
        }

        classified = comparing | transparent | not_comparing

        assert classified == _ALLOWED_STRUCTURAL_CLASSES, (
            f"unclassified: {sorted(_ALLOWED_STRUCTURAL_CLASSES - classified)}; "
            f"classified but not admitted: {sorted(classified - _ALLOWED_STRUCTURAL_CLASSES)}"
        )

        # Every comparing class must actually yield pairs, so the classification
        # cannot be satisfied by naming a class the enumeration ignores. `Any`
        # and the orderings share a shape, so one probe stands for each group.
        for sql, name in [
            ("SELECT id FROM spans WHERE start_time = 'x'", "EQ"),
            ("SELECT id FROM spans WHERE start_time <> 'x'", "NEQ"),
            ("SELECT id FROM spans WHERE start_time > 'x'", "GT"),
            ("SELECT id FROM spans WHERE start_time >= 'x'", "GTE"),
            ("SELECT id FROM spans WHERE start_time < 'x'", "LT"),
            ("SELECT id FROM spans WHERE start_time <= 'x'", "LTE"),
            ("SELECT id FROM spans WHERE start_time IS NOT DISTINCT FROM 'x'", "NullSafeEQ"),
            ("SELECT id FROM spans WHERE start_time IS DISTINCT FROM 'x'", "NullSafeNEQ"),
            ("SELECT id FROM spans WHERE start_time IS 'x'", "Is"),
            ("SELECT id FROM spans WHERE start_time IN ('x')", "In"),
            ("SELECT id FROM spans WHERE start_time BETWEEN 'x' AND 'y'", "Between"),
        ]:
            root = parse_one(sql, read="sqlite")
            pairs = [p for node in root.walk() for p in _timestamp_comparison_pairs(node)]
            assert pairs, f"{name} is classified as comparing but yields no pairs"

        # Asserted on the value the quantifier holds, not merely on the pair
        # count: the comparison node yields its own operands either way, so
        # "some pairs exist" passes with the unwrap removed.
        any_root = parse_one(
            "SELECT id FROM spans WHERE start_time = ANY(ARRAY['x'])", read="postgres"
        )
        held = [
            operand
            for node in any_root.walk()
            for _, operand in _timestamp_comparison_pairs(node)
            if isinstance(operand, exp.Literal) and operand.this == "x"
        ]
        assert held, "Any is classified as comparing but the value it holds is never reached"

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT ctid FROM spans",
            "SELECT xmin FROM spans",
            "SELECT ctid::text FROM spans",
            "SELECT system_user FROM spans",
        ],
    )
    def test_what_the_plan_gate_cannot_see_is_refused_before_it(self, sql: str) -> None:
        """The PostgreSQL plan gate inspects relations and set-returning
        functions, so system columns and bare system functions pass it: it
        bounds cost, and is not a capability gate.

        Admission is what refuses these, which is only true while the column
        policy stays an allowlist -- under a denylist a column described nowhere
        is readable, and each of these is described nowhere.
        """
        result = try_parse_and_admit(sql, dialect="postgresql")

        assert result.outcome is AdmissionOutcome.COLUMN_NOT_ALLOWED

    def test_a_lossy_shape_keeps_its_own_message(self) -> None:
        """The structural policy runs after the lossy-shape checks, which name
        the hazard and a spelling that works. Told only that `HexString` is not
        in the grammar, a caller learns nothing."""
        result = self._admit("SELECT id FROM spans WHERE id = 0x1f", "sqlite")

        assert "decimal" in result.detail
        assert "not part of the permitted grammar" not in result.detail


class TestPhysicalColumnsWithForeignSources:
    """A physical column remains valid when another source shares its scope."""

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT user_id FROM datasets, (SELECT 1 AS k) sub",
            "SELECT user_id FROM datasets, json_each('[1,2,3]')",
            "SELECT gradient_start_color FROM projects p, (SELECT 1 AS k) sub",
            "SELECT user_id FROM datasets",
        ],
    )
    def test_a_physical_column_is_admitted_whatever_shares_the_scope(self, sql: str) -> None:
        result = try_parse_and_admit(sql, dialect="sqlite")

        assert result.outcome is AdmissionOutcome.ADMIT, sql

    def test_a_name_only_the_foreign_source_could_provide_still_admits(self) -> None:
        """Query-local sources can provide names absent from the DDL."""
        result = try_parse_and_admit(
            "SELECT key FROM spans, json_each(spans.attributes)", dialect="sqlite"
        )

        assert result.outcome is AdmissionOutcome.ADMIT


class TestMainstreamGrammarIsNotRefused:
    """The structural floor must not exclude ordinary analytics SQL.

    Each of these executes on its engine and was admitted before the policy was
    inverted; none was covered by the corpus, so the omission would have shipped
    silently.
    """

    @pytest.mark.parametrize(
        "sql,dialect",
        [
            ("SELECT id FROM spans WHERE 1 = 1 AND NOT TRUE", "sqlite"),
            (
                "SELECT id FROM spans WHERE start_time > "
                "CAST('2026-01-01' AS TIMESTAMP) - INTERVAL '7 days'",
                "postgresql",
            ),
            ("SELECT v.k FROM (VALUES ('a'), ('b')) AS v(k)", "postgresql"),
            ("SELECT id FROM spans WHERE name IS DISTINCT FROM 'x'", "postgresql"),
            ("SELECT id FROM spans WHERE (trace_rowid, span_kind) IN ((1, 'LLM'))", "postgresql"),
            ("SELECT name, COUNT(*) FROM spans GROUP BY ROLLUP(name)", "postgresql"),
            ("SELECT name, COUNT(*) FROM spans GROUP BY CUBE(name)", "postgresql"),
            ("SELECT name, COUNT(*) FROM spans GROUP BY GROUPING SETS ((name), ())", "postgresql"),
        ],
    )
    def test_it_admits(self, sql: str, dialect: str) -> None:
        result = try_parse_and_admit(sql, dialect=cast(SupportedSQLDialectName, dialect))

        assert result.outcome is AdmissionOutcome.ADMIT, f"{sql} -> {result.detail}"


class TestGroupByBindsToTheInputColumn:
    """`ORDER BY` and `GROUP BY` are not symmetric.

    Both engines resolve a bare `GROUP BY` name against the input columns first,
    falling back to an output alias only when no source column carries it.
    `ORDER BY` prefers the output alias.
    """

    def test_an_alias_shadowing_a_physical_column_is_admitted(self) -> None:
        result = try_parse_and_admit(
            "SELECT name AS user_id, COUNT(*) FROM datasets GROUP BY user_id", dialect="sqlite"
        )

        assert result.outcome is AdmissionOutcome.ADMIT

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT date(start_time) AS v FROM spans GROUP BY v",
            "SELECT s.name AS span_name, COUNT(*) AS v FROM span_annotations sa "
            "JOIN spans s ON s.id = sa.span_rowid GROUP BY span_name",
        ],
    )
    def test_an_alias_only_name_still_groups(self, sql: str) -> None:
        """No source column carries the name, so the engine binds to the alias
        and so must the resolver. This is ordinary bucketing SQL."""
        assert try_parse_and_admit(sql, dialect="sqlite").outcome is AdmissionOutcome.ADMIT


class TestOrderByAliasBindsOnlyAsAWholeKey:
    """An alias binds in ORDER BY only when the sort key is the bare name.

    Inside an expression both engines resolve to the input column, so treating
    every column beneath the clause as query-local would rewrite an input
    virtual column as an output alias.
    """

    @pytest.mark.parametrize(
        "key",
        [
            "gradient_start_color || ''",
            "upper(gradient_start_color)",
            "CAST(gradient_start_color AS TEXT)",
        ],
    )
    def test_an_expression_sort_key_reaches_the_real_column(self, key: str) -> None:
        result = try_parse_and_admit(
            f"SELECT id AS gradient_start_color FROM projects ORDER BY {key}", dialect="sqlite"
        )

        assert result.outcome is AdmissionOutcome.ADMIT

    def test_an_alias_shadowing_a_physical_column_is_admitted(self) -> None:
        result = try_parse_and_admit(
            "SELECT id AS gradient_start_color FROM projects ORDER BY gradient_start_color",
            dialect="sqlite",
        )

        assert result.outcome is AdmissionOutcome.ADMIT

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT count(*) AS n FROM spans ORDER BY n",
            "SELECT count(*) AS spans FROM spans ORDER BY spans",
            "SELECT name AS lbl, count(*) AS n FROM datasets GROUP BY lbl ORDER BY n",
            "SELECT id AS v FROM datasets GROUP BY v",
        ],
    )
    def test_an_alias_that_shadows_no_physical_column_is_admitted(self, sql: str) -> None:
        assert try_parse_and_admit(sql, dialect="sqlite").outcome is AdmissionOutcome.ADMIT

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT count(*) AS n FROM spans UNION SELECT count(*) FROM datasets ORDER BY n",
            "SELECT name AS lbl FROM datasets UNION SELECT name FROM datasets ORDER BY lbl",
            "SELECT id AS n FROM projects INTERSECT SELECT id FROM projects ORDER BY n",
            "SELECT id AS n FROM projects EXCEPT SELECT id FROM projects ORDER BY n DESC",
        ],
    )
    def test_a_set_operation_sorts_by_its_own_output_names(self, sql: str) -> None:
        """A compound select's ORDER BY hangs off the set operation, not either
        branch, so a walk that looks only at selects never reached it and every
        such sort key was refused as an unknown column. All four execute on both
        engines; the single-SELECT form of the same query already admitted.

        Every output name qualifies, not just the aliased ones -- a set operation
        has no input columns of its own for a key to bind to instead.
        """
        assert try_parse_and_admit(sql, dialect="sqlite").outcome is AdmissionOutcome.ADMIT

    def test_a_key_inside_a_subquery_is_not_bound_to_the_outer_aliases(self) -> None:
        """A sort or group key may contain a subquery, whose references resolve
        against its own select list. Walking through it marked an inner
        reference against the outer aliases."""
        root = parse_one(
            "SELECT id AS n FROM projects ORDER BY (SELECT s.name FROM spans s ORDER BY n LIMIT 1)",
            read="sqlite",
        )
        locality = query_local_columns(
            cast(exp.Expression, root), allowlist=load_allowlist("sqlite")
        )

        assert not any(locality.is_local(column) for column in root.find_all(exp.Column))

    def test_the_resolver_categorises_alias_evidence_apart_from_structural(self) -> None:
        """The invariant the split exists to hold.

        The rewrite substitutes virtual columns only when they resolve to a
        base relation, so alias and derived-relation evidence must remain
        distinguishable.
        """
        allowlist = load_allowlist("sqlite")

        alias_root = parse_one(
            "SELECT id AS gradient_start_color FROM projects ORDER BY gradient_start_color",
            read="sqlite",
        )
        alias = query_local_columns(cast(exp.Expression, alias_root), allowlist=allowlist)
        marked = [c for c in alias_root.find_all(exp.Column) if alias.is_local(c)]
        assert marked, "the bare sort key is local"
        assert all(alias.is_alias_bound(c) for c in marked)
        assert not any(alias.is_structurally_local(c) for c in marked)

        derived_root = parse_one("SELECT q.user_id FROM (SELECT 1 AS user_id) q", read="sqlite")
        derived = query_local_columns(cast(exp.Expression, derived_root), allowlist=allowlist)
        structural = [c for c in derived_root.find_all(exp.Column) if derived.is_local(c)]
        assert structural, "a qualified reference into a subquery is structural evidence"
        assert all(derived.is_structurally_local(c) for c in structural)
        assert not any(derived.is_alias_bound(c) for c in structural)

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT user_id FROM datasets, (SELECT 1 AS user_id) q",
            "SELECT 1 FROM datasets, (SELECT 1 AS user_id) q WHERE user_id = 1",
            "SELECT 1 AS c FROM datasets, (SELECT 1 AS user_id) q ORDER BY user_id",
            "SELECT count(*) FROM datasets, (SELECT 1 AS user_id) q GROUP BY user_id",
        ],
    )
    def test_a_derived_projection_colliding_with_a_base_column_is_admitted(self, sql: str) -> None:
        """The premise `DERIVED_PROJECTION` rests on, pinned rather than assumed.

        The name is offered by both a base table and a derived relation, so the
        category cannot say which one it means -- and does not have to, because
        both engines refuse the collision as ambiguous instead of resolving it
        toward the base table. Measured in all four positions on SQLite and
        PostgreSQL.
        """
        assert try_parse_and_admit(sql, dialect="sqlite").outcome is AdmissionOutcome.ADMIT

    def test_the_locality_answer_cannot_be_asked_by_membership(self) -> None:
        """Consumers must choose the locality evidence appropriate to their use."""
        locality = query_local_columns(
            cast(
                exp.Expression, parse_one("SELECT id AS v FROM projects ORDER BY v", read="sqlite")
            ),
            allowlist=load_allowlist("sqlite"),
        )

        with pytest.raises(TypeError):
            1 in locality  # type: ignore[operator]

    def test_the_rewrite_still_leaves_a_bare_alias_alone(self) -> None:
        rendered = rewrite(
            cast(
                exp.Expression,
                parse_one(
                    "SELECT id, 1 AS latency_ms FROM spans ORDER BY latency_ms", read="sqlite"
                ),
            ),
            RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=500),
        ).sql(dialect="sqlite")

        assert "ORDER BY latency_ms" in rendered


def test_a_render_refusal_returns_an_outcome_rather_than_raising() -> None:
    """`try_parse_and_admit` promises an outcome instead of an exception, and
    rendering can now refuse -- a statement can pass every admission check and
    still name a construct the target cannot express."""
    result = try_parse_and_admit("SELECT * FROM (VALUES (1), (2)) AS t(x)", dialect="sqlite")

    assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
