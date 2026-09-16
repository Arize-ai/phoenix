from __future__ import annotations

import re
import time

import pytest
import strawberry
from graphql import GraphQLObjectType, GraphQLSchema, build_schema, get_named_type

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


def test_every_read_root_exists(graphql_schema: GraphQLSchema) -> None:
    missing = [r for r in READ_ROOTS if r not in graphql_schema.type_map]
    assert not missing


@pytest.mark.parametrize(
    "query,expected",
    [
        # Stemming: "annotate" reaches "annotations", "latencies" reaches "latency".
        ("annotate spans", "  spanAnnotations("),
        ("latencies", "  latencyMs: Float!"),
        # The verb is normalized like every other term, so it still marks intent.
        ("deleting a dataset", "mutation deleteDataset("),
    ],
)
def test_stemmed_terms_reach_their_identifiers(index: Index, query: str, expected: str) -> None:
    assert expected in search(index, query)


def test_status_code_finds_the_status_code_fields(index: Index) -> None:
    top = search(index, "status_code").splitlines()[:3]
    assert top[0] == "Span"
    assert all(line.startswith("  ") and "StatusCode" in line for line in top[1:])


def test_description_only_match(index: Index) -> None:
    # "percolates" appears in one field description and in no identifier.
    assert first_line(search(index, "percolates")).startswith("Span.propagatedStatusCode")


def test_identifiers_inside_descriptions_contribute_their_parts() -> None:
    terms = _terms("The window uses startTime and endTime.")
    assert {"starttim", "start", "time", "end", "endtim"} <= set(terms)


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


@pytest.mark.parametrize(
    "name,expected",
    [
        ("Experiment", "type Experiment implements Node"),
        ("Span.costSummary", "Span.costSummary: SpanCostSummary"),
        ("clearProject", "mutation clearProject(input: ClearProjectInput!): Query!"),
        ("SpanColumn", "enum SpanColumn"),
    ],
)
def test_lookup_renders_the_named_unit(index: Index, name: str, expected: str) -> None:
    assert first_line(lookup(index, name)).startswith(expected)


def test_defaults_render_as_graphql_literals(index: Index) -> None:
    assert "filter: AnnotationFilter = null" in first_line(lookup(index, "Span.spanAnnotations"))
    assert "orphanSpanAsRootSpan: Boolean = true" in first_line(lookup(index, "Project.spans"))
    assert first_line(lookup(index, "CreateAgentSessionInput.isEphemeral")).endswith(
        "isEphemeral: Boolean! = false"
    )
    assert "= None" not in search(index, "span annotations")
    assert "= True" not in search(index, "spans")


def test_unreachable_types_say_what_returns_them(index: Index) -> None:
    assert "type DatasetMutationPayload  returned by Mutation." in search(
        index, "dataset mutation payload"
    )


def test_search_with_an_exact_name_is_a_full_lookup(index: Index) -> None:
    text = search(index, "Experiment")
    assert text == lookup(index, "Experiment")
    assert len(text) > 1500
    assert "truncated" not in text and "omitted" not in text


def test_lookup_truncates_at_whole_lines_and_keeps_the_block_closed(index: Index) -> None:
    text = lookup(index, "Query", budget=1500)
    assert len(text) <= 1500
    lines = text.splitlines()
    assert lines[0] == "type Query {"
    assert any(
        line.startswith("  # ... ") and line.endswith("more lines omitted") for line in lines
    )
    assert "}" in lines
    assert any(
        line.startswith("# ... ") and line.endswith("more sections omitted") for line in lines
    )


def test_optional_pagination_arguments_collapse_to_one_marker(index: Index) -> None:
    text = lookup(index, "Query.projects")
    assert first_line(text) == (
        "Query.projects(\u2026, sort: ProjectSort, filter: ProjectFilter): ProjectConnection!"
    )
    assert text.splitlines()[-1] == (
        "# \u2026 = first: Int, last: Int, after: String, before: String"
    )
    # A required `first` stays visible: the caller must pass it.
    assert "spans(first: Int!, timeRange: TimeRange, last: Int," in lookup(index, "Project.spans")
    hits = search(index, "prompts")
    assert "\n  prompts(\u2026, filter: PromptFilter" in hits
    assert hits.splitlines()[-1].startswith("# \u2026 = ")
    assert "\u2026" not in lookup(index, "Span.spanAnnotations")


