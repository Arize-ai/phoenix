from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from types import MappingProxyType
from typing import Mapping, Optional

from sqlglot import exp

from phoenix.db.ddl import load_dialect_schema
from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.manifest import manifest


def sqlglot_read_dialect(dialect: SupportedSQLDialectName) -> str:
    return "postgres" if dialect == "postgresql" else dialect


# SQLGlot expression classes treated as allowed SQL callables during admission.
# Portable across both backends.
ALLOWED_FUNC_CLASSES: frozenset[type[exp.Func]] = frozenset(
    {
        exp.Count,
        exp.Sum,
        exp.Avg,
        exp.Min,
        exp.Max,
        exp.Cast,
        exp.Case,
        exp.Coalesce,
        exp.Nullif,
        exp.Round,
        exp.Extract,
        exp.RowNumber,
        exp.Rank,
        exp.DenseRank,
        exp.Ntile,
        exp.JSONExtract,
        exp.JSONExtractScalar,
        # Type introspection over JSON. Pure, read-only, and the natural next
        # question once a caller has found a key but does not know whether the
        # value is a scalar, an object or an array -- which is the position every
        # caller is in, because the key space is not declared anywhere.
        exp.JSONType,
        # Pure scalar transforms, bounded by the size of their own input. None
        # can amplify: substring only ever shortens, lower preserves length, abs
        # is arithmetic on one value.
        exp.Abs,
        exp.Lower,
        # Upper and Length sit in the same risk class as Lower and are already
        # named in the Postgres plan gate, so refusing them at admission left
        # three layers disagreeing about the same three functions.
        exp.Upper,
        exp.Length,
        # Wall clock. Refusing it was not a policy but an accident of which
        # spellings happened to be listed: SQLite already admits
        # datetime('now'), unixepoch('now') and julianday('now'), which deliver
        # the same capability, so the same question was answerable on one
        # backend and refused on the other. The determinism objection is also
        # already conceded, since a request without explicit bounds embeds
        # datetime.now() through the default window. Decisively, only four of
        # the allowlisted tables carry a time column, so for datasets,
        # experiments, annotations and costs the injected window does nothing
        # and "created this week" has no expressible answer without this --
        # leaving a caller to write a literal date from its own belief about
        # today, which is exactly what a language model gets wrong.
        exp.CurrentTimestamp,
        exp.CurrentDate,
        exp.Substring,
        # Offset window functions. Comparing a row against its neighbour is what
        # makes a trend, a gap, or an exclusive-time union expressible at all --
        # the ranking functions cannot express any of those.
        exp.Lag,
        exp.Lead,
        # String aggregation. Unlike everything else here this one *amplifies*:
        # N rows collapse into a single cell of size proportional to N, and the
        # engine materialises that string before any cap of ours can inspect it.
        # It is admitted because the per-cell byte limit rejects an oversized
        # result and the statement deadline bounds the work, but it belongs in a
        # different risk class from its neighbours and should be the first thing
        # reconsidered if memory pressure ever appears.
        exp.GroupConcat,
    }
)

