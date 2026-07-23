"""Tests for the span analytics MCP tools.

Covers the field registry (dialect-branched expressions, guarded numeric
casts, percentiles), the query compiler (single scoping path, structured
errors, admission control), the five tools end-to-end over the real MCP
protocol, and a differential check of query results against the seed
script's independently computed ground truth. The suite runs under both
database backends via the ``--db`` option.
"""

from __future__ import annotations

import importlib.util
import json
import math
import random
import sys
from collections import Counter
from contextlib import AsyncExitStack
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, AsyncIterator, Sequence, cast

import httpx
import pytest
import sqlalchemy
from asgi_lifespan import LifespanManager
from sqlalchemy import text
from sqlalchemy.dialects import postgresql, sqlite

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.app import create_app
from phoenix.server.mcp_server import MCP_MOUNT_PATH
from phoenix.server.mcp_span_analytics import (
    build_span_analytics_tools,
    compiler,
    discovery,
    registry,
)
from phoenix.server.mcp_span_analytics.compiler import (
    AggregateQuery,
    Calculation,
    QueryError,
    RowQuery,
    TimeRange,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import (
    TestBulkInserter,
    patch_batched_caller,
    patch_grpc_server,
)

# ---------------------------------------------------------------------------
# Seed-script import (the script is not a package module)
# ---------------------------------------------------------------------------

_SEED_PATH = Path(__file__).parents[3] / "scripts" / "span_analytics_seeds" / "seed_incident.py"
_spec = importlib.util.spec_from_file_location("seed_incident", _SEED_PATH)
assert _spec is not None and _spec.loader is not None
seed_incident: Any = importlib.util.module_from_spec(_spec)
# Dataclass field resolution looks the module up by name at class-creation
# time, so it must be registered before execution.
sys.modules["seed_incident"] = seed_incident
_spec.loader.exec_module(seed_incident)

_COPILOT_PATH = (
    Path(__file__).parents[3] / "scripts" / "span_analytics_seeds" / "seed_support_copilot.py"
)
_copilot_spec = importlib.util.spec_from_file_location("seed_support_copilot", _COPILOT_PATH)
assert _copilot_spec is not None and _copilot_spec.loader is not None
seed_support_copilot: Any = importlib.util.module_from_spec(_copilot_spec)
sys.modules["seed_support_copilot"] = seed_support_copilot
_copilot_spec.loader.exec_module(seed_support_copilot)

FIXED_NOW = datetime(2026, 7, 23, 12, 0, 0, tzinfo=timezone.utc)
CUT = FIXED_NOW - timedelta(hours=seed_incident.RELEASE_CUT_HOURS_AGO)
FULL_WINDOW = {
    "start": (FIXED_NOW - timedelta(hours=49)).isoformat(),
    "end": (FIXED_NOW + timedelta(hours=1)).isoformat(),
}
POST_CUT_WINDOW = {"start": CUT.isoformat(), "end": (FIXED_NOW + timedelta(hours=1)).isoformat()}
#: The copilot workload backdates over the trailing 24 hours; turn chains
#: can run slightly past the anchor.
COPILOT_WINDOW = {
    "start": (FIXED_NOW - timedelta(hours=26)).isoformat(),
    "end": (FIXED_NOW + timedelta(hours=2)).isoformat(),
}

ANALYTICS_TOOLS = ("describeSpans", "aggregateSpans", "querySpanRows", "getSpan", "getTrace")


@pytest.fixture(scope="module")
def incident() -> Any:
    return seed_incident.build_incident(FIXED_NOW, seed_incident.DEFAULT_SEED)


@pytest.fixture
async def seeded(db: DbSessionFactory, incident: Any) -> Any:
    async with db() as session:
        await seed_incident.insert_incident(session, incident)
    return incident


@pytest.fixture(scope="module")
def copilot_workload() -> Any:
    return seed_support_copilot.build_workload(FIXED_NOW, seed_support_copilot.DEFAULT_SEED)


@pytest.fixture
async def seeded_copilot(db: DbSessionFactory, copilot_workload: Any) -> Any:
    async with db() as session:
        await seed_support_copilot.insert_workload(session, copilot_workload)
    return copilot_workload


@pytest.fixture
async def mcp_app(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[Any]:
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
    monkeypatch.setattr("phoenix.server.mcp_server.get_env_mcp_code_mode", lambda: False)
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        await stack.enter_async_context(LifespanManager(app))
        yield app


def _mcp_client(app: Any) -> Any:
    from fastmcp import Client
    from fastmcp.client.transports import StreamableHttpTransport

    def _factory(
        headers: dict[str, str] | None = None,
        timeout: httpx.Timeout | None = None,
        auth: httpx.Auth | None = None,
        follow_redirects: bool = True,
    ) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
            headers=headers,
            follow_redirects=follow_redirects,
        )

    return Client(
        StreamableHttpTransport(
            url=f"http://testserver{MCP_MOUNT_PATH}",
            httpx_client_factory=_factory,
        )
    )


def _payload(result: Any) -> dict[str, Any]:
    payload = json.loads(result.content[0].text)
    assert isinstance(payload, dict)
    return payload


async def _enable_spans(client: Any) -> None:
    await client.call_tool("enable_tool_group", {"group": "spans"})


def _percentile_cont(values: Sequence[float], q: float) -> float:
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * q
    lower = math.floor(position)
    upper = math.ceil(position)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


class TestRegistry:
    @pytest.mark.parametrize("sql_dialect", [sqlite.dialect(), postgresql.dialect()])  # type: ignore[no-untyped-call]
    def test_every_authored_field_compiles(self, sql_dialect: Any) -> None:
        supported = SupportedSQLDialect(sql_dialect.name)
        for field in registry.AUTHORED_FIELDS:
            compiled = str(sqlalchemy.select(field.expr(supported)).compile(dialect=sql_dialect))
            assert compiled  # compilation succeeded

    @pytest.mark.parametrize("sql_dialect", [sqlite.dialect(), postgresql.dialect()])  # type: ignore[no-untyped-call]
    def test_observed_field_and_time_bucket_compile(self, sql_dialect: Any) -> None:
        supported = SupportedSQLDialect(sql_dialect.name)
        observed = registry.ObservedField(
            id='metadata["build.version"]', keys=("metadata", "build.version")
        )
        assert str(sqlalchemy.select(observed.expr(supported)).compile(dialect=sql_dialect))
        assert str(
            sqlalchemy.select(registry.time_bucket_expr(supported)).compile(dialect=sql_dialect)
        )

    def test_canonical_spelling_round_trips_through_parse(self) -> None:
        for keys in [
            ("llm", "model_name"),
            ("metadata", "release"),
            ("metadata", "build.version"),
            ("custom_flag",),
            ("a", "b.c", "d"),
        ]:
            spelling = registry.canonical_attribute_spelling(keys)
            assert registry.parse_attribute_path(spelling) == keys, spelling

    def test_parse_rejects_non_paths(self) -> None:
        for bad in ["evals['x'].score", "f(x)", "a + b", "attributes[0]", "not a path"]:
            keys = registry.parse_attribute_path(bad)
            assert keys is None or keys[0] in ("evals", "annotations"), bad

    def test_guarded_cast_diverges_from_plain_cast_in_sql(self) -> None:
        for sql_dialect, guard in [
            (postgresql.dialect(), "jsonb_typeof"),  # type: ignore[no-untyped-call]
            (sqlite.dialect(), "json_type"),
        ]:
            supported = SupportedSQLDialect(sql_dialect.name)
            field = registry.AUTHORED_BY_ID["llm.token_count.total"]
            compiled = str(sqlalchemy.select(field.expr(supported)).compile(dialect=sql_dialect))
            assert guard in compiled
            assert "CASE" in compiled


async def test_percentiles_execute_with_known_values(db: DbSessionFactory, seeded: Any) -> None:
    """Percentiles run for real on both engines and agree with linear
    (``percentile_cont``) interpolation computed independently in Python."""
    query = AggregateQuery(
        project=seed_incident.MAIN_PROJECT_NAME,
        time_range=TimeRange(**FULL_WINDOW),
        filter="span_kind == 'LLM'",
        calculations=[
            Calculation(name="p50", fn="p50", field="latency_ms"),
            Calculation(name="p90", fn="p90", field="latency_ms"),
            Calculation(name="p95", fn="p95", field="latency_ms"),
            Calculation(name="p99", fn="p99", field="latency_ms"),
        ],
    )
    async with db.read() as session:
        rowid = await compiler.resolve_project_rowid(session, seed_incident.MAIN_PROJECT_NAME)
        assert rowid is not None
        plan = compiler.compile_aggregate(query, rowid, db.dialect)
        row = (await session.execute(plan.overall_stmt)).one()
    latencies = [span.latency_ms for span in seeded.main.spans if span.span_kind == "LLM"]
    for value, q in zip(row, (0.5, 0.9, 0.95, 0.99)):
        expected = _percentile_cont(latencies, q)
        assert float(value) == pytest.approx(expected, abs=0.05), q


async def test_guarded_cast_mixed_type_row(db: DbSessionFactory, seeded: Any) -> None:
    """A string-valued token count must read as NULL on both engines: the
    aggregate succeeds, excludes the malformed value, and the non-null count
    exposes it as missing."""
    numeric_tokens = [
        span.attributes["llm"]["token_count"]["total"]
        for span in seeded.main.spans
        if span.span_kind == "LLM"
        and isinstance(span.attributes["llm"]["token_count"]["total"], int)
    ]
    llm_span_count = sum(1 for s in seeded.main.spans if s.span_kind == "LLM")
    assert llm_span_count == len(numeric_tokens) + 1  # exactly one string-valued row

    query = AggregateQuery(
        project=seed_incident.MAIN_PROJECT_NAME,
        time_range=TimeRange(**FULL_WINDOW),
        filter="span_kind == 'LLM'",
        calculations=[
            Calculation(name="total", fn="sum", field="llm.token_count.total"),
            Calculation(name="with_tokens", fn="count", field="llm.token_count.total"),
            Calculation(name="all_rows", fn="count"),
            Calculation(name="avg_tokens", fn="avg", field="llm.token_count.total"),
        ],
    )
    async with db.read() as session:
        rowid = await compiler.resolve_project_rowid(session, seed_incident.MAIN_PROJECT_NAME)
        assert rowid is not None
        plan = compiler.compile_aggregate(query, rowid, db.dialect)
        total, with_tokens, all_rows, avg_tokens = (await session.execute(plan.overall_stmt)).one()
    assert float(total) == sum(numeric_tokens)
    assert with_tokens == len(numeric_tokens)
    assert all_rows == llm_span_count
    assert float(avg_tokens) == pytest.approx(sum(numeric_tokens) / len(numeric_tokens))


# ---------------------------------------------------------------------------
# Compiler validation (no database required)
# ---------------------------------------------------------------------------


class TestCompilerValidation:
    def test_temporal_filter_rejected_pointing_at_time_range(self) -> None:
        with pytest.raises(QueryError) as info:
            compiler.validated_filter("start_time > '2026-01-01'")
        assert info.value.code == "temporal_filter"
        assert "time_range" in info.value.message

    def test_annotation_predicate_compiles_to_exists(self) -> None:
        """A top-level annotation comparison becomes an EXISTS predicate —
        never a join, so it cannot multiply span rows under aggregation."""
        compiled = compiler.validated_filter("evals['correctness'].score < 0.5")
        assert compiled is not None and compiled.uses_annotations
        (predicate,) = compiled.annotation_predicates
        assert (predicate.name, predicate.attribute, predicate.op, predicate.value) == (
            "correctness",
            "score",
            "<",
            0.5,
        )
        combined = compiler.validated_filter(
            "status_code == 'ERROR' and evals['correctness'].score < 0.5"
        )
        assert combined is not None
        assert combined.uses_annotations and combined.span_filter is not None
        stmt = combined(compiler.scoped_base([sqlalchemy.func.count()], 1, None))
        compiled_sql = str(stmt)
        assert "EXISTS" in compiled_sql
        assert "JOIN span_annotations" not in compiled_sql

    def test_label_and_reversed_annotation_forms(self) -> None:
        label_form = compiler.validated_filter("evals['correctness'].label == 'incorrect'")
        assert label_form is not None
        (predicate,) = label_form.annotation_predicates
        assert (predicate.attribute, predicate.op, predicate.value) == (
            "label",
            "==",
            "incorrect",
        )
        reversed_form = compiler.validated_filter("0.5 > evals['correctness'].score")
        assert reversed_form is not None
        (mirrored,) = reversed_form.annotation_predicates
        assert (mirrored.op, mirrored.value) == ("<", 0.5)

    def test_nested_annotation_reference_rejected_with_route(self) -> None:
        with pytest.raises(QueryError) as info:
            compiler.validated_filter("status_code == 'ERROR' or evals['correctness'].score < 0.5")
        assert info.value.code == "unsupported_filter_reference"
        assert "top-level" in info.value.message
        assert "listSpanAnnotationsBySpanIds" in info.value.message

    def test_is_error_filter_rejected_with_route(self) -> None:
        with pytest.raises(QueryError) as info:
            compiler.validated_filter("is_error == 1")
        assert info.value.code == "field_not_filterable"
        assert "status_code == 'ERROR'" in info.value.suggestions

    def test_unknown_field_gets_nearest_name_suggestion(self) -> None:
        with pytest.raises(QueryError) as info:
            compiler.resolve_field("latencyms")
        assert info.value.code == "unknown_field"
        assert "latency_ms" in info.value.suggestions
        assert "Did you mean" in info.value.message

    def test_reserved_column_names_do_not_fall_through_to_attributes(self) -> None:
        with pytest.raises(QueryError) as info:
            compiler.resolve_field("cumulative_llm_token_count_total")
        assert info.value.code == "field_not_exposed"

    def test_scoped_base_carries_no_ordering(self) -> None:
        stmt = compiler.scoped_base([sqlalchemy.func.count()], project_rowid=1, time_range=None)
        assert "ORDER BY" not in str(stmt)

    def test_aggregate_statement_has_no_ungrouped_order_by(self) -> None:
        query = AggregateQuery(
            project="p",
            time_range=TimeRange(**FULL_WINDOW),
            calculations=[Calculation(name="n", fn="count")],
        )
        plan = compiler.compile_aggregate(query, 1, SupportedSQLDialect.SQLITE)
        assert "ORDER BY" not in str(plan.stmt)
        assert "ORDER BY" not in str(plan.overall_stmt)

    def test_project_predicate_present_in_every_statement(self) -> None:
        query = RowQuery(project="p", time_range=TimeRange(**FULL_WINDOW))
        plan = compiler.compile_rows(query, 123, SupportedSQLDialect.SQLITE)
        assert plan.stmt is not None
        assert "project_rowid" in str(plan.stmt)

    def test_order_referencing_undeclared_calculation(self) -> None:
        query = AggregateQuery(
            project="p",
            time_range=TimeRange(**FULL_WINDOW),
            calculations=[Calculation(name="calls", fn="count")],
            breakdowns=["name"],
            order=[compiler.AggregateOrderEntry(calculation="total_tokens")],
        )
        with pytest.raises(QueryError) as info:
            compiler.compile_aggregate(query, 1, SupportedSQLDialect.SQLITE)
        assert info.value.code == "invalid_order"
        assert "order[0].calculation" == info.value.path

    def test_non_groupable_breakdown_rejected_with_alternatives(self) -> None:
        query = AggregateQuery(
            project="p",
            time_range=TimeRange(**FULL_WINDOW),
            calculations=[Calculation(name="calls", fn="count")],
            breakdowns=["latency_ms"],
        )
        with pytest.raises(QueryError) as info:
            compiler.compile_aggregate(query, 1, SupportedSQLDialect.SQLITE)
        assert info.value.code == "field_not_groupable"
        assert info.value.suggestions  # alternatives offered

    def test_non_aggregatable_field_rejected(self) -> None:
        query = AggregateQuery(
            project="p",
            time_range=TimeRange(**FULL_WINDOW),
            calculations=[Calculation(name="s", fn="sum", field="name")],
        )
        with pytest.raises(QueryError) as info:
            compiler.compile_aggregate(query, 1, SupportedSQLDialect.SQLITE)
        assert info.value.code == "field_not_aggregatable"

    def test_observed_field_not_value_aggregatable(self) -> None:
        """Value aggregation on an observed field is rejected with the
        presence/value distinction named; presence aggregations compile."""
        query = AggregateQuery(
            project="p",
            time_range=TimeRange(**FULL_WINDOW),
            calculations=[Calculation(name="s", fn="sum", field="metadata.release")],
        )
        with pytest.raises(QueryError) as info:
            compiler.compile_aggregate(query, 1, SupportedSQLDialect.SQLITE)
        assert info.value.code == "field_not_aggregatable"
        assert "presence aggregations (count, count_distinct)" in info.value.message
        assert "value aggregations" in info.value.message

        presence = AggregateQuery(
            project="p",
            time_range=TimeRange(**FULL_WINDOW),
            calculations=[
                Calculation(name="tenants", fn="count_distinct", field="metadata.tenant"),
                Calculation(name="with_tenant", fn="count", field="metadata.tenant"),
            ],
        )
        plan = compiler.compile_aggregate(presence, 1, SupportedSQLDialect.SQLITE)
        assert [c.name for c in plan.calculations] == ["tenants", "with_tenant"]

    def test_limit_clamped_not_rejected(self) -> None:
        query = RowQuery(project="p", time_range=TimeRange(**FULL_WINDOW), limit=100_000)
        plan = compiler.compile_rows(query, 1, SupportedSQLDialect.SQLITE)
        assert plan.applied_limit == compiler.ROW_LIMIT_MAX

    def test_invalid_time_range_is_structured(self) -> None:
        with pytest.raises(QueryError) as info:
            RowQuery(
                project="p",
                time_range=TimeRange(start=FIXED_NOW, end=FIXED_NOW - timedelta(hours=1)),
            )
        assert info.value.code == "invalid_time_range"

    def test_naive_timestamps_normalized_to_utc(self) -> None:
        query = RowQuery(
            project="p",
            time_range=TimeRange(
                start=datetime(2026, 7, 22, 0, 0), end=datetime(2026, 7, 23, 0, 0)
            ),
        )
        assert query.time_range is not None
        assert query.time_range.start.tzinfo == timezone.utc
        assert query.time_range.end.tzinfo == timezone.utc

    def test_row_window_defaults_to_last_24_hours(self) -> None:
        query = RowQuery(project="p")
        plan = compiler.compile_rows(query, 1, SupportedSQLDialect.SQLITE, now=FIXED_NOW)
        assert plan.time_range_defaulted is True
        assert plan.time_range.end == FIXED_NOW
        assert plan.time_range.start == FIXED_NOW - timedelta(
            hours=compiler.ROW_WINDOW_DEFAULT_HOURS
        )

    def test_row_order_must_reference_selected_field(self) -> None:
        query = RowQuery(
            project="p",
            time_range=TimeRange(**FULL_WINDOW),
            fields=["span_id", "name"],
            order=[compiler.RowOrderField(field="latency_ms")],
        )
        with pytest.raises(QueryError) as info:
            compiler.compile_rows(query, 1, SupportedSQLDialect.SQLITE)
        assert info.value.code == "invalid_order"

    def test_span_id_identity_is_implicit(self) -> None:
        query = RowQuery(
            project="p", time_range=TimeRange(**FULL_WINDOW), fields=["name", "latency_ms"]
        )
        plan = compiler.compile_rows(query, 1, SupportedSQLDialect.SQLITE)
        assert plan.columns[0].id == "span_id"

    def test_duplicate_calculation_names_rejected(self) -> None:
        with pytest.raises(QueryError) as info:
            AggregateQuery(
                project="p",
                time_range=TimeRange(**FULL_WINDOW),
                calculations=[
                    Calculation(name="x", fn="count"),
                    Calculation(name="x", fn="count"),
                ],
            )
        assert info.value.code == "invalid_request"


@pytest.mark.postgres_only
async def test_statement_timeout_applied_on_postgres(db: DbSessionFactory, seeded: Any) -> None:
    async with db.read() as session:
        applied = await compiler.apply_statement_timeout(session, db.dialect)
        assert applied == compiler.STATEMENT_TIMEOUT_MS
        shown = (await session.execute(text("SHOW statement_timeout"))).scalar()
        assert shown == "30s"


# ---------------------------------------------------------------------------
# Seed script determinism
# ---------------------------------------------------------------------------


class TestSeedScript:
    def test_two_builds_render_identical_ground_truth(self) -> None:
        first = seed_incident.build_incident(FIXED_NOW, seed_incident.DEFAULT_SEED)
        second = seed_incident.build_incident(FIXED_NOW, seed_incident.DEFAULT_SEED)
        assert seed_incident.render_ground_truth(first) == seed_incident.render_ground_truth(second)

    def test_fixture_contains_the_special_rows(self, incident: Any) -> None:
        llm_spans = [s for s in incident.main.spans if s.span_kind == "LLM"]
        string_tokens = [
            s for s in llm_spans if isinstance(s.attributes["llm"]["token_count"]["total"], str)
        ]
        assert len(string_tokens) == 1
        large_inputs = [s for s in llm_spans if len(s.attributes["input"]["value"]) >= 19_000]
        assert len(large_inputs) == 1
        assert large_inputs[0].status_code == "ERROR"
        orphans = [s for s in incident.main.spans if s.name == seed_incident.ORPHAN_SPAN_NAME]
        assert len(orphans) == 5
        dotted = incident.main.spans[0].attributes["metadata"]
        assert "build.version" in dotted

    def test_fixture_contains_eval_annotations(self, incident: Any) -> None:
        annotations = incident.main.annotations
        assert len(annotations) >= 24
        assert {a.annotator_kind for a in annotations} == {"LLM", "HUMAN"}
        assert {a.name for a in annotations} == {"correctness"}
        # The same span can carry rows from both annotators under one name.
        by_span = Counter(a.span_id for a in annotations)
        assert max(by_span.values()) == 2


# ---------------------------------------------------------------------------
# Tools end-to-end over MCP
# ---------------------------------------------------------------------------


async def test_tools_gate_with_spans_group_and_advertise_contracts(mcp_app: Any) -> None:
    async with _mcp_client(mcp_app) as client:
        visible = {t.name for t in await client.list_tools()}
        for name in ANALYTICS_TOOLS:
            assert name not in visible, f"{name} must gate with the spans group"

        await _enable_spans(client)
        tools = {t.name: t for t in await client.list_tools()}
        for name in ANALYTICS_TOOLS:
            assert name in tools, name
            tool = tools[name]
            assert tool.annotations is not None
            assert tool.annotations.readOnlyHint is True
            assert tool.annotations.destructiveHint is False
            assert tool.outputSchema is not None
            arms = tool.outputSchema["oneOf"]
            statuses = [arm["properties"]["status"].get("const") for arm in arms]
            assert "ok" in statuses and "error" in statuses

        # The filter documentation teaches exactly what the surface accepts,
        # annotation predicates included: the two supported comparison forms,
        # the top-level-AND-only placement, and the any-annotator semantics
        # with their disclosure field.
        for name in ("aggregateSpans", "querySpanRows"):
            filter_description = tools[name].inputSchema["properties"]["filter"]["description"]
            assert "evals['<name>'].score" in filter_description
            assert "evals['<name>'].label" in filter_description
            assert "top-level AND" in filter_description
            assert "any-annotator" in filter_description
            assert "annotation_semantics" in filter_description
            assert "rejected" in filter_description
            assert "llm.model_name" in filter_description
            assert "time_range" in filter_description


async def test_describe_spans_effective_catalog(mcp_app: Any, seeded: Any) -> None:
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool("describeSpans", {"project": seed_incident.MAIN_PROJECT_NAME})
        )
    assert result["status"] == "ok"
    entries = {e["field"]: e for e in result["fields"]}

    authored = entries["llm.model_name"]
    assert authored["source"] == "openinference_convention"
    assert authored["type"] == "string"
    assert "breakdown" in authored["capabilities"]
    assert authored.get("observed_count", 0) > 0  # enriched with sampled stats

    assert entries["span_id"]["source"] == "column"
    assert entries["status_code"]["source"] == "column"

    aggregate_only = entries["is_error"]
    assert aggregate_only["source"] == "computed"
    assert "aggregate" in aggregate_only["capabilities"]
    assert "filter" not in aggregate_only["capabilities"]

    release = entries["metadata.release"]
    assert release["source"] == "observed_attribute"
    assert release["observed_types"] == ["string"]
    # Observed fields carry the presence-aggregation capability (count,
    # count_distinct never compute on values) but not value aggregation.
    assert "aggregate" not in release["capabilities"]
    assert "count" in release["capabilities"]
    # The discovery sample is drawn across the project's whole id range, so
    # dimension values that stopped occurring (the pre-cut release) are
    # visible alongside current ones — a recency-only sample would hide
    # exactly the values an investigation of a change needs.
    top_values = {v["value"] for v in release["top_values"]}
    assert top_values == {"v41", "v42"}

    tenant = entries["metadata.tenant"]
    assert tenant["source"] == "observed_attribute"
    assert {v["value"] for v in tenant["top_values"]} <= set(seed_incident.TENANTS)

    # cost.total: a declared reduction, select-and-aggregate only (plus the
    # universal presence-aggregation capability).
    cost_entry = entries["cost.total"]
    assert cost_entry["unit"] == "USD"
    assert set(cost_entry["capabilities"]) == {"select", "aggregate", "count"}

    # The message fields appear as authored convention entries in
    # list-index subscript spelling, select-only, and the message lists
    # themselves produce no observed entries (list-valued paths are
    # omitted from observed discovery).
    first_content = entries["llm.input_messages[0].message.content"]
    assert first_content["source"] == "openinference_convention"
    assert first_content["capabilities"] == ["select", "count"]
    assert not any(
        e["source"] == "observed_attribute" and "input_messages" in e["field"]
        for e in result["fields"]
    )

    # A key containing a literal dot comes back in subscript spelling.
    dotted = entries['metadata["build.version"]']
    assert dotted["source"] == "observed_attribute"

    sampling = result["sampling"]
    assert sampling["strategy"] == "id_spread_500"
    assert 0 < sampling["sample_count"] <= 500
    assert "not exhaustive" in sampling["note"]


