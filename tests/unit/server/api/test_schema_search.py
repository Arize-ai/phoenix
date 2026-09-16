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
    GraphQLSchema,
    GraphQLUnionType,
    build_schema,
    get_named_type,
    is_non_null_type,
    parse,
)
from graphql.language import print_ast
from graphql.pyutils import Undefined
from graphql.utilities import ast_from_value

from phoenix.server.api.schema import build_graphql_schema
from phoenix.server.api.schema_search import (
    READ_ROOTS,
    Index,
    _terms,
    build_index,
    cached_index,
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
    assert top[0] == "Span"
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
    assert search(toy, "annotate spans").startswith("Span\n  spanAnnotations(")


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
    assert search(toy, "Project") == lookup(toy, "Project")
    assert search(toy, "span.costsummary") == lookup(toy, "Span.costSummary")


def test_several_searches_answer_together(toy: Index, toy_reads_only: Index) -> None:
    text = search_many(toy, ["session duration", "projects"], budget=3000)
    first, second = text.split("\n\n", 1)
    assert first_line(first).startswith("Project.averageSessionDurationMs")
    assert f"\n  projects({PAGINATION}, " in second
    assert text.count(PAGINATION_LEGEND) == 1
    assert text.splitlines()[-1] == PAGINATION_LEGEND
    assert len(text) <= 3000 + len(PAGINATION_LEGEND)
    text = search_many(toy_reads_only, ["delete dataset", "clear project"])
    assert text.count(DISABLED) == 1
    assert text.splitlines()[-1] == DISABLED


def test_several_exact_names_are_each_looked_up(toy: Index) -> None:
    text = search(toy, "TimeRange, TimeBinConfig TimeBinScale")
    assert text == lookup_many(toy, ["TimeRange", "TimeBinConfig", "TimeBinScale"])
    blocks = text.split("\n\n")
    assert [first_line(b) for b in blocks] == [
        "input TimeRange {",
        "input TimeBinConfig {",
        "enum TimeBinScale {",
    ]
    # One unknown name makes it a free-text search again.
    assert "in full:" in search(toy, "TimeRange bogus")
    assert lookup_many(toy, ["Span", "NoSuch"]).endswith("named 'NoSuch'. Try search('NoSuch').")
    assert len(lookup_many(toy, ["Project", "Span"], budget=600)) <= 600 + len(PAGINATION_LEGEND)


def test_misses_say_so(toy: Index) -> None:
    assert search(toy, "zzqx").startswith("-- No type")
    assert search(toy, "the of").startswith("-- Empty query")
    assert lookup(toy, "NoSuchType").startswith("-- No type")
    assert lookup(toy, "NoSuchType.field").startswith("-- No type")
    assert lookup(toy, "Project.nonexistent").startswith(
        "-- Project has no field 'nonexistent'. Try search('Project nonexistent')."
    )
    text = search(toy, "Project.nonexistent")
    assert first_line(text) == "-- Project has no field 'nonexistent'. Closest matches:"
    assert len(text.splitlines()) > 1


def test_relay_wrappers_say_what_they_wrap(toy: Index) -> None:
    connection = (
        "-- SpanConnection is a connection over Span: select `edges { node { ... } }` "
        "and `pageInfo`. Look up Span."
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
        line.startswith("# ... ") and line.endswith("more sections omitted") for line in lines
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
    listed = text.split(" in full:", 1)[0].splitlines()[:-1]
    assert listed and all(line.startswith("mutation ") for line in listed)
    assert "mutation deleteDataset(" in text and "mutation addExamplesToDataset(" in text
    assert search(toy, "mutations") == lookup(toy, "Mutation")
    # Two exact names would be a multi-lookup, but the root's name is the filter.
    project = search(toy, "project mutation")
    assert first_line(project).startswith("mutation clearProject(")
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
            and t.name.lower() in index.by_key
        ):
            for fname, f in t.fields.items():
                line = first_line(lookup(index, f"{t.name}.{fname}"))
                for a, arg in f.args.items():
                    if arg.default_value is Undefined or a in {"first", "last", "after", "before"}:
                        continue
                    assert f"{a}: {arg.type} = {_literal(arg)}" in line, line
                    checked += 1
        elif isinstance(t, GraphQLInputObjectType) and t.name.lower() in index.by_key:
            for fname, field in t.fields.items():
                if field.default_value is Undefined:
                    continue
                line = first_line(lookup(index, f"{t.name}.{fname}"))
                assert line.endswith(f"= {_literal(field)}"), line
                checked += 1
    assert checked > 0
    for name in ("None", "True", "False"):
        assert f"= {name}" not in lookup(index, index.query_root, budget=100_000)


def test_pagination_collapses_exactly_when_every_pagination_argument_is_optional(
    index: Index,
) -> None:
    pagination = {"first": "Int", "last": "Int", "after": "String", "before": "String"}
    checked = 0
    for t in index.schema.type_map.values():
        if (
            not isinstance(t, (GraphQLObjectType, GraphQLInterfaceType))
            or t.name.lower() not in index.by_key
        ):
            continue
        for fname, f in t.fields.items():
            if not {"first", "after"} <= f.args.keys():
                continue
            line = first_line(lookup(index, f"{t.name}.{fname}"))
            optional = all(
                str(get_named_type(arg.type)) == pagination[a] and not is_non_null_type(arg.type)
                for a, arg in f.args.items()
                if a in pagination
            )
            assert (PAGINATION in line) == optional, line
            assert ("first:" in line) != optional, line
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


def test_grouped_lines_apply_to_every_listed_owner(index: Index) -> None:
    for query in ("cost summary time range", "start time", "id", "name", "created at"):
        for line in search(index, query, budget=6000).splitlines():
            if "  # on " not in line:
                continue
            signature, rest = line.split("  # on ", 1)
            owners = rest.split('  "', 1)[0].split(" +")[0].split(", ")
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
    assert any(line.endswith("more; narrow the search") for line in text.splitlines())


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