# Classes only one backend can execute. The parser is permissive and will happily
# build a node for syntax the target engine cannot run -- it parses
# ``percentile_cont(...) WITHIN GROUP (...)`` under the SQLite dialect even though
# SQLite has no such grammar. Admitting on class alone would therefore accept a
# statement that fails at execution, so the decision is made per dialect.
ALLOWED_FUNC_CLASSES_BY_DIALECT: dict[SupportedSQLDialectName, frozenset[type[exp.Func]]] = {
    "postgresql": ALLOWED_FUNC_CLASSES
    | frozenset(
        {
            # Ordered-set aggregates. SQLite reaches percentiles through a plain
            # call, percentile(x, 90), rather than WITHIN GROUP, so this class is
            # Postgres only.
            exp.PercentileCont,
            # Truncating a timestamp to an hour or a day is how nearly every
            # time series is grouped, so the natural spelling has to work.
            # Under the Postgres dialect date_trunc parses to TimestampTrunc;
            # DateTrunc is kept alongside it because other spellings of the same
            # request land on that class instead, and admitting one but not the
            # other would accept or refuse the same intent depending on how it
            # was written.
            exp.TimestampTrunc,
            exp.DateTrunc,
            # Postgres spells JSON access four ways. `->` and `->>` take a single
            # key and are admitted through the portable JSONExtract classes;
            # `#>` and `#>>` take a whole path and parse to these separate JSONB
            # classes. They are the same capability -- read one value out of a
            # document -- and the path forms are the ones that reach a nested
            # value without chaining, which is most of what this data requires.
            # Admitting only the key forms refuses the more useful spelling and
            # reports the refusal under a function name the caller never wrote.
            exp.JSONBExtract,
            exp.JSONBExtractScalar,
            # JSONB predicates in operator form: key existence, containment, and
            # path existence. Each returns a boolean and reads one document, so
            # cost is bounded by that document's size. `@>` and `<@` also test
            # array containment, bounded the same way.
            exp.JSONBContains,
            exp.JSONBContainsAnyTopKeys,
            exp.JSONBContainsAllTopKeys,
            exp.ArrayContainsAll,
            exp.ArrayContainedBy,
            exp.JSONBPathExists,
            # `?|` and `?&` take an array of keys, so the array constructor is
            # part of their spelling. Bounded by its own arguments.
            exp.Array,
            # Removing a path from a document. Output is smaller than input.
            exp.JSONBDeleteAtPath,
            # Aggregation into one document. Amplifies: N rows collapse into one
            # cell whose size grows with N, and the engine materialises it before
            # any cap of ours can inspect it. Same risk class as exp.GroupConcat
            # and admitted on the same terms -- the per-cell byte limit rejects an
            # oversized result and the statement deadline bounds the work.
            exp.JSONBObjectAgg,
        }
    ),
    "sqlite": ALLOWED_FUNC_CLASSES
    | frozenset(
        {
            # SQLite has no date_trunc. Its equivalent is strftime with a format
            # string, which parses to TimeToStr -- a name no caller ever types,
            # which is why admitting it has to be done by class rather than by
            # the spelling the caller used.
            exp.TimeToStr,
            # date() truncates a timestamp to its day, which is the coarser half
            # of the same bucketing need and the spelling most callers try
            # first. The authorizer already permitted it; only admission did
            # not, so a caller was refused a function the engine was willing to
            # run.
            exp.Date,
            # json1 construction. `json_object` is bounded by its arguments.
            #
            # The two aggregates amplify: N rows collapse into one cell whose
            # size grows with N, and the engine materialises that value before
            # any cap of ours can inspect it. They sit in the same risk class as
            # exp.GroupConcat and are admitted on the same terms -- the per-cell
            # byte limit rejects an oversized result and the statement deadline
            # bounds the work -- and should be reconsidered alongside it if
            # memory pressure ever appears.
            exp.JSONObject,
            exp.JSONArrayAgg,
            exp.JSONObjectAgg,
            # Producing a modified copy, bounded by its inputs; the SQLite
            # counterparts of jsonb_set and jsonb_insert above.
            exp.JSONSet,
            exp.JSONRemove,
        }
    ),
}


def allowed_func_classes(dialect: SupportedSQLDialectName) -> frozenset[type[exp.Func]]:
    return ALLOWED_FUNC_CLASSES_BY_DIALECT[dialect]


# Target types a CAST may name.
#
# Postgres resolves an object-identifier type by consulting the system catalogs,
# so CAST('pg_authid' AS regclass) answers whether a relation exists and returns
# its oid -- for any relation, role, function or type, including the ones the
# allowlist deliberately excludes. It never appears as a scanned relation, so the
# plan gate cannot see it: the plan names only the innocent table in the FROM.
# SQLite denies catalog reads outright, so this was a policy stated on one
# backend and absent on the other.
#
# Restricting the target to the types the data actually has costs nothing a
# caller needs -- these are the seven the manifest declares, plus the spellings
# each backend uses for them -- and removes an entire family of catalog lookups
# rather than the reg* names specifically.
ALLOWED_CAST_TYPES: frozenset[str] = frozenset(
    {
        "BOOLEAN",
        "BIGINT",
        "INT",
        "SMALLINT",
        "TINYINT",
        "DECIMAL",
        "DOUBLE",
        "FLOAT",
        "REAL",
        "NUMERIC",
        "TEXT",
        "VARCHAR",
        "CHAR",
        "NCHAR",
        "NVARCHAR",
        "DATE",
        "DATETIME",
        "TIMESTAMP",
        "TIMESTAMPTZ",
        "TIME",
        "INTERVAL",
        "JSON",
        "JSONB",
        "BINARY",
        "VARBINARY",
        "UUID",
    }
)