async def test_discovery_round_trip(mcp_app: Any, seeded: Any) -> None:
    """Every identifier discovery returns works verbatim in fields, filter,
    and breakdowns — authored, observed, and the literal-dotted key."""
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        described = _payload(
            await client.call_tool("describeSpans", {"project": seed_incident.MAIN_PROJECT_NAME})
        )
        assert described["status"] == "ok"
        # The response-level sampling epistemics must always be present:
        # strategy, sample size, and the note (an unobserved path or value
        # means not-seen-in-sample, never nonexistent).
        sampling = described["sampling"]
        assert sampling["strategy"] == "id_spread_500"
        assert sampling["sample_count"] > 0
        assert "never nonexistent" in sampling["note"]
        spellings = [e["field"] for e in described["fields"]]
        assert 'metadata["build.version"]' in spellings

        for entry in described["fields"]:
            field_id = entry["field"]
            capabilities = entry["capabilities"]
            if "select" in capabilities:
                rows = _payload(
                    await client.call_tool(
                        "querySpanRows",
                        {
                            "project": seed_incident.MAIN_PROJECT_NAME,
                            "time_range": FULL_WINDOW,
                            "fields": [field_id],
                            "limit": 1,
                        },
                    )
                )
                assert rows["status"] == "ok", (field_id, rows)
            if "filter" in capabilities:
                filtered = _payload(
                    await client.call_tool(
                        "querySpanRows",
                        {
                            "project": seed_incident.MAIN_PROJECT_NAME,
                            "time_range": FULL_WINDOW,
                            "filter": f"{field_id} is not None",
                            "limit": 1,
                        },
                    )
                )
                assert filtered["status"] == "ok", (field_id, filtered)
            if "breakdown" in capabilities:
                grouped = _payload(
                    await client.call_tool(
                        "aggregateSpans",
                        {
                            "project": seed_incident.MAIN_PROJECT_NAME,
                            "time_range": FULL_WINDOW,
                            "calculations": [{"name": "calls", "fn": "count"}],
                            "breakdowns": [field_id],
                        },
                    )
                )
                assert grouped["status"] == "ok", (field_id, grouped)
            if "count" in capabilities:
                counted = _payload(
                    await client.call_tool(
                        "aggregateSpans",
                        {
                            "project": seed_incident.MAIN_PROJECT_NAME,
                            "time_range": FULL_WINDOW,
                            "calculations": [
                                {
                                    "name": "distinct_values",
                                    "fn": "count_distinct",
                                    "field": field_id,
                                }
                            ],
                        },
                    )
                )
                assert counted["status"] == "ok", (field_id, counted)