def test_mutation_lookup_prints_its_input_closure(index: Index) -> None:
    text = lookup(index, "addExamplesToDataset")
    assert "input AddExamplesToDatasetInput" in text
    assert "input DatasetExampleInput" in text
    assert text.rstrip().splitlines()[-1].startswith("# DatasetMutationPayload:")


def test_type_lookup_prints_one_line_paths(index: Index) -> None:
    text = lookup(index, "Experiment")
    assert "# via Dataset.experiments" in text
    assert "# via Dataset.baselineExperiment" in text
    assert "type Dataset" not in text
    assert "# ExperimentRun:" in text
    assert "# ExperimentRunConnection" not in text


def test_field_lookup_prints_the_path_to_its_parent(index: Index) -> None:
    text = lookup(index, "Span.costSummary")
    assert "# via Query.getSpanByOtelId > Span.costSummary" in text
    assert "type Query" not in text


def test_several_searches_answer_together(index: Index) -> None:
    text = search_many(index, ["session duration", "prompts"], budget=3000)
    first, second = text.split("\n\n", 1)
    assert first_line(first).startswith("Project.averageSessionDurationMs")
    assert "\n  prompts(\u2026, " in second
    assert text.count("# \u2026 = ") == 1
    assert text.splitlines()[-1].startswith("# \u2026 = ")
    assert len(text) <= 3000 + 80
    hidden = build_index(index.schema, include_mutations=False)
    text = search_many(hidden, ["delete dataset", "clone prompt"])
    assert text.count("-- Mutations are disabled") == 1
    assert text.splitlines()[-1].startswith("-- Mutations are disabled")


def test_several_exact_names_are_each_looked_up(index: Index) -> None:
    text = search(index, "TimeRange, TimeBinConfig TimeBinScale")
    assert text == lookup_many(index, ["TimeRange", "TimeBinConfig", "TimeBinScale"])
    blocks = text.split("\n\n")
    assert [first_line(b) for b in blocks] == [
        "input TimeRange {",
        "input TimeBinConfig {",
        "enum TimeBinScale {",
    ]
    # One unknown name makes it a free-text search again.
    assert "in full:" in search(index, "TimeRange bogus")
    assert lookup_many(index, ["Span", "NoSuch"]).endswith("named 'NoSuch'. Try search('NoSuch').")
    assert len(lookup_many(index, ["Project", "Span"], budget=1000)) <= 1000 + 80


def test_top_hit_follows_the_list_in_full(index: Index) -> None:
    text = search(index, "trace by otel id")
    assert "# Query.getTraceByOtelId in full:" in text
    assert "\nQuery.getTraceByOtelId(traceId: String!): Trace\n" in text
    assert "# Trace: id, traceId" in text
    mutations = search(index, "deleting a dataset")
    assert "# deleteDataset in full:" in mutations
    assert "input DeleteDatasetInput {" in mutations
    # A shared or abstract top hit is not expanded.
    assert " in full:" not in search(index, "experiment run error")


def test_field_lookup_inlines_its_inputs_and_return_members(index: Index) -> None:
    text = lookup(index, "Project.traceCountByStatusTimeSeries")
    assert "input TimeRange {" in text
    assert "input TimeBinConfig {" in text
    assert "enum TimeBinScale {" in text
    assert "# TraceCountByStatusTimeSeries: data" in text
    assert "# TraceCountByStatusTimeSeriesDataPoint: timestamp, okCount, errorCount" in text
    assert "# CostBreakdown: tokens, cost" in lookup(index, "Span.costSummary")


def test_types_render_one_member_per_line_with_trailing_descriptions() -> None:
    schema = build_schema(
        '"""A thing."""\ntype Query { """The id. Never null."""\nid: ID, n(k: Int = 1): Int }'
    )
    text = lookup(build_index(schema), "Query")
    assert text.splitlines()[:3] == [
        "type Query {  # A thing.",
        "  id: ID  # The id.",
        "  n(k: Int = 1): Int",
    ]
    assert '"""' not in text