# Names SQLite reports to its authorizer for constructs admission already allows.
#
# Admission decides on parser node classes and on function names as the caller
# wrote them. SQLite sees neither: it sees the *rendered* statement, and rendering
# changes spelling. `json_extract(x, path)` is emitted as the `->` operator, and
# node classes such as RowNumber and Nullif arrive under their SQL names, none of
# which the caller necessarily typed.
#
# Anything admitted here and denied there fails at execution with a sanitized
# message that names nothing, so the two policies have to agree. Keeping this set
# beside the admission policy is what makes that checkable; the liveness tests
# execute every entry end to end so a gap fails loudly instead of silently.
SQLITE_AUTHORIZER_FUNCTIONS: frozenset[str] = frozenset(
    {
        # Aggregates and scalars corresponding to allowed node classes.
        "count",
        "sum",
        "avg",
        "min",
        "max",
        "round",
        "abs",
        "coalesce",
        "nullif",
        # Window functions.
        "row_number",
        "rank",
        "dense_rank",
        "ntile",
        "lag",
        "lead",
        # SQLite spelling; PostgreSQL renders the same class as string_agg.
        "group_concat",
        "substr",
        "substring",
        "lower",
        # Admitted by the parser policy as portable classes (exp.Upper,
        # exp.Length, exp.CurrentTimestamp, exp.CurrentDate) but absent here,
        # so each worked on PostgreSQL and was refused on SQLite -- the exact
        # divergence the two policies exist to prevent. The liveness suite now
        # executes all four so the gap cannot silently reopen.
        "upper",
        "length",
        "current_timestamp",
        "current_date",
        # Operators SQLite reports to the authorizer as function calls. Admission
        # never sees these as functions -- they are predicates and operators
        # governed by the operator policy -- so the two layers disagree about what
        # kind of thing they are, and only this entry reconciles them. `->` and
        # `->>` are additionally what `json_extract` is rendered as: the same
        # capability under a different spelling, not a wider one.
        "json_extract",
        "json_type",
        # Admitted by the parser policy as node classes (exp.JSONObject,
        # exp.JSONArrayAgg, exp.JSONObjectAgg, exp.JSONSet, exp.JSONRemove)
        # rather than as generic calls, so they do not arrive here through
        # allowed_anon_functions and have to be named directly.
        "json_object",
        "json_group_array",
        "json_group_object",
        "json_set",
        "json_remove",
        "encode",
        "crypto_encode",
        "typeof",
        "->",
        "->>",
        "like",
        "glob",
        # Time.
        "unixepoch",
        "julianday",
        "date",
        "datetime",
        "strftime",
        # Percentiles, from the bundled stats extension.
        "percentile",
        "median",
    }
)

# Table-valued functions surface to the authorizer as reads of a pseudo-table
# rather than as function calls, so the table check has to know about them or it
# refuses the very unnesting the function policy permits.
# Mirrors what admission permits. json_tree was listed here and nowhere else,
# so the authorizer stood ready to accept a pseudo-table admission would never
# pass -- the exact disagreement this set exists to prevent, in the direction
# that merely wastes an entry rather than opening one. Adding it properly means
# giving it the table-valued handling json_each has and a liveness case; until
# then the two lists agree by naming only what works.
SQLITE_TABLE_VALUED_FUNCTIONS: frozenset[str] = frozenset({"json_each"})