async def test_aggregate_error_rate_by_release_matches_ground_truth(
    mcp_app: Any, seeded: Any
) -> None:
    expected_counts: Counter[Any] = Counter()
    expected_errors: Counter[Any] = Counter()
    for span in seeded.main.spans:
        release = span.attributes.get("metadata", {}).get("release")
        expected_counts[release] += 1
        if span.status_code == "ERROR":
            expected_errors[release] += 1

    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [
                        {"name": "error_count", "fn": "sum", "field": "is_error"},
                        {"name": "error_rate", "fn": "avg", "field": "is_error"},
                        {"name": "calls", "fn": "count"},
                    ],
                    "breakdowns": ["metadata.release"],
                    "order": [{"calculation": "error_count", "direction": "desc"}],
                },
            )
        )
    assert result["status"] == "ok"
    assert result["share_basis"] == "error_count"
    assert result["groups_total"] == len(expected_counts)  # v41, v42, and the null bucket
    by_release = {row["metadata.release"]: row for row in result["rows"]}
    assert set(by_release) == set(expected_counts)
    total_errors = sum(expected_errors.values())
    for release, count in expected_counts.items():
        row = by_release[release]
        assert row["calls"] == count
        assert row["error_count"] == expected_errors[release]
        assert row["error_rate"] == pytest.approx(expected_errors[release] / count)
        if total_errors:
            assert row["share"] == pytest.approx(expected_errors[release] / total_errors)
    overall = result["overall"]
    assert overall["calls"] == sum(expected_counts.values())
    assert overall["error_count"] == total_errors


