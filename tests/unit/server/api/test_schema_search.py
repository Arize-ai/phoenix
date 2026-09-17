"""Tests for the schema search index.

Behaviour is tested against ``TOY_SDL``, a schema these tests own, so a change
to Phoenix's schema cannot break them. The real schema is used only for
properties that hold for every type and field, and for invariants of the index
itself. Do not pin a Phoenix type, field, or argument name here: when the
schema moves, convert the assertion, do not re-pin it.
"""

from __future__ import annotations

import re
import time

import pytest
import strawberry
from graphql import (
    GraphQLArgument,
    GraphQLInputObjectType,
    GraphQLInterfaceType,
    GraphQLObjectType,
    GraphQLScalarType,
    GraphQLSchema,
    GraphQLUnionType,
    build_schema,
    get_named_type,
    parse,
)
from graphql.language import ValueNode, parse_value, print_ast
from graphql.pyutils import Undefined
from graphql.utilities import ast_from_value, value_from_ast_untyped

from phoenix.server.api.schema import build_graphql_schema
from phoenix.server.api.schema_search import (
    READ_ROOTS,
    Index,
    _stem,
    _stem_cached,
    _terms,
    build_index,
    cached_index,
    describe,
    lookup,
    lookup_many,
    reach_paths,
    search,
    search_many,
    tokenize,
)

TOY_SDL = '''
schema { query: Query mutation: Mutation subscription: Subscription }

"""An object with a globally unique ID."""
interface Node { id: ID! }

type Query {
  projects(first: Int = 50, last: Int, after: String, before: String, sort: ProjectSort, filter: ProjectFilter): ProjectConnection!
  getProjectByName(name: String!): Project
  getSpanByOtelId(spanId: String!): Span
  getTraceByOtelId(traceId: String!): Trace
  node(id: ID!): Node!
  datasets(first: Int = 50, last: Int, after: String, before: String): DatasetConnection!
  promptVersions(first: Int = 50, after: String): PromptVersionConnection!
  version: String
}

"""A project groups traces."""
type Project implements Node {
  id: ID!
  name: String!
  """Number of spans in the project."""
  recordCount: Int!
  spans(first: Int!, timeRange: TimeRange, last: Int, after: String, before: String, sort: SpanSort, rootSpansOnly: Boolean = true): SpanConnection!
  """Average session duration in milliseconds."""
  averageSessionDurationMs: Float
  spanAnnotationNames: [String!]!
  traceCountTimeSeries(timeRange: TimeRange!, timeBinConfig: TimeBinConfig): TraceCountTimeSeries!
  latencyMsQuantile(probability: Float!, timeRange: TimeRange): Float
}

type Span implements Node {
  id: ID!
  name: String!
  statusCode: SpanStatusCode!
  """Status code that percolates up from descendant spans."""
  propagatedStatusCode: SpanStatusCode!
  latencyMs: Float
  costSummary: SpanCostSummary
  spanAnnotations(filter: AnnotationFilter = null): [SpanAnnotation!]!
  trace: Trace!
  project: Project!
}

type Trace implements Node {
  id: ID!
  traceId: ID!
  latencyMs: Float
  rootSpan: Span
  spans(first: Int = 50, after: String): SpanConnection!
  project: Project!
}

type SpanAnnotation implements Node { id: ID! name: String! label: String score: Float }
type SpanCostSummary { prompt: CostBreakdown! total: CostBreakdown! }
type CostBreakdown { tokens: Float cost: Float }

type Dataset implements Node {
  id: ID!
  name: String!
  exampleCount: Int!
  experiments(first: Int = 50, after: String): ExperimentConnection!
  baselineExperiment: Experiment
}
type Experiment implements Node {
  id: ID!
  name: String!
  averageRunLatencyMs: Float
  runs(first: Int = 50, after: String, sort: ExperimentRunSort): ExperimentRunConnection!
  dataset: Dataset!
}
type ExperimentRun implements Node { id: ID! error: String latencyMs: Float! }

type TraceCountTimeSeries { data: [TraceCountTimeSeriesDataPoint!]! }
type TraceCountTimeSeriesDataPoint { timestamp: DateTime! okCount: Int errorCount: Int }

union PromptTemplate = PromptStringTemplate | PromptChatTemplate
type PromptStringTemplate { template: String! }
type PromptChatTemplate { messages: [String!]! }
type PromptVersion implements Node { id: ID! template: PromptTemplate! }

type PageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! startCursor: String endCursor: String }
type ProjectConnection { edges: [ProjectEdge!]! pageInfo: PageInfo! }
type ProjectEdge { node: Project! cursor: String! }
type SpanConnection { edges: [SpanEdge!]! pageInfo: PageInfo! }
type SpanEdge { node: Span! cursor: String! }
type DatasetConnection { edges: [DatasetEdge!]! pageInfo: PageInfo! }
type DatasetEdge { node: Dataset! cursor: String! }
type ExperimentConnection { edges: [ExperimentEdge!]! pageInfo: PageInfo! }
type ExperimentEdge { node: Experiment! cursor: String! }
type ExperimentRunConnection { edges: [ExperimentRunEdge!]! pageInfo: PageInfo! }
type ExperimentRunEdge { node: ExperimentRun! cursor: String! }
type PromptVersionConnection { edges: [PromptVersionEdge!]! pageInfo: PageInfo! }
type PromptVersionEdge { node: PromptVersion! cursor: String! }

scalar DateTime

input TimeRange {
  """The start of the time range."""
  start: DateTime = null
  end: DateTime = null
}
input TimeBinConfig { scale: TimeBinScale! = HOUR utcOffsetMinutes: Int! = 0 }
enum TimeBinScale { MINUTE HOUR DAY }
enum SpanStatusCode { OK ERROR UNSET }
input SpanSort { col: SpanColumn! dir: SortDir! }
enum SpanColumn { startTime latencyMs }
enum SortDir { asc desc }
input ProjectSort { col: ProjectColumn! dir: SortDir! }
enum ProjectColumn { name endTime }
input ProjectFilter { col: ProjectFilterColumn! value: String! }
enum ProjectFilterColumn { name }
input AnnotationFilter { names: [String!] }
input ExperimentRunSort { col: ExperimentRunColumn! dir: SortDir! }
enum ExperimentRunColumn { latencyMs }

type Mutation {
  deleteDataset(input: DeleteDatasetInput!): DatasetMutationPayload!
  addExamplesToDataset(input: AddExamplesToDatasetInput!): DatasetMutationPayload!
  clearProject(input: ClearProjectInput!): Query!
  createSession(input: CreateSessionInput!): Session!
  transferTraces(traceIds: [ID!]!, projectId: ID!): Query!
}
input DeleteDatasetInput { datasetId: ID! }
input AddExamplesToDatasetInput { datasetId: ID! examples: [DatasetExampleInput!]! }
input DatasetExampleInput { input: String! output: String }
input ClearProjectInput { id: ID! }
input CreateSessionInput { isEphemeral: Boolean! = false }
type DatasetMutationPayload { dataset: Dataset! }
type Session { id: ID! }

type Subscription { chatCompletion(input: ChatCompletionInput!): ChatCompletionPayload! }
input ChatCompletionInput { promptVersionId: ID! }
interface ChatCompletionPayload { datasetExampleId: ID }
type TextChunk implements ChatCompletionPayload { datasetExampleId: ID content: String! }
'''

PAGINATION = "…"
PAGINATION_ARGUMENTS = "first: Int, last: Int, after: String, before: String"
PAGINATION_LEGEND = f"# {PAGINATION} = {PAGINATION_ARGUMENTS}"
DISABLED = "-- Mutations are disabled for this session and are not listed."


@pytest.fixture(scope="module")
def toy_schema() -> GraphQLSchema:
    return build_schema(TOY_SDL)


@pytest.fixture(scope="module")
def toy(toy_schema: GraphQLSchema) -> Index:
    return build_index(toy_schema)


@pytest.fixture(scope="module")
def toy_reads_only(toy_schema: GraphQLSchema) -> Index:
    return build_index(toy_schema, include_mutations=False)


@pytest.fixture(scope="module")
def schema() -> strawberry.Schema:
    return build_graphql_schema()


@pytest.fixture(scope="module")
def graphql_schema(schema: strawberry.Schema) -> GraphQLSchema:
    return schema._schema


@pytest.fixture(scope="module")
def index(graphql_schema: GraphQLSchema) -> Index:
    return build_index(graphql_schema)


def first_line(text: str) -> str:
    """The first hit or definition line, with a grouped hit re-joined to its owner."""
    lines = text.splitlines()
    if (
        len(lines) > 1
        and lines[1].startswith("  ")
        and not lines[0].startswith(("type ", "enum ", "input ", "interface ", "union "))
    ):
        owner, _, via = lines[0].partition("  via ")
        return f"{owner}.{lines[1].strip()}" + (f"  via {via}" if via else "")
    return lines[0]


# --- tokenizing ------------------------------------------------------------------


@pytest.mark.parametrize(
    "identifier,expected",
    [
        (
            "traceLatencyMsPercentileTimeSeries",
            ["trace", "latency", "ms", "percentile", "time", "series"],
        ),
        ("getSpanByOtelId", ["get", "span", "by", "otel", "id"]),
        ("oauth2Grants", ["oauth", "2", "grants"]),
        ("status_code", ["status", "code"]),
        ("LLMEvaluator", ["llm", "evaluator"]),
    ],
)
def test_tokenizer(identifier: str, expected: list[str]) -> None:
    assert tokenize(identifier) == expected


def test_identifiers_inside_descriptions_contribute_their_parts() -> None:
    terms = _terms("The window uses startTime and endTime.")
    assert {"starttim", "start", "time", "end", "endtim"} <= set(terms)


# --- searching -------------------------------------------------------------------


@pytest.mark.parametrize(
    "query,expected",
    [
        # Stemming: "annotate" reaches "annotations", "latencies" reaches "latency".
        ("annotate spans", "  spanAnnotations("),
        ("latencies", "  latencyMs: Float"),
        # The verb is normalized like every other term, so it still marks intent.
        ("deleting a dataset", "mutation deleteDataset("),
        # Plural query terms match singular identifiers.
        ("span annotations names", "  spanAnnotationNames: [String!]!"),
    ],
)
def test_stemmed_terms_reach_their_identifiers(toy: Index, query: str, expected: str) -> None:
    assert expected in search(toy, query)


def test_snake_case_terms_find_camel_case_fields(toy: Index) -> None:
    top = search(toy, "status_code").splitlines()[:3]
    assert top[0] == "Span  via Query.getSpanByOtelId"
    assert all(line.startswith("  ") and "StatusCode" in line for line in top[1:])


def test_description_only_match(toy: Index) -> None:
    # "percolates" appears in one field description and in no identifier.
    assert first_line(search(toy, "percolates")).startswith("Span.propagatedStatusCode")


def test_single_owner_hits_group_under_their_owner(toy: Index) -> None:
    lines = search(toy, "projects").splitlines()
    headers = [i for i, line in enumerate(lines) if re.fullmatch(r"[A-Z]\w*(  via .*)?", line)]
    assert lines[headers[0]].split("  ")[0] in {"Query", "Project"}
    # Every header is followed by at least one indented hit, and owners appear once.
    owners = [lines[i].split("  ")[0] for i in headers]
    assert len(owners) == len(set(owners))
    assert all(lines[i + 1].startswith("  ") for i in headers)
    # A read root's header carries its entry point.
    assert search(toy, "annotate spans").startswith(
        "Span  via Query.getSpanByOtelId\n  spanAnnotations("
    )


def test_shared_hits_list_every_owner(toy: Index) -> None:
    text = search(toy, "latency ms")
    line = next(line for line in text.splitlines() if line.startswith("latencyMs: Float  # on "))
    owners = line.split("  # on ", 1)[1].split(", ")
    assert set(owners) == {"Span", "Trace"}
    for owner in owners:
        assert first_line(lookup(toy, f"{owner}.latencyMs")) == f"{owner}.latencyMs: Float"