# GraphQL node identifiers for tables that have one.
#
# Everything a user sees in the UI or receives from the GraphQL API is a Relay
# global id -- base64 of "TypeName:id" -- never the integer primary key. Without a
# translation an agent holding UHJvamVjdDo3 has no way to reach the row it names,
# and no way to hand a result back to anything that speaks node ids.
#
# Only tables whose GraphQL type keys on the integer primary key appear here.
# span_costs, span_cost_details, dataset_example_revisions and the join table have
# no Node type at all, so the column is simply absent for them rather than
# present and wrong.
TABLE_GRAPHQL_TYPES: dict[str, str] = {
    "projects": "Project",
    "traces": "Trace",
    "spans": "Span",
    "span_annotations": "SpanAnnotation",
    "generative_models": "GenerativeModel",
    "project_sessions": "ProjectSession",
    "datasets": "Dataset",
    "dataset_versions": "DatasetVersion",
    "dataset_examples": "DatasetExample",
    "experiments": "Experiment",
    "experiment_runs": "ExperimentRun",
    "experiment_run_annotations": "ExperimentRunAnnotation",
}

GRAPHQL_NODE_ID_COLUMN = "graphql_node_id"


def sqlite_authorizer_functions(allowlist: "Allowlist") -> frozenset[str]:
    """Every function name the SQLite authorizer should permit for this allowlist."""
    return SQLITE_AUTHORIZER_FUNCTIONS | allowlist.allowed_anon_functions("sqlite")


# sqlglot 30+ models boolean/CASE structure as exp.Func; not SQL callables.
EXCLUDED_FUNC_CLASSES: frozenset[type[exp.Func]] = frozenset(
    {
        exp.Or,
        exp.And,
        exp.Xor,
        exp.If,
        # A coercion the parser inserts on its own when a date function is
        # applied to a column, marking "treat this as a timestamp". No caller
        # writes it and it is not a call: it renders as the bare column on
        # SQLite and as a plain CAST on Postgres. Judging it as a function would
        # refuse the enclosing date function for a node the caller never wrote,
        # and would report a denial naming something absent from their SQL.
        exp.TsOrDsToTimestamp,
        # EXISTS is a predicate over a subquery, not a callable. The subquery it
        # guards is admitted on its own terms like any other, so judging the
        # keyword as a function refuses ordinary SQL and reports the refusal as
        # "function exists is not allowed" -- naming something the caller wrote
        # but not as the thing they wrote it as.
        exp.Exists,
    }
)

ALLOWED_ANON_FUNCTIONS_COMMON: frozenset[str] = frozenset(
    {
        "rank",
        "dense_rank",
        "ntile",
        "json_extract",
    }
)