async def test_aggregate_hourly_series_shows_the_jump(mcp_app: Any, seeded: Any) -> None:
    expected_counts: Counter[str] = Counter()
    expected_errors: Counter[str] = Counter()
    for span in seeded.main.spans:
        bucket = span.start_time.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00:00+00:00")
        expected_counts[bucket] += 1
        if span.status_code == "ERROR":
            expected_errors[bucket] += 1

    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [
                        {"name": "errors", "fn": "sum", "field": "is_error"},
                        {"name": "error_rate", "fn": "avg", "field": "is_error"},
                    ],
                    "breakdowns": [{"bucket": "hour"}],
                    "limit": 200,
                },
            )
        )
    assert result["status"] == "ok"
    series = {row["time_bucket"]: row for row in result["rows"]}
    assert set(series) == set(expected_counts)
    for bucket, row in series.items():
        assert row["errors"] == expected_errors[bucket], bucket
    # The regression is visible in the series: the post-cut hours run far
    # hotter than the pre-cut hours.
    pre = [r["error_rate"] for b, r in series.items() if b < CUT.strftime("%Y-%m-%dT%H")]
    post = [r["error_rate"] for b, r in series.items() if b > CUT.strftime("%Y-%m-%dT%H:59")]
    assert sum(post) / len(post) > 3 * (sum(pre) / len(pre))


async def test_query_rows_slowest_failures_with_clipping(mcp_app: Any, seeded: Any) -> None:
    failed_llm = [s for s in seeded.main.spans if s.span_kind == "LLM" and s.status_code == "ERROR"]
    expected = [s.span_id for s in sorted(failed_llm, key=lambda s: (-s.latency_ms, s.span_id))[:5]]
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["name", "latency_ms", "input.value", "metadata.tenant"],
                    "filter": "span_kind == 'LLM' and status_code == 'ERROR'",
                    "order": [{"field": "latency_ms", "direction": "desc"}],
                    "limit": 5,
                },
            )
        )
    assert result["status"] == "ok"
    assert [row["span_id"] for row in result["rows"]] == expected
    # span_id is present although it was not selected: row identity is
    # implicit, so the clipping recovery path always has an anchor.
    worst = result["rows"][0]
    assert len(worst["input.value"]) < 20_000  # clipped to a preview
    assert any(
        marker["row"] == expected[0] and marker["field"] == "input.value"
        for marker in result["clipped"]
    )
    assert "getSpan" in result["note"]


async def test_get_span_recovers_the_clipped_value_in_full(mcp_app: Any, seeded: Any) -> None:
    large = next(
        s
        for s in seeded.main.spans
        if s.span_kind == "LLM" and len(s.attributes["input"]["value"]) >= 19_000
    )
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "getSpan",
                {"project": seed_incident.MAIN_PROJECT_NAME, "span_id": large.span_id},
            )
        )
    assert result["status"] == "ok"
    span = result["span"]
    assert span["attributes"]["input"]["value"] == large.attributes["input"]["value"]
    assert span["status"]["code"] == "ERROR"
    (event,) = span["events"]
    assert event["attributes"]["exception.type"]
    assert result["ui_url"].endswith(f"/redirects/spans/{large.span_id}")
    # The link is a UI route: the MCP mount the request arrived through
    # must never leak into it.
    assert "/mcp" not in result["ui_url"]
    assert result["clipped"] == []  # within the default budget


async def test_cost_field_top10_matches_answer_key_and_nulls(mcp_app: Any, seeded: Any) -> None:
    """cost.total is a declared sum reduction over the cost table: the ten
    priciest spans match the seed's answer key on both backends (NULL cost
    rows sort last by declared placement), and a span without cost records
    reads NULL — with no observed-path note, because the NULL is authored
    meaning, not a misspelling."""
    expected_top10 = [
        c.span_id for c in sorted(seeded.main.costs, key=lambda c: (-c.total_cost, c.span_id))[:10]
    ]
    expected_costs = {c.span_id: c.total_cost for c in seeded.main.costs}
    mixed = next(
        s
        for s in seeded.main.spans
        if s.span_kind == "LLM" and isinstance(s.attributes["llm"]["token_count"]["total"], str)
    )
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["cost.total", "llm.model_name"],
                    "filter": "span_kind == 'LLM'",
                    "order": [{"field": "cost.total", "direction": "desc"}],
                    "limit": 10,
                },
            )
        )
        assert result["status"] == "ok"
        assert [row["span_id"] for row in result["rows"]] == expected_top10
        for row in result["rows"]:
            assert row["cost.total"] == pytest.approx(expected_costs[row["span_id"]])

        costless = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["cost.total"],
                    "filter": f"span_id == '{mixed.span_id}'",
                },
            )
        )
        (costless_row,) = costless["rows"]
        assert costless_row["cost.total"] is None
        assert "field_notes" not in costless

        # cost.total is select-and-aggregate only: a filter reference is
        # rejected instead of silently reading a nonexistent attribute.
        filtered = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "filter": "cost.total > 0.01",
                },
            )
        )
        assert filtered["status"] == "error"
        assert filtered["code"] == "field_not_filterable"


async def test_cost_aggregation_matches_answer_key(mcp_app: Any, seeded: Any) -> None:
    costs = seeded.main.costs
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [
                        {"name": "total_cost", "fn": "sum", "field": "cost.total"},
                        {"name": "with_cost", "fn": "count", "field": "cost.total"},
                        {"name": "spans", "fn": "count"},
                    ],
                },
            )
        )
    assert result["status"] == "ok"
    overall = result["overall"]
    assert overall["with_cost"] == len(costs)
    assert overall["spans"] == len(seeded.main.spans)
    assert overall["total_cost"] == pytest.approx(sum(c.total_cost for c in costs), rel=1e-9)
    # sum is additive, so cost carries share-of-total semantics.
    assert result["share_basis"] == "total_cost"
    (row,) = result["rows"]
    assert row["share"] == pytest.approx(1.0)


async def test_input_turns_by_user_matches_ground_truth(mcp_app: Any, seeded_copilot: Any) -> None:
    """avg/max conversation depth (input.turns) grouped by user matches the
    seed's independently computed ground truth on both backends; prompt
    token sums agree as well."""
    expected_depths: dict[str, list[int]] = {}
    expected_prompt_tokens = 0
    for span in seeded_copilot.spans:
        if span.span_kind != "LLM":
            continue
        user = span.attributes["user"]["id"]
        expected_depths.setdefault(user, []).append(len(span.attributes["llm"]["input_messages"]))
        expected_prompt_tokens += span.attributes["llm"]["token_count"]["prompt"]
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_support_copilot.PROJECT_NAME,
                    "time_range": COPILOT_WINDOW,
                    "calculations": [
                        {"name": "avg_depth", "fn": "avg", "field": "input.turns"},
                        {"name": "max_depth", "fn": "max", "field": "input.turns"},
                        {"name": "llm_calls", "fn": "count", "field": "input.turns"},
                        {
                            "name": "prompt_tokens",
                            "fn": "sum",
                            "field": "llm.token_count.prompt",
                        },
                    ],
                    "breakdowns": ["user.id"],
                    "limit": 200,
                },
            )
        )
    assert result["status"] == "ok"
    by_user = {row["user.id"]: row for row in result["rows"]}
    assert set(by_user) == set(expected_depths)
    for user, depths in expected_depths.items():
        row = by_user[user]
        assert row["max_depth"] == max(depths), user
        assert row["llm_calls"] == len(depths), user
        assert row["avg_depth"] == pytest.approx(sum(depths) / len(depths)), user
    assert result["overall"]["prompt_tokens"] == expected_prompt_tokens