def test_top_hit_follows_the_list_in_full(toy: Index) -> None:
    text = search(toy, "trace by otel id")
    assert "# Query.getTraceByOtelId in full:" in text
    assert "\nQuery.getTraceByOtelId(traceId: String!): Trace\n" in text
    assert "# Trace: id, traceId" in text
    mutations = search(toy, "deleting a dataset")
    assert "# deleteDataset in full:" in mutations
    assert "input DeleteDatasetInput {" in mutations
    # A shared top hit is not expanded.
    index = build_index(
        build_schema("type Query { a: A, b: B }\ntype A { size: Int }\ntype B { size: Int }")
    )
    shared = search(index, "size")
    assert first_line(shared) == "size: Int  # on A, B"
    assert " in full:" not in shared


def test_search_with_an_exact_name_is_a_full_lookup(toy: Index) -> None:
    assert search(toy, "Project", budget=4000) == lookup(toy, "Project")
    assert search(toy, "span.costsummary") == lookup(toy, "Span.costSummary")
    # The caller's budget holds for a lookup reached this way.
    assert len(search(toy, "Project", budget=400)) <= 400 + len(PAGINATION_LEGEND)


def test_several_searches_answer_together(toy: Index, toy_reads_only: Index) -> None:
    text = search_many(toy, ["session duration", "projects"], budget=3000)
    first, second = text.split("\n\n", 1)
    assert first.splitlines()[0] == "# search: session duration"
    assert first_line("\n".join(first.splitlines()[1:])).startswith(
        "Project.averageSessionDurationMs"
    )
    assert second.startswith("# search: projects\n")
    assert f"\n  projects({PAGINATION}, " in second
    # A single search carries no label.
    assert "# search:" not in search_many(toy, ["projects"])
    assert text.count(PAGINATION_LEGEND) == 1
    assert text.splitlines()[-1] == PAGINATION_LEGEND
    assert len(text) <= 3000 + len(PAGINATION_LEGEND)
    text = search_many(toy_reads_only, ["delete dataset", "clear project"])
    assert text.count(DISABLED) == 1
    assert text.splitlines()[-1] == DISABLED


def test_names_are_each_looked_up_within_one_budget(toy: Index) -> None:
    text = lookup_many(toy, ["TimeRange", "TimeBinConfig", "TimeBinScale"])
    blocks = text.split("\n\n")
    assert [first_line(b) for b in blocks] == [
        "input TimeRange {",
        "input TimeBinConfig {",
        "enum TimeBinScale {",
    ]
    assert lookup_many(toy, ["Span", "NoSuch"]).endswith("named 'NoSuch'. Try search('NoSuch').")
    # A looked-up name that collapses pagination gets the key, once, at the end.
    text = lookup_many(toy, ["Query", "Project.spans", "Trace"])
    assert text.count(PAGINATION_LEGEND) == 1
    assert text.splitlines()[-1] == PAGINATION_LEGEND
    assert len(lookup_many(toy, ["Project", "Span"], budget=600)) <= 600
    # Several names as free text are a search, not a lookup.
    assert "in full:" in search(toy, "TimeRange, TimeBinConfig TimeBinScale")


def test_describe_shares_one_budget_and_names_what_it_omits(toy: Index) -> None:
    names = [u.name for u in toy.units if u.kind == "type"][:30]
    text = describe(toy, names=names, budget=1500)
    assert len(text) <= 1500
    shown = [b for b in text.split("\n\n") if not b.startswith("--")]
    assert 3 <= len(shown) < 30
    assert any(
        line.endswith("more requests omitted; ask for fewer at once.") for line in text.splitlines()
    )
    both = describe(toy, names=["TimeRange"], search=["session duration", "projects"], budget=2000)
    blocks = both.split("\n\n")
    assert blocks[0].startswith("input TimeRange {")
    assert blocks[1].startswith("# search: session duration\n")
    assert blocks[2].startswith("# search: projects\n")
    assert both.count(PAGINATION_LEGEND) == 1
    assert describe(toy) == lookup(toy, "Query")


def test_misses_say_so(toy: Index) -> None:
    assert search(toy, "zzqx").startswith("-- No type")
    assert search(toy, "the of").startswith("-- Empty query")
    assert lookup(toy, "NoSuchType").startswith("-- No type")
    assert lookup(toy, "NoSuchType.field").startswith("-- No type")
    assert lookup(toy, "Project.nonexistent").startswith(
        "-- Project has no field 'nonexistent'. Try search('Project nonexistent')."
    )
    # The caller's spelling is echoed, not the lookup key.
    assert (
        lookup(toy, "Span.traceIdX")
        == "-- Span has no field 'traceIdX'. Try search('Span traceIdX')."
    )
    assert search(toy, "Project.nonexistent") == (
        "-- Project has no field 'nonexistent', and nothing on Project matches it. "
        "Try search('nonexistent')."
    )


def test_a_missing_member_searches_within_its_type(toy: Index) -> None:
    lines = search(toy, "Project.latency").splitlines()
    assert lines[0] == "# On Project, matching 'latency':"
    assert lines[1] == "Project  via Query.getProjectByName"
    assert lines[2].startswith("  latencyMsQuantile(")
    headers = [line for line in lines[1:] if re.fullmatch(r"[A-Z]\w*(  via .*)?", line)]
    assert headers == ["Project  via Query.getProjectByName"]


def test_a_dotted_query_on_an_unknown_type_is_not_searched_at_large(toy: Index) -> None:
    miss = "-- No type named 'Spann'. Did you mean Span, SpanColumn, SpanSort? Try search('Span.cost')."
    assert search(toy, "Spann.cost") == miss
    assert lookup(toy, "Spann.cost") == miss
    assert search(toy, "Zzzz.cost") == "-- No type named 'Zzzz'. Try search('cost')."
    # A sentence with a full stop is still free text.
    assert "# On " not in search(toy, "cost. summary")


def test_the_tail_says_where_the_rest_lives(toy: Index) -> None:
    text = search(toy, "id", budget=350)
    trailer = next(line for line in text.splitlines() if line.startswith("... "))
    assert re.fullmatch(
        r"\.\.\. \d+ more; narrow the search \(([\w ]+ \d+)(, [\w ]+ \d+){0,2}\)", trailer
    )
    assert "shared" not in trailer


def test_a_grouped_type_is_not_listed_twice(toy: Index) -> None:
    text = search(toy, "cost summary")
    assert "SpanCostSummary  via " in text
    assert "type SpanCostSummary" not in text


def test_omitted_note_without_names_is_the_bare_count() -> None:
    from phoenix.server.api.schema_search import _omitted

    assert _omitted(["# A: x", "# B: y"], limit=0) == "# ... 2 more sections omitted"
    assert _omitted(["# A: x", "# B: y"], limit=1) == "# ... 2 more sections omitted: A +1"
    assert _omitted(["# via Query.a"]) == "# ... 1 more sections omitted"


def test_the_query_root_fits_the_builtin_budget(index: Index) -> None:
    # A root cut short hides entry points. If this fails, raise the builtin's
    # schema budget rather than accept the cut.
    from phoenix.server.agents.capabilities.tools.internal.bash import _SCHEMA_BUDGET

    root = lookup(index, index.query_root, budget=_SCHEMA_BUDGET)
    assert "more lines omitted" not in root.split("\n}", 1)[0]


def test_a_close_runner_up_is_shown_in_full_too() -> None:
    index = build_index(
        build_schema("type Query { a: A }\ntype A { fooBar: Int, fooBaz: Int, other: Int }")
    )
    text = search(index, "foo")
    assert "# A.fooBar in full:" in text and "# A.fooBaz in full:" in text
    clear = search(index, "other")
    assert clear.count(" in full:") == 1


def test_relay_wrappers_say_what_they_wrap(toy: Index) -> None:
    connection = (
        "-- SpanConnection is a connection over Span: select `edges { node { ... } }` "
        "and `pageInfo { hasNextPage endCursor }`. Look up Span."
    )
    assert lookup(toy, "SpanConnection") == connection
    assert search(toy, "SpanConnection") == connection
    assert lookup(toy, "SpanConnection.edges") == connection
    assert lookup(toy, "SpanEdge") == (
        "-- SpanEdge is a connection edge over Span: select `node { ... }`. Look up Span."
    )
    assert lookup(toy, "PageInfo") == (
        "-- PageInfo is Relay pagination plumbing: hasNextPage, hasPreviousPage, "
        "startCursor, endCursor."
    )


# --- lookups ---------------------------------------------------------------------


@pytest.mark.parametrize(
    "name,expected",
    [
        ("Experiment", "type Experiment implements Node {"),
        ("Span.costSummary", "Span.costSummary: SpanCostSummary"),
        ("clearProject", "mutation clearProject(input: ClearProjectInput!): Query!"),
        ("SpanColumn", "enum SpanColumn {"),
        ("TimeRange", "input TimeRange {"),
        ("Node", "interface Node {  # An object with a globally unique ID."),
        ("PromptTemplate", "union PromptTemplate = PromptStringTemplate | PromptChatTemplate"),
    ],
)
def test_lookup_renders_the_named_unit(toy: Index, name: str, expected: str) -> None:
    assert first_line(lookup(toy, name)) == expected


def test_types_render_one_member_per_line_with_trailing_descriptions(toy: Index) -> None:
    text = lookup(toy, "Project")
    assert text.splitlines()[:4] == [
        "type Project implements Node {  # A project groups traces.",
        "  id: ID!",
        "  name: String!",
        "  recordCount: Int!  # Number of spans in the project.",
    ]
    assert '"""' not in text


def test_lookup_truncates_at_whole_lines_and_keeps_the_block_closed() -> None:
    fields = "\n".join(f"  field{i}: Int" for i in range(80))
    index = build_index(
        build_schema(f"type Query {{\n{fields}\n  other: Other\n}}\ntype Other {{ a: Int }}")
    )
    text = lookup(index, "Query", budget=600)
    assert len(text) <= 600
    lines = text.splitlines()
    assert lines[0] == "type Query {"
    assert any(
        line.startswith("  # ... ") and line.endswith("more lines omitted") for line in lines
    )
    assert "}" in lines
    assert any(
        line.startswith("# ... ") and "more sections omitted: Other" in line for line in lines
    )


def test_optional_pagination_arguments_collapse_to_one_marker(toy: Index) -> None:
    text = lookup(toy, "Query.projects")
    assert first_line(text) == (
        f"Query.projects({PAGINATION}, sort: ProjectSort, filter: ProjectFilter): ProjectConnection!"
    )
    assert text.splitlines()[-1] == PAGINATION_LEGEND
    # A required `first` stays visible: the caller must pass it.
    assert "spans(first: Int!, timeRange: TimeRange, last: Int," in lookup(toy, "Project.spans")
    hits = search(toy, "datasets")
    assert f"\n  datasets({PAGINATION}): DatasetConnection!" in hits
    assert hits.splitlines()[-1] == PAGINATION_LEGEND
    assert PAGINATION not in lookup(toy, "Span.spanAnnotations")


def test_defaults_render_as_graphql_literals(toy: Index) -> None:
    assert first_line(lookup(toy, "Span.spanAnnotations")) == (
        "Span.spanAnnotations(filter: AnnotationFilter = null): [SpanAnnotation!]!"
    )
    assert "rootSpansOnly: Boolean = true" in first_line(lookup(toy, "Project.spans"))
    assert first_line(lookup(toy, "CreateSessionInput.isEphemeral")) == (
        "CreateSessionInput.isEphemeral: Boolean! = false"
    )
    assert "scale: TimeBinScale! = HOUR" in lookup(toy, "TimeBinConfig")


def test_type_lookup_prints_one_line_paths(toy: Index) -> None:
    text = lookup(toy, "Experiment")
    assert "# via Dataset.experiments" in text
    assert "# via Dataset.baselineExperiment" in text
    assert "type Dataset" not in text
    assert "# ExperimentRun: id, error, latencyMs" in text
    assert "# ExperimentRunConnection" not in text


def test_field_lookup_prints_the_path_to_its_parent(toy: Index) -> None:
    text = lookup(toy, "Span.costSummary")
    assert "# via Query.getSpanByOtelId > Span.costSummary" in text
    assert "type Query" not in text