ALLOWED_ANON_FUNCTIONS_BY_DIALECT: dict[SupportedSQLDialectName, frozenset[str]] = {
    "postgresql": ALLOWED_ANON_FUNCTIONS_COMMON
    | frozenset(
        {
            "jsonb_array_elements",
            "jsonb_array_elements_text",
            "jsonb_each",
            "jsonb_each_text",
            # Reading the *type* of a JSON value, which is the Postgres spelling
            # of the json_type already admitted through its own parser class.
            # It is what makes an undeclared key space explorable at all: a
            # caller who has found a key still cannot tell whether it holds a
            # scalar, an object or an array without asking.
            "jsonb_typeof",
            "json_typeof",
            # The rest of the JSON reading surface. Each is pure and bounded by
            # the size of the document it reads.
            #
            # Size of an array value, without extracting it.
            "jsonb_array_length",
            "json_array_length",
            # Rendering. `jsonb_pretty` adds only whitespace and
            # `jsonb_strip_nulls` can only shrink, so both stay inside the
            # per-cell byte cap that governs any projected document.
            "jsonb_pretty",
            "jsonb_strip_nulls",
            # SQL/JSON path, which reaches a nested value by path expression
            # rather than by chaining accessors. `jsonb_path_query` is
            # set-returning and is declared in UNNEST_FUNCTIONS below; the rest
            # return one value or a boolean.
            "jsonb_path_query",
            "jsonb_path_query_first",
            "jsonb_path_query_array",
            "jsonb_path_exists",
            "jsonb_path_match",
            # Key enumeration, which is how an undeclared key space is explored.
            # Set-returning, so also declared in UNNEST_FUNCTIONS below.
            "jsonb_object_keys",
            "json_object_keys",
            # Construction from values already read. Bounded by its arguments.
            "jsonb_build_object",
            "jsonb_build_array",
            "json_build_object",
            "json_build_array",
            # Producing a modified copy. These write nothing: each returns a new
            # document bounded by its inputs, the same shape of operation as
            # `jsonb_strip_nulls` above. Removing a large member before it
            # crosses the per-cell byte cap is the use that matters here.
            "jsonb_set",
            "jsonb_insert",
            # Aggregation into one document, amplifying the same way
            # exp.JSONBObjectAgg does and bounded by the same two limits.
            "jsonb_agg",
            # Whole-value conversion, for building a document from values
            # already read. The whole-row spelling these also permit --
            # `row_to_json(s)` where `s` names a relation -- stays out of reach:
            # the row-valued rule in `_check_column_references` refuses a bare
            # relation reference wherever it appears.
            "to_jsonb",
            "to_json",
            "row_to_json",
        }
    ),
    "sqlite": ALLOWED_ANON_FUNCTIONS_COMMON
    | frozenset(
        {
            "unixepoch",
            "datetime",
            # The older spelling of the same idea, and the one a model is more
            # likely to reach for: julianday has been in SQLite for decades
            # while unixepoch arrived in 3.38, so published SQLite that a model
            # has read skews heavily toward julianday. Admitting only the modern
            # name refuses the more familiar phrasing of an allowed operation.
            #
            # It returns days as a float near 2.46e6, so a difference between
            # two of them carries fewer significant digits than the equivalent
            # unixepoch subtraction. That is a precision characteristic, not a
            # safety one, and it is why latency_ms is built on unixepoch.
            "julianday",
            "json_each",
            # SQLite's continuous percentile, from the bundled stats extension.
            # Verified to agree with Postgres percentile_cont to within floating
            # point representation error across null handling, empty and
            # single-row inputs, duplicates, and the full percentile range.
            "percentile",
            # The json1 reading surface. Each is pure and bounded by the size of
            # the document it reads.
            #
            # Size of an array value, and validity of a document.
            "json_array_length",
            "json_valid",
            # Rendering and normalisation. `json_pretty` adds only whitespace and
            # `json` minifies, so both stay inside the per-cell byte cap that
            # governs any projected document.
            "json_pretty",
            "json",
            # Construction from values already read. Bounded by its arguments.
            # `json_object` parses to a node class rather than a generic call, so
            # it is admitted through ALLOWED_FUNC_CLASSES_BY_DIALECT instead.
            "json_array",
            "json_quote",
            # Producing a modified copy, bounded by its inputs. `json_set` and
            # `json_remove` parse to node classes and are admitted there.
            "json_insert",
            "json_replace",
            "json_patch",
        }
    ),
}

UNNEST_FUNCTIONS: frozenset[str] = frozenset(
    {
        "jsonb_array_elements",
        "jsonb_array_elements_text",
        "jsonb_each",
        "jsonb_each_text",
        "json_each",
        # Set-returning like the four above: one row in, one row per key or per
        # path match out. Declared here as well as in the anon allowlist because
        # the plan gate recognises a set-returning node by the function named
        # inside it, so a name missing here is refused in the plan even when
        # admission passes it.
        "jsonb_object_keys",
        "json_object_keys",
        "jsonb_path_query",
    }
)

SRF_NODE_TYPES: frozenset[str] = frozenset({"Function Scan", "ProjectSet"})

# Function names permitted to appear anywhere in a PostgreSQL plan node.
#
# A ProjectSet names its functions inside its Output expressions, and those
# expressions legitimately mix the set-returning function with ordinary scalars:
# `(jsonb_each(attributes)).key, coalesce(name, '')` is one admitted statement,
# not two. Checking every extracted name against the unnest family alone would
# reject the scalar, so the gate checks against everything admission permits and
# refuses only what is in neither set.
PLAN_GATE_ALLOWED_FUNCTIONS: frozenset[str] = UNNEST_FUNCTIONS | frozenset(
    {
        # Emitted by our own rewrites, never by a caller. `graphql_node_id`
        # becomes encode(convert_to(...)) on PostgreSQL, so any statement
        # combining that column with a set-returning function had its plan
        # refused as a suspected bypass -- by the layer whose warning text says
        # such a refusal "should be investigated rather than dismissed". A gate
        # that fires on its own side's output trains the reader to ignore it.
        "encode",
        "convert_to",
        "count",
        "sum",
        "avg",
        "min",
        "max",
        "round",
        "abs",
        "coalesce",
        "nullif",
        "row_number",
        "rank",
        "dense_rank",
        "ntile",
        "json_extract",
        "jsonb_extract_path",
        "jsonb_extract_path_text",
        "json_type",
        "date_trunc",
        "extract",
        "to_char",
        "date_part",
        "percentile_cont",
        "percentile_disc",
        "upper",
        "lower",
        "length",
        "cast",
    }
)


