"""Declarative regression cases for analytics SQL admission."""

from __future__ import annotations

from dataclasses import dataclass

from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.parse import AdmissionOutcome


@dataclass(frozen=True)
class AdmissionCase:
    sql: str
    expect: AdmissionOutcome
    note: str
    dialect: SupportedSQLDialectName = "postgresql"


CASES: tuple[AdmissionCase, ...] = (
    AdmissionCase(
        sql="SELECT id FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="simple select against an allowlisted table",
    ),
    AdmissionCase(
        sql="SELECT * FROM users",
        expect=AdmissionOutcome.RELATION_NOT_ALLOWED,
        note="relation absent from the manifest",
    ),
    AdmissionCase(
        sql="SELECT generate_series(1, 100000000000) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="set-returning function that SQLGlot models with a dedicated node class, so a check inspecting only generic call nodes misses it",
    ),
    AdmissionCase(
        sql="SELECT * FROM generate_series(1, 100000000000)",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="same function in table position; must be refused for being disallowed, not incidentally because the parser produced an empty table name",
    ),
    AdmissionCase(
        sql="SELECT * FROM unnest(ARRAY[1,2,3])",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="array unnest in table position, modelled with a dedicated node class",
    ),
    AdmissionCase(
        sql="SELECT id FROM spans; DROP TABLE users",
        expect=AdmissionOutcome.MULTI_STATEMENT,
        note="two statements must be refused, never truncated to the first",
    ),
    AdmissionCase(
        sql="SELECT id FROM spans /* /* */ WHERE 1=0 */",
        expect=AdmissionOutcome.ADMIT,
        note="nested comment must not survive into the rendered statement",
    ),
    AdmissionCase(
        sql="SELECT id FROM spans /* /* */ ; DROP TABLE api_keys */",
        expect=AdmissionOutcome.ADMIT,
        note="comment payload carrying a second statement; rendering must strip comments rather than pass them through",
    ),
    AdmissionCase(
        sql="SELECT abs(id) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="allowlisted 2026-08-02: arithmetic on one value; bounded by its own input",
    ),
    AdmissionCase(
        sql="SELECT * INTO temp FROM spans",
        expect=AdmissionOutcome.NOT_READ_ONLY,
        note="SELECT INTO creates a table",
    ),
    AdmissionCase(
        sql="SELECT * FROM spans FOR UPDATE",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="row locking takes write locks",
    ),
    AdmissionCase(
        sql="WITH RECURSIVE spans(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM spans WHERE n<5) SELECT * FROM spans",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="recursive CTE can loop unboundedly, and its name shadows an allowlisted table",
    ),
    AdmissionCase(
        sql="SELECT * FROM spans, LATERAL generate_series(1, 10) AS g(i)",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="lateral join reaches a set-returning function without it appearing in the select list",
    ),
    AdmissionCase(
        sql="COPY spans TO '/tmp/x'",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="bulk copy writes to the filesystem and is not a select",
    ),
    AdmissionCase(
        sql="SELECT lower(name) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="allowlisted 2026-08-02: case folding preserves length; cannot amplify",
    ),
    AdmissionCase(
        sql="SELECT substring(name, 1, 2) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="allowlisted 2026-08-02: substring only ever shortens its input",
    ),
    AdmissionCase(
        sql="SELECT repeat(name, 1000000000) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="repeat can allocate unbounded memory from a small statement",
    ),
    AdmissionCase(
        sql="SELECT md5(name) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="hash function with a dedicated node class",
    ),
    AdmissionCase(
        sql="WITH users AS (SELECT 1 AS id) SELECT id FROM users",
        expect=AdmissionOutcome.ADMIT,
        note="a CTE named after a denied table is a lexical symbol, not that table; over-eager scoping would wrongly refuse this",
    ),
    AdmissionCase(
        sql="SELECT * FROM users WHERE id IN (WITH users AS (SELECT 1 AS id) SELECT id FROM users)",
        expect=AdmissionOutcome.RELATION_NOT_ALLOWED,
        note="the inner CTE must not make the outer reference to the real denied table acceptable",
    ),
    AdmissionCase(
        sql="WITH x AS (SELECT * FROM users) SELECT * FROM x",
        expect=AdmissionOutcome.RELATION_NOT_ALLOWED,
        note="a denied table inside a CTE body is still a real relation",
    ),
    AdmissionCase(
        sql="SELECT count(*), max(end_time) FROM spans GROUP BY span_kind",
        expect=AdmissionOutcome.ADMIT,
        note="allowed aggregates",
    ),
    AdmissionCase(
        sql="SELECT row_number() OVER (ORDER BY id) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="allowed ranking function with a dedicated node class",
    ),
    AdmissionCase(
        sql="SELECT rank() OVER (ORDER BY id) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="allowed ranking function the parser models as a generic call, exercising the other branch of the function check",
    ),
    AdmissionCase(
        sql="SELECT ROUND(CAST((EXTRACT(EPOCH FROM end_time) - EXTRACT(EPOCH FROM start_time)) * 1000 AS NUMERIC), 1) AS latency_ms FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="latency expression from the teaching examples must survive admission",
    ),
    AdmissionCase(
        sql="SELECT s.id FROM spans AS s JOIN traces AS t ON s.trace_rowid = t.id",
        expect=AdmissionOutcome.ADMIT,
        note="aliased join across two allowlisted tables",
    ),
    AdmissionCase(
        sql="SELECT * FROM public.spans",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="caller-supplied schema qualification is refused; the server qualifies accepted relations itself after admission",
    ),
    AdmissionCase(
        sql="SELECT id FROM spans WHERE 1=0 UNION SELECT id FROM users",
        expect=AdmissionOutcome.RELATION_NOT_ALLOWED,
        note="a denied table reached through a UNION branch is still a real relation, even when the other branch is allowlisted",
    ),
    AdmissionCase(
        sql="SELECT jsonb_each(attributes) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="allowed JSON unnest in the select list; admission accepts it, so anything that later refuses it is refusing a legitimate query",
    ),
    AdmissionCase(
        sql="SELECT id FROM spans WHERE latency_ms > 100",
        expect=AdmissionOutcome.ADMIT,
        note="latency_ms is a derived column substituted after admission, so admission must not reject it as an unknown identifier",
    ),
    AdmissionCase(
        sql="SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY id) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="continuous percentile is allowed on Postgres, which has ordered-set aggregate syntax",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY id) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="the same statement is refused on SQLite, which has no WITHIN GROUP grammar; the parser builds the node anyway, so the class check must be dialect-aware",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT percentile(id, 50) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="SQLite reaches percentiles through a plain call from the bundled stats extension",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT percentile(id, 50) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="the SQLite spelling is not a Postgres function and must not be admitted there",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY id) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="discrete percentile returns an actual data point rather than an interpolated one, has no SQLite counterpart, and stays denied until measured separately",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT mode() WITHIN GROUP (ORDER BY id) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="allowing one ordered-set aggregate must not admit the others",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT lag(id) OVER (ORDER BY id) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="offset window function; comparing a row to its neighbour is what makes a trend expressible",
    ),
    AdmissionCase(
        sql="SELECT lead(id) OVER (ORDER BY id) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="offset window function, forward direction",
    ),
    AdmissionCase(
        sql="SELECT group_concat(name) FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="string aggregation; the one admitted function that amplifies, bounded by the per-cell byte cap",
    ),
    AdmissionCase(
        sql="SELECT repeat(name, 1000000) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="disconfirming: adjacent to the admitted string functions but amplifies a small statement into a huge value",
    ),
    AdmissionCase(
        sql="SELECT printf('%.100000f', 1.0) FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="disconfirming: format strings can amplify without any large input",
    ),
    AdmissionCase(
        sql="SELECT date_trunc('hour', start_time) AS bucket FROM spans GROUP BY bucket",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="SQLite has no date_trunc; admitting it would defer a guaranteed failure to execution time",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT EXTRACT(epoch FROM start_time) AS seconds FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="SQLGlot parses EXTRACT for SQLite, but its FROM grammar is PostgreSQL-only",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT EXTRACT(epoch FROM start_time) AS seconds FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="PostgreSQL supports the standard EXTRACT(field FROM value) grammar",
    ),
    AdmissionCase(
        sql="SELECT name ILIKE '%root%' FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="PostgreSQL supports case-insensitive LIKE predicates",
    ),
    AdmissionCase(
        sql="SELECT name NOT ILIKE '%root%' FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="PostgreSQL supports negated case-insensitive LIKE predicates",
    ),
    AdmissionCase(
        sql="SELECT name ILIKE '%root%' FROM spans",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="SQLite has no ILIKE grammar, so admit neither spelling of its case-insensitive match",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT name SIMILAR TO '%root%' FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="PostgreSQL supports SQL-standard pattern predicates",
    ),
    AdmissionCase(
        sql="SELECT name SIMILAR TO '%root%' FROM spans",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="SQLite has no SIMILAR TO grammar",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT strftime('%Y-%m-%d %H', start_time) AS bucket FROM spans GROUP BY bucket",
        expect=AdmissionOutcome.ADMIT,
        note="strftime is SQLite's hour bucketing and parses to TimeToStr, a class name the caller never writes",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT name, COUNT(*) FROM spans GROUP BY ROLLUP(name)",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="SQLite parses ROLLUP but cannot execute it; refuse before opening the backend",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT name, COUNT(*) FROM spans GROUP BY CUBE(name)",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="SQLite parses CUBE but cannot execute it; PostgreSQL remains covered by grammar tests",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT name, COUNT(*) FROM spans GROUP BY GROUPING SETS ((name), ())",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="SQLite parses GROUPING SETS but cannot execute it",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT gradient_start_color FROM projects",
        expect=AdmissionOutcome.ADMIT,
        note="a physical DDL column is admitted even though older manifest policy omitted it",
    ),
    AdmissionCase(
        sql="SELECT GRADIENT_START_COLOR FROM projects",
        expect=AdmissionOutcome.ADMIT,
        note="physical DDL columns remain queryable under ordinary identifier case folding",
    ),
    AdmissionCase(
        sql='SELECT "GRADIENT_START_COLOR" FROM projects',
        expect=AdmissionOutcome.COLUMN_NOT_ALLOWED,
        note="quoted PostgreSQL identifiers preserve case and do not name lowercase physical columns",
    ),
    AdmissionCase(
        sql="SELECT p FROM projects p",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="a bare reference to a relation is the whole row, omitted columns included, and names no column so every per-column rule was inapplicable",
    ),
    AdmissionCase(
        sql="SELECT CAST(p AS TEXT) FROM projects p",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="the same row-valued reference inside a cast, which is how it was first found returning every column of the table",
    ),
    AdmissionCase(
        sql="SELECT (p).gradient_start_color FROM projects p",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="composite field access reaches a field of the row without producing a column node for it",
    ),
    AdmissionCase(
        sql="SELECT p.id FROM projects p JOIN (SELECT '#x' AS gradient_start_color) g USING (gradient_start_color)",
        expect=AdmissionOutcome.ADMIT,
        note="USING may name any physical DDL column",
    ),
    AdmissionCase(
        sql="SELECT count(*) FROM projects NATURAL JOIN traces",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="NATURAL JOIN leaves join keys implicit, so require ON",
    ),
    AdmissionCase(
        sql="SELECT (jsonb_each(attributes)).key FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="field access on a set-returning function's result is not the row-valued escape; a blanket refusal of composite access removed the idiom this surface's own plan-gate comment cites",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT count(*) FROM spans WHERE (attributes #>> ('{session,id}'::text[])) IS NOT NULL",
        expect=AdmissionOutcome.ADMIT,
        note="an array of an allowed element type reaches nothing the element type does not; refusing it made the surface reject the index spelling it publishes",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT count(*) FROM spans WHERE (attributes #>> '{session,id}'::text[]) IS NOT NULL",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="a cast written bare after #>> parses as a cast of the whole extraction, which is also what a deliberate CAST(a #>> b AS text[]) produces; the two readings are indistinguishable after parsing so neither is chosen for the caller",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT CAST(attributes #>> '{session,id}' AS text[]) AS v FROM spans",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="the deliberate spelling of the same ambiguous tree, refused for the same reason; (attributes #>> '{session,id}')::text[] says it unambiguously and is admitted",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT (attributes #>> '{session,id}')::text[] AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="casting the extracted value is unambiguous once parenthesised, and is a real operation: PostgreSQL parses the extracted string as an array literal",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT CAST('pg_authid' AS regclass) FROM spans",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="object-identifier types consult the catalogs for any relation, role or function and never appear as a scanned relation, so the plan gate cannot see them; this is why cast targets are restricted at all",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="WITH x AS (SELECT 1 AS v) SELECT gradient_start_color FROM projects AS x, x",
        expect=AdmissionOutcome.UNSUPPORTED_SYNTAX,
        note="a table aliased to a CTE's name is dropped from the scope map every later check reads, so it was skipped rather than refused",
    ),
    AdmissionCase(
        sql="WITH t AS (SELECT 1 AS v) SELECT n FROM (SELECT count(*) AS n FROM spans AS t) q",
        expect=AdmissionOutcome.ADMIT,
        note="the same names in different scopes are legal and unambiguous; the first version of that check refused this, and t is both the commonest CTE name and the commonest alias",
    ),
    AdmissionCase(
        sql="SELECT attributes ? 'session' AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="key existence, the first question anyone asks of a JSONB column; the operator form of a key-existence test; its refusal names the parser class jsonb_contains, which is not PostgreSQL's function for it",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT attributes @? '$.a' AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="JSON path existence; JSON path existence; sql_names() has no function spelling for an operator, so a refusal here names j_s_o_n_b_path_exists, which exists nowhere",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT attributes ?| ARRAY['a','b'] AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="the array constructor is part of this operator's spelling, so the operator is unusable unless exp.Array is admitted too",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT jsonb_object_keys(attributes) AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="set-returning, so it must be in UNNEST_FUNCTIONS as well as the anon allowlist or the plan gate refuses what admission passed",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT jsonb_set(attributes, '{a}', '1') AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="returns a modified copy bounded by its inputs; writes nothing, and removing a large member before it crosses the per-cell byte cap is the use that matters",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT json_array_length(attributes) AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="json1 size function; the SQLite counterpart of jsonb_array_length, bounded by the document it reads",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT json_group_array(name) AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="parses to a node class rather than a generic call, so it reaches the SQLite authorizer only by being named in SQLITE_AUTHORIZER_FUNCTIONS",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT json_set(attributes, '$.a', 1) AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="the SQLite counterpart of jsonb_set; parses to a node class, so it reaches the authorizer only by being named in SQLITE_AUTHORIZER_FUNCTIONS",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT json_tree(attributes) AS v FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="table-valued like json_each, but without the table-valued handling that makes json_each work; admitting it would defer a guaranteed failure to execution",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT attributes ? 'session' AS v FROM spans",
        expect=AdmissionOutcome.FUNCTION_NOT_ALLOWED,
        note="declared asymmetry: SQLite has no key-existence operator, so the question is asked with json_extract(...) IS NOT NULL or json_each; the refusal names the parser class jsonb_contains rather than the operator written",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT jsonb_agg(attributes) AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="aggregation into one document; amplifies like group_concat and is bounded by the per-cell byte cap and the statement deadline",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT attributes #- '{a}' AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="path removal in operator form; output is smaller than input",
        dialect="postgresql",
    ),
    AdmissionCase(
        sql="SELECT json_remove(attributes, '$.a') AS v FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="the SQLite counterpart of the #- operator, parsed as a node class",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT no_such_column FROM spans",
        expect=AdmissionOutcome.COLUMN_NOT_ALLOWED,
        note="the column policy is an allowlist: a name the manifest does not offer is refused, not merely one on a hidden list",
    ),
    AdmissionCase(
        sql="SELECT latency_ms FROM spans",
        expect=AdmissionOutcome.ADMIT,
        note="a virtual column is advertised and not stored, so the allowlist must offer it despite its absence from the manifest columns",
    ),
    AdmissionCase(
        sql="SELECT key FROM spans, json_each(spans.attributes)",
        expect=AdmissionOutcome.ADMIT,
        note="a table-valued function offers names the manifest never declared, so an unqualified reference beside one cannot be attributed to a base table",
        dialect="sqlite",
    ),
    AdmissionCase(
        sql="SELECT s.* FROM spans s",
        expect=AdmissionOutcome.ADMIT,
        note="a star is expanded from the manifest by a later pass and is not a column reference",
    ),
)
