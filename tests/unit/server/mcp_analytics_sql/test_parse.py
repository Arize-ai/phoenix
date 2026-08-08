"""Admission regression corpus and the parser behaviours admission depends on.

``admission_corpus.jsonl`` holds every statement admission is known to have got
wrong at some point, together with the outcome it must now produce. Each entry
carries a note explaining what the statement exercises, so a failure says what
broke without needing outside context. Add a case whenever a new bypass is
found; never delete one.

The corpus is deliberately data rather than code. Admission is an allowlist, and
the cheapest way to weaken an allowlist is to widen it while the tests keep
passing, so the record of what must stay refused lives in a file that is easy to
read and hard to loosen by accident.

``test_parser_contract`` covers a different risk. Admission is only as sound as
the parser beneath it, and two of its guarantees are properties of SQLGlot
rather than of our code: that multi-statement input is visible rather than
silently truncated, and that comments are dropped only when explicitly asked.
Those assumptions are worth asserting directly, because a parser upgrade can
change them without any corpus entry failing.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import cast

import pytest
from sqlglot import exp, parse, parse_one

from phoenix.server.mcp_analytics_sql.allowlist import DialectName, load_allowlist
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.parse import (
    _ALLOWED_STRUCTURAL_CLASSES,
    STRUCTURAL,
    AdmissionOutcome,
    AdmissionResult,
    Locality,
    _timestamp_comparison_pairs,
    admit_sql,
    query_local_columns,
    try_parse_and_admit,
)
from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext, rewrite
from tests.unit.server.mcp_analytics_sql.admission_fixtures import minimal_admission_allowlist

CORPUS_PATH = Path(__file__).parent / "admission_corpus.jsonl"
DIALECT: DialectName = "postgresql"


def _load_corpus() -> list[dict[str, str]]:
    with CORPUS_PATH.open() as f:
        return [json.loads(line) for line in f if line.strip()]


CORPUS = _load_corpus()


def _outcome(result: AdmissionResult) -> str:
    return "admit" if result.outcome == AdmissionOutcome.ADMIT else result.outcome.value


def _case_id(case: dict[str, str]) -> str:
    dialect = case.get("dialect", DIALECT)
    return f"{dialect[:2]}-{case['note'][:44]}"


@pytest.mark.parametrize("case", CORPUS, ids=[_case_id(c) for c in CORPUS])
def test_admission_corpus(case: dict[str, str]) -> None:
    # Most statements behave identically on both backends, so the dialect is
    # optional and defaults to Postgres. Cases that name one are asserting a
    # decision that differs between engines -- typically a function only one of
    # them can execute.
    dialect = cast(DialectName, case.get("dialect", DIALECT))
    result = try_parse_and_admit(
        case["sql"], dialect=dialect, allowlist=minimal_admission_allowlist()
    )
    assert _outcome(result) == case["expect"], (
        f"{case['note']}\n  dialect: {dialect}\n  sql: {case['sql']}"
    )


def test_corpus_is_not_shrinking() -> None:
    """A corpus that quietly loses cases stops defending anything.

    The count is asserted rather than derived so that deleting a case is a
    deliberate edit to this line, not a silent side effect of editing the data.
    """
    assert len(CORPUS) >= 56
    keys = [(c["sql"], c.get("dialect", DIALECT)) for c in CORPUS]
    assert len(set(keys)) == len(keys), "duplicate statement/dialect pair in corpus"


def test_the_corpus_can_express_a_column_outcome() -> None:
    """Guard against the fixture silently disarming the column rule again.

    The fixture built its tables with `columns=()`, so `hidden_columns` was
    empty everywhere and `_check_hidden_columns` returned at its first line.
    The corpus therefore held no `column_not_allowed` entry and structurally
    could not: three of the four column bypasses this surface has had were
    invisible to the file whose job is to record what must stay refused.

    Asserted on the fixture rather than on the entries, because an entry can be
    deleted while the capability remains -- and the capability is what was
    missing.
    """
    hidden = {
        column
        for spec in minimal_admission_allowlist().table_specs.values()
        for column in spec.hidden_columns
    }
    assert hidden, "the corpus allowlist has no omitted columns, so it cannot test the rule"
    assert any(case["expect"] == "column_not_allowed" for case in CORPUS)


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


class TestHiddenColumnsAreRefused:
    """A schema that omits a column must be backed by an executor that refuses it.

    Otherwise the omission is decoration: `describeSqlSchema` stops showing
    `user_id` while `SELECT user_id FROM datasets` keeps returning it, and the
    document and the executor disagree about what the surface is. That gap is
    the defect this whole surface has produced most often -- two policy layers,
    each verified alone.

    Consistency is the whole reason, not secrecy. These columns are display
    attributes and foreign keys into tables the surface does not expose, and
    every one is readable through GraphQL by the same caller.
    """

    @pytest.mark.parametrize(
        "sql,expected",
        [
            ("SELECT user_id FROM datasets", "datasets.user_id"),
            ("SELECT d.user_id FROM datasets AS d", "datasets.user_id"),
            ("SELECT gradient_start_color FROM projects", "projects.gradient_start_color"),
            (
                "SELECT p.trace_retention_policy_id FROM projects p",
                "projects.trace_retention_policy_id",
            ),
            ("SELECT id FROM projects WHERE gradient_end_color = '#fff'", "projects."),
            ("SELECT count(*) FROM datasets GROUP BY user_id", "datasets.user_id"),
        ],
    )
    def test_a_hidden_column_is_refused_wherever_it_appears(self, sql: str, expected: str) -> None:
        allowlist = load_allowlist()
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=allowlist, dialect="sqlite")
        assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED
        assert expected in (caught.value.admission_detail or "")

    def test_the_refusal_names_the_column_rather_than_denying_it_exists(self) -> None:
        """A caller told "no such column" retries near spellings; this stops it.

        The message says the column exists and was left out for answering no
        analytical question -- which is the actual reason. Wording it as though
        the column were withheld invited the reading that this is a
        confidentiality boundary, and it is not: every omitted column is
        readable through GraphQL by the same caller.
        """
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql("SELECT user_id FROM datasets", allowlist=load_allowlist(), dialect="sqlite")
        assert "exists but is not part of the analytics schema" in caught.value.message
        assert "answers no analytical question" in caught.value.message

    def test_a_column_that_does_not_exist_is_not_described_as_withheld(self) -> None:
        """The two reach one outcome and must not share one sentence.

        Told a typo "exists and was left out", a caller stops -- when trying the
        spelling it meant is exactly what it should do. So the unknown-column
        case supplies its own wording and a suggestion drawn from the manifest,
        which cannot propose a column the caller may not read.
        """
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql("SELECT span_kindd FROM spans", allowlist=load_allowlist(), dialect="sqlite")
        assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED
        assert "is not a column of that table" in caught.value.message
        assert "Did you mean span_kind" in caught.value.message
        assert "exists but is not part of" not in caught.value.message

    def test_an_unqualified_reference_is_reported_against_every_table_checked(self) -> None:
        """Naming one of them would assert something narrower than what was tested."""
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                "SELECT nosuchthing FROM spans JOIN traces ON spans.trace_rowid = traces.id",
                allowlist=load_allowlist(),
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
    def test_exposed_columns_are_untouched(self, sql: str) -> None:
        admit_sql(sql, allowlist=load_allowlist(), dialect="sqlite")


class TestHiddenColumnsResistCaseVariation:
    """The table rule is an allowlist; this one is a denylist, and they fail opposite ways.

    An unrecognised table spelling is refused because nothing matched. An
    unrecognised *column* spelling was admitted for the same reason -- and both
    engines resolve unquoted identifiers case-insensitively, so a single capital
    letter returned exactly the data the lowercase spelling is refused for.
    Reproduced end to end on both backends before this was closed.
    """

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT GRADIENT_START_COLOR FROM projects",
            "SELECT Gradient_Start_Color FROM projects",
            "SELECT gRaDiEnT_sTaRt_CoLoR FROM projects",
            'SELECT "USER_ID" FROM span_annotations',
            "SELECT USER_ID FROM span_annotations",
            "SELECT p.TRACE_RETENTION_POLICY_ID FROM projects p",
            "SELECT count(*) FROM datasets GROUP BY USER_ID",
        ],
    )
    def test_case_variants_of_a_hidden_column_are_refused(self, sql: str) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
        assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED

    def test_the_table_allowlist_was_already_closed_under_case(self) -> None:
        """Recorded so the asymmetry that caused this is visible, not inferred."""
        for sql in ("SELECT id FROM USERS", "SELECT id FROM Users"):
            with pytest.raises(AnalyticsSqlError) as caught:
                admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
            assert caught.value.code is ErrorCode.RELATION_NOT_ALLOWED


class TestJoinsCannotLaunderAHiddenColumn:
    """`USING` and NATURAL JOIN equate columns without writing an `exp.Column`.

    Scanning column references missed both. That was not merely a read: joining
    a caller-supplied VALUES list `USING (gradient_start_color)` returns one row
    per match, so a candidate list recovers the withheld value row by row, and
    an integer key like `user_id` falls to a single query. Reproduced against
    both live backends before this was closed -- PostgreSQL returned
    (project_id, hidden_colour) pairs.
    """

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
    def test_using_a_hidden_column_is_refused(self, sql: str) -> None:
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
        assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED

    def test_natural_join_is_refused_outright(self) -> None:
        """It names nothing, so nothing can be inspected -- there is no safe subset."""
        with pytest.raises(AnalyticsSqlError) as caught:
            admit_sql(
                "SELECT count(*) FROM datasets NATURAL JOIN dataset_versions",
                allowlist=load_allowlist(),
                dialect="postgresql",
            )
        assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX
        assert "NATURAL JOIN" in caught.value.message

    def test_using_an_exposed_column_still_works(self) -> None:
        admit_sql(
            "SELECT count(*) FROM spans JOIN traces USING (id)",
            allowlist=load_allowlist(),
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
            admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
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
        admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")


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
            admit_sql(sql, allowlist=load_allowlist(), dialect="sqlite")
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
        admit_sql(sql, allowlist=load_allowlist(), dialect="sqlite")


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
        admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")

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
            admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
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
            admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
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
        _, rendered = admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
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
        admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")

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
            admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
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
        admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")


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
        admit_sql(sql, allowlist=load_allowlist(), dialect="postgresql")
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
        admit_sql(refused, allowlist=load_allowlist(), dialect=cast(DialectName, dialect))
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
        ctx = RewriteContext(allowlist=load_allowlist(), dialect="sqlite", row_limit=500)
        tree = parse_one(
            "SELECT id FROM spans WHERE start_time IN ('2026-01-01T00:00:00Z')", read="sqlite"
        )

        rendered = rewrite(tree, ctx).sql(dialect="sqlite")

        assert "2026-01-01 00:00:00" in rendered
        assert "timestamp_literals" in ctx.applied

    @pytest.mark.parametrize(
        "sql,dialect",
        [
            ("SELECT id FROM spans WHERE start_time IS DISTINCT FROM '{}'", "sqlite"),
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
            sql.format("2026-01-01T10:30:00"), dialect=cast(DialectName, dialect)
        )

        assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
        assert "time of day" in result.detail

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT id FROM spans WHERE start_time IS DISTINCT FROM '{}'",
            "SELECT CASE start_time WHEN '{}' THEN 1 ELSE 0 END FROM spans",
        ],
    )
    def test_an_aware_literal_is_rewritten_in_those_same_spellings(self, sql: str) -> None:
        ctx = RewriteContext(allowlist=load_allowlist(), dialect="sqlite", row_limit=500)
        tree = parse_one(sql.format("2026-01-01T00:00:00Z"), read="sqlite")

        rendered = rewrite(tree, ctx).sql(dialect="sqlite")

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
    def _admit(sql: str, dialect: DialectName = "postgresql") -> AdmissionResult:
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
            result = self._admit(sql, cast(DialectName, dialect))
            assert "not part of the permitted grammar" not in result.detail, f"{dialect}: {sql}"

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
        lists kept in agreement by hand, and three spellings had drifted between
        them -- each admitted, none reaching the timestamp machinery, so a naive
        literal beside one was neither refused nor rewritten and the comparison
        quietly answered wrong. Adding a class below without classifying it here
        fails, which is the only point at which the answer is cheap.
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
        # Everything else: operators, clauses, identifiers and containers. A
        # value compared under one of these reaches a comparison node first.
        not_comparing = _ALLOWED_STRUCTURAL_CLASSES - comparing

        assert comparing <= _ALLOWED_STRUCTURAL_CLASSES, (
            f"classified but not admitted: {sorted(comparing - _ALLOWED_STRUCTURAL_CLASSES)}"
        )
        assert comparing | not_comparing == _ALLOWED_STRUCTURAL_CLASSES

        # Each comparing class must actually yield pairs, so the classification
        # cannot be satisfied by naming a class the enumeration ignores.
        for sql, name in [
            ("SELECT id FROM spans WHERE start_time = 'x'", "EQ"),
            ("SELECT id FROM spans WHERE start_time IS DISTINCT FROM 'x'", "NullSafeNEQ"),
            ("SELECT id FROM spans WHERE start_time IS 'x'", "Is"),
            ("SELECT id FROM spans WHERE start_time IN ('x')", "In"),
            ("SELECT id FROM spans WHERE start_time BETWEEN 'x' AND 'y'", "Between"),
        ]:
            root = parse_one(sql, read="sqlite")
            pairs = [p for node in root.walk() for p in _timestamp_comparison_pairs(node)]
            assert pairs, f"{name} is classified as comparing but yields no pairs"

    def test_a_lossy_shape_keeps_its_own_message(self) -> None:
        """The structural policy runs after the lossy-shape checks, which name
        the hazard and a spelling that works. Told only that `HexString` is not
        in the grammar, a caller learns nothing."""
        result = self._admit("SELECT id FROM spans WHERE id = 0x1f", cast(DialectName, "sqlite"))

        assert "decimal" in result.detail
        assert "not part of the permitted grammar" not in result.detail


class TestHiddenColumnsSurviveForeignSources:
    """A source the manifest does not know cannot launder a withheld column.

    The allowlist inversion added an escape so a table-valued function could
    project names the manifest never declared. Written as a whole-scope skip, it
    meant any query cross-joining a derived table admitted every hidden column
    unqualified -- and admission is the only gate for those, since the SQLite
    authorizer is table-level and the plan gate reads relations.
    """

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT user_id FROM datasets, (SELECT 1 AS k) sub",
            "SELECT user_id FROM datasets, json_each('[1,2,3]')",
            "SELECT gradient_start_color FROM projects p, (SELECT 1 AS k) sub",
            "SELECT user_id FROM datasets",
        ],
    )
    def test_a_hidden_column_is_refused_whatever_shares_the_scope(self, sql: str) -> None:
        result = try_parse_and_admit(sql, dialect="sqlite")

        assert result.outcome is AdmissionOutcome.COLUMN_NOT_ALLOWED, sql

    def test_a_name_only_the_foreign_source_could_provide_still_admits(self) -> None:
        """The case the escape exists for. It is not hidden, so it is not
        withheld -- it is simply unknown to the manifest."""
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
        result = try_parse_and_admit(sql, dialect=cast(DialectName, dialect))

        assert "not part of the permitted grammar" not in result.detail, sql


class TestGroupByBindsToTheInputColumn:
    """`ORDER BY` and `GROUP BY` are not symmetric, and treating them alike leaked.

    Both engines resolve a bare `GROUP BY` name against the input columns first,
    falling back to an output alias only when no source column carries it.
    `ORDER BY` prefers the output alias. Marking both query-local let an alias
    shadowing a withheld column reach the real one.
    """

    def test_an_alias_shadowing_a_hidden_column_does_not_reach_it(self) -> None:
        """Measured with `name` held constant and user_id 1,2,3, so the group
        count discriminates: grouping by the alias would give one group and it
        gave three -- the withheld column's distribution."""
        result = try_parse_and_admit(
            "SELECT name AS user_id, COUNT(*) FROM datasets GROUP BY user_id", dialect="sqlite"
        )

        assert result.outcome is AdmissionOutcome.COLUMN_NOT_ALLOWED

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

    def test_order_by_still_binds_to_the_output_alias(self) -> None:
        rendered = rewrite(
            parse_one("SELECT id, 1 AS latency_ms FROM spans ORDER BY latency_ms", read="sqlite"),
            RewriteContext(allowlist=load_allowlist(), dialect="sqlite", row_limit=500),
        ).sql(dialect="sqlite")

        assert "ORDER BY latency_ms" in rendered