def test_abstract_types_list_their_possible_types(index: Index) -> None:
    union = lookup(index, "PromptTemplate")
    assert first_line(union) == "union PromptTemplate = PromptStringTemplate | PromptChatTemplate"
    assert "# via PromptVersion.template" in union
    node = lookup(index, "Node")
    possible = next(line for line in node.splitlines() if line.startswith("# possible types: "))
    assert "Project" in possible and "Experiment" in possible


def test_reach_paths_are_shortest_first_and_skip_self_references(index: Index) -> None:
    paths = reach_paths(index, "Span")
    assert paths[0] == ("Query.getSpanByOtelId",)
    assert all("Span." not in hop for path in paths for hop in path)
    assert len(paths) <= 3


def test_excluded_mutations_take_their_inputs_and_payloads_with_them(
    graphql_schema: GraphQLSchema,
) -> None:
    index = build_index(graphql_schema, include_mutations=False)
    names = {u.name for u in index.units}
    assert not any(u.kind == "mutation" for u in index.units)
    assert "DeleteDatasetInput" not in names
    assert "DatasetMutationPayload" not in names
    # Inputs and enums shared with the query side stay.
    assert "TimeRange" in names and "SpanColumn" in names
    assert lookup(index, "deleteDataset").startswith("-- deleteDataset is a mutation. --")
    assert search(index, "deleteDataset") == lookup(index, "deleteDataset")
    disabled = "-- Mutations are disabled for this session and are not listed."
    assert search(index, "delete dataset").splitlines()[-1] == disabled
    assert search(index, "clone prompt").splitlines()[-1] == disabled
    assert "disabled" not in search(index, "span cost")


def test_query_root_survives_mutation_exclusion(graphql_schema: GraphQLSchema) -> None:
    # Some mutations return Query so a client can refetch after a write. That
    # must not make the root itself a mutation-only payload.
    index = build_index(graphql_schema, include_mutations=False)
    assert first_line(lookup(index, "Query")) == "type Query {"
    assert any(u.kind == "field" and u.parent == "Query" for u in index.units)
    assert first_line(lookup(index, "Query.projects")).startswith("Query.projects(")


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


def test_subscription_only_types_are_never_indexed() -> None:
    schema = build_schema(
        "schema { query: Query subscription: Subscription }\n"
        "type Query { hello(shared: SharedInput): String }\n"
        "type Subscription { stream(input: StreamInput!, shared: SharedInput): StreamPayload! }\n"
        "input StreamInput { n: Int }\n"
        "input SharedInput { n: Int }\n"
        "interface StreamPayload { id: ID }\n"
        "type Chunk implements StreamPayload { id: ID, text: String }"
    )
    names = {u.name for u in build_index(schema).units}
    assert "Subscription" not in names
    assert "StreamInput" not in names and "StreamPayload" not in names
    # An implementation delivered only through a hidden root's interface goes too.
    assert "Chunk" not in names
    assert "SharedInput" in names


def test_union_members_are_reached_through_the_union_field() -> None:
    schema = build_schema(
        "type Query { thing: Thing }\n"
        "type Thing { data: Data }\n"
        "union Data = A | B\n"
        "type A { x: Int }\n"
        "type B { y: Int }"
    )
    index = build_index(schema)
    assert index.via("A") == "Query.thing > Thing.data"
    assert first_line(search(index, "x")) == "A.x: Int  via Query.thing > Thing.data"
    assert reach_paths(index, "B") == [("Query.thing", "Thing.data")]
    assert "# via Query.thing > Thing.data" in lookup(index, "B")


def test_cut_member_stubs_explain_their_marker() -> None:
    fields = " ".join(f"f{i}: Int" for i in range(14))
    schema = build_schema(
        f"type Query {{ big: Big, small: Small }}\ntype Big {{ {fields} }}\ntype Small {{ a: Int }}"
    )
    index = build_index(schema)
    text = lookup(index, "Query")
    assert "# Big: f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11 +2" in text
    assert "# Small: a" in text
    assert (
        text.splitlines()[-1]
        == "# +N counts members not shown; look up that type to see every one."
    )
    assert "+N" not in lookup(index, "Big")