def test_field_lookup_inlines_its_inputs_and_return_members(toy: Index) -> None:
    text = lookup(toy, "Project.traceCountTimeSeries")
    assert "input TimeRange {" in text
    assert "input TimeBinConfig {" in text
    assert "enum TimeBinScale {" in text
    assert "# TraceCountTimeSeries: data" in text
    assert "# TraceCountTimeSeriesDataPoint: timestamp, okCount, errorCount" in text
    assert "# CostBreakdown: tokens, cost" in lookup(toy, "Span.costSummary")


def test_mutation_lookup_prints_its_input_closure(toy: Index) -> None:
    text = lookup(toy, "addExamplesToDataset")
    assert "input AddExamplesToDatasetInput {" in text
    assert "input DatasetExampleInput {" in text
    assert text.rstrip().splitlines()[-1] == "# DatasetMutationPayload: dataset"


def test_input_types_are_labelled_by_their_mutation(toy: Index) -> None:
    assert "input for Mutation.addExamplesToDataset" in search(toy, "add examples to dataset")


def test_unreachable_types_say_what_returns_them(toy: Index) -> None:
    assert "type DatasetMutationPayload  returned by Mutation." in search(toy, "dataset payload")


def test_abstract_types_list_their_possible_types(toy: Index) -> None:
    union = lookup(toy, "PromptTemplate")
    assert "# via PromptVersion.template" in union
    node = lookup(toy, "Node")
    possible = next(line for line in node.splitlines() if line.startswith("# possible types: "))
    assert "Project" in possible and "Experiment" in possible


def test_union_members_are_reached_through_the_union_field(toy: Index) -> None:
    # PromptVersion is a read root, so the path starts there.
    assert lookup(toy, "PromptChatTemplate").splitlines()[1:] == [
        "  messages: [String!]!",
        "}",
        "# via PromptVersion.template",
    ]
    assert first_line(search(toy, "messages")) == (
        "PromptChatTemplate.messages: [String!]!  via PromptVersion.template"
    )


def test_reach_paths_are_shortest_first_and_skip_self_references(toy: Index) -> None:
    paths = reach_paths(toy, "Span")
    assert paths[0] == ("Query.getSpanByOtelId",)
    assert all("Span." not in hop for path in paths for hop in path)
    assert len(paths) <= 3


def test_cut_member_stubs_explain_their_marker() -> None:
    fields = " ".join(f"f{i}: Int" for i in range(14))
    schema = build_schema(
        f"type Query {{ big: Big, small: Small }}\ntype Big {{ {fields} }}\ntype Small {{ a: Int }}"
    )
    index = build_index(schema)
    text = lookup(index, "Query")
    assert "# Big: f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11 +2" in text
    assert "# Small: a" in text
    assert text.splitlines()[-1] == (
        "# +N counts members not shown; look up that type to see every one."
    )
    assert "+N" not in lookup(index, "Big")


def test_enums_returned_by_fields_say_so(toy: Index) -> None:
    assert lookup(toy, "SpanStatusCode").endswith(
        "# used by Span.statusCode, Span.propagatedStatusCode"
    )
    assert lookup(toy, "SortDir").endswith(
        "# used by SpanSort.dir, ProjectSort.dir, ExperimentRunSort.dir"
    )
    assert first_line(search(toy, "unset")) == (
        "enum SpanStatusCode.UNSET  used by Span.statusCode, Span.propagatedStatusCode"
    )


def test_action_verbs_come_from_the_mutations_themselves(toy: Index) -> None:
    assert first_line(search(toy, "transfer traces")).startswith("mutation transferTraces(")
    # A read query is not pushed toward mutations.
    assert not first_line(search(toy, "trace latency")).startswith("mutation ")


def test_the_word_mutations_restricts_a_search_to_mutations(
    toy: Index, toy_reads_only: Index
) -> None:
    text = search(toy, "dataset mutations")
    lines = text.split(" in full:", 1)[0].splitlines()
    assert lines[0] == "# mutations only"
    listed = lines[1:-1]
    assert listed and all(line.startswith("mutation ") for line in listed)
    # The word inside an identifier names a type and does not filter.
    payload = search(toy, "DatasetMutationPayload fields")
    assert "# mutations only" not in payload
    assert payload.startswith("type DatasetMutationPayload  returned by Mutation.")
    assert "mutation deleteDataset(" in text and "mutation addExamplesToDataset(" in text
    assert search(toy, "mutations") == lookup(toy, "Mutation")
    project = search(toy, "project mutation")
    assert project.splitlines()[1].startswith("mutation clearProject(")
    assert "type Project" not in project
    assert search(toy_reads_only, "dataset mutations") == DISABLED


# --- hidden roots ----------------------------------------------------------------


def test_excluded_mutations_take_their_inputs_and_payloads_with_them(
    toy_reads_only: Index,
) -> None:
    names = {u.name for u in toy_reads_only.units}
    assert not any(u.kind == "mutation" for u in toy_reads_only.units)
    assert {"DeleteDatasetInput", "DatasetMutationPayload", "Session"}.isdisjoint(names)
    # Inputs and enums shared with the query side stay.
    assert {"TimeRange", "SpanColumn", "Dataset"} <= names
    assert lookup(toy_reads_only, "deleteDataset").startswith("-- deleteDataset is a mutation. --")
    assert search(toy_reads_only, "deleteDataset") == lookup(toy_reads_only, "deleteDataset")
    assert search(toy_reads_only, "delete dataset").splitlines()[-1] == DISABLED
    assert search(toy_reads_only, "clear project").splitlines()[-1] == DISABLED
    assert "disabled" not in search(toy_reads_only, "span cost")


def test_query_root_survives_mutation_exclusion(toy_reads_only: Index) -> None:
    # A mutation may return the query root for a refetch; that does not make
    # the root a mutation-only payload.
    assert first_line(lookup(toy_reads_only, "Query")) == "type Query {"
    assert first_line(lookup(toy_reads_only, "Query.projects")).startswith("Query.projects(")


def test_root_type_names_come_from_the_schema() -> None:
    schema = build_schema(
        "schema { query: RootQuery mutation: RootMutation }\n"
        "type RootQuery { hello: String }\n"
        "type RootMutation { doIt(x: Int = 1): Boolean }"
    )
    index = build_index(schema)
    assert first_line(lookup(index, "doIt")) == "mutation doIt(x: Int = 1): Boolean"
    assert first_line(search(index, "hello")) == "RootQuery.hello: String"
    without = build_index(schema, include_mutations=False)
    assert not any(u.kind == "mutation" for u in without.units)
    assert lookup(without, "doIt").startswith("-- doIt is a mutation.")
    disabled = "-- RootMutation is the mutation root. -- Mutations are disabled"
    assert lookup(without, "RootMutation").startswith(disabled)
    assert search(without, "rootmutation").startswith(disabled)


def test_subscription_only_types_are_never_indexed(toy: Index) -> None:
    names = {u.name for u in toy.units}
    assert {"Subscription", "ChatCompletionInput", "ChatCompletionPayload"}.isdisjoint(names)
    # An implementation delivered only through a hidden root's interface goes too.
    assert "TextChunk" not in names


# --- bounds and edge cases -------------------------------------------------------


def test_oversized_queries_are_answered_within_budget(toy: Index) -> None:
    assert len(search(toy, "z" * 10000, 400)) <= 400
    assert len(search(toy, "Span." + "w" * 3000, 400)) <= 400
    assert len(describe(toy, search=["cost " * 1000, "id"], budget=4000)) <= 4000
    assert len(describe(toy, names=["Span", "z" * 10000], budget=1000)) <= 1000
    # A quoted-back query is cut, so the message stays short.
    assert "…" in search(toy, "zz" * 100)


def test_oversized_words_are_not_cached() -> None:
    before = _stem_cached.cache_info().currsize
    assert _stem("x" * 41) == "x" * 41
    assert _stem_cached.cache_info().currsize == before


@pytest.mark.parametrize("budget", [1, 30, 48, 100, 200, 314])
@pytest.mark.parametrize("query", ["projects", "span cost", "Project", "Span.costSummary"])
def test_tiny_budgets_are_respected(toy: Index, query: str, budget: int) -> None:
    assert len(search(toy, query, budget)) <= budget
    assert len(lookup(toy, query, budget)) <= budget


def test_a_mutation_name_with_no_word_tokens_indexes() -> None:
    index = build_index(build_schema("type Query { ok: Int } type Mutation { _: Int }"))
    assert "  _: Int" in search(index, "mutations")


def test_the_mutations_word_on_a_schema_without_mutations() -> None:
    index = build_index(build_schema("type Query { ok: Int }"))
    assert search(index, "mutations") == "-- The schema has no mutations."


def test_names_differing_only_in_case_stay_distinct() -> None:
    index = build_index(
        build_schema("type Query { a: Thing b: thing } type Thing { x: Int } type thing { y: Int }")
    )
    assert first_line(lookup(index, "Thing")) == "type Thing {"
    assert first_line(lookup(index, "thing")) == "type thing {"
    assert lookup(index, "THING").startswith("-- No type, field, or mutation named 'THING'")
    # A unique spelling still resolves case-insensitively.
    assert first_line(lookup(index, "QUERY")) == "type Query {"


def test_a_type_and_a_mutation_with_one_name_are_both_reachable() -> None:
    index = build_index(
        build_schema(
            "type Query { a: makeThing } type makeThing { x: Int } "
            "type Mutation { makeThing(x: Int): makeThing }"
        )
    )
    assert first_line(lookup(index, "makeThing")) == "type makeThing {"
    assert (
        first_line(lookup(index, "Mutation.makeThing")) == "mutation makeThing(x: Int): makeThing"
    )


def test_a_type_the_query_side_returns_stays_when_mutations_are_hidden() -> None:
    index = build_index(
        build_schema(
            "type Query { status: Status } enum Status { A B } "
            "type Mutation { change(status: Status): Int }"
        ),
        include_mutations=False,
    )
    assert first_line(lookup(index, "Status")) == "enum Status {"


def test_a_hidden_payload_that_references_itself_goes() -> None:
    index = build_index(
        build_schema(
            "type Query { ok: Int } type Subscription { s: Payload } "
            "type Payload { next: Payload secret: String }"
        )
    )
    assert [u.label for u in index.units] == ["Query.ok", "Query"]


def test_grouped_enum_values_and_input_fields_name_every_owner() -> None:
    index = build_index(
        build_schema(
            "type Query { a(x: A, y: B, p: P, q: R): Int } enum A { OK } enum B { OK } "
            "input P { limit: Int } input R { limit: Int }"
        )
    )
    assert first_line(search(index, "OK")) == "enum OK  # on A, B"
    assert first_line(search(index, "limit")) == "input limit: Int  # on P, R"


def test_an_implementation_is_reached_through_its_interface_when_nothing_concrete_delivers_it() -> (
    None
):
    sdl = (
        "interface Node { id: ID! } type Query { node: Node } type Item implements Node { id: ID! }"
    )
    index = build_index(build_schema(sdl))
    assert "# via Query.node" in lookup(index, "Item")
    assert index.via("Item") == "Query.node"
    # A concrete field wins over the interface, which stays listed after it.
    direct = build_index(build_schema(sdl + " extend type Query { item: Item }"))
    assert direct.via("Item") == "Query.item"
    assert reach_paths(direct, "Item") == [("Query.item",), ("Query.node",)]


def test_a_list_typed_first_argument_is_not_pagination() -> None:
    index = build_index(build_schema("type Query { xs(first: [Int], after: [String]): Int }"))
    text = lookup(index, "Query")
    assert "xs(first: [Int], after: [String]): Int" in text and PAGINATION_LEGEND not in text


def test_a_runner_up_is_not_expanded_behind_a_shared_top_hit() -> None:
    index = build_index(
        build_schema(
            "type Query { a: A b: B c: C } type A { size: Int } type B { size: Int } "
            "type C { sizeLimit(irrelevant: Int): Int }"
        )
    )
    assert " in full:" not in search(index, "size")


def test_omitted_line_count_excludes_the_closing_brace() -> None:
    index = build_index(build_schema("type Query { a: Int b: Int c: Int d: Int e: Int }"))
    assert lookup(index, "Query", 48) == "type Query {\n  # ... 5 more lines omitted\n}"


def test_concurrent_first_callers_share_one_index() -> None:
    import concurrent.futures

    schema = build_schema("type Query { ok: Int }")
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        built = list(pool.map(lambda _: cached_index(schema), range(8)))
    assert all(b is built[0] for b in built)