class TestOrderByAliasBindsOnlyAsAWholeKey:
    """An alias binds in ORDER BY only when the sort key is the bare name.

    Inside an expression both engines resolve to the input column, so treating
    every column beneath the clause as query-local let a shadowing alias reach a
    withheld one. Measured on rows (1,'zzz') (2,'aaa') (3,'mmm'):
    `ORDER BY gradient_start_color || ''` returned 2,3,1 -- the hidden column's
    order -- while the bare alias returned 1,2,3.
    """

    @pytest.mark.parametrize(
        "key",
        [
            "gradient_start_color || ''",
            "upper(gradient_start_color)",
            "CAST(gradient_start_color AS TEXT)",
        ],
    )
    def test_an_expression_sort_key_reaches_the_real_column_and_is_refused(self, key: str) -> None:
        result = try_parse_and_admit(
            f"SELECT id AS gradient_start_color FROM projects ORDER BY {key}", dialect="sqlite"
        )

        assert result.outcome is AdmissionOutcome.COLUMN_NOT_ALLOWED

    def test_an_alias_shadowing_a_withheld_column_is_refused_even_when_it_binds(self) -> None:
        """Refused on the category of evidence, not on where the name binds.

        A bare sort key really does bind to the output -- measured on both
        engines -- so this refuses a statement that would have been harmless.
        The trade is deliberate: the check declines alias-precedence evidence
        outright, so no future correction to that model can turn into a
        disclosure. Renaming the alias recovers the query, and only an alias
        colliding with a withheld name is affected.
        """
        result = try_parse_and_admit(
            "SELECT id AS gradient_start_color FROM projects ORDER BY gradient_start_color",
            dialect="sqlite",
        )

        assert result.outcome is AdmissionOutcome.COLUMN_NOT_ALLOWED

    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT count(*) AS n FROM spans ORDER BY n",
            "SELECT name AS lbl, count(*) AS n FROM datasets GROUP BY lbl ORDER BY n",
            "SELECT id AS v FROM datasets GROUP BY v",
        ],
    )
    def test_an_alias_that_shadows_nothing_withheld_is_still_admitted(self, sql: str) -> None:
        """The strict bar applies to the disclosure check alone.

        Applying it to the unknown-column check as well would refuse ordinary
        aliasing, where the name is the caller's own and no table was consulted.
        """
        assert try_parse_and_admit(sql, dialect="sqlite").outcome is AdmissionOutcome.ADMIT

    def test_the_resolver_categorises_alias_evidence_apart_from_structural(self) -> None:
        """The invariant the split exists to hold.

        Both alias-precedence defects found so far were wrong readings of where
        a name binds. Pinning the shape of the answer rather than each reading
        is what stops the next one from being a disclosure: the category is what
        the check consults, so a reference marked local by the select list can
        never be mistaken for one that resolves into a derived relation.
        """
        allowlist = load_allowlist()

        alias = query_local_columns(
            parse_one(
                "SELECT id AS gradient_start_color FROM projects ORDER BY gradient_start_color",
                read="sqlite",
            ),
            allowlist=allowlist,
        )
        assert set(alias.values()) == {Locality.OUTPUT_ALIAS}
        assert not set(alias.values()) & STRUCTURAL

        derived = query_local_columns(
            parse_one("SELECT q.user_id FROM (SELECT 1 AS user_id) q", read="sqlite"),
            allowlist=allowlist,
        )
        assert set(derived.values()) <= STRUCTURAL
        assert derived, "a qualified reference into a subquery is structural evidence"

    def test_the_rewrite_still_leaves_a_bare_alias_alone(self) -> None:
        rendered = rewrite(
            parse_one("SELECT id, 1 AS latency_ms FROM spans ORDER BY latency_ms", read="sqlite"),
            RewriteContext(allowlist=load_allowlist(), dialect="sqlite", row_limit=500),
        ).sql(dialect="sqlite")

        assert "ORDER BY latency_ms" in rendered


def test_a_render_refusal_returns_an_outcome_rather_than_raising() -> None:
    """`try_parse_and_admit` promises an outcome instead of an exception, and
    rendering can now refuse -- a statement can pass every admission check and
    still name a construct the target cannot express."""
    result = try_parse_and_admit("SELECT * FROM (VALUES (1), (2)) AS t(x)", dialect="sqlite")

    assert result.outcome is AdmissionOutcome.UNSUPPORTED_SYNTAX