@dataclass(frozen=True)
class TableSpec:
    name: str
    area: str
    grain: str
    # Physical columns are sourced from the generated DDL, which is the
    # authoritative dialect-specific schema. Their order matters for `*`;
    # metadata beyond their names belongs in the DDL itself.
    columns: tuple[str, ...]
    # The generator deliberately emits quoted identifiers when bare SQL would
    # bind a different PostgreSQL name. Keep that fact through to star expansion;
    # rebuilding a `MixedCase` column as an unquoted identifier silently changes
    # it to `mixedcase`.
    quoted_columns: frozenset[str] = frozenset()
    time_column: Optional[str] = None
    virtual_columns: frozenset[str] = frozenset()
    promoted_columns_note: Optional[str] = None
    # Short notes for columns whose name and type mislead. Curation, not schema:
    # the database cannot say that `parent_id` holds a `span_id`.
    column_notes: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))


@dataclass(frozen=True)
class Allowlist:
    tables: frozenset[str]
    table_specs: Mapping[str, TableSpec]
    areas: Mapping[str, frozenset[str]]
    pg_schema: str
    anon_functions: Optional[frozenset[str]] = None

    def allowed_anon_functions(self, dialect: SupportedSQLDialectName) -> frozenset[str]:
        if self.anon_functions is not None:
            return self.anon_functions
        return ALLOWED_ANON_FUNCTIONS_BY_DIALECT[dialect]


@lru_cache
def load_allowlist(dialect: SupportedSQLDialectName) -> Allowlist:
    curation = manifest()
    schema = load_dialect_schema(dialect)
    table_specs: dict[str, TableSpec] = {}
    areas: dict[str, frozenset[str]] = {}
    for area_name, area in curation.areas.items():
        names: set[str] = set()
        for table_name, table in area.tables.items():
            physical_table = schema.get(table_name)
            if physical_table is None:
                raise ValueError(
                    f"Allowlisted table {table_name!r} is missing from the DDL assets."
                )
            virtual_columns = table.virtual_columns | (
                {GRAPHQL_NODE_ID_COLUMN} if table_name in TABLE_GRAPHQL_TYPES else frozenset()
            )
            physical_by_folded_name = {
                column.casefold(): column for column in physical_table.columns
            }
            collisions = sorted(
                virtual
                for virtual in virtual_columns
                if virtual.casefold() in physical_by_folded_name
            )
            if collisions:
                # SQLite identifiers are case-insensitive regardless of quoting,
                # and this surface serves both SQLite and PostgreSQL. Rejecting
                # the overlap here avoids a virtual rewrite shadowing a physical
                # column in one backend while selecting the other in PostgreSQL.
                raise ValueError(
                    f"Allowlisted table {table_name!r} has physical/virtual column collisions: "
                    + ", ".join(
                        f"{physical_by_folded_name[virtual.casefold()]!r} and {virtual!r}"
                        for virtual in collisions
                    )
                )
            table_specs[table_name] = TableSpec(
                name=table_name,
                area=area_name,
                grain=table.grain,
                columns=physical_table.columns,
                quoted_columns=physical_table.quoted_columns,
                time_column=table.time_column,
                # Derived columns come from the manifest, plus the node id for
                # tables that have a GraphQL type -- that mapping lives in code
                # rather than the manifest because it tracks the API's type names,
                # not the database schema.
                virtual_columns=virtual_columns,
                promoted_columns_note=table.promoted_columns_note,
                column_notes=table.column_notes,
            )
            names.add(table_name)
        areas[area_name] = frozenset(names)
    return Allowlist(
        tables=frozenset(table_specs),
        table_specs=MappingProxyType(table_specs),
        areas=MappingProxyType(areas),
        pg_schema="public",
    )