async def test_avg_cost_by_conversation_depth(mcp_app: Any, seeded_copilot: Any) -> None:
    """The context-depth economics query: input.turns is a groupable
    bounded small-integer dimension, so avg cost by conversation depth is
    one aggregate — and it matches the workload-derived oracle."""
    cost_by_span = {c.span_id: c.total_cost for c in seeded_copilot.costs}
    expected: dict[int, list[float]] = {}
    for span in seeded_copilot.spans:
        if span.span_kind == "LLM" and span.span_id in cost_by_span:
            depth = len(span.attributes["llm"]["input_messages"])
            expected.setdefault(depth, []).append(cost_by_span[span.span_id])
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_support_copilot.PROJECT_NAME,
                    "time_range": COPILOT_WINDOW,
                    "calculations": [
                        {"name": "avg_cost", "fn": "avg", "field": "cost.total"},
                        {"name": "calls_with_cost", "fn": "count", "field": "cost.total"},
                    ],
                    "breakdowns": ["input.turns"],
                    "order": [{"field": "input.turns", "direction": "asc"}],
                },
            )
        )
    assert result["status"] == "ok"
    with_depth = [row for row in result["rows"] if row["input.turns"] is not None]
    assert [row["input.turns"] for row in with_depth] == sorted(expected)
    for row in with_depth:
        costs = expected[row["input.turns"]]
        assert row["calls_with_cost"] == len(costs)
        assert row["avg_cost"] == pytest.approx(sum(costs) / len(costs))
    # The economics are visible: deeper conversations cost more per call.
    averages = [row["avg_cost"] for row in with_depth]
    assert averages[-1] > averages[0]


async def test_input_turns_array_guard_and_input_chars(mcp_app: Any, seeded: Any) -> None:
    """The array-guarded depth field reads NULL — not an error, not zero —
    for spans without a message list, and input.chars matches the known
    string length."""
    normal = seeded.main.spans[1]  # LLM span with two input messages
    chain = seeded.main.spans[0]  # CHAIN root: no llm.input_messages at all
    single = next(
        s
        for s in seeded.main.spans
        if s.span_kind == "LLM" and isinstance(s.attributes["llm"]["token_count"]["total"], str)
    )
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)

        async def fetch(span_id: str) -> dict[str, Any]:
            result = _payload(
                await client.call_tool(
                    "querySpanRows",
                    {
                        "project": seed_incident.MAIN_PROJECT_NAME,
                        "time_range": FULL_WINDOW,
                        "fields": ["input.turns", "input.chars"],
                        "filter": f"span_id == '{span_id}'",
                    },
                )
            )
            assert result["status"] == "ok", result
            (row,) = result["rows"]
            return dict(row)

        assert (await fetch(normal.span_id))["input.turns"] == 2
        assert (await fetch(single.span_id))["input.turns"] == 1
        chain_row = await fetch(chain.span_id)
        assert chain_row["input.turns"] is None

        normal_row = await fetch(normal.span_id)
        assert normal_row["input.chars"] == len(normal.attributes["input"]["value"])

        # Computed dotted fields are rejected in filters instead of silently
        # reading nonexistent attributes.
        filtered = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "filter": "input.turns > 2",
                },
            )
        )
        assert filtered["status"] == "error"
        assert filtered["code"] == "field_not_filterable"


def test_public_url_resolution(monkeypatch: pytest.MonkeyPatch) -> None:
    """Only configuration or the request itself can know the public origin:
    PHOENIX_ROOT_URL wins when set; otherwise the current request's origin
    plus its ASGI root_path; the env-composed URL only without a request."""
    from starlette.requests import Request as StarletteRequest

    from phoenix.server.mcp_span_analytics import tools as tools_module

    def scope(root_path: str) -> dict[str, Any]:
        return {
            "type": "http",
            "scheme": "https",
            "server": ("proxy-internal", 8080),
            "headers": [(b"host", b"phoenix.example.com")],
            "root_path": root_path,
            "path": f"{root_path}/mcp",
            "query_string": b"",
            "method": "GET",
            "http_version": "1.1",
        }

    plain_request = StarletteRequest(scope(""))
    prefixed_request = StarletteRequest(scope("/apps/phoenix"))

    # (a) Explicit configuration wins over everything.
    monkeypatch.setenv("PHOENIX_ROOT_URL", "https://obs.example.com/px")
    monkeypatch.setattr(tools_module, "get_http_request", lambda: plain_request)
    assert (
        tools_module._public_url("/redirects/spans/abc")
        == "https://obs.example.com/px/redirects/spans/abc"
    )

    # (b) Without configuration, the request's own origin is the truth.
    monkeypatch.delenv("PHOENIX_ROOT_URL")
    assert (
        tools_module._public_url("/redirects/spans/abc")
        == "https://phoenix.example.com/redirects/spans/abc"
    )

    # (c) A non-empty ASGI root_path prefixes every link.
    monkeypatch.setattr(tools_module, "get_http_request", lambda: prefixed_request)
    assert (
        tools_module._public_url("/redirects/spans/abc")
        == "https://phoenix.example.com/apps/phoenix/redirects/spans/abc"
    )

    # (d) The MCP mount segment is the app's own, not the deployment's:
    # requests seen inside the mount carry it in root_path, and it must be
    # stripped from UI links while the deployment prefix is preserved.
    mounted_request = StarletteRequest(scope("/prefix/mcp"))
    monkeypatch.setattr(tools_module, "get_http_request", lambda: mounted_request)
    mounted_url = tools_module._public_url("/projects/UHJvamVjdDox/spans")
    assert mounted_url == "https://phoenix.example.com/prefix/projects/UHJvamVjdDox/spans"
    assert "/mcp" not in mounted_url

    bare_mount_request = StarletteRequest(scope("/mcp"))
    monkeypatch.setattr(tools_module, "get_http_request", lambda: bare_mount_request)
    bare_url = tools_module._public_url("/redirects/spans/abc")
    assert bare_url == "https://phoenix.example.com/redirects/spans/abc"

    # No request context at all: fall back to the env-composed URL.
    def no_context() -> Any:
        raise RuntimeError("no active request")

    monkeypatch.setattr(tools_module, "get_http_request", no_context)
    fallback = tools_module._public_url("/redirects/spans/abc")
    assert fallback.startswith("http") and fallback.endswith("/redirects/spans/abc")


async def test_cohort_links_escape_and_round_trip(mcp_app: Any, seeded_copilot: Any) -> None:
    """Every aggregate row deep-links its cohort; values with embedded
    quotes and backslashes survive both the filter grammar and URL encoding,
    and the decoded link re-selects exactly the group's rows."""
    from urllib.parse import parse_qs, urlparse

    from phoenix.trace.dsl.filter import SpanFilter

    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_support_copilot.PROJECT_NAME,
                    "time_range": COPILOT_WINDOW,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "breakdowns": ["metadata.org"],
                    "limit": 200,
                },
            )
        )
        assert result["status"] == "ok"
        by_org = {row["metadata.org"]: row for row in result["rows"]}
        for adversarial in ("o'brien-corp", "globex\\emea"):
            row = by_org[adversarial]
            parsed = urlparse(row["ui_url"])
            assert "/projects/" in parsed.path and parsed.path.endswith("/spans")
            assert "/mcp" not in parsed.path  # UI route, not the MCP mount
            params = parse_qs(parsed.query)
            condition = params["filter"][0]
            SpanFilter(condition)  # decodes to a valid filter-grammar string
            requery = _payload(
                await client.call_tool(
                    "aggregateSpans",
                    {
                        "project": seed_support_copilot.PROJECT_NAME,
                        "time_range": {
                            "start": params["start"][0],
                            "end": params["end"][0],
                        },
                        "calculations": [{"name": "spans_n", "fn": "count"}],
                        "filter": condition,
                    },
                )
            )
            assert requery["status"] == "ok", (adversarial, requery)
            assert requery["overall"]["spans_n"] == row["spans_n"], adversarial


async def test_cohort_links_time_buckets_and_null_keys(mcp_app: Any, seeded: Any) -> None:
    """A time bucket narrows the link's time params to its hour and adds no
    filter conjunct; a null group key is skipped (the UI filter cannot say
    'absent'), so the null bucket links to the window without it."""
    from urllib.parse import parse_qs, urlparse

    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "breakdowns": ["metadata.release", {"bucket": "hour"}],
                    "limit": 200,
                },
            )
        )
    assert result["status"] == "ok"
    bucketed = next(r for r in result["rows"] if r["metadata.release"] == "v42")
    params = parse_qs(urlparse(bucketed["ui_url"]).query)
    assert params["filter"][0] == "metadata.release == 'v42'"  # no bucket conjunct
    start = datetime.fromisoformat(params["start"][0])
    end = datetime.fromisoformat(params["end"][0])
    assert end - start == timedelta(hours=1)

    null_key = next(r for r in result["rows"] if r["metadata.release"] is None)
    null_params = parse_qs(urlparse(null_key["ui_url"]).query)
    assert "filter" not in null_params