def test_a_scoped_search_matches_the_whole_member_and_quotes_it_short(toy: Index) -> None:
    text = search(toy, "Project." + "z" * 81 + " recordCount")
    assert "  recordCount" in text
    assert "…" in text.splitlines()[0]


def test_quoted_text_stays_bounded_once_escaped(toy: Index) -> None:
    query = "Project." + "\x00" * 80
    assert len(search(toy, query, 400)) <= 400
    assert len(describe(toy, search=[query] * 10, budget=4000)) <= 4000
    assert "\\x00" not in search(toy, query)


def test_messages_honour_a_budget_smaller_than_themselves(toy: Index) -> None:
    assert len(search(toy, "", 1)) <= 1
    assert len(describe(toy, search=["cost"], budget=1)) <= 1


def test_the_term_limit_holds_after_compound_words_expand() -> None:
    from phoenix.server.api.schema_search import _MAX_QUERY_TERMS, _query_terms

    assert len(_query_terms("a1" * 250)) == _MAX_QUERY_TERMS


def test_a_root_shaped_like_relay_plumbing_still_indexes() -> None:
    index = build_index(build_schema("schema { query: PageInfo } type PageInfo { ok: Int }"))
    assert first_line(lookup(index, "PageInfo")) == "type PageInfo {"


def test_a_forward_only_connection_keeps_its_arguments_visible() -> None:
    index = build_index(build_schema("type Query { xs(first: Int, after: String): Int }"))
    text = lookup(index, "Query.xs")
    assert first_line(text) == "Query.xs(first: Int, after: String): Int"
    assert PAGINATION_LEGEND not in text


def test_visibility_walks_wrapper_fields_and_implemented_interfaces() -> None:
    wrapped = build_index(
        build_schema(
            "type Query { items: Conn } "
            "type Conn { edges: [Edge!]! pageInfo: PageInfo! stats: Status } "
            "type Edge { node: Item cursor: String } type PageInfo { hasNextPage: Boolean! } "
            "type Item { id: ID } enum Status { A } type Mutation { change(x: Status): Int }"
        ),
        include_mutations=False,
    )
    assert first_line(lookup(wrapped, "Status")) == "enum Status {"
    implemented = build_index(
        build_schema(
            "interface Node { id: ID } type Query { item: Item } "
            "type Item implements Node { id: ID } type Mutation { get: Node }"
        ),
        include_mutations=False,
    )
    assert first_line(lookup(implemented, "Node")) == "interface Node {"


def test_an_interface_hop_counts_before_path_length() -> None:
    index = build_index(
        build_schema(
            "interface Node { id: ID } type Query { node: Node } "
            "type A implements Node { id: ID b: B } type B implements Node { id: ID }"
        )
    )
    assert index.nearest["B"] == ("Query", 1, ("Query.node",))


def test_a_hidden_read_root_does_not_seed_paths() -> None:
    index = build_index(
        build_schema(
            "type Query { box: Box } type Box { data: Data } type Subscription { secret: Project } "
            "type Project { data: Data } type Data { value: Int }"
        )
    )
    assert first_line(search(index, "value")) == "Data.value: Int  via Query.box > Box.data"


def test_the_filter_word_inside_a_snake_case_identifier_does_not_filter(toy: Index) -> None:
    assert "# mutations only" not in search(toy, "dataset_mutation_payload fields")


def test_a_hidden_mutation_with_no_tokens_is_never_named() -> None:
    index = build_index(
        build_schema("type Query { okays: Int } type Mutation { _: Int }"), include_mutations=False
    )
    assert "disabled" not in search(index, "okays")


def test_a_list_that_fits_is_not_held_back_by_unused_reservations() -> None:
    index = build_index(build_schema("type Query { hello: Int }"))
    assert search(index, "hello", 80) == "Query\n  hello: Int"


def test_a_cut_last_hit_is_counted_in_the_trailer() -> None:
    index = build_index(
        build_schema(
            "type Query { a: A b: B } type A { size: Int } "
            "type B { size(filter: String, rangeStart: Int, rangeEnd: Int): Int }"
        )
    )
    assert search(index, "size", 100) == (
        "A  via Query.a\n  size: Int\n... 1 more; narrow the search (B 1)"
    )


def test_a_custom_scalar_default_renders_as_a_graphql_literal() -> None:
    sdl = 'scalar JSON type Query { ok(x: JSON = {a: [1, "b", null, true]}): Int }'
    index = build_index(build_schema(sdl))
    assert (
        first_line(lookup(index, "Query.ok"))
        == 'Query.ok(x: JSON = {a: [1, "b", null, true]}): Int'
    )


