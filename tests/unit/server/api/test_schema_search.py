from __future__ import annotations

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
    reach_paths,
    search,
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
    return text.splitlines()[0]


def test_every_read_root_exists(graphql_schema: GraphQLSchema) -> None:
    missing = [r for r in READ_ROOTS if r not in graphql_schema.type_map]
    assert not missing


@pytest.mark.parametrize(
    "query,expected",
    [
        ("span cost", "Span.costSummary: SpanCostSummary"),
        ("add examples to dataset", "mutation addExamplesToDataset"),
        ("trace by otel id", "Query.getTraceByOtelId"),
        ("session duration", "Project.averageSessionDurationMs"),
        ("latency percentile", "Project.traceLatencyMsPercentileTimeSeries"),
        ("experiment run error", "error: String  # on ExperimentRun"),
        # Stemming: "annotate" reaches "annotations", "latencies" reaches "latency".
        ("annotate spans", "Span.spanAnnotations("),
        ("latencies", "ExperimentRun.latencyMs: Float!"),
        # The verb is normalized like every other term, so it still marks intent.
        ("deleting a dataset", "mutation deleteDataset("),
    ],
)
def test_top_line(index: Index, query: str, expected: str) -> None:
    assert first_line(search(index, query)).startswith(expected)


def test_status_code_finds_the_status_code_fields(index: Index) -> None:
    top = search(index, "status_code").splitlines()[:2]
    assert all(line.startswith("Span.") and "StatusCode" in line for line in top)


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
    assert lines[-1].startswith("# ... ") and lines[-1].endswith("more sections omitted")


def test_mutation_lookup_prints_its_input_closure(index: Index) -> None:
    text = lookup(index, "addExamplesToDataset")
    assert "input AddExamplesToDatasetInput" in text
    assert "input DatasetExampleInput" in text
    assert text.rstrip().splitlines()[-1].startswith("# DatasetMutationPayload:")


def test_type_lookup_prints_the_path_as_pruned_sdl(index: Index) -> None:
    text = lookup(index, "Experiment")
    assert "# reached through:" in text
    assert "type Dataset implements Node {\n" in text
    assert "  experiments(" in text
    assert "  baselineExperiment: Experiment\n" in text
    # The pruned Dataset carries only the fields on the paths, not all 22.
    assert "  exampleCount(" not in text
    assert "# ExperimentRun:" in text
    assert "# ExperimentRunConnection" not in text


def test_field_lookup_prints_the_path_to_its_parent(index: Index) -> None:
    text = lookup(index, "Span.costSummary")
    assert "type Query {\n  getSpanByOtelId(spanId: String!): Span\n}" in text
    assert "type Span implements Node {\n  costSummary: SpanCostSummary\n}" in text


def test_abstract_types_list_their_possible_types(index: Index) -> None:
    union = lookup(index, "PromptTemplate")
    assert "# possible types: PromptStringTemplate, PromptChatTemplate" in union
    assert "# reached through:" in union
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


def test_oversized_queries_are_bounded(index: Index) -> None:
    query = " ".join(u.name for u in index.units[:1000])
    started = time.perf_counter()
    text = search(index, query)
    assert time.perf_counter() - started < 2.0
    assert text.splitlines()[-1].endswith("more; narrow the search")


def test_cached_index_is_built_once_per_schema_and_setting(graphql_schema: GraphQLSchema) -> None:
    a = cached_index(graphql_schema)
    assert cached_index(graphql_schema) is a
    b = cached_index(graphql_schema, include_mutations=False)
    assert b is not a and cached_index(graphql_schema, include_mutations=False) is b


def test_budget_bounds_a_broad_search(index: Index) -> None:
    text = search(index, "id", budget=800)
    assert len(text) <= 800
    assert text.splitlines()[-1].startswith("... ")
    assert "more; narrow the search" in text


def test_input_types_are_labelled_by_their_mutation(index: Index) -> None:
    text = search(index, "add examples to dataset")
    assert "input for Mutation.addExamplesToDataset" in text
    assert "node(id:)" not in text


def test_misses_say_so(index: Index) -> None:
    assert search(index, "zzqx").startswith("-- No type")
    assert search(index, "the of").startswith("-- Empty query")
    assert lookup(index, "NoSuchType").startswith("-- No type")


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
    assert "Project.spanAnnotationNames" in search(index, "span annotations names")


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