async def test_cohort_links_carry_the_query_filter(mcp_app: Any, seeded: Any) -> None:
    """The deep link selects the row's cohort, not just its breakdown slice:
    the query's own filter is conjoined with the breakdown equalities, so
    re-running the link's condition reproduces the row's exact count — for a
    filtered breakdown and for a filtered time-bucket breakdown (the bucket
    narrows the window, never the condition)."""
    from urllib.parse import parse_qs, urlparse

    from phoenix.trace.dsl.filter import SpanFilter

    filter_condition = "metadata['release'] == 'v42' and status_code == 'ERROR'"

    async def requery(client: Any, condition: str, window: dict[str, str]) -> int:
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": window,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "filter": condition,
                },
            )
        )
        assert result["status"] == "ok", result
        return cast(int, result["overall"]["spans_n"])

    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        filtered = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "filter": filter_condition,
                    "breakdowns": ["metadata.tenant"],
                    "limit": 200,
                },
            )
        )
        assert filtered["status"] == "ok"
        keyed_rows = [r for r in filtered["rows"] if r["metadata.tenant"] is not None]
        assert keyed_rows
        for row in keyed_rows:
            params = parse_qs(urlparse(row["ui_url"]).query)
            condition = params["filter"][0]
            assert condition.startswith(f"({filter_condition}) and ")
            SpanFilter(condition)  # the UI grammar accepts the composed condition
            window = {"start": params["start"][0], "end": params["end"][0]}
            assert await requery(client, condition, window) == row["spans_n"], row

        # The null group key is skipped by declared necessity, but the query
        # filter itself must survive into the link. Orphan spans carry no
        # metadata, so this breakdown yields exactly the null group.
        orphan_filter = f"name == '{seed_incident.ORPHAN_SPAN_NAME}'"
        orphans = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "filter": orphan_filter,
                    "breakdowns": ["metadata.tenant"],
                },
            )
        )
        assert orphans["status"] == "ok"
        null_row = next(r for r in orphans["rows"] if r["metadata.tenant"] is None)
        null_condition = parse_qs(urlparse(null_row["ui_url"]).query)["filter"][0]
        assert null_condition == orphan_filter

        bucketed = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "filter": "status_code == 'ERROR'",
                    "breakdowns": [{"bucket": "hour"}, "metadata.tenant"],
                    "limit": 200,
                },
            )
        )
        assert bucketed["status"] == "ok"
        bucket_row = next(r for r in bucketed["rows"] if r["metadata.tenant"] is not None)
        params = parse_qs(urlparse(bucket_row["ui_url"]).query)
        start = datetime.fromisoformat(params["start"][0])
        end = datetime.fromisoformat(params["end"][0])
        assert end - start == timedelta(hours=1)  # the bucket narrowed the window
        condition = params["filter"][0]
        assert condition.startswith("(status_code == 'ERROR') and ")
        assert "time_bucket" not in condition  # buckets scope time, not the condition
        window = {"start": params["start"][0], "end": params["end"][0]}
        assert await requery(client, condition, window) == bucket_row["spans_n"]


async def test_presence_aggregations_on_observed_fields(mcp_app: Any, seeded_copilot: Any) -> None:
    """count and count_distinct never compute on values, so they work on any
    scalar field — 'how many distinct users' is one aggregate over the
    observed user.id — while value aggregation on the same field stays
    rejected with the presence/value distinction named."""
    spans_with_user = [
        span for span in seeded_copilot.spans if isinstance(span.attributes.get("user"), dict)
    ]
    expected_users = {span.attributes["user"]["id"] for span in spans_with_user}
    expected_names = {span.name for span in seeded_copilot.spans}
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_support_copilot.PROJECT_NAME,
                    "time_range": COPILOT_WINDOW,
                    "calculations": [
                        {"name": "distinct_users", "fn": "count_distinct", "field": "user.id"},
                        {"name": "spans_with_user", "fn": "count", "field": "user.id"},
                        {"name": "distinct_names", "fn": "count_distinct", "field": "name"},
                    ],
                },
            )
        )
        assert result["status"] == "ok"
        overall = result["overall"]
        assert overall["distinct_users"] == len(expected_users)
        assert overall["spans_with_user"] == len(spans_with_user)
        assert overall["distinct_names"] == len(expected_names)

        rejected = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_support_copilot.PROJECT_NAME,
                    "time_range": COPILOT_WINDOW,
                    "calculations": [{"name": "s", "fn": "sum", "field": "user.id"}],
                },
            )
        )
        assert rejected["status"] == "error"
        assert rejected["code"] == "field_not_aggregatable"
        assert "presence aggregations (count, count_distinct)" in rejected["message"]
        assert "latency_ms" in rejected["suggestions"]


async def test_message_fields_select_and_clip(mcp_app: Any, seeded: Any) -> None:
    """The first-two-input-message fields read the OpenInference message
    lists: correct role/content for messages 0 and 1, NULL second message on
    a single-message span, and preview clipping on oversized content."""
    message_fields = [
        "llm.input_messages[0].message.role",
        "llm.input_messages[0].message.content",
        "llm.input_messages[1].message.role",
        "llm.input_messages[1].message.content",
    ]
    normal = seeded.main.spans[1]
    mixed = next(
        s
        for s in seeded.main.spans
        if s.span_kind == "LLM" and isinstance(s.attributes["llm"]["token_count"]["total"], str)
    )
    large = next(
        s
        for s in seeded.main.spans
        if s.span_kind == "LLM" and len(s.attributes["input"]["value"]) >= 19_000
    )
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)

        async def fetch(span_id: str, max_cell_chars: int = 10_000) -> dict[str, Any]:
            result = _payload(
                await client.call_tool(
                    "querySpanRows",
                    {
                        "project": seed_incident.MAIN_PROJECT_NAME,
                        "time_range": FULL_WINDOW,
                        "fields": message_fields,
                        "filter": f"span_id == '{span_id}'",
                        "max_cell_chars": max_cell_chars,
                    },
                )
            )
            assert result["status"] == "ok", result
            return result

        both = await fetch(normal.span_id)
        (row,) = both["rows"]
        assert row["llm.input_messages[0].message.role"] == "system"
        assert row["llm.input_messages[0].message.content"] == seed_incident.SYSTEM_PROMPT
        assert row["llm.input_messages[1].message.role"] == "user"
        assert row["llm.input_messages[1].message.content"] == normal.attributes["input"]["value"]

        single = await fetch(mixed.span_id)
        (single_row,) = single["rows"]
        assert single_row["llm.input_messages[0].message.role"] == "user"
        assert single_row["llm.input_messages[1].message.role"] is None
        assert single_row["llm.input_messages[1].message.content"] is None

        clipped = await fetch(large.span_id, max_cell_chars=400)
        (clipped_row,) = clipped["rows"]
        content = clipped_row["llm.input_messages[1].message.content"]
        assert len(content) < 1_000 and "clipped" in content
        assert any(
            marker["field"] == "llm.input_messages[1].message.content"
            for marker in clipped["clipped"]
        )
        assert "getSpan" in clipped["note"]


async def test_silent_null_projection_note(mcp_app: Any, seeded: Any) -> None:
    """A selected observed path the discovery sample never saw gets a
    per-field not_observed note (a misspelling is indistinguishable from a
    real-but-absent path); a sparse path with some values present does not."""
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        missing = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["metadata.nonexistent_key", "name"],
                    "limit": 20,
                },
            )
        )
        assert missing["status"] == "ok"
        assert any(
            note["field"] == "metadata.nonexistent_key"
            and note["code"] == "not_observed"
            and "describeSpans" in note["note"]
            for note in missing["field_notes"]
        )

        # A genuinely sparse path: orphan spans carry no metadata, ordinary
        # spans do; mixed NULL and non-NULL draws no note.
        sparse = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["start_time", "metadata.tenant", "name"],
                    "filter": (
                        f"name == '{seed_incident.ORPHAN_SPAN_NAME}' or "
                        f"name == '{seed_incident.ROOT_SPAN_NAME}'"
                    ),
                    "order": [{"field": "start_time", "direction": "asc"}],
                    "limit": 200,
                },
            )
        )
        assert sparse["status"] == "ok"
        values = [row["metadata.tenant"] for row in sparse["rows"]]
        assert any(v is None for v in values) and any(v is not None for v in values)
        assert "field_notes" not in sparse


async def test_all_null_slice_of_observed_path_is_noted(mcp_app: Any, seeded: Any) -> None:
    """A path the sample did observe but the returned slice never carries
    draws an all_null note — in rows (every returned row NULL) and in
    aggregates (only a null group key)."""
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        # Orphan spans carry no metadata at all, so this slice is all-NULL
        # for a path that exists everywhere else in the project.
        rows = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["metadata.tenant", "name"],
                    "filter": f"name == '{seed_incident.ORPHAN_SPAN_NAME}'",
                    "limit": 200,
                },
            )
        )
        assert rows["status"] == "ok"
        assert rows["rows"] and all(r["metadata.tenant"] is None for r in rows["rows"])
        (note,) = rows["field_notes"]
        assert note["field"] == "metadata.tenant"
        assert note["code"] == "all_null"
        assert "observed" in note["note"]

        grouped = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "filter": f"name == '{seed_incident.ORPHAN_SPAN_NAME}'",
                    "breakdowns": ["metadata.tenant"],
                },
            )
        )
        assert grouped["status"] == "ok"
        (row,) = grouped["rows"]
        assert row["metadata.tenant"] is None
        (grouped_note,) = grouped["field_notes"]
        assert (grouped_note["field"], grouped_note["code"]) == ("metadata.tenant", "all_null")