def test_a_cold_query_stems_no_more_than_the_term_limit(toy: Index) -> None:
    from phoenix.server.api.schema_search import _MAX_QUERY_TERMS

    words = " ".join("q" + chr(97 + i // 26) + chr(97 + i % 26) for i in range(100))
    before = _stem_cached.cache_info().misses
    search(toy, words)
    assert _stem_cached.cache_info().misses - before <= _MAX_QUERY_TERMS


def test_an_implemented_interface_does_not_expose_hidden_siblings() -> None:
    index = build_index(
        build_schema(
            "type Query { item: A } interface Node { id: ID! } type A implements Node { id: ID! } "
            "type B implements Node { id: ID! secret: String } type Mutation { get: B }"
        ),
        include_mutations=False,
    )
    assert first_line(lookup(index, "Node")) == "interface Node {"
    assert "secret" not in search(index, "secret").replace("'secret'", "")


def test_a_multiline_description_stays_one_comment() -> None:
    index = build_index(build_schema('type Query { """metadata\nsecret: Int""" hello: Int }'))
    assert lookup(index, "Query") == "type Query {\n  hello: Int  # metadata secret: Int\n}"


def test_a_field_added_to_a_wrapper_is_indexed_under_the_wrapper() -> None:
    index = build_index(build_schema(TOY_SDL + " extend type ProjectConnection { stats: Int }"))
    assert "ProjectConnection  via Query.projects\n  stats: Int" in search(index, "stats")
    assert lookup(index, "ProjectConnection.stats").splitlines() == [
        "ProjectConnection.stats: Int",
        "# via Query.projects > ProjectConnection.stats",
    ]
    assert lookup(index, "ProjectConnection").endswith(
        "It also has stats; look up ProjectConnection.stats."
    )


def test_a_list_that_fits_whole_is_never_cut_for_a_trailer() -> None:
    index = build_index(build_schema("type Query { sizeOne: Int sizeTwo: String }"))
    assert search(index, "size", 50) == "Query\n  sizeOne: Int\n  sizeTwo: String"


def test_requests_past_the_cap_are_omitted_before_any_is_served(toy: Index) -> None:
    from phoenix.server.api.schema_search import _MAX_REQUESTS

    text = describe(toy, names=["Span"] * (_MAX_REQUESTS + 4), budget=10**6)
    assert text.endswith("-- 4 more requests omitted; ask for fewer at once.")
    assert text.count("type Span ") == _MAX_REQUESTS


def test_an_interface_reached_by_implements_is_not_walked() -> None:
    index = build_index(
        build_schema(
            "type Query { item: A } interface Node { child: Node } "
            "type A implements Node { child: A } "
            "type B implements Node { child: B secret: String } type Mutation { get: B }"
        ),
        include_mutations=False,
    )
    assert index.resolve("B") is None and index.resolve("Node") is not None


def test_a_full_description_is_commented_line_by_line() -> None:
    sdl = 'type Query { """metadata\ntype Fake { secret: Int }""" hello: Int }'
    index = build_index(build_schema(sdl))
    assert lookup(index, "Query.hello").startswith(
        "Query.hello: Int\n# metadata\n# type Fake { secret: Int }"
    )


def test_wrapper_extras_follow_the_wrapper_shape() -> None:
    sdl = TOY_SDL + " extend type ProjectConnection { cursor: String }"
    sdl += " extend type ProjectEdge { stats: Int }"
    index = build_index(build_schema(sdl))
    assert (
        first_line(lookup(index, "ProjectConnection.cursor")) == "ProjectConnection.cursor: String"
    )
    assert lookup(index, "ProjectEdge.stats").splitlines()[:2] == [
        "ProjectEdge.stats: Int",
        "# via Query.projects > ProjectConnection.edges > ProjectEdge.stats",
    ]


def test_an_answer_that_exactly_fills_its_budget_is_printed() -> None:
    index = build_index(build_schema("type Query { sizeOne: Int sizeTwo: String }"))
    whole = "Query\n  sizeOne: Int\n  sizeTwo: String"
    assert search(index, "size", len(whole)) == whole
    single = build_index(build_schema("type Query { x: Int }"))
    assert lookup(single, "Query", 23) == "type Query {\n  x: Int\n}"


def test_one_of_inputs_keep_their_directive() -> None:
    index = build_index(
        build_schema(
            "type Query { find(by: Locator!): Int } input Locator @oneOf { id: ID name: String }"
        )
    )
    assert first_line(lookup(index, "Locator")) == "input Locator @oneOf {"


def test_a_default_no_literal_can_spell_is_marked() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    json_scalar = GraphQLScalarType("JSON")
    query = GraphQLObjectType(
        "Query",
        {"ok": GraphQLField(GraphQLString, args={"x": GraphQLArgument(json_scalar, {"a-b": 1})})},
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.ok")) == "Query.ok(x: JSON = <unprintable>): String"


def test_a_code_first_default_renders_by_type() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLEnumType,
        GraphQLField,
        GraphQLInputField,
        GraphQLInputObjectType,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    json_scalar = GraphQLScalarType("JSON")
    choice = GraphQLEnumType("Choice", {"A": "a"})
    opt = GraphQLInputObjectType(
        "Opt", {"payload": GraphQLInputField(json_scalar), "choice": GraphQLInputField(choice)}
    )
    # Inside an input object graphql-core coerces an omitted default by enum name.
    default = {"payload": {"a": [1, "b", None]}, "choice": "A"}
    query = GraphQLObjectType(
        "Query", {"ok": GraphQLField(GraphQLString, args={"x": GraphQLArgument(opt, default)})}
    )
    index = build_index(GraphQLSchema(query=query))
    line = first_line(lookup(index, "Query.ok"))
    assert line == 'Query.ok(x: Opt = {payload: {a: [1, "b", null]}, choice: A}): String'


def test_a_connection_over_a_scalar_is_an_ordinary_type() -> None:
    index = build_index(
        build_schema(
            "type Query { c: Conn } type Conn { edges: [Edge] pageInfo: Int } "
            "type Edge { node: Int cursor: String }"
        )
    )
    assert first_line(lookup(index, "Conn")) == "type Conn {"
    assert first_line(lookup(index, "Edge")) == "type Edge {"


def test_wrapper_owners_resolve_by_exact_case_first() -> None:
    sdl = TOY_SDL + " extend type ProjectConnection { stats: Int }"
    sdl += " type projectconnection { edges: [ProjectEdge!]! pageInfo: PageInfo! size: Int }"
    sdl += " extend type Query { lower: projectconnection }"
    index = build_index(build_schema(sdl))
    assert "  stats: Int" in search(index, "ProjectConnection.stat")
    assert "  size: Int" in search(index, "projectconnection.siz")


def test_a_scoped_search_on_an_indexed_wrapper_works() -> None:
    index = build_index(build_schema(TOY_SDL + " extend type ProjectConnection { cursor: String }"))
    text = search(index, "ProjectConnection.cur")
    assert text.startswith("# On ProjectConnection, matching 'cur':")
    assert "  cursor: String" in text


def test_a_multi_part_lookup_that_exactly_fits_is_printed() -> None:
    index = build_index(build_schema("type Query { obj: A } type A { a: Int }"))
    assert lookup(index, "Query.obj", 19) == "Query.obj: A\n# A: a"


def test_relay_shapes_are_checked_by_field_types() -> None:
    index = build_index(
        build_schema(
            "type Query { record: Record items: Items } "
            "type Record { node: Int cursor: String other: Int } "
            "type Items { edges: [String!]! pageInfo: Int }"
        )
    )
    assert first_line(lookup(index, "Record")) == "type Record {"
    assert first_line(lookup(index, "Items")) == "type Items {"


def _wrapped_scalar() -> GraphQLScalarType:
    """A scalar that serializes ``v`` as ``{value: v}`` and reads that back."""

    def parse_literal(node: ValueNode, _: object = None) -> object:
        return value_from_ast_untyped(node)["value"]

    return GraphQLScalarType(
        "Wrapped",
        serialize=lambda v: {"value": v},
        parse_value=lambda v: v["value"],
        parse_literal=parse_literal,
    )


def test_a_custom_scalar_default_renders_as_it_serializes() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLSchema,
        GraphQLString,
    )

    wrapped = _wrapped_scalar()
    query = GraphQLObjectType(
        "Query", {"ok": GraphQLField(GraphQLString, args={"x": GraphQLArgument(wrapped, 7)})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.ok")) == "Query.ok(x: Wrapped = {value: 7}): String"


def test_a_scalar_whose_serializer_raises_marks_its_default() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLError,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    def refuse(_: object) -> object:
        raise GraphQLError("Upload is input-only")

    upload = GraphQLScalarType("Upload", serialize=refuse)
    query = GraphQLObjectType(
        "Query", {"ok": GraphQLField(GraphQLString, args={"x": GraphQLArgument(upload, {"a": 1})})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.ok")) == "Query.ok(x: Upload = <unprintable>): String"


def test_a_block_string_default_renders_on_one_line() -> None:
    rows = "\n".join(f"row {i}" for i in range(30))
    index = build_index(build_schema(f'type Query {{ ok(x: String = """{rows}"""): String }}'))
    text = lookup(index, "Query")
    assert text.splitlines()[1].startswith('  ok(x: String = "row 0\\nrow 1\\n')
    parse(text)


def test_page_info_is_recognised_by_shape() -> None:
    index = build_index(
        build_schema(
            "type Query { p: PageInfo } type PageInfo { node: Int cursor: String total: Int }"
        )
    )
    assert first_line(lookup(index, "PageInfo")) == "type PageInfo {"
    assert first_line(lookup(index, "PageInfo.total")) == "PageInfo.total: Int"


def test_a_wrapper_whose_node_needs_an_argument_is_not_collapsed() -> None:
    index = build_index(
        build_schema(
            "type Query { c: Conn } type Conn { edges: [Edge] pageInfo: PageInfo } "
            "type PageInfo { hasNextPage: Boolean! } type Node { id: ID } "
            "type Edge { node(key: ID!): Node cursor: String }"
        )
    )
    assert first_line(lookup(index, "Edge")) == "type Edge {"
    assert "node(key: ID!): Node" in lookup(index, "Edge")


def test_wrapper_lookup_resolves_exact_case_first() -> None:
    index = build_index(
        build_schema(
            "type Query { a: Conn b: conn } type PageInfo { hasNextPage: Boolean! } "
            "type Conn { edges: [CE] pageInfo: PageInfo } type CE { node: Node cursor: String } "
            "type conn { edges: [OE] pageInfo: PageInfo } type OE { node: Other cursor: String } "
            "type Node { id: ID } type Other { value: String }"
        )
    )
    assert "Conn is a connection over Node" in lookup(index, "Conn")
    assert "conn is a connection over Other" in lookup(index, "conn")
    assert lookup(index, "CONN").startswith("-- No type, field, or mutation named 'CONN'")


def test_a_scalar_default_that_does_not_coerce_back_is_marked() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    asymmetric = GraphQLScalarType(
        "Asymmetric", serialize=lambda v: {"output": v}, parse_value=lambda v: v["input"]
    )
    query = GraphQLObjectType(
        "Query", {"ok": GraphQLField(GraphQLString, args={"x": GraphQLArgument(asymmetric, 7)})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert (
        first_line(lookup(index, "Query.ok")) == "Query.ok(x: Asymmetric = <unprintable>): String"
    )


def test_a_list_valued_scalar_default_serializes_whole() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLSchema,
        GraphQLString,
    )

    wrapped = _wrapped_scalar()
    query = GraphQLObjectType(
        "Query", {"ok": GraphQLField(GraphQLString, args={"x": GraphQLArgument(wrapped, [1, 2])})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.ok")) == "Query.ok(x: Wrapped = {value: [1, 2]}): String"


def test_page_info_fields_must_have_relay_types_and_no_arguments() -> None:
    index = build_index(
        build_schema(
            "type Query { flags: Flags n: N } type Flags { hasNextPage(key: ID!): N } type N { id: ID }"
        )
    )
    assert first_line(lookup(index, "Flags")) == "type Flags {"
    assert first_line(lookup(index, "Flags.hasNextPage")) == "Flags.hasNextPage(key: ID!): N"


def test_a_wrapper_whose_page_info_or_cursor_needs_an_argument_is_not_collapsed() -> None:
    index = build_index(
        build_schema(
            "type Query { c: Conn } type Conn { edges: [Edge] pageInfo(key: ID!): PageInfo } "
            "type PageInfo { hasNextPage: Boolean! } type Node { id: ID } "
            "type Edge { node: Node cursor(key: ID!): String }"
        )
    )
    assert first_line(lookup(index, "Conn")) == "type Conn {"
    assert first_line(lookup(index, "Edge")) == "type Edge {"


def test_an_exactly_named_wrapper_wins_over_a_case_folded_type() -> None:
    index = build_index(
        build_schema(
            "type Query { a: Conn b: conn } type PageInfo { hasNextPage: Boolean! } "
            "type Conn { edges: [CE] pageInfo: PageInfo } type CE { node: Node cursor: String } "
            "type Node { id: ID } type conn { value: String }"
        )
    )
    assert "Conn is a connection over Node" in lookup(index, "Conn")
    assert first_line(lookup(index, "conn")) == "type conn {"


def test_wrapper_extras_follow_the_shape_that_made_it_a_wrapper() -> None:
    index = build_index(
        build_schema(
            "type Query { rec: Rec } type Rec { node: N cursor: String edges: Int pageInfo: Int } "
            "type N { id: ID }"
        )
    )
    assert first_line(lookup(index, "Rec.edges")) == "Rec.edges: Int"
    assert first_line(lookup(index, "Rec.pageInfo")) == "Rec.pageInfo: Int"


def test_a_hidden_wrapper_is_not_pointed_at() -> None:
    index = build_index(
        build_schema(
            "type Query { ok: Int } type Mutation { create: Conn } type PageInfo { hasNextPage: Boolean! } "
            "type Conn { edges: [Edge] pageInfo: PageInfo } type Edge { node: Secret cursor: String } "
            "type Secret { value: String }"
        ),
        include_mutations=False,
    )
    assert lookup(index, "Conn").startswith("-- Conn is reachable only through mutations.")


def test_every_custom_scalar_default_must_coerce_back() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    shifted = GraphQLScalarType("Shifted", serialize=lambda v: v + 1, parse_value=lambda v: v)
    query = GraphQLObjectType(
        "Query", {"ok": GraphQLField(GraphQLString, args={"x": GraphQLArgument(shifted, 7)})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.ok")) == "Query.ok(x: Shifted = <unprintable>): String"


def test_a_tuple_default_for_a_list_type_renders_element_by_element() -> None:
    from graphql import GraphQLArgument, GraphQLField, GraphQLList, GraphQLSchema, GraphQLString

    arg = GraphQLArgument(GraphQLList(_wrapped_scalar()), (1, 2))
    query = GraphQLObjectType("Query", {"ok": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    line = first_line(lookup(index, "Query.ok"))
    assert line == "Query.ok(x: [Wrapped] = [{value: 1}, {value: 2}]): String"


def test_a_dotted_name_never_takes_a_member_from_a_case_folded_owner() -> None:
    index = build_index(
        build_schema(
            "type Query { a: Conn b: conn } type PageInfo { hasNextPage: Boolean! } "
            "type Conn { edges: [CE] pageInfo: PageInfo } type CE { node: Node cursor: String } "
            "type Node { id: ID } type conn { value: String }"
        )
    )
    assert "Conn is a connection over Node" in lookup(index, "Conn.value")
    assert first_line(lookup(index, "conn.value")) == "conn.value: String"


def test_possible_types_omit_hidden_implementations() -> None:
    index = build_index(
        build_schema(
            "interface Shared { id: ID } type Query { visible: Visible } "
            "type Visible implements Shared { id: ID } "
            "type Secret implements Shared { id: ID token: String } type Mutation { create: Secret }"
        ),
        include_mutations=False,
    )
    assert "# possible types: Visible" in lookup(index, "Shared")
    assert "Secret" not in lookup(index, "Shared")


def test_a_scoped_search_on_a_wrapper_explains_the_wrapper() -> None:
    index = build_index(
        build_schema(
            "type Query { a: Conn b: conn } type PageInfo { hasNextPage: Boolean! } "
            "type Conn { edges: [CE] pageInfo: PageInfo } type CE { node: Node cursor: String } "
            "type Node { id: ID } type conn { value: String }"
        )
    )
    assert "Conn is a connection over Node" in search(index, "Conn.value")
    assert first_line(search(index, "conn.val")) == "# On conn, matching 'val':"


def test_a_wrapper_member_still_resolves_case_insensitively() -> None:
    index = build_index(build_schema(TOY_SDL + " extend type ProjectConnection { stats: Int }"))
    assert first_line(lookup(index, "PROJECTCONNECTION.STATS")) == "ProjectConnection.stats: Int"


def test_possible_types_are_filtered_by_exact_visibility() -> None:
    index = build_index(
        build_schema(
            "interface Shared { id: ID } type Query { visible: Visible other: secret c: Conn } "
            "type Visible implements Shared { id: ID } type secret { ok: Int } "
            "type Secret implements Shared { id: ID token: String } "
            "type Conn implements Shared { id: ID edges: [CE] pageInfo: PageInfo } "
            "type CE { node: Visible cursor: String } type PageInfo { hasNextPage: Boolean! } "
            "type Mutation { create: Secret }"
        ),
        include_mutations=False,
    )
    assert "# possible types: Visible, Conn" in lookup(index, "Shared")


def test_unicode_line_separators_inside_a_literal_survive() -> None:
    index = build_index(build_schema('type Query { ok(x: String = "left\u2028right"): Int }'))
    text = describe(index, names=["Query"])
    assert "left\u2028right" in text
    parse(text)


def test_a_mutation_sharing_a_hidden_types_name_does_not_make_it_visible() -> None:
    index = build_index(
        build_schema(
            "interface Shared { id: ID } type Query { visible: Visible } "
            "type Visible implements Shared { id: ID } type Secret implements Shared { id: ID } "
            "type Subscription { events: Secret } type Mutation { Secret: Int }"
        )
    )
    assert "# possible types: Visible\n" in lookup(index, "Shared") + "\n"


def test_a_carriage_return_in_a_description_stays_commented() -> None:
    from graphql import GraphQLField, GraphQLInt, GraphQLSchema

    query = GraphQLObjectType(
        "Query", {"ok": GraphQLField(GraphQLInt, description="metadata\rtype Fake { secret: Int }")}
    )
    index = build_index(GraphQLSchema(query=query))
    assert lookup(index, "Query.ok").startswith(
        "Query.ok: Int\n# metadata\n# type Fake { secret: Int }"
    )


def test_a_missing_member_lookup_keeps_the_exact_owner() -> None:
    index = build_index(
        build_schema(
            "type Query { a: Conn b: conn } type PageInfo { hasNextPage: Boolean! } "
            "type Conn { edges: [CE] pageInfo: PageInfo } type CE { node: Node cursor: String } "
            "type Node { id: ID } type conn { value: String }"
        )
    )
    assert lookup(index, "conn.edges").startswith("-- conn has no field 'edges'")
    assert "Conn is a connection over Node" in lookup(index, "Conn.edges")


def test_a_wrapper_with_extras_still_explains_its_relay_fields() -> None:
    index = build_index(
        build_schema(
            "type Query { edge: Edge } type Edge { node: N cursor: String total: Int } type N { id: ID }"
        )
    )
    assert "Edge is a connection edge over N" in lookup(index, "Edge.node")
    assert first_line(lookup(index, "Edge.total")) == "Edge.total: Int"


def test_a_hidden_mutation_does_not_shadow_a_visible_wrapper() -> None:
    index = build_index(
        build_schema(
            "type Query { edge: Edge } type Edge { node: N cursor: String } type N { id: ID } "
            "type Mutation { Edge: Int }"
        ),
        include_mutations=False,
    )
    assert "Edge is a connection edge over N" in lookup(index, "Edge")


def test_a_subscription_root_the_query_side_reaches_stays_visible() -> None:
    index = build_index(
        build_schema(
            "schema { query: Query subscription: Events } "
            "type Query { replay: Events } type Events { value: Int }"
        )
    )
    assert first_line(lookup(index, "Events")) == "type Events {"
    assert first_line(lookup(index, "Events.value")) == "Events.value: Int"


def test_a_mutation_root_the_query_side_returns_is_read_as_an_ordinary_type() -> None:
    sdl = "type Query { replay: Mutation } type Mutation { value(limit: Int!): Result } "
    sdl += "type Result { id: ID }"
    index = build_index(build_schema(sdl), include_mutations=False)
    assert first_line(lookup(index, "Mutation.value")) == "Mutation.value(limit: Int!): Result"
    assert "# via Query.replay > Mutation.value" in lookup(index, "Mutation.value")
    assert index.resolve("value") is None
    unreachable = build_index(
        build_schema("type Query { ok: Int } type Mutation { value: Int }"), include_mutations=False
    )
    assert "Mutations are disabled" in lookup(unreachable, "Mutation.value")


def test_a_wrappers_relay_field_is_explained_even_beside_a_same_named_extra() -> None:
    index = build_index(
        build_schema(
            "type Query { edge: Edge } type Edge { node: N NODE: Int cursor: String } type N { id: ID }"
        )
    )
    assert "Edge is a connection edge over N" in lookup(index, "Edge.node")
    assert first_line(lookup(index, "Edge.NODE")) == "Edge.NODE: Int"


def test_hits_with_different_shown_descriptions_do_not_share_a_line() -> None:
    index = build_index(
        build_schema(
            'type Query { a: A b: B } type A { "Latency in milliseconds." latency: Float } '
            'type B { "Latency in seconds." latency: Float }'
        )
    )
    text = search(index, "latency")
    assert '  latency: Float  "Latency in milliseconds."' in text
    assert '  latency: Float  "Latency in seconds."' in text


def test_a_member_folds_case_within_its_exact_owner() -> None:
    index = build_index(
        build_schema("type Query { a: A b: a } type A { value: Int } type a { value: String }")
    )
    assert first_line(lookup(index, "A.VALUE")) == "A.value: Int"
    assert first_line(lookup(index, "a.VALUE")) == "a.value: String"


def test_a_wrapper_outranks_a_same_named_mutation_in_any_spelling() -> None:
    index = build_index(
        build_schema(
            "type Query { edge: Edge } type Edge { node: N cursor: String } type N { id: ID } "
            "type Mutation { Edge: Int }"
        )
    )
    assert "Edge is a connection edge over N" in lookup(index, "EDGE")
    assert "Edge is a connection edge over N" in lookup(index, "Edge.NODE")
    assert first_line(lookup(index, "Mutation.Edge")) == "mutation Edge: Int"


def test_an_exact_extra_on_a_wrapper_wins_over_a_folded_relay_field() -> None:
    index = build_index(
        build_schema(
            "type Query { edge: Edge } type Edge { node: N NODE: Int cursor: String } type N { id: ID }"
        )
    )
    assert first_line(lookup(index, "edge.NODE")) == "Edge.NODE: Int"
    assert "Edge is a connection edge over N" in lookup(index, "edge.node")


def test_a_scalar_is_described_and_never_shadowed_by_a_mutation() -> None:
    index = build_index(
        build_schema(
            '"A calendar date." scalar Date type Query { date: Date } type Mutation { Date: Int }'
        )
    )
    assert lookup(index, "Date") == "scalar Date  # A calendar date."
    assert first_line(lookup(index, "Mutation.Date")) == "mutation Date: Int"


def test_a_relay_field_with_any_argument_keeps_the_wrapper_whole() -> None:
    index = build_index(
        build_schema(
            "type Query { edges: [Edge] } type N { name: String } "
            'type Edge { node(locale: String = "en"): N cursor: String }'
        )
    )
    assert first_line(lookup(index, "Edge.node")) == 'Edge.node(locale: String = "en"): N'
    assert "locale" in search(index, "locale")


def test_an_exact_member_wins_even_when_its_siblings_fold_to_the_same_name() -> None:
    index = build_index(
        build_schema(
            "type Query { edge: Edge } type N { id: ID } "
            "type Edge { node: N NODE: Int Node: String cursor: String }"
        )
    )
    assert first_line(lookup(index, "edge.NODE")) == "Edge.NODE: Int"
    assert first_line(lookup(index, "edge.Node")) == "Edge.Node: String"


def test_an_exact_scalar_wins_over_a_folded_mutation() -> None:
    index = build_index(
        build_schema("scalar Date type Query { date: Date } type Mutation { date: Int }")
    )
    assert lookup(index, "Date") == "scalar Date"
    assert first_line(lookup(index, "Mutation.date")) == "mutation date: Int"


def test_an_exact_scalar_wins_over_a_folded_wrapper_and_is_found_by_search() -> None:
    index = build_index(
        build_schema(
            "scalar Edge type Query { value: Edge edge: edge } "
            "type edge { node: N cursor: String } type N { id: ID }"
        )
    )
    assert lookup(index, "Edge") == "scalar Edge"
    dated = build_index(
        build_schema("scalar Date type Query { date: Date } type Mutation { date: Int }")
    )
    assert search(dated, "Date") == "scalar Date"
    assert describe(dated, search=["Date"]).startswith("scalar Date")


def test_a_hidden_exact_owner_is_reported_rather_than_folded() -> None:
    index = build_index(
        build_schema(
            "type Query { thing: thing } type thing { value: Int } "
            "type Mutation { hidden: Thing } type Thing { value: String }"
        ),
        include_mutations=False,
    )
    assert lookup(index, "Thing.value").startswith("-- Thing is reachable only through mutations.")
    assert search(index, "Thing.val").startswith("-- Thing is reachable only through mutations.")
    assert first_line(lookup(index, "thing.value")) == "thing.value: Int"


def test_shared_operation_roots_keep_their_query_fields() -> None:
    sdl = "schema { query: Root mutation: Root } type Root { value: Int }"
    for include in (True, False):
        index = build_index(build_schema(sdl), include_mutations=include)
        assert first_line(lookup(index, "Root.value")) == "Root.value: Int"
        assert "  value: Int" in describe(index)


def test_a_root_serving_mutations_and_subscriptions_stays_when_mutations_are_enabled() -> None:
    sdl = "schema { query: Query mutation: Root subscription: Root } "
    sdl += "type Query { ok: Int } type Root { value: Int }"
    index = build_index(build_schema(sdl))
    assert first_line(lookup(index, "Root.value")) == "mutation value: Int"
    assert "disabled" not in search(index, "value")
    hidden = build_index(build_schema(sdl), include_mutations=False)
    assert "Mutations are disabled" in lookup(hidden, "Root.value")


def test_connection_guidance_names_a_page_info_field_the_schema_has() -> None:
    index = build_index(
        build_schema(
            "type Query { items: Conn } type Conn { edges: [Edge] pageInfo: Info } "
            "type Edge { node: Item cursor: String } type Item { id: ID } type Info { hasNextPage: Boolean }"
        )
    )
    assert "`pageInfo { hasNextPage }`" in lookup(index, "Conn")
    toy_text = lookup(build_index(build_schema(TOY_SDL)), "ProjectConnection")
    assert "`pageInfo { hasNextPage endCursor }`" in toy_text


def test_an_overlong_name_is_never_cut_onto_another_name() -> None:
    from phoenix.server.api.schema_search import _MAX_QUERY_CHARS

    short, long = "a" * (_MAX_QUERY_CHARS - 6), "a" * (_MAX_QUERY_CHARS - 5)
    index = build_index(build_schema(f"type Query {{ {short}: Int {long}: String }}"))
    assert not lookup(index, f"Query.{long}").startswith(f"Query.{short}:")
    assert not search(index, f"Query.{long}").startswith(f"Query.{short}:")


def test_a_shared_root_answers_a_mutations_only_search() -> None:
    index = build_index(
        build_schema("schema { query: Root mutation: Root } type Root { write: Int }")
    )
    assert "  write: Int" in search(index, "mutations write")


def test_a_source_literal_is_used_only_while_it_spells_the_current_default() -> None:
    schema = build_schema("type Query { f(x: Int = 1): Int }")
    assert schema.query_type is not None
    schema.query_type.fields["f"].args["x"].default_value = 2
    assert first_line(lookup(build_index(schema), "Query.f")) == "Query.f(x: Int = 2): Int"


def test_a_hidden_type_note_names_the_operation_that_reaches_it() -> None:
    index = build_index(
        build_schema(
            "type Query { ok: Int } type Mutation { write: Secret } type Subscription { event: Event } "
            "type Event { id: ID } type Secret { id: ID }"
        ),
        include_mutations=False,
    )
    assert lookup(index, "Event").startswith("-- Event is reachable only through subscriptions")
    assert lookup(index, "Secret").startswith("-- Secret is reachable only through mutations")


def test_a_default_whose_comparison_fails_still_indexes() -> None:
    class Awkward:
        def __eq__(self, other: object) -> bool:
            raise ValueError("ambiguous")

        __hash__ = None  # type: ignore[assignment]

    schema = build_schema("scalar V type Query { f(x: V = [1, 2]): Int }")
    assert schema.query_type is not None
    schema.query_type.fields["f"].args["x"].default_value = Awkward()
    assert (
        first_line(lookup(build_index(schema), "Query.f")) == "Query.f(x: V = <unprintable>): Int"
    )


def test_a_stale_literal_is_not_kept_for_a_value_of_another_kind() -> None:
    schema = build_schema("scalar JSON type Query { f(x: JSON = true): String }")
    assert schema.query_type is not None
    schema.query_type.fields["f"].args["x"].default_value = 1
    assert first_line(lookup(build_index(schema), "Query.f")) == "Query.f(x: JSON = 1): String"


def test_a_shared_root_field_resolves_by_bare_name_when_mutations_are_enabled() -> None:
    index = build_index(
        build_schema("schema { query: Root mutation: Root } type Root { write: Int }")
    )
    assert first_line(lookup(index, "write")) == "Root.write: Int"
    assert "Root.write: Int" in describe(index, names=["write"])


def test_a_scalar_default_of_another_kind_than_its_literal_is_marked() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    flag = GraphQLScalarType("Flag", serialize=bool)
    query = GraphQLObjectType(
        "Query", {"f": GraphQLField(GraphQLString, args={"x": GraphQLArgument(flag, 1)})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Flag = <unprintable>): String"


def test_a_source_literal_is_compared_after_input_field_renaming() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLInputObjectType,
        GraphQLInt,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    opt = GraphQLInputObjectType(
        "Opt",
        {
            "left": GraphQLInputField(GraphQLInt, out_name="right"),
            "right": GraphQLInputField(GraphQLInt, out_name="left"),
        },
    )
    arg = GraphQLArgument(opt, {"right": 1})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Opt")),
        default_value=parse_value("{left: 1}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {right: 1}): String"


def test_a_source_literal_of_another_kind_than_the_raw_default_is_not_kept() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    flag = GraphQLScalarType("Flag", serialize=bool, parse_value=bool)
    arg = GraphQLArgument(flag, 2)
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Flag")),
        default_value=parse_value("true"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Flag = <unprintable>): String"


def test_a_union_named_in_a_visible_interface_signature_is_visible_with_visible_members() -> None:
    index = build_index(
        build_schema(
            "type Query { t: T } interface I { u: U } type T implements I { u: A } "
            "union U = A | B type A { id: ID } type B { secret: String } type Mutation { write: U }"
        ),
        include_mutations=False,
    )
    assert "  u: U" in lookup(index, "I")
    assert first_line(lookup(index, "U")) == "union U = A"
    assert index.resolve("B") is None


def test_a_default_renders_as_the_literal_that_delivers_it() -> None:
    from graphql import GraphQLArgument, GraphQLEnumType, GraphQLField, GraphQLSchema, GraphQLString
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    choice = GraphQLEnumType("Choice", {"A": "B", "B": "A"})
    arg = GraphQLArgument(choice, "A")
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Choice")),
        default_value=parse_value("A"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Choice = B): String"


def test_a_tuple_default_for_a_custom_scalar_is_not_shown_as_a_list() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    seq = GraphQLScalarType("Seq", serialize=list)
    query = GraphQLObjectType(
        "Query", {"f": GraphQLField(GraphQLString, args={"x": GraphQLArgument(seq, (1, 2))})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Seq = <unprintable>): String"


def test_a_stale_literal_that_no_longer_validates_is_not_kept() -> None:
    schema = build_schema(
        "input Opt { a: Int old: Int } type Query { f(x: Opt = {a: 1, old: 2}): String }"
    )
    opt = schema.type_map["Opt"]
    assert isinstance(opt, GraphQLInputObjectType) and schema.query_type is not None
    del opt.fields["old"]
    schema.query_type.fields["f"].args["x"].default_value = {"a": 1}
    assert first_line(lookup(build_index(schema), "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_a_tuple_inside_a_list_of_custom_scalars_keeps_its_kind() -> None:
    schema = build_schema("scalar Seq type Query { f(x: [Seq] = [[1, 2]]): String }")
    assert schema.query_type is not None
    schema.query_type.fields["f"].args["x"].default_value = [(1, 2)]
    assert (
        first_line(lookup(build_index(schema), "Query.f"))
        == "Query.f(x: [Seq] = <unprintable>): String"
    )


def test_a_singleton_literal_for_a_list_is_checked_against_the_item_type() -> None:
    schema = build_schema(
        "input Opt { a: Int old: Int } type Query { f(x: [Opt] = {a: 1, old: 2}): String }"
    )
    opt = schema.type_map["Opt"]
    assert isinstance(opt, GraphQLInputObjectType) and schema.query_type is not None
    del opt.fields["old"]
    schema.query_type.fields["f"].args["x"].default_value = [{"a": 1}]
    assert (
        first_line(lookup(build_index(schema), "Query.f")) == "Query.f(x: [Opt] = [{a: 1}]): String"
    )


def test_colliding_output_names_fall_back_to_kind_strict_comparison() -> None:
    schema = build_schema(
        "scalar Seq input Opt { a: Seq b: [Int] } type Query { f(x: Opt = {a: [1, 2]}): String }"
    )
    opt = schema.type_map["Opt"]
    assert isinstance(opt, GraphQLInputObjectType) and schema.query_type is not None
    for field in opt.fields.values():
        field.out_name = "v"
    schema.query_type.fields["f"].args["x"].default_value = {"a": (1, 2)}
    assert (
        first_line(lookup(build_index(schema), "Query.f"))
        == "Query.f(x: Opt = <unprintable>): String"
    )


def test_a_custom_output_type_still_renders_a_faithful_default() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLInt,
        GraphQLSchema,
        GraphQLString,
    )

    opt = GraphQLInputObjectType(
        "Opt", {"a": GraphQLInputField(GraphQLInt)}, out_type=lambda d: tuple(d.items())
    )
    query = GraphQLObjectType(
        "Query", {"f": GraphQLField(GraphQLString, args={"x": GraphQLArgument(opt, {"a": 1})})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_a_literal_with_duplicate_fields_is_not_kept() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLInt,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    opt = GraphQLInputObjectType("Opt", {"a": GraphQLInputField(GraphQLInt)})
    arg = GraphQLArgument(opt, {"a": 2})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Opt")),
        default_value=parse_value("{a: 1, a: 2}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 2}): String"


def test_a_dictionary_returning_output_type_still_compares_by_kind() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLInt,
        GraphQLList,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    seq = GraphQLScalarType("Seq")
    opt = GraphQLInputObjectType(
        "Opt",
        {"a": GraphQLInputField(seq), "b": GraphQLInputField(GraphQLList(GraphQLInt))},
        out_type=lambda d: {"b": d["a"]},
    )
    arg = GraphQLArgument(opt, {"a": (1, 2)})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Opt")),
        default_value=parse_value("{a: [1, 2]}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = <unprintable>): String"
    renamed = GraphQLInputObjectType(
        "Opt", {"a": GraphQLInputField(GraphQLInt)}, out_type=lambda d: {"renamed": d["a"]}
    )
    query = GraphQLObjectType(
        "Query", {"f": GraphQLField(GraphQLString, args={"x": GraphQLArgument(renamed, {"a": 1})})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_duplicate_fields_inside_a_custom_scalar_literal_are_rejected() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    arg = GraphQLArgument(GraphQLScalarType("Opt"), {"a": 2})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Opt")),
        default_value=parse_value("{a: 1, a: 2}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 2}): String"


def test_a_custom_output_object_compares_its_fields_by_kind() -> None:
    import dataclasses

    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    @dataclasses.dataclass
    class OptValue:
        a: object

    opt = GraphQLInputObjectType(
        "Opt", {"a": GraphQLInputField(GraphQLScalarType("Val"))}, out_type=lambda d: OptValue(**d)
    )
    arg = GraphQLArgument(opt, {"a": 1})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Opt")),
        default_value=parse_value("{a: true}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_a_default_keyed_by_output_names_renders_by_input_names() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLInt,
        GraphQLNonNull,
        GraphQLSchema,
        GraphQLString,
    )

    opt = GraphQLInputObjectType("Opt", {"a": GraphQLInputField(GraphQLInt, out_name="b")})
    query = GraphQLObjectType(
        "Query",
        {
            "f": GraphQLField(
                GraphQLString, args={"x": GraphQLArgument(GraphQLNonNull(opt), {"b": 1})}
            )
        },
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt! = {a: 1}): String"


def test_a_literal_with_a_variable_is_not_kept() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    arg = GraphQLArgument(GraphQLScalarType("Opt"), {"a": Undefined})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Opt")),
        default_value=parse_value("{a: $missing}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert "$missing" not in lookup(index, "Query.f")


def test_a_slotted_output_object_compares_its_slots() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    class Slotted:
        __slots__ = ("a", "__dict__")

        def __init__(self, a: object) -> None:
            self.a = a

    opt = GraphQLInputObjectType(
        "Opt", {"a": GraphQLInputField(GraphQLScalarType("Val"))}, out_type=lambda d: Slotted(**d)
    )
    arg = GraphQLArgument(opt, {"a": 1})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Opt")),
        default_value=parse_value("{a: true}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_a_datetime_default_renders_through_its_scalar() -> None:
    from datetime import datetime

    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    when = GraphQLScalarType(
        "DateTime", serialize=lambda d: d.isoformat(), parse_value=datetime.fromisoformat
    )
    query = GraphQLObjectType(
        "Query",
        {
            "f": GraphQLField(
                GraphQLString, args={"x": GraphQLArgument(when, datetime(2026, 9, 17))}
            )
        },
    )
    index = build_index(GraphQLSchema(query=query))
    assert (
        first_line(lookup(index, "Query.f"))
        == 'Query.f(x: DateTime = "2026-09-17T00:00:00"): String'
    )


def test_a_renamed_default_renders_even_when_output_names_overlap_input_names() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLInt,
        GraphQLNonNull,
        GraphQLSchema,
        GraphQLString,
    )

    opt = GraphQLInputObjectType(
        "Opt",
        {
            "a": GraphQLInputField(GraphQLInt, out_name="b"),
            "b": GraphQLInputField(GraphQLInt, out_name="c"),
        },
    )
    query = GraphQLObjectType(
        "Query",
        {
            "f": GraphQLField(
                GraphQLString, args={"x": GraphQLArgument(GraphQLNonNull(opt), {"b": 1})}
            )
        },
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt! = {a: 1}): String"


def test_a_type_definition_without_directives_does_not_crash() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLInt,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputObjectTypeDefinitionNode, NameNode

    opt = GraphQLInputObjectType("Opt", {"a": GraphQLInputField(GraphQLInt)})
    opt.ast_node = InputObjectTypeDefinitionNode(name=NameNode(value="Opt"), fields=[])
    query = GraphQLObjectType(
        "Query", {"f": GraphQLField(GraphQLString, args={"x": GraphQLArgument(opt)})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Opt")) == "input Opt {"
    assert "Opt" in search(index, "Query.f")


def _opt_with_output(out_type: object) -> Index:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLInputField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    opt = GraphQLInputObjectType(
        "Opt",
        {"a": GraphQLInputField(GraphQLScalarType("Val"))},
        out_type=out_type,  # type: ignore[arg-type]
    )
    arg = GraphQLArgument(opt, {"a": 1})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="Opt")),
        default_value=parse_value("{a: true}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    return build_index(GraphQLSchema(query=query))


def test_string_and_private_slots_are_compared() -> None:
    class Box:
        __slots__ = "value"

        def __init__(self, a: object) -> None:
            self.value = a

    class Private:
        __slots__ = ("__value",)

        def __init__(self, a: object) -> None:
            self.__value = a

    for box in (Box, Private):
        index = _opt_with_output(lambda d, box=box: box(**d))
        assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_sets_and_dictionary_keys_are_compared_by_kind() -> None:
    for out in (lambda d: {d["a"]}, lambda d: frozenset({d["a"]}), lambda d: {d["a"]: "x"}):
        index = _opt_with_output(out)
        assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_shadowed_slots_containers_and_native_subclasses_compare_by_kind() -> None:
    import collections

    class Base:
        __slots__ = ("value",)

    class Sub(Base):
        __slots__ = ("value",)

        def __init__(self, a: object) -> None:
            Base.value.__set__(self, a)  # type: ignore[attr-defined]
            Sub.value.__set__(self, 0)  # type: ignore[attr-defined]

    class Key:
        def __init__(self, v: object) -> None:
            self.value = v

    outputs = (
        lambda d: Sub(d["a"]),
        lambda d: collections.deque([d["a"]]),
        lambda d: {Key(1), Key(d["a"])},
        lambda d: dict.fromkeys([Key(1), Key(d["a"])], "x"),
    )
    for out in outputs:
        index = _opt_with_output(out)
        assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_a_native_subclass_default_keeps_its_value() -> None:
    from datetime import datetime

    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    class Date(datetime):
        pass

    when = GraphQLScalarType(
        "When", serialize=lambda d: d.isoformat(), parse_value=Date.fromisoformat
    )
    arg = GraphQLArgument(when, Date(2026, 9, 17))
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="When")),
        default_value=parse_value('"2020-01-01T00:00:00"'),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert (
        first_line(lookup(index, "Query.f")) == 'Query.f(x: When = "2026-09-17T00:00:00"): String'
    )


def test_a_large_default_is_rendered_once_and_quickly() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    big = {f"k{i}": i for i in range(800)}
    query = GraphQLObjectType(
        "Query",
        {
            "f": GraphQLField(
                GraphQLString, args={"x": GraphQLArgument(GraphQLScalarType("JSON"), big)}
            )
        },
    )
    index = build_index(GraphQLSchema(query=query))
    started = time.perf_counter()
    for _ in range(3):
        lookup(index, "Query", budget=100)
    assert time.perf_counter() - started < 1.0


def test_a_rendered_default_is_cached_per_definition() -> None:
    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    from phoenix.server.api.schema_search import _DEFAULTS

    big = {f"k{i}": i for i in range(800)}
    arg = GraphQLArgument(GraphQLScalarType("JSON"), big)
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    lookup(index, "Query", budget=100)
    assert any(k[0] == id(arg) and v[0] is arg for k, v in _DEFAULTS.items())


def test_a_native_subclass_whose_attributes_differ_is_marked() -> None:
    from datetime import datetime

    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    class Date(datetime):
        pass

    when = GraphQLScalarType(
        "When", serialize=lambda d: d.isoformat(), parse_value=Date.fromisoformat
    )
    default = Date(2026, 9, 17)
    default.source = "schema"  # type: ignore[attr-defined]
    query = GraphQLObjectType(
        "Query", {"f": GraphQLField(GraphQLString, args={"x": GraphQLArgument(when, default)})}
    )
    index = build_index(GraphQLSchema(query=query))
    # A parsed Date lacks the attribute the default carries, so no literal delivers it.
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: When = <unprintable>): String"


def test_an_ordered_mapping_default_keeps_its_order() -> None:
    from collections import OrderedDict

    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    json_scalar = GraphQLScalarType("JSON", parse_value=OrderedDict)
    arg = GraphQLArgument(json_scalar, OrderedDict([("b", 2), ("a", 1)]))
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="JSON")),
        default_value=parse_value("{a: 1, b: 2}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: JSON = {b: 2, a: 1}): String"


def test_slots_from_factory_made_classes_stay_distinct() -> None:
    def boxed(base: type) -> type:
        class Box(base):  # type: ignore[misc]
            __slots__ = ("value",)

        return Box

    Base = boxed(object)
    Sub = boxed(Base)

    def make(d: dict[str, object]) -> object:
        obj = Sub()
        Base.value.__set__(obj, 0)  # type: ignore[attr-defined]
        Sub.value.__set__(obj, d["a"])  # type: ignore[attr-defined]
        return obj

    index = _opt_with_output(make)
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Opt = {a: 1}): String"


def test_container_metadata_and_plain_dictionary_order_are_compared() -> None:
    from collections import deque

    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    queue = GraphQLScalarType("Queue", serialize=list, parse_value=deque)
    query = GraphQLObjectType(
        "Query",
        {
            "f": GraphQLField(
                GraphQLString, args={"x": GraphQLArgument(queue, deque([1], maxlen=1))}
            )
        },
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: Queue = <unprintable>): String"

    class Tagged(list):  # type: ignore[type-arg]
        def __init__(self, d: dict[str, object]) -> None:
            super().__init__()
            self.value = d["a"]

    assert (
        first_line(lookup(_opt_with_output(Tagged), "Query.f"))
        == "Query.f(x: Opt = {a: 1}): String"
    )

    arg = GraphQLArgument(GraphQLScalarType("JSON"), {"b": 2, "a": 1})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="JSON")),
        default_value=parse_value("{a: 1, b: 2}"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: JSON = {b: 2, a: 1}): String"


def test_negative_zero_keeps_its_sign() -> None:
    schema = build_schema("type Query { f(x: Float = 0.0): String }")
    assert schema.query_type is not None
    schema.query_type.fields["f"].args["x"].default_value = -0.0
    assert first_line(lookup(build_index(schema), "Query.f")) in (
        "Query.f(x: Float = -0.0): String",
        "Query.f(x: Float = -0): String",
    )


def test_a_rebuild_re_renders_a_changed_default() -> None:
    schema = build_schema("type Query { f(x: Int = 1): String }")
    assert schema.query_type is not None
    assert "x: Int = 1" in lookup(build_index(schema), "Query.f")
    schema.query_type.fields["f"].args["x"].default_value = 2
    assert "x: Int = 2" in lookup(build_index(schema), "Query.f")


def test_an_aware_datetime_default_keeps_its_zone() -> None:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    when = GraphQLScalarType(
        "DateTime", serialize=lambda d: d.isoformat(), parse_value=datetime.fromisoformat
    )
    zoned = datetime(2026, 9, 17, 12, tzinfo=ZoneInfo("America/Los_Angeles"))
    query = GraphQLObjectType(
        "Query", {"f": GraphQLField(GraphQLString, args={"x": GraphQLArgument(when, zoned)})}
    )
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) == "Query.f(x: DateTime = <unprintable>): String"


def test_primitive_subclasses_default_factories_and_signed_zero_in_sets() -> None:
    from collections import defaultdict

    from graphql import (
        GraphQLArgument,
        GraphQLField,
        GraphQLScalarType,
        GraphQLSchema,
        GraphQLString,
    )

    class Token(str):
        pass

    token = Token("abc")
    token.source = "schema"  # type: ignore[attr-defined]
    cases = [
        (GraphQLScalarType("Token", serialize=str, parse_value=Token), token),
        (
            GraphQLScalarType(
                "Map", serialize=dict, parse_value=lambda v: defaultdict(lambda: "parsed", v)
            ),
            defaultdict(lambda: "schema", {"a": "1"}),
        ),
    ]
    for scalar, default in cases:
        query = GraphQLObjectType(
            "Query",
            {"f": GraphQLField(GraphQLString, args={"x": GraphQLArgument(scalar, default)})},
        )
        index = build_index(GraphQLSchema(query=query))
        assert "<unprintable>" in first_line(lookup(index, "Query.f")), scalar.name
    # A set member keeps the sign of zero: the source literal [0.0] is refused, [-0.0] delivers.
    from graphql.language import InputValueDefinitionNode, NamedTypeNode, NameNode

    arg = GraphQLArgument(GraphQLScalarType("FloatSet", serialize=list, parse_value=set), {-0.0})
    arg.ast_node = InputValueDefinitionNode(
        name=NameNode(value="x"),
        type=NamedTypeNode(name=NameNode(value="FloatSet")),
        default_value=parse_value("[0.0]"),
    )
    query = GraphQLObjectType("Query", {"f": GraphQLField(GraphQLString, args={"x": arg})})
    index = build_index(GraphQLSchema(query=query))
    assert first_line(lookup(index, "Query.f")) in (
        "Query.f(x: FloatSet = [-0.0]): String",
        "Query.f(x: FloatSet = [-0]): String",
    )


# --- properties of the real schema -----------------------------------------------


def _literal(arg: GraphQLArgument) -> str:
    node = ast_from_value(arg.default_value, arg.type)
    assert node is not None
    return print_ast(node)


def test_every_default_renders_as_its_graphql_literal(index: Index) -> None:
    """Holds for every argument and input field in the schema with a default."""
    checked = 0
    for t in index.schema.type_map.values():
        if (
            isinstance(t, (GraphQLObjectType, GraphQLInterfaceType))
            and index.resolve(t.name) is not None
        ):
            for fname, f in t.fields.items():
                line = first_line(lookup(index, f"{t.name}.{fname}"))
                for a, arg in f.args.items():
                    if arg.default_value is Undefined or a in {"first", "last", "after", "before"}:
                        continue
                    assert f"{a}: {arg.type} = {_literal(arg)}" in line, line
                    checked += 1
        elif isinstance(t, GraphQLInputObjectType) and index.resolve(t.name) is not None:
            for fname, field in t.fields.items():
                if field.default_value is Undefined:
                    continue
                line = first_line(lookup(index, f"{t.name}.{fname}"))
                assert line.endswith(f"= {_literal(field)}"), line
                checked += 1
    assert checked > 0
    for name in ("None", "True", "False"):
        assert f"= {name}" not in lookup(index, index.query_root, budget=100_000)


def test_pagination_collapses_exactly_for_the_complete_optional_relay_set(index: Index) -> None:
    """The marker stands for all four arguments, so it appears only when a field
    takes all four as optional; a forward-only field keeps its arguments visible."""
    pagination = {"first": "Int", "last": "Int", "after": "String", "before": "String"}
    checked = 0
    for t in index.schema.type_map.values():
        if (
            not isinstance(t, (GraphQLObjectType, GraphQLInterfaceType))
            or index.resolve(t.name) is None
        ):
            continue
        for fname, f in t.fields.items():
            if not {"first", "after"} <= f.args.keys():
                continue
            line = first_line(lookup(index, f"{t.name}.{fname}"))
            complete = all(
                a in f.args and str(f.args[a].type) == expected
                for a, expected in pagination.items()
            )
            assert (PAGINATION in line) == complete, line
            assert ("first:" in line) != complete, line
            checked += 1
    assert checked > 0


def test_every_reach_path_is_a_chain_of_real_fields(index: Index) -> None:
    schema = index.schema
    checked = 0
    for u in index.units:
        if u.kind != "type" or not isinstance(
            schema.type_map[u.name], (GraphQLObjectType, GraphQLInterfaceType)
        ):
            continue
        for path in reach_paths(index, u.name):
            assert path[0].split(".", 1)[0] in index.roots, path
            for hop, following in zip(path, path[1:]):
                type_name, field_name = hop.split(".", 1)
                owner = schema.type_map[type_name]
                assert isinstance(owner, (GraphQLObjectType, GraphQLInterfaceType)), hop
                delivered = get_named_type(owner.fields[field_name].type)
                next_owner = following.split(".", 1)[0]
                assert next_owner in _delivered_names(schema, delivered), (hop, following)
            checked += 1
    assert checked > 0


def _delivered_names(schema: GraphQLSchema, delivered: object) -> set[str]:
    """The concrete types a field of type ``delivered`` can hand to the next hop."""
    names: set[str] = set()
    if isinstance(delivered, GraphQLObjectType) and "edges" in delivered.fields:
        edge = get_named_type(delivered.fields["edges"].type)
        if isinstance(edge, GraphQLObjectType) and "node" in edge.fields:
            delivered = get_named_type(edge.fields["node"].type)
    if isinstance(delivered, (GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType)):
        names.add(delivered.name)
    if isinstance(delivered, (GraphQLInterfaceType, GraphQLUnionType)):
        names.update(p.name for p in schema.get_possible_types(delivered))
    return names


def test_every_type_lookup_is_well_formed_sdl(index: Index) -> None:
    """The definition block of a lookup parses as SDL, comments included."""
    checked = 0
    for u in index.units:
        if u.kind != "type":
            continue
        lines = lookup(index, u.name).splitlines()
        end = next((i for i, line in enumerate(lines) if line == "}"), 0)
        block = "\n".join(lines[: end + 1]).replace(PAGINATION, PAGINATION_ARGUMENTS)
        if block.startswith("--"):
            continue
        parse(block)
        checked += 1
    assert checked > 0


def test_every_search_answer_respects_its_budget(index: Index) -> None:
    """Holds across query shapes and budgets, expansions and trailers included."""
    queries = [
        "id",
        "name",
        "span cost",
        "trace by otel id",
        "dataset mutations",
        "Span.cost",
        "Project",
    ]
    for query in queries:
        for budget in (300, 800, 1500, 4000):
            text = search(index, query, budget)
            assert len(text) <= budget, (query, budget, len(text))


def test_grouped_lines_apply_to_every_listed_owner(index: Index) -> None:
    for query in ("cost summary time range", "start time", "id", "name", "created at"):
        for line in search(index, query, budget=6000).splitlines():
            if "  # on " not in line:
                continue
            signature, rest = line.split("  # on ", 1)
            owners = rest.split('  "', 1)[0].split(" +")[0].split(", ")
            signature = signature.removeprefix("enum ").removeprefix("input ")
            field = signature.split("(", 1)[0].split(":", 1)[0]
            for owner in owners:
                assert first_line(lookup(index, f"{owner}.{field}")) == f"{owner}.{signature}"


# --- invariants of the real schema -----------------------------------------------


def test_every_read_root_exists(graphql_schema: GraphQLSchema) -> None:
    missing = [r for r in READ_ROOTS if r not in graphql_schema.type_map]
    assert not missing


def test_every_connection_has_edges_node(graphql_schema: GraphQLSchema) -> None:
    for t in graphql_schema.type_map.values():
        if isinstance(t, GraphQLObjectType) and {"edges", "pageInfo"} <= t.fields.keys():
            edge = get_named_type(t.fields["edges"].type)
            assert isinstance(edge, GraphQLObjectType) and "node" in edge.fields, t.name


def test_oversized_queries_are_bounded(index: Index) -> None:
    query = " ".join(u.name for u in index.units[:1000])
    started = time.perf_counter()
    text = search(index, query)
    assert time.perf_counter() - started < 2.0
    assert any("more; narrow the search (" in line for line in text.splitlines())


def test_budget_bounds_a_broad_search(index: Index) -> None:
    text = search(index, "id", budget=800)
    assert len(text) <= 800
    assert any(
        line.startswith("... ") and "more; narrow the search" in line for line in text.splitlines()
    )


def test_cached_index_is_built_once_per_schema_and_setting(graphql_schema: GraphQLSchema) -> None:
    a = cached_index(graphql_schema)
    assert cached_index(graphql_schema) is a
    b = cached_index(graphql_schema, include_mutations=False)
    assert b is not a and cached_index(graphql_schema, include_mutations=False) is b


def test_index_is_deterministic(graphql_schema: GraphQLSchema) -> None:
    a = build_index(graphql_schema)
    b = build_index(graphql_schema)
    for query in ("cost", "annotation score", "add examples to dataset"):
        assert search(a, query) == search(b, query)