def test_single_owner_hits_group_under_their_owner(index: Index) -> None:
    lines = search(index, "projects").splitlines()
    headers = [i for i, line in enumerate(lines) if re.fullmatch(r"[A-Z]\w*(  via .*)?", line)]
    assert lines[headers[0]].split("  ")[0] in {"Query", "Project"}
    # Every header is followed by at least one indented hit, and owners appear once.
    owners = [lines[i].split("  ")[0] for i in headers]
    assert len(owners) == len(set(owners))
    assert all(lines[i + 1].startswith("  ") for i in headers)
    text = search(index, "annotate spans")
    assert text.startswith("Span\n  spanAnnotations(")


def test_enums_returned_by_fields_say_so() -> None:
    schema = build_schema(
        "type Query { status: Status, items(sort: Dir): [Int] }\n"
        "enum Status { ACTIVE ARCHIVED }\n"
        "enum Dir { ASC DESC }"
    )
    index = build_index(schema)
    assert lookup(index, "Status").endswith("# used by Query.status")
    assert lookup(index, "Dir").endswith("# used by Query.items")
    assert first_line(search(index, "archived")) == "enum Status.ARCHIVED  used by Query.status"


def test_oversized_queries_are_bounded(index: Index) -> None:
    query = " ".join(u.name for u in index.units[:1000])
    started = time.perf_counter()
    text = search(index, query)
    assert time.perf_counter() - started < 2.0
    assert any(line.endswith("more; narrow the search") for line in text.splitlines())


def test_cached_index_is_built_once_per_schema_and_setting(graphql_schema: GraphQLSchema) -> None:
    a = cached_index(graphql_schema)
    assert cached_index(graphql_schema) is a
    b = cached_index(graphql_schema, include_mutations=False)
    assert b is not a and cached_index(graphql_schema, include_mutations=False) is b


def test_budget_bounds_a_broad_search(index: Index) -> None:
    text = search(index, "id", budget=800)
    assert len(text) <= 800
    assert any(
        line.startswith("... ") and "more; narrow the search" in line for line in text.splitlines()
    )


def test_input_types_are_labelled_by_their_mutation(index: Index) -> None:
    text = search(index, "add examples to dataset")
    assert "input for Mutation.addExamplesToDataset" in text
    assert "node(id:)" not in text


def test_relay_wrappers_say_what_they_wrap(index: Index) -> None:
    connection = "-- SpanConnection is a connection over Span: select `edges { node { ... } }` and `pageInfo`. Look up Span."
    assert lookup(index, "SpanConnection") == connection
    assert search(index, "SpanConnection") == connection
    assert lookup(index, "SpanConnection.edges") == connection
    assert lookup(index, "SpanEdge") == (
        "-- SpanEdge is a connection edge over Span: select `node { ... }`. Look up Span."
    )
    assert lookup(index, "PageInfo").startswith(
        "-- PageInfo is Relay pagination plumbing: hasNextPage"
    )


def test_misses_say_so(index: Index) -> None:
    assert search(index, "zzqx").startswith("-- No type")
    assert search(index, "the of").startswith("-- Empty query")
    assert lookup(index, "NoSuchType").startswith("-- No type")
    assert lookup(index, "NoSuchType.field").startswith("-- No type")
    assert lookup(index, "Project.nonexistent").startswith(
        "-- Project has no field 'nonexistent'. Try search('Project nonexistent')."
    )
    text = search(index, "Project.nonexistent")
    assert first_line(text) == "-- Project has no field 'nonexistent'. Closest matches:"
    assert len(text.splitlines()) > 1


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


def test_plural_query_terms_match_singular_identifiers(index: Index) -> None:
    assert "  spanAnnotationNames: [String!]!" in search(index, "span annotations names")


def test_every_connection_has_edges_node(graphql_schema: GraphQLSchema) -> None:
    for t in graphql_schema.type_map.values():
        if isinstance(t, GraphQLObjectType) and {"edges", "pageInfo"} <= t.fields.keys():
            edge = get_named_type(t.fields["edges"].type)
            assert isinstance(edge, GraphQLObjectType) and "node" in edge.fields, t.name


def test_index_is_deterministic(graphql_schema: GraphQLSchema) -> None:
    a = build_index(graphql_schema)
    b = build_index(graphql_schema)
    for query in ("cost", "annotation score", "add examples to dataset"):
        assert search(a, query) == search(b, query)