async def test_not_observed_breakdown_teaches_instead_of_silence(mcp_app: Any, seeded: Any) -> None:
    """The misspelled-breakdown trap: a typo'd observed path still succeeds
    (open admission — a path can be real but unsampled) but the response
    carries a not_observed note with nearest observed-path suggestions,
    instead of one silent null group presented as a complete answer."""
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "breakdowns": ["metadata.releas"],
                },
            )
        )
        assert result["status"] == "ok"
        (row,) = result["rows"]
        assert row["metadata.releas"] is None  # the silent null group, now disclosed
        (note,) = result["field_notes"]
        assert note["field"] == "metadata.releas"
        assert note["code"] == "not_observed"
        assert "describeSpans" in note["note"]
        assert "metadata.release" in note["suggestions"]

        # The same typo as a projection: one not_observed note, no duplicate
        # all_null note for the same field.
        projected = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["metadata.releas", "name"],
                    "limit": 20,
                },
            )
        )
        assert projected["status"] == "ok"
        typo_notes = [n for n in projected["field_notes"] if n["field"] == "metadata.releas"]
        (projected_note,) = typo_notes
        assert projected_note["code"] == "not_observed"
        assert "metadata.release" in projected_note["suggestions"]

        # A typo'd filter path draws the note too.
        filtered = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "filter": "metadata['releas'] == 'v42'",
                },
            )
        )
        assert filtered["status"] == "ok"
        assert any(
            n["code"] == "not_observed" and "metadata.release" in n["suggestions"]
            for n in filtered["field_notes"]
        )


async def test_validate_only_surfaces_not_observed_warnings(mcp_app: Any, seeded: Any) -> None:
    """validate_only checks observed paths against the discovery sample and
    returns structured warnings for unsampled ones — a warning, never an
    error, because open admission stands."""
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "spans_n", "fn": "count"}],
                    "breakdowns": ["metadata.releas"],
                    "validate_only": True,
                },
            )
        )
        assert result["status"] == "ok" and result["valid"] is True
        (warning,) = result["warnings"]
        assert warning["field"] == "metadata.releas"
        assert warning["code"] == "not_observed"
        assert "metadata.release" in warning["suggestions"]


async def test_real_but_unsampled_path_succeeds_with_note(
    mcp_app: Any, seeded: Any, db: DbSessionFactory
) -> None:
    """Open admission is real: a path present in the data but absent from
    the bounded discovery sample still returns its values — accompanied by
    the not_observed note, which is sampled evidence, not proof of absence."""
    async with db() as session:
        span_ids = list(
            (
                await session.execute(
                    sqlalchemy.select(models.Span.id)
                    .join(
                        models.Trace,
                        models.Span.trace_rowid == models.Trace.id,
                    )
                    .join(
                        models.Project,
                        models.Trace.project_rowid == models.Project.id,
                    )
                    .where(models.Project.name == seed_incident.MAIN_PROJECT_NAME)
                )
            ).scalars()
        )
        # Replicate the seeded discovery draw exactly and plant the rare
        # path on a span the draw provably skips.
        id_range = range(min(span_ids), max(span_ids) + 1)
        assert len(id_range) > discovery.SAMPLE_SIZE  # the draw actually samples
        sampled = set(random.Random(discovery.SAMPLE_SEED).sample(id_range, discovery.SAMPLE_SIZE))
        unsampled_rowid = next(i for i in span_ids if i not in sampled)
        span = (
            await session.execute(
                sqlalchemy.select(models.Span).where(models.Span.id == unsampled_rowid)
            )
        ).scalar_one()
        attributes = dict(span.attributes)
        attributes.setdefault("metadata", {})
        attributes["metadata"] = {**attributes["metadata"], "rare_flag": "on"}
        span.attributes = attributes
        planted_span_id = span.span_id
        await session.commit()

    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["metadata.rare_flag"],
                    "filter": f"span_id == '{planted_span_id}'",
                },
            )
        )
    assert result["status"] == "ok"
    (row,) = result["rows"]
    assert row["metadata.rare_flag"] == "on"  # the value comes back
    assert any(
        n["field"] == "metadata.rare_flag" and n["code"] == "not_observed"
        for n in result["field_notes"]
    )


async def test_get_span_fields_match_row_values(mcp_app: Any, seeded: Any) -> None:
    """getSpan's flat `fields` echo must equal the querySpanRows row for the
    same span, id for id — the survey-to-drill-down handoff keeps one naming
    scheme (flat status_code, not a nested remap)."""
    span = seeded.main.spans[1]  # an ordinary LLM span with small payloads
    authored_ids = [f.id for f in registry.AUTHORED_FIELDS]
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        rows = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": authored_ids,
                    "filter": f"span_id == '{span.span_id}'",
                    "max_cell_chars": 10_000,
                },
            )
        )
        assert rows["status"] == "ok"
        (row,) = rows["rows"]
        drilled = _payload(
            await client.call_tool(
                "getSpan",
                {"project": seed_incident.MAIN_PROJECT_NAME, "span_id": span.span_id},
            )
        )
    assert drilled["status"] == "ok"
    fields = drilled["fields"]
    assert set(fields) == set(authored_ids)
    for field_id in authored_ids:
        assert fields[field_id] == row[field_id], field_id


def test_analytics_tools_carry_tags_and_search_vocabulary() -> None:
    """The analytics tools carry the analytics tag beside the spans group
    tag, speak the vocabulary catalog search ranks on, and point at
    get_schema detail='full' for their nested parameter shapes."""
    tools = {t.name: t for t in build_span_analytics_tools(cast(Any, object()))}
    for name in ("describeSpans", "aggregateSpans", "querySpanRows", "getSpan"):
        assert "analytics" in tools[name].tags, name
        assert "spans" in tools[name].tags, name
        assert "detail='full'" in (tools[name].description or ""), name
    assert "spans" in tools["getTrace"].tags
    aggregate_description = tools["aggregateSpans"].description or ""
    for keyword in ("group by", "metrics", "error rate", "percentiles", "top-N"):
        assert keyword in aggregate_description, keyword
    assert "top-N" in (tools["querySpanRows"].description or "")


async def test_get_trace_assembles_the_tree(mcp_app: Any, seeded: Any) -> None:
    large = next(
        s
        for s in seeded.main.spans
        if s.span_kind == "LLM" and len(s.attributes["input"]["value"]) >= 19_000
    )
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "getTrace",
                {"project": seed_incident.MAIN_PROJECT_NAME, "trace_id": large.trace_id},
            )
        )
    assert result["status"] == "ok"
    (root,) = [r for r in result["roots"] if r["parent_id"] is None]
    assert root["name"] == seed_incident.ROOT_SPAN_NAME
    child_ids = {c["span_id"] for c in root["children"]}
    assert large.span_id in child_ids
    assert root["ui_url"].endswith(f"/redirects/spans/{root['span_id']}")


async def test_get_trace_flags_orphans_as_roots(mcp_app: Any, seeded: Any) -> None:
    orphan = next(s for s in seeded.main.spans if s.name == seed_incident.ORPHAN_SPAN_NAME)
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "getTrace",
                {"project": seed_incident.MAIN_PROJECT_NAME, "trace_id": orphan.trace_id},
            )
        )
    assert result["status"] == "ok"
    orphan_roots = [r for r in result["roots"] if r.get("orphan")]
    assert [r["span_id"] for r in orphan_roots] == [orphan.span_id]


async def test_zero_result_guidance_causes(mcp_app: Any, seeded: Any) -> None:
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)

        absent_path = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "filter": "metadata['never_recorded_key'] == 'x'",
                },
            )
        )
        assert absent_path["status"] == "ok"
        assert absent_path["rows"] == []
        assert absent_path["guidance"]["cause"] == "path_not_observed"
        assert "sampled evidence" in absent_path["guidance"]["detail"]

        empty_window = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": {
                        "start": "2020-01-01T00:00:00Z",
                        "end": "2020-01-02T00:00:00Z",
                    },
                },
            )
        )
        assert empty_window["guidance"]["cause"] == "window_empty"

        no_match = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "filter": "'zzz-not-in-any-payload' in input.value",
                },
            )
        )
        assert no_match["guidance"]["cause"] == "no_matches"


async def test_project_isolation_is_behavioral(mcp_app: Any, seeded: Any) -> None:
    """A decoy project with identical span names and attribute keys but
    different values must never leak through any tool path."""
    decoy_span = seeded.decoy.spans[0]
    decoy_tenants = set(seed_incident.DECOY_TENANTS)
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)

        described = _payload(
            await client.call_tool("describeSpans", {"project": seed_incident.MAIN_PROJECT_NAME})
        )
        tenant_entry = next(e for e in described["fields"] if e["field"] == "metadata.tenant")
        assert not ({v["value"] for v in tenant_entry["top_values"]} & decoy_tenants)

        counted = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "calls", "fn": "count"}],
                },
            )
        )
        assert counted["overall"]["calls"] == len(seeded.main.spans)

        rows = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "limit": 200,
                },
            )
        )
        decoy_ids = {s.span_id for s in seeded.decoy.spans}
        assert not ({r["span_id"] for r in rows["rows"]} & decoy_ids)

        # A span id from the decoy project answers exactly like a span id
        # that exists nowhere.
        foreign = _payload(
            await client.call_tool(
                "getSpan",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "span_id": decoy_span.span_id,
                },
            )
        )
        nonexistent = _payload(
            await client.call_tool(
                "getSpan",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "span_id": "0000000000000000",
                },
            )
        )
        assert foreign["status"] == "error" and foreign["code"] == "span_not_found"
        assert nonexistent["code"] == "span_not_found"
        assert foreign["message"].replace(decoy_span.span_id, "X") == nonexistent[
            "message"
        ].replace("0000000000000000", "X")

        foreign_trace = _payload(
            await client.call_tool(
                "getTrace",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "trace_id": seeded.decoy.traces[0].trace_id,
                },
            )
        )
        assert foreign_trace["status"] == "error"
        assert foreign_trace["code"] == "trace_not_found"


async def test_nearest_name_error_surfaces_through_the_client(mcp_app: Any, seeded: Any) -> None:
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["latencyms"],
                },
            )
        )
    assert result["status"] == "error"
    assert result["code"] == "unknown_field"
    assert "latency_ms" in result["suggestions"]


async def test_project_not_found_suggests_near_names(mcp_app: Any, seeded: Any) -> None:
    """A near-miss project name gets nearest-name suggestions from the
    project list — safe while every project is listable by every caller
    (getProjects discloses the same names); under per-project authorization
    the candidate list must first be filtered to the caller's visible set."""
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": "payment-agent",
                    "time_range": FULL_WINDOW,
                },
            )
        )
    assert result["status"] == "error"
    assert result["code"] == "project_not_found"
    assert seed_incident.MAIN_PROJECT_NAME in result["suggestions"]


async def test_malformed_order_shape_is_structured(mcp_app: Any, seeded: Any) -> None:
    """A wrong parameter shape must surface on the error union with a plain
    message and a usable path — never as raw validation text with internal
    model names or vendor URLs."""
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        # The sample spelling wrapped in a list: matches neither order form.
        result = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "order": [{"sample": {"seed": 42}}],
                },
            )
        )
        assert result["status"] == "error"
        assert result["code"] == "invalid_shape"
        assert result["path"].startswith("order")
        assert '{"sample": {"seed": 42}}' in result["message"]
        serialized = json.dumps(result)
        assert "pydantic" not in serialized.lower()
        assert "RowOrderField" not in serialized
        assert "SampleOrder" not in serialized

        # Same contract on the aggregate shape.
        aggregate = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": {"name": "calls", "fn": "count"},
                },
            )
        )
        assert aggregate["status"] == "error"
        assert aggregate["code"] == "invalid_shape"
        assert aggregate["path"].startswith("calculations")
        assert "Calculation" not in json.dumps(aggregate)


async def test_validate_only_executes_nothing(mcp_app: Any, seeded: Any) -> None:
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        valid = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "calls", "fn": "count"}],
                    "breakdowns": ["metadata.release"],
                    "validate_only": True,
                },
            )
        )
        assert valid == {
            "status": "ok",
            "valid": True,
            "applied": valid["applied"],
        }
        assert "rows" not in valid

        invalid = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "s", "fn": "sum", "field": "name"}],
                    "validate_only": True,
                },
            )
        )
        assert invalid["status"] == "error"
        assert invalid["code"] == "field_not_aggregatable"


async def test_two_control_beat_clamping_and_admission(
    mcp_app: Any, seeded: Any, db: DbSessionFactory
) -> None:
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        clamped = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "limit": 100_000,
                },
            )
        )
        assert clamped["status"] == "ok"
        assert clamped["applied"]["limit"] == compiler.ROW_LIMIT_MAX
        expected_timeout = (
            compiler.STATEMENT_TIMEOUT_MS if db.dialect.value == "postgresql" else None
        )
        assert clamped["applied"]["timeout"]["statement_timeout_ms"] == expected_timeout

        rejected = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "calls", "fn": "count"}],
                    "breakdowns": ["input.value"],
                },
            )
        )
        assert rejected["status"] == "error"
        assert rejected["code"] == "field_not_groupable"
        assert rejected["suggestions"]
        # The suggestions include the project's own discovered dimensions —
        # the breakdowns an agent actually reaches for — beside authored ids.
        assert "metadata.tenant" in rejected["suggestions"]
        assert "metadata.release" in rejected["suggestions"]
        assert "Observed dimensions" in rejected["message"]


async def test_filter_grammar_rejections_are_structured(mcp_app: Any, seeded: Any) -> None:
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        call_expression = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "filter": "__import__('os').system('true')",
                },
            )
        )
        assert call_expression["status"] == "error"
        assert call_expression["code"] == "invalid_filter"

        # Composite annotation expressions stay rejected — with the
        # supported shape and the two-call decomposition as the route.
        nested_evals = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "filter": "status_code == 'ERROR' or evals['correctness'].score < 0.5",
                },
            )
        )
        assert nested_evals["status"] == "error"
        assert nested_evals["code"] == "unsupported_filter_reference"
        assert "top-level" in nested_evals["message"]
        assert "listSpanAnnotationsBySpanIds" in nested_evals["message"]


async def test_annotation_filter_end_to_end(mcp_app: Any, seeded: Any) -> None:
    """Annotation existence filters work without multiplying rows: the
    top-10-by-cost among low-scored spans matches the answer key, a span
    scored by two annotators counts once, the label form works, the
    any-annotator semantics are disclosed structurally, and annotation
    *value* uses are refused with their decomposition."""
    annotations = [a for a in seeded.main.annotations if a.name == "correctness"]
    low_spans = {a.span_id for a in annotations if a.score < 0.5}
    all_annotated = {a.span_id for a in annotations}
    incorrect_spans = {a.span_id for a in annotations if a.label == "incorrect"}
    per_span = Counter(a.span_id for a in annotations)
    assert max(per_span.values()) == 2  # at least one span carries both annotators
    cost_by_span = {c.span_id: c for c in seeded.main.costs}
    expected_top = [
        c.span_id
        for c in sorted(
            (cost_by_span[sid] for sid in low_spans if sid in cost_by_span),
            key=lambda c: (-c.total_cost, c.span_id),
        )[:10]
    ]

    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        rows = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["cost.total"],
                    "filter": "evals['correctness'].score < 0.5",
                    "order": [{"field": "cost.total", "direction": "desc"}],
                    "limit": 10,
                },
            )
        )
        assert rows["status"] == "ok"
        assert [row["span_id"] for row in rows["rows"]] == expected_top
        assert rows["annotation_semantics"] == "any"
        assert "any-annotator" in rows["note"]

        # Unmultiplied counts: a span with two annotator rows counts once.
        counted = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "n", "fn": "count"}],
                    "filter": "evals['correctness'].score <= 1.0",
                },
            )
        )
        assert counted["status"] == "ok"
        assert counted["overall"]["n"] == len(all_annotated)
        assert counted["annotation_semantics"] == "any"

        labeled = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [{"name": "n", "fn": "count"}],
                    "filter": "evals['correctness'].label == 'incorrect'",
                },
            )
        )
        assert labeled["overall"]["n"] == len(incorrect_spans)

        # Annotation values stay refused — with the decomposition route.
        value_select = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["evals['correctness'].score"],
                },
            )
        )
        assert value_select["status"] == "error"
        assert value_select["code"] == "annotation_values_not_supported"
        assert "listSpanAnnotationsBySpanIds" in value_select["message"]

        value_calc = _payload(
            await client.call_tool(
                "aggregateSpans",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "calculations": [
                        {
                            "name": "avg_score",
                            "fn": "avg",
                            "field": "evals['correctness'].score",
                        }
                    ],
                },
            )
        )
        assert value_calc["status"] == "error"
        assert value_calc["code"] == "annotation_values_not_supported"


async def test_sample_order_is_deterministic_per_seed(mcp_app: Any, seeded: Any) -> None:
    async def draw(client: Any, seed: int) -> list[str]:
        result = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "filter": "status_code == 'ERROR'",
                    "order": {"sample": {"seed": seed}},
                    "limit": 10,
                },
            )
        )
        assert result["status"] == "ok"
        assert result["applied"]["sample"] == {"seed": seed}
        return [row["span_id"] for row in result["rows"]]

    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        first = await draw(client, seed=11)
        second = await draw(client, seed=11)
        different = await draw(client, seed=12)
    assert first == second
    assert len(first) == 10
    assert first != different


async def test_response_budget_bounds_rows(mcp_app: Any, seeded: Any) -> None:
    async with _mcp_client(mcp_app) as client:
        await _enable_spans(client)
        result = _payload(
            await client.call_tool(
                "querySpanRows",
                {
                    "project": seed_incident.MAIN_PROJECT_NAME,
                    "time_range": FULL_WINDOW,
                    "fields": ["input.value", "output.value"],
                    "limit": 200,
                    "max_result_chars": 2_000,
                },
            )
        )
    assert result["status"] == "ok"
    assert 0 < len(result["rows"]) < result["row_count"]
    assert "max_result_chars" in result["note"]
    assert len(json.dumps(result["rows"])) < 4_000


async def test_code_mode_catalog_includes_the_tools(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
    monkeypatch.setattr("phoenix.server.mcp_server.get_env_mcp_code_mode", lambda: True)
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        await stack.enter_async_context(LifespanManager(app))
        async with _mcp_client(app) as client:
            listing = (await client.call_tool("list_tools", {})).content[0].text
            for name in ANALYTICS_TOOLS:
                assert name in listing
