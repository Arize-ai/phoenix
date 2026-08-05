from __future__ import annotations

import contextlib
import importlib
import io
import json
import random
import re
import shlex
import socket
import subprocess
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Status, StatusCode, format_span_id

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

agent_tool_calls = importlib.import_module("scripts.generate_spans.generate_agent_tool_calls")
cli = importlib.import_module("scripts.generate_spans.__main__")
edge_cases = importlib.import_module("scripts.generate_spans.generate_edge_case_spans")
generate_all = importlib.import_module("scripts.generate_spans.generate_all")
mixed = importlib.import_module("scripts.generate_spans.generate_mixed_workload")
registry = importlib.import_module("scripts.generate_spans._registry")
partial_traces = importlib.import_module("scripts.generate_spans.generate_partial_traces")
prompts = importlib.import_module("scripts.generate_spans.generate_prompt_templates")
rag = importlib.import_module("scripts.generate_spans.generate_rag_pipeline")
sessions = importlib.import_module("scripts.generate_spans.generate_multi_session_traffic")
shared = importlib.import_module("scripts.generate_spans._shared")
costs = importlib.import_module("scripts.generate_spans.generate_spans_for_cost_calculations")
events = importlib.import_module("scripts.generate_spans.generate_spans_with_event_attributes")
experiment_data = importlib.import_module("scripts.experiments._shared")
psql = importlib.import_module("scripts.generate_data_via_plpgsql._psql")
time_series = importlib.import_module("scripts.generate_spans.generate_spans_for_time_series")
MODELS = shared.MODELS
Generator = shared.Generator
poisson = shared.poisson
token_usage = shared.token_usage
trace_endpoint = shared.trace_endpoint
DEFAULT_MANIFEST = costs.DEFAULT_MANIFEST
load_models = costs.load_models


@pytest.mark.parametrize(
    ("value", "expected"),
    (
        ("http://localhost:6006", "http://localhost:6006/v1/traces"),
        ("http://localhost:6006/", "http://localhost:6006/v1/traces"),
        ("http://collector:4318/v1/traces", "http://collector:4318/v1/traces"),
    ),
)
def test_trace_endpoint(value: str, expected: str) -> None:
    assert trace_endpoint(value) == expected


def test_token_usage_is_seeded_and_internally_consistent() -> None:
    first = token_usage(random.Random(7), MODELS[0])
    second = token_usage(random.Random(7), MODELS[0])

    assert first == second
    assert first.prompt > 0
    assert first.completion > 0
    assert first.total == first.prompt + first.completion
    assert first.completion <= first.prompt * 2


def test_random_status_splits_the_same_draw_three_ways() -> None:
    """The status mix every scenario inherits, and what the README's ~5% UNSET claim rests on.

    error_rate and unset_rate partition a single uniform draw rather than being sampled
    independently, so raising one necessarily eats into the others — a change to independent
    draws would silently alter the mix everywhere without failing anything else.
    """
    rng = random.Random(11)
    counts = Counter(shared.random_status(rng, error_rate=0.10) for _ in range(20_000))

    assert set(counts) == {StatusCode.OK, StatusCode.ERROR, StatusCode.UNSET}
    assert counts[StatusCode.ERROR] / 20_000 == pytest.approx(0.10, abs=0.015)
    assert counts[StatusCode.UNSET] / 20_000 == pytest.approx(0.05, abs=0.015)

    # A saturated error rate leaves nothing for the other two.
    saturated = {shared.random_status(rng, error_rate=1.0) for _ in range(200)}
    assert saturated == {StatusCode.ERROR}

    # And UNSET can be switched off without disturbing the error rate.
    no_unset = Counter(
        shared.random_status(rng, error_rate=0.10, unset_rate=0.0) for _ in range(5_000)
    )
    assert StatusCode.UNSET not in no_unset
    assert no_unset[StatusCode.ERROR] / 5_000 == pytest.approx(0.10, abs=0.02)


def test_poisson_is_seeded_and_rejects_negative_rates() -> None:
    first = [poisson(random.Random(seed), 3.5) for seed in range(10)]
    second = [poisson(random.Random(seed), 3.5) for seed in range(10)]

    assert first == second
    assert all(value >= 0 for value in first)
    with pytest.raises(ValueError, match="non-negative"):
        poisson(random.Random(1), -0.1)


def test_cost_models_come_from_the_checked_in_manifest() -> None:
    models = load_models(Path(DEFAULT_MANIFEST))

    assert len(models) > 10
    assert any(model.provider == "openai" for model in models)
    assert any(model.provider == "anthropic" for model in models)
    assert {"cerebras", "groq", "together"}.issubset({model.provider for model in models})
    assert len({model.name for model in models}) == len(models)


def test_cost_models_prefer_declared_provider_and_infer_missing_provider(tmp_path: Path) -> None:
    manifest = tmp_path / "model_cost_manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "models": [
                    {"name": "groq/llama-3.3-70b", "provider": "groq", "token_prices": []},
                    {"name": "gpt-4.1", "token_prices": []},
                ]
            }
        )
    )

    models = load_models(manifest)

    assert [(model.name, model.provider) for model in models] == [
        ("groq/llama-3.3-70b", "groq"),
        ("gpt-4.1", "openai"),
    ]

    args = costs.build_parser().parse_args(
        ["--manifest", str(manifest), "--provider", "groq", "--dry-run"]
    )
    generator, model_count = costs.generate(args)
    generator.close()

    assert model_count == 1
    assert generator.trace_count == 1
    assert generator.span_count == 2


@pytest.mark.parametrize(
    ("end_time", "transition_date", "transition_hour", "expected_occurrences"),
    (
        (datetime(2024, 3, 11, 7, tzinfo=timezone.utc), date(2024, 3, 10), 2, 0),
        (datetime(2024, 11, 4, 6, tzinfo=timezone.utc), date(2024, 11, 3), 1, 2),
    ),
)
def test_time_series_uses_24_unique_utc_buckets_across_dst(
    monkeypatch: pytest.MonkeyPatch,
    end_time: datetime,
    transition_date: date,
    transition_hour: int,
    expected_occurrences: int,
) -> None:
    class HourStartRandom:
        @staticmethod
        def uniform(start: float, end: float) -> float:
            return start

    monkeypatch.setattr(time_series, "poisson", lambda rng, rate: 1)
    args = SimpleNamespace(
        timezone="America/Denver",
        days=1,
        business_rate=1,
        evening_rate=1,
        night_rate=1,
        weekend_rate=1,
        max_traces=100,
    )

    timestamps = list(
        time_series.generate_timestamps(
            SimpleNamespace(rng=HourStartRandom()),
            args,
            end_time=end_time,
        )
    )

    assert len(timestamps) == 24
    assert len(set(timestamps)) == 24
    assert all(
        (current - previous).total_seconds() == 3_600
        for previous, current in zip(timestamps, timestamps[1:])
    )
    local_timestamps = [timestamp.astimezone(ZoneInfo(args.timezone)) for timestamp in timestamps]
    assert (
        sum(
            timestamp.date() == transition_date and timestamp.hour == transition_hour
            for timestamp in local_timestamps
        )
        == expected_occurrences
    )


def test_dry_run_generator_counts_roots_without_exporting() -> None:
    generator = Generator(
        endpoint="http://localhost:6006",
        project_name="test",
        seed=3,
        dry_run=True,
    )
    with generator.span("root", "CHAIN", root=True):
        with generator.span("child", "LLM"):
            pass
    generator.close()

    assert generator.trace_count == 1
    assert generator.span_count == 2


def test_generator_applies_status_fallback_without_overwriting_body_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    generator = Generator(
        endpoint="http://localhost:6006",
        project_name="test",
        seed=3,
        dry_run=False,
        preflight=False,
    )
    with generator.span("default-fallback", "CHAIN"):
        pass
    with generator.span("error-fallback", "CHAIN", status=StatusCode.ERROR):
        pass
    with generator.span("body-error", "CHAIN") as span:
        span.set_status(Status(StatusCode.ERROR, "downstream timeout"))
    with generator.span("body-ok", "CHAIN", status=StatusCode.ERROR) as span:
        span.set_status(Status(StatusCode.OK))
    generator.close()

    statuses = {span.name: span.status for span in exporter.get_finished_spans()}
    assert statuses["default-fallback"].status_code is StatusCode.OK
    assert statuses["error-fallback"].status_code is StatusCode.ERROR
    assert statuses["body-error"].status_code is StatusCode.ERROR
    assert statuses["body-error"].description == "downstream timeout"
    assert statuses["body-ok"].status_code is StatusCode.OK


def test_generator_uses_phoenix_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    exporter = InMemorySpanExporter()
    exporter_options: dict[str, object] = {}

    def make_exporter(*, endpoint: str, headers: object) -> InMemorySpanExporter:
        exporter_options.update(endpoint=endpoint, headers=headers)
        return exporter

    monkeypatch.setenv("PHOENIX_API_KEY", "secret-key")
    monkeypatch.setattr(shared, "OTLPSpanExporter", make_exporter)
    generator = Generator(
        endpoint="https://app.phoenix.arize.com",
        project_name="test",
        seed=3,
        dry_run=False,
        preflight=False,
    )
    generator.close()

    assert exporter_options == {
        "endpoint": "https://app.phoenix.arize.com/v1/traces",
        "headers": {"Authorization": "Bearer secret-key"},
    }


def test_event_fixtures_report_trace_local_child_counts_and_error_descriptions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = events.build_parser().parse_args(
        ["--traces", "2", "--exceptions-per-trace", "1", "--seed", "7", "--no-preflight"]
    )
    generator = events.generate(args)
    generator.close()
    spans = exporter.get_finished_spans()
    spans_by_trace: dict[int, list[ReadableSpan]] = {}
    for span in spans:
        spans_by_trace.setdefault(span.context.trace_id, []).append(span)

    roots = [span for span in spans if span.name.startswith("support-request-")]
    assert len(roots) == 2
    for root in roots:
        completed_event = next(event for event in root.events if event.name == "trace.completed")
        assert completed_event.attributes is not None
        assert (
            completed_event.attributes["child_spans"]
            == len(spans_by_trace[root.context.trace_id]) - 1
        )

    exceptions = [span for span in spans if span.name.startswith("failed-operation-")]
    assert len(exceptions) == 2
    assert all(span.status.status_code is StatusCode.ERROR for span in exceptions)
    assert all(span.status.description for span in exceptions)


def test_agent_tool_calls_correlate_requests_with_tool_spans(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = agent_tool_calls.build_parser().parse_args(
        ["--traces", "4", "--seed", "11", "--no-preflight", "--annotation-rate", "0"]
    )
    generator, _annotations, tool_calls, tool_failures = agent_tool_calls.generate(args)
    generator.close()
    spans = exporter.get_finished_spans()

    tool_spans = [span for span in spans if span.attributes["openinference.span.kind"] == "TOOL"]
    assert len(tool_spans) == tool_calls
    assert sum(span.status.status_code is StatusCode.ERROR for span in tool_spans) == tool_failures

    requested_ids = {
        value
        for span in spans
        for key, value in span.attributes.items()
        if key.endswith(".tool_call.id")
    }
    assert requested_ids == {span.attributes["tool.id"] for span in tool_spans}

    # Every advertised tool must be a schema an SDK could send verbatim to the model.
    schemas = [
        json.loads(value)
        for span in spans
        for key, value in span.attributes.items()
        if key.startswith("llm.tools.") and key.endswith(".tool.json_schema")
    ]
    assert schemas
    assert all(schema["function"]["parameters"]["type"] == "object" for schema in schemas)


def test_session_turn_counts_cover_the_whole_range() -> None:
    """Weighting fixed lengths left holes at 4, 6, 7, 9-12 and 14-20.

    A turn-count histogram then showed spikes with gaps, and a range filter like "4 to 10
    turns" matched only the two lengths that happened to be in the list.
    """
    generator = shared.Generator(
        endpoint="http://localhost:6006", project_name="test", seed=7, dry_run=True
    )
    counts = Counter(sessions._turn_count(generator, 21) for _ in range(4_000))

    assert set(counts) == set(range(1, 22)), sorted(set(range(1, 22)) - set(counts))
    # The long tail has to survive the fix: most conversations are still short.
    assert sum(count for turns, count in counts.items() if turns <= 3) / 4_000 > 0.5
    assert counts[21] < counts[1]

    # --max-turns still truncates rather than silently widening the range.
    assert set(sessions._turn_count(generator, 5) for _ in range(500)) <= set(range(1, 6))
    assert set(sessions._turn_count(generator, 1) for _ in range(100)) == {1}
    generator.close()


def test_sessions_are_backdated_with_ordered_turns_and_nested_children(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = sessions.build_parser().parse_args(
        [
            "--sessions",
            "8",
            "--days",
            "3",
            "--seed",
            "5",
            "--no-preflight",
            "--annotation-rate",
            "0",
        ]
    )
    generator, _annotations, turn_histogram = sessions.generate(args)
    generator.close()
    spans = exporter.get_finished_spans()

    assert sum(turn_histogram.values()) == 8
    turns = [span for span in spans if span.name == "conversation-turn"]
    assert len(turns) == generator.trace_count

    now_ns = int(shared.utc_now().timestamp() * 1_000_000_000)
    window_ns = 3 * 86_400 * 1_000_000_000
    for turn in turns:
        # The trap this guards: omitting end_time ends the span at wall clock, which both
        # zeroes the duration and drags a backdated span forward to now.
        assert turn.end_time > turn.start_time
        assert turn.start_time > now_ns - window_ns
        assert turn.end_time <= now_ns

    by_session: dict[str, list[ReadableSpan]] = {}
    for turn in turns:
        by_session.setdefault(turn.attributes["session.id"], []).append(turn)
    assert len(by_session) == 8
    for session_turns in by_session.values():
        ordered = sorted(session_turns, key=lambda span: span.start_time)
        assert [span.attributes["user.id"] for span in ordered].count(
            ordered[0].attributes["user.id"]
        ) == len(ordered)
        for previous, current in zip(ordered, ordered[1:]):
            assert current.start_time >= previous.end_time

    turns_by_context = {turn.context.span_id: turn for turn in turns}
    children = [span for span in spans if span.name == "chat-completion"]
    assert len(children) == len(turns)
    for child in children:
        parent = turns_by_context[child.parent.span_id]
        assert parent.start_time <= child.start_time < child.end_time <= parent.end_time


@pytest.mark.parametrize(
    ("value", "expected"),
    (
        ("http://localhost:6006", "http://localhost:6006"),
        ("http://localhost:6006/", "http://localhost:6006"),
        ("http://localhost:6006/v1/traces", "http://localhost:6006"),
    ),
)
def test_base_url_recovers_the_phoenix_root_from_either_endpoint_form(
    value: str, expected: str
) -> None:
    assert shared.base_url(value) == expected


def test_annotations_batch_writes_and_nest_results(monkeypatch: pytest.MonkeyPatch) -> None:
    batches: list[list[dict[str, object]]] = []

    class FakeSpans:
        @staticmethod
        def log_span_annotations(*, span_annotations: list[dict[str, object]]) -> None:
            batches.append(list(span_annotations))

    class FakeClient:
        def __init__(self, base_url: str) -> None:
            self.base_url = base_url
            self.spans = FakeSpans()

    monkeypatch.setattr("phoenix.client.Client", FakeClient)
    annotations = shared.Annotations(
        endpoint="http://localhost:6006/v1/traces", dry_run=False, batch_size=2
    )
    generator = shared.Generator(
        endpoint="http://localhost:6006", project_name="test", seed=1, dry_run=True
    )
    for index in range(3):
        with generator.span(f"root-{index}", "CHAIN", root=True) as span:
            annotations.add(span, "helpfulness", score=0.5, label="helpful")
    generator.close()

    assert annotations.count == 3
    assert [len(batch) for batch in batches] == [2]  # third is still buffered
    annotations.flush()
    assert [len(batch) for batch in batches] == [2, 1]

    annotation = batches[0][0]
    # score/label/explanation nest under `result`; they are not top-level fields.
    assert annotation["result"] == {"score": 0.5, "label": "helpful"}
    assert annotation["annotator_kind"] == "LLM"
    assert len(annotation["span_id"]) == 16

    with pytest.raises(ValueError, match="at least one of"):
        annotations.add(span, "empty")

    # Phoenix rejects name="note" on the bulk endpoint with a 400; fail before exporting.
    with pytest.raises(ValueError, match="reserved"):
        annotations.add(span, "note", explanation="should use add_note")


def test_trace_and_session_annotations_use_their_own_payloads_and_endpoints(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Each annotation flavour has a different key and a different client method.

    Swapping `span_id` for `trace_id` on a trace annotation, or routing a session annotation
    to the span endpoint, produces a payload the server rejects at runtime — well after the
    spans have already exported.
    """
    sinks: dict[str, list[dict[str, object]]] = {"span": [], "trace": [], "session": []}

    class FakeSpans:
        @staticmethod
        def log_span_annotations(*, span_annotations: list[dict[str, object]]) -> None:
            sinks["span"].extend(span_annotations)

    class FakeTraces:
        @staticmethod
        def log_trace_annotations(*, trace_annotations: list[dict[str, object]]) -> None:
            sinks["trace"].extend(trace_annotations)

    class FakeSessions:
        @staticmethod
        def log_session_annotations(*, session_annotations: list[dict[str, object]]) -> None:
            sinks["session"].extend(session_annotations)

    class FakeClient:
        def __init__(self, base_url: str) -> None:
            self.spans, self.traces, self.sessions = FakeSpans(), FakeTraces(), FakeSessions()

    monkeypatch.setattr("phoenix.client.Client", FakeClient)
    annotations = shared.Annotations(endpoint="http://localhost:6006", dry_run=False)
    generator = shared.Generator(
        endpoint="http://localhost:6006",
        project_name="test",
        seed=1,
        dry_run=True,
        preflight=False,
    )
    with generator.span("root", "CHAIN", root=True) as root:
        annotations.add(root, "span_level", score=0.5)
        annotations.add_trace(root, "task_completion", label="completed")
    annotations.add_session("session-0001", "user_satisfaction", score=0.9)
    generator.close()
    annotations.flush()

    assert (annotations.count, annotations.trace_count, annotations.session_count) == (1, 1, 1)

    span_annotation = sinks["span"][0]
    trace_annotation = sinks["trace"][0]
    session_annotation = sinks["session"][0]

    assert set(span_annotation) >= {"span_id", "name", "annotator_kind", "result"}
    # A trace annotation carries trace_id *instead of* span_id, not in addition to it.
    assert "span_id" not in trace_annotation
    assert trace_annotation["trace_id"] == shared.trace_id(root)
    assert len(trace_annotation["trace_id"]) == 32
    assert session_annotation["session_id"] == "session-0001"
    assert "span_id" not in session_annotation

    with pytest.raises(ValueError, match="at least one of"):
        annotations.add_session("session-0001", "empty")


def test_ns_rejects_naive_timestamps() -> None:
    """Backdating depends on tz-aware timestamps; a naive one would shift by the local offset."""
    aware = datetime(2024, 6, 1, 12, tzinfo=timezone.utc)
    assert shared.ns(aware) == int(aware.timestamp() * 1_000_000_000)

    with pytest.raises(ValueError, match="timezone-aware"):
        shared.ns(datetime(2024, 6, 1, 12))


def test_annotations_are_a_no_op_under_dry_run() -> None:
    annotations = shared.Annotations(endpoint="http://localhost:6006", dry_run=True)
    generator = shared.Generator(
        endpoint="http://localhost:6006", project_name="test", seed=1, dry_run=True
    )
    with generator.span("root", "CHAIN", root=True) as span:
        annotations.add(span, "helpfulness", score=1.0)
    generator.close()
    annotations.flush()

    assert annotations.count == 1


DATAGEN_DOCS = (
    Path("scripts/README.md"),
    Path("scripts/generate_spans/README.md"),
    Path("scripts/experiments/README.md"),
    Path("scripts/generate_data_via_plpgsql/README.md"),
)


def _documented_commands() -> list[tuple[str, list[str]]]:
    """Every runnable example in the datagen READMEs, as (scenario-or-path, args)."""
    root = Path(shared.__file__).parents[2]
    text = "\n".join((root / doc).read_text() for doc in DATAGEN_DOCS)
    text = re.sub(r"\\\n\s*", " ", text)  # join shell line continuations
    found: list[tuple[str, list[str]]] = []
    for match in re.finditer(r"(?:uv run )?python -m scripts\.generate_spans ([^\n#]*)", text):
        argstr = match.group(1).strip()
        if not argstr or "<" in argstr or argstr.startswith("--help"):
            continue
        parts = shlex.split(argstr)
        found.append((parts[0], parts[1:]))
    for match in re.finditer(r"(?:uv run )?python (scripts/[\w/]+\.py)([^\n#]*)", text):
        path, argstr = match.group(1), match.group(2).strip()
        if "<" in path or "<" in argstr:
            continue
        found.append((path, shlex.split(argstr)))
    return found


@pytest.mark.parametrize(
    ("target", "args"), _documented_commands(), ids=lambda v: v if isinstance(v, str) else None
)
def test_documented_example_commands_still_parse(target: str, args: list[str]) -> None:
    """A copy-pasteable example that no longer parses is worse than no example.

    Renaming or dropping a flag breaks the READMEs silently — nothing else reads them.
    """
    if target.endswith(".py"):
        module = importlib.import_module(target.replace("/", ".").removesuffix(".py"))
    elif target == "all":
        module = generate_all
    else:
        assert target in registry.SCENARIOS, f"README references unknown scenario {target!r}"
        module = importlib.import_module(registry.SCENARIOS[target][1].__module__)

    parser = module.build_parser()
    with contextlib.redirect_stderr(io.StringIO()):
        parser.parse_args(args)  # SystemExit here means the documented flags are stale


def test_every_scenario_has_a_row_in_the_readme_table() -> None:
    """Step 6 of the README's own contract, which nothing else checks.

    A scenario missing from the table still runs and still passes every other test — it is
    just invisible to anyone deciding which fixture to use.
    """
    readme = (SCENARIO_DIR / "README.md").read_text()
    section = readme.split("## Scenarios", 1)[1].split("\n## ", 1)[0]
    documented = set(re.findall(r"^\| `([a-z][a-z-]*)` \|", section, re.M))

    assert set(registry.SCENARIOS) <= documented, (
        f"scenarios missing from the README table: {sorted(set(registry.SCENARIOS) - documented)}"
    )
    assert documented <= set(registry.SCENARIOS), (
        f"README table lists scenarios that do not exist: "
        f"{sorted(documented - set(registry.SCENARIOS))}"
    )


@pytest.mark.parametrize("scenario", tuple(registry.SCENARIOS))
def test_documented_defaults_match_the_real_defaults(scenario: str) -> None:
    """`(default: N)` is hand-written and silently rots when a default changes.

    Flags defaulting to None are exempt: their help describes the effective behaviour
    ("current time", "all") rather than the literal, which is the more useful thing to say.
    """
    module = importlib.import_module(registry.SCENARIOS[scenario][1].__module__)

    mismatches = []
    for action in module.build_parser()._actions:
        if not action.help or not action.option_strings or action.default is None:
            continue
        claimed = re.search(r"\(default:\s*([^)]+)\)", action.help)
        if not claimed:
            continue
        text = claimed.group(1).strip()
        try:
            matches = float(text) == float(action.default)
        except (TypeError, ValueError):
            matches = text == str(action.default)
        if not matches:
            mismatches.append(f"{action.option_strings[0]}: says {text!r}, is {action.default!r}")

    assert not mismatches, f"{scenario} help text disagrees with its defaults: {mismatches}"


@pytest.mark.parametrize("scenario", tuple(registry.SCENARIOS))
def test_every_flag_documents_itself(scenario: str) -> None:
    """`--help` is the only documentation an agent reads before choosing arguments.

    27% of scenario flags once had none, so `--help` listed a name and a type and left the
    reader to guess. Shared flags are described once in add_common_arguments.
    """
    module = importlib.import_module(registry.SCENARIOS[scenario][1].__module__)
    shared_flags = {"--endpoint", "--project-name", "--seed", "--dry-run", "--no-preflight"}

    undocumented = [
        action.option_strings[0]
        for action in module.build_parser()._actions
        if action.option_strings
        and not set(action.option_strings) & (shared_flags | {"--help"})
        and not action.help
    ]
    assert not undocumented, f"{scenario} has flags with no help text: {undocumented}"


@pytest.mark.parametrize("scenario", tuple(registry.SCENARIOS))
def test_every_registered_scenario_runs_with_its_defaults(
    scenario: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Guards the registration seam: a scenario in SCENARIOS must be runnable as shipped."""
    assert cli.main([scenario, "--dry-run"]) == 0

    summary = dict(
        line.split("=", 1) for line in capsys.readouterr().out.splitlines() if "=" in line
    )
    assert summary["dry_run"] == "true"
    assert int(summary["spans"]) > 0
    assert int(summary["traces"]) > 0, "root=True is missing from the scenario's outermost span"


@pytest.mark.parametrize("command", tuple(cli.COMMANDS))
def test_every_command_accepts_the_flags_make_seed_passes(
    command: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """`make seed` always passes --endpoint/--seed/--dry-run, plus --project-name when set.

    A command that rejects any of them breaks the documented Makefile path, which is not
    exercised by running the scenario directly.
    """
    argv = [
        command,
        "--endpoint",
        "http://localhost:6006",
        "--seed",
        "7",
        "--project-name",
        "seedtest",
        "--dry-run",
    ]
    if command == "all":
        argv += ["--only", "nested"]

    assert cli.main(argv) == 0
    assert "seedtest" in capsys.readouterr().out


SCENARIO_DIR = Path(shared.__file__).parent
EXPERIMENTS_DIR = Path(experiment_data.__file__).parent


@pytest.mark.parametrize(
    "script",
    sorted(
        str(path)
        for directory in (SCENARIO_DIR, EXPERIMENTS_DIR)
        for path in directory.glob("*.py")
    ),
    ids=lambda p: f"{Path(p).parent.name}/{Path(p).name}",
)
def test_dual_import_branches_list_identical_names(script: str) -> None:
    """Static counterpart to the subprocess test, naming the drifted symbol directly.

    Both halves of `try: from ._shared … except ImportError: from _shared …` must import the
    same names. A missing name in the fallback is valid Python that imports cleanly under
    `-m` and dies with a NameError only when the file is run directly. Both datagen packages
    use the idiom, so both are checked.
    """
    import ast

    tree = ast.parse(Path(script).read_text())
    for node in ast.walk(tree):
        if not isinstance(node, ast.Try):
            continue
        primary = {
            alias.name
            for stmt in node.body
            if isinstance(stmt, ast.ImportFrom)
            for alias in stmt.names
        }
        fallback = {
            alias.name
            for handler in node.handlers
            for stmt in handler.body
            if isinstance(stmt, ast.ImportFrom)
            for alias in stmt.names
        }
        if primary and fallback:
            assert primary == fallback, (
                f"{script}: dual-import branches disagree on {sorted(primary ^ fallback)}"
            )


@pytest.mark.parametrize(
    "script",
    sorted(path.stem for path in SCENARIO_DIR.glob("generate_*.py") if path.stem != "generate_all"),
)
def test_every_scenario_file_is_registered_and_exposes_the_entry_points(script: str) -> None:
    """Steps 3 and 5 of the README's 'Adding a scenario' contract, machine-checked."""
    module = importlib.import_module(f"scripts.generate_spans.{script}")

    for entry_point in ("build_parser", "generate", "main"):
        assert callable(getattr(module, entry_point, None)), f"{script} lacks {entry_point}()"

    registered = {main.__module__ for _description, main in registry.SCENARIOS.values()}
    assert f"scripts.generate_spans.{script}" in registered, (
        f"{script} exists but is not in _registry.SCENARIOS, so nothing runs or tests it"
    )


@pytest.mark.parametrize(
    "script", sorted(path.name for path in EXPERIMENTS_DIR.glob("generate_*.py"))
)
def test_experiment_scripts_run_when_executed_directly(script: str) -> None:
    """Same dual-import contract as the span scenarios, with the same silent drift risk."""
    completed = subprocess.run(
        [sys.executable, script, "--dry-run", "--examples", "3"],
        cwd=EXPERIMENTS_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )

    assert completed.returncode == 0, f"{script} failed directly:\n{completed.stderr[-1500:]}"


@pytest.mark.parametrize("script", sorted(path.name for path in SCENARIO_DIR.glob("generate_*.py")))
def test_scenario_files_run_when_executed_directly(script: str) -> None:
    """The dual-import idiom exists so these files work outside the package; prove it does.

    Running as a subprocess is the only way to exercise the `except ImportError` fallback —
    and it has to actually generate, not just import, because a fallback list that drifts from
    the primary one imports cleanly and fails later with a NameError.
    """
    completed = subprocess.run(
        [sys.executable, script, "--dry-run"],
        cwd=SCENARIO_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )

    assert completed.returncode == 0, f"{script} failed directly:\n{completed.stderr[-1500:]}"


def test_shared_does_not_import_phoenix_client_at_module_scope() -> None:
    """PEP 723 scripts import `_shared` without declaring arize-phoenix-client.

    `generate_token_detail_spans.py` declares only the OpenTelemetry and semconv packages, yet
    imports `_shared`. That works solely because `_shared` defers `from phoenix.client import
    Client` into `Annotations.__init__`. Hoisting it to module scope would break those scripts
    under `uv run` while leaving every in-project test green.
    """
    completed = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys, _shared; print(sorted(m for m in sys.modules if m.startswith('phoenix')))",
        ],
        cwd=SCENARIO_DIR,
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert completed.returncode == 0, completed.stderr[-1000:]
    assert completed.stdout.strip() == "[]", (
        f"_shared now imports phoenix at module scope: {completed.stdout.strip()}"
    )


@pytest.mark.parametrize(
    "script",
    sorted(
        path.name
        for path in SCENARIO_DIR.glob("generate_*.py")
        if path.read_text().startswith("# /// script")
    ),
)
def test_pep723_scripts_declare_every_third_party_import(script: str) -> None:
    """A PEP 723 block is a promise about an isolated environment; keep it honest."""
    source = (SCENARIO_DIR / script).read_text()
    block = source.partition("# ///\n")[0]
    declared = {
        line.strip().strip('#" ,')
        for line in block.splitlines()
        if '"' in line and "dependencies" not in line
    }
    distributions = {
        "opentelemetry": {"opentelemetry-sdk", "opentelemetry-exporter-otlp"},
        "openinference": {"openinference-semantic-conventions"},
        "phoenix": {"arize-phoenix-client"},
    }
    imported_roots = {
        line.split()[1].split(".")[0]
        for line in source.splitlines()
        if line.startswith(("from ", "import ")) and not line.startswith(("from .", "from _"))
    }

    for root, candidates in distributions.items():
        if root in imported_roots:
            assert declared & candidates, (
                f"{script} imports {root} but declares none of {candidates}"
            )


def test_all_namespaces_projects_by_prefix(capsys: pytest.CaptureFixture[str]) -> None:
    assert cli.main(["all", "--dry-run", "--project-name", "demo", "--only", "rag,agent"]) == 0
    output = capsys.readouterr().out

    assert "project=demo-rag" in output
    assert "project=demo-agent" in output


def test_all_runs_every_scenario_and_honours_subsetting(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert cli.main(["all", "--dry-run"]) == 0
    output = capsys.readouterr().out
    for scenario in registry.SCENARIOS:
        assert f"=== {scenario} ===" in output
    assert "scenarios_failed=0" in output

    assert cli.main(["all", "--dry-run", "--only", "rag,agent", "--exclude", "agent"]) == 0
    output = capsys.readouterr().out
    assert "=== rag ===" in output
    assert "=== agent ===" not in output
    assert "scenarios_run=1" in output


def test_all_reports_failures_without_hiding_the_remaining_scenarios(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def explode(argv: list[str] | None) -> int:
        raise RuntimeError("synthetic scenario failure")

    monkeypatch.setattr(
        generate_all,
        "SCENARIOS",
        {"boom": ("fails", explode), "fine": ("works", registry.SCENARIOS["nested"][1])},
    )

    assert generate_all.main(["--dry-run", "--keep-going"]) == 1
    output = capsys.readouterr().out
    assert "synthetic scenario failure" in output
    assert "=== fine ===" in output, "--keep-going must still run later scenarios"
    assert "failed=boom" in output


def test_unreachable_endpoint_fails_fast_instead_of_retrying_every_span(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """SimpleSpanProcessor retries each span with backoff, so a dead endpoint must fail up front."""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        closed_port = probe.getsockname()[1]

    assert cli.main(["nested", "--endpoint", f"http://127.0.0.1:{closed_port}"]) == 2
    error = capsys.readouterr().err
    assert "nothing is listening" in error
    assert "--dry-run" in error, "the message must say how to proceed without a server"

    with pytest.raises(ConnectionError):
        shared.check_reachable(f"http://127.0.0.1:{closed_port}", timeout=0.5)


def test_preflight_can_be_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = SimpleNamespace(
        endpoint="http://127.0.0.1:1",
        project_name="test",
        seed=1,
        dry_run=False,
        no_preflight=True,
    )

    generator = shared.Generator.from_args(args)
    generator.close()


ANNOTATION_SCENARIOS = ("agent", "sessions", "prompts", "rag", "time-series")


@pytest.mark.parametrize("scenario", ANNOTATION_SCENARIOS)
def test_annotation_rate_is_a_probability_everywhere(
    scenario: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Same flag name must mean the same thing in every scenario that offers it.

    `agent` and `sessions` originally wired --annotation-rate only to the Annotations
    constructor, so 0 disabled annotations but 0.5 still annotated everything — a flag that
    silently ignored its own value.
    """

    def annotations_at(rate: str) -> int:
        argv = [scenario, "--dry-run", "--annotation-rate", rate, "--seed", "5"]
        if scenario == "time-series":
            argv += ["--days", "1"]
        assert cli.main(argv) == 0
        summary = dict(
            line.split("=", 1)
            for line in capsys.readouterr().out.splitlines()
            if "=" in line and line.count("=") == 1
        )
        return sum(
            int(value) for key, value in summary.items() if "annotation" in key and value.isdigit()
        )

    full = annotations_at("1.0")
    assert full > 0, f"{scenario} emits no annotations at rate 1.0"
    assert annotations_at("0.0") == 0, f"{scenario} still annotates at rate 0"
    half = annotations_at("0.5")
    assert 0 < half < full, f"{scenario} ignores fractional rates: {half} vs {full}"


def test_unknown_scenario_is_rejected_without_a_traceback(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert cli.main(["not-a-scenario"]) == 2
    assert "unknown scenario" in capsys.readouterr().err


# Semantic-convention attributes the package deliberately never emits, and why. Anything not
# listed here must be emitted by some scenario — see the coverage test below.
UNEMITTED_BY_DESIGN = {
    # Phoenix computes cost from token counts and its model cost manifest. Emitting cost
    # attributes would either duplicate or contradict that calculation.
    **{
        f"llm.cost.{suffix}": "computed by Phoenix, not reported by instrumentation"
        for suffix in (
            "completion",
            "completion_details",
            "completion_details.audio",
            "completion_details.output",
            "completion_details.reasoning",
            "prompt",
            "prompt_details",
            "prompt_details.audio",
            "prompt_details.cache_input",
            "prompt_details.cache_read",
            "prompt_details.cache_write",
            "prompt_details.input",
            "total",
        )
    },
    # Legacy OpenAI function-calling, superseded by tool calls, which `agent` emits.
    "llm.function_call": "deprecated in favour of llm.tools / tool_calls",
    "message.function_call_name": "deprecated in favour of tool_calls",
    "message.function_call_arguments_json": "deprecated in favour of tool_calls",
    # Provider-specific reasoning plumbing with no Phoenix UI surface.
    "message_content.encrypted_content": "provider-specific reasoning block",
    "message_content.id": "provider-specific reasoning block",
    "message_content.signature": "provider-specific reasoning block",
    "tool_call.reasoning_signature": "provider-specific reasoning block",
    # Non-chat completion shape; every scenario models chat completions.
    "llm.prompts": "raw completion prompts; scenarios model chat completions",
    "llm.choices": "raw completion choices; scenarios model chat completions",
    "completion.text": "raw completion choices; scenarios model chat completions",
    # Audio *content* blocks. `token-details` covers audio token accounting, which is the part
    # Phoenix aggregates; the content blocks themselves are not yet modelled.
    "audio.url": "audio content blocks not modelled; audio tokens are",
    "audio.mime_type": "audio content blocks not modelled; audio tokens are",
    "audio.transcript": "audio content blocks not modelled; audio tokens are",
    "embedding.invocation_parameters": "no Phoenix UI surface",
    "message.name": "no Phoenix UI surface",
    "prompt.text": "prompt registry linkage uses prompt.id / prompt.url",
    "llm.token_count.prompt_details.cache_input": "newer alias; cache_read/cache_write emitted",
}


@pytest.fixture(scope="module")
def every_scenario_span() -> list[ReadableSpan]:
    """Every span every scenario produces, generated once and shared by the sweep tests."""
    spans: list[ReadableSpan] = []
    original = shared.OTLPSpanExporter
    try:
        for name, (_, scenario_main) in registry.SCENARIOS.items():
            exporter = InMemorySpanExporter()
            shared.OTLPSpanExporter = lambda endpoint, headers=None, _e=exporter: _e
            argv = ["--seed", "3", "--no-preflight"]
            if name == "time-series":
                argv += ["--days", "1"]
            if name in {"time-series", "rag", "prompts", "agent", "sessions"}:
                argv += ["--annotation-rate", "0"]
            assert scenario_main(argv) == 0
            spans.extend(exporter.get_finished_spans())
    finally:
        shared.OTLPSpanExporter = original
    return spans


def test_no_scenario_silently_truncates_a_span(every_scenario_span: list[ReadableSpan]) -> None:
    """OpenTelemetry drops attributes, events and links past its limits without erroring.

    `edge-cases` was the only scenario checked for this; the limits are global, so the sweep
    is what actually protects the package.
    """
    assert every_scenario_span
    truncated = [
        (span.name, span.dropped_attributes, span.dropped_events, span.dropped_links)
        for span in every_scenario_span
        if span.dropped_attributes or span.dropped_events or span.dropped_links
    ]
    assert not truncated, f"spans exceeded SPAN_LIMITS: {truncated[:5]}"
    # Guard against passing vacuously: some scenario must exceed the 128 default, or raising
    # SPAN_LIMITS was pointless and this test proves nothing.
    widest = max(len(span.attributes) for span in every_scenario_span)
    assert widest > 128, f"widest span has only {widest} attributes"


def test_semconv_attribute_coverage_is_accounted_for(
    every_scenario_span: list[ReadableSpan],
) -> None:
    """Every OpenInference attribute is either emitted somewhere or excluded on purpose.

    This is the drift alarm: when OpenInference adds an attribute, this fails and somebody
    decides whether a scenario should emit it, rather than the gap going unnoticed.
    """
    import openinference.semconv.trace as semconv

    emitted: set[str] = set()
    for span in every_scenario_span:
        emitted.update(span.attributes)

    normalized = {re.sub(r"\.\d+\.", ".N.", key) for key in emitted}
    defined = {
        value
        for cls_name in dir(semconv)
        if isinstance(cls := getattr(semconv, cls_name), type) and cls_name.endswith("Attributes")
        for key, value in vars(cls).items()
        if isinstance(value, str) and not key.startswith("_")
    }

    unemitted = {value for value in defined if not any(value in key for key in normalized)}
    assert unemitted == set(UNEMITTED_BY_DESIGN), (
        "semconv coverage drifted — newly unemitted: "
        f"{sorted(unemitted - set(UNEMITTED_BY_DESIGN))}; "
        f"now emitted (drop from the exclusion list): "
        f"{sorted(set(UNEMITTED_BY_DESIGN) - unemitted)}"
    )


def test_large_session_spans_realistic_wall_clock_time(monkeypatch: pytest.MonkeyPatch) -> None:
    """500 turns once fitted inside 9 milliseconds, in the scenario built to stress sessions.

    Session duration is a first-class column in that view, so a long conversation has to look
    long: turns separated by think time, ordered, and ending about now.
    """
    large_session = importlib.import_module(
        "scripts.generate_spans.generate_spans_for_large_session"
    )
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = large_session.build_parser().parse_args(
        ["--turns", "200", "--seed", "3", "--no-preflight"]
    )
    large_session.generate(args).close()

    turns = sorted(exporter.get_finished_spans(), key=lambda span: span.start_time)
    assert len(turns) == 200
    elapsed = (turns[-1].end_time - turns[0].start_time) / 1e9
    assert elapsed > 3600, f"200 turns should span hours, not {elapsed:.1f}s"

    now = shared.utc_now().timestamp() * 1e9
    assert turns[-1].end_time <= now + 1e9, "the conversation must be backdated, not future"
    # A conversation is sequential: one turn finishes before the next begins.
    for earlier, later in zip(turns, turns[1:]):
        assert earlier.end_time <= later.start_time


def test_mixed_spans_have_real_nested_durations(monkeypatch: pytest.MonkeyPatch) -> None:
    """`mixed` is the `make seed` default and every span in it used to last microseconds.

    A waterfall over instant spans shows nothing, so the tree is now planned before it is
    emitted: a parent's duration is the work beneath it, and children sit inside its window.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = mixed.build_parser().parse_args(["--traces", "120", "--seed", "3", "--no-preflight"])
    mixed.generate(args).close()
    spans = exporter.get_finished_spans()

    durations = sorted((span.end_time - span.start_time) / 1e9 for span in spans)
    assert durations[len(durations) // 2] > 0.01, "median span is still effectively instant"
    assert durations[-1] > 1.0, "no span takes a visible amount of time"

    by_id = {span.context.span_id: span for span in spans}
    for span in spans:
        if span.parent and span.parent.span_id in by_id:
            parent = by_id[span.parent.span_id]
            assert parent.start_time <= span.start_time, span.name
            assert span.end_time <= parent.end_time, span.name


def test_mixed_covers_every_openinference_span_kind(monkeypatch: pytest.MonkeyPatch) -> None:
    """`mixed` is the all-kinds coverage fixture, so it must not quietly fall behind semconv."""
    from openinference.semconv.trace import OpenInferenceSpanKindValues

    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = mixed.build_parser().parse_args(["--traces", "300", "--seed", "13", "--no-preflight"])
    generator = mixed.generate(args)
    generator.close()

    emitted = {span.attributes["openinference.span.kind"] for span in exporter.get_finished_spans()}
    defined = {kind.value for kind in OpenInferenceSpanKindValues}
    # UNKNOWN is a fallback Phoenix assigns, not something a scenario emits on purpose.
    assert emitted == defined - {"UNKNOWN"}


def test_phoenix_and_openinference_span_kinds_agree() -> None:
    """`mixed` emits every OpenInference kind, but Phoenix validates against its own enum.

    A kind Phoenix does not recognize is coerced to UNKNOWN silently rather than rejected, so
    drift between the two enums would quietly degrade the fixture instead of failing.
    """
    from openinference.semconv.trace import OpenInferenceSpanKindValues

    from phoenix.trace.schemas import SpanKind

    assert {kind.value for kind in SpanKind} == {kind.value for kind in OpenInferenceSpanKindValues}


def test_malformed_span_kind_cannot_be_coerced_to_a_valid_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Phoenix upper-cases unrecognized ASCII kinds, so the fuzz value must defeat that."""
    from phoenix.trace.schemas import SpanKind

    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = mixed.build_parser().parse_args(
        ["--traces", "20", "--malformed-rate", "1", "--max-depth", "1", "--no-preflight"]
    )
    generator = mixed.generate(args)
    generator.close()

    kinds = {span.attributes["openinference.span.kind"] for span in exporter.get_finished_spans()}
    assert len(kinds) == 1
    malformed = kinds.pop()
    assert SpanKind(malformed) is SpanKind.UNKNOWN


def test_better_prompt_version_also_costs_more(monkeypatch: pytest.MonkeyPatch) -> None:
    """A version comparison is only half a question if both versions cost the same.

    v2's template is three times longer, but prompt tokens came from the model's typical
    usage and ignored it entirely — so "is the better prompt worth the tokens?" had no answer
    in the data. Only the prompt side scales: the instructions grew, not the answer.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = prompts.build_parser().parse_args(
        ["--traces", "400", "--seed", "5", "--no-preflight", "--annotation-rate", "0"]
    )
    generator, _annotations, _tally = prompts.generate(args)
    generator.close()
    spans = exporter.get_finished_spans()

    by_version: dict[str, list[int]] = {"v1": [], "v2": []}
    for span in spans:
        version = span.attributes.get("llm.prompt_template.version")
        if version:
            by_version[version].append(span.attributes["llm.token_count.prompt"])
    assert by_version["v1"] and by_version["v2"]

    median_v1 = sorted(by_version["v1"])[len(by_version["v1"]) // 2]
    median_v2 = sorted(by_version["v2"])[len(by_version["v2"]) // 2]
    assert median_v2 > median_v1 * 1.15, (median_v1, median_v2)

    # Scaling the prompt must not break the arithmetic the cost views depend on.
    for span in spans:
        if "llm.token_count.total" in span.attributes:
            assert (
                span.attributes["llm.token_count.total"]
                == span.attributes["llm.token_count.prompt"]
                + span.attributes["llm.token_count.completion"]
            )


def test_prompt_version_two_measurably_outperforms_version_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A version comparison fixture is worthless if the versions score the same."""
    exporter = InMemorySpanExporter()
    logged: list[dict[str, object]] = []

    class FakeSpans:
        @staticmethod
        def log_span_annotations(*, span_annotations: list[dict[str, object]]) -> None:
            logged.extend(span_annotations)

    class FakeClient:
        def __init__(self, base_url: str) -> None:
            self.spans = FakeSpans()

    monkeypatch.setattr("phoenix.client.Client", FakeClient)
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = prompts.build_parser().parse_args(["--traces", "200", "--seed", "5", "--no-preflight"])
    generator, annotations, tally = prompts.generate(args)
    generator.close()

    assert annotations.count == 200
    by_version: dict[str, list[float]] = {"v1": [], "v2": []}
    for annotation in logged:
        by_version[annotation["metadata"]["prompt_version"]].append(annotation["result"]["score"])
    assert by_version["v1"] and by_version["v2"]
    mean = {key: sum(values) / len(values) for key, values in by_version.items()}
    assert mean["v2"] > mean["v1"] + 0.25, mean

    # Every rendered span must carry the template, its variables, and the version it used.
    llm_spans = [span for span in exporter.get_finished_spans() if span.name == "chat-completion"]
    assert len(llm_spans) == 200
    for span in llm_spans:
        assert span.attributes["llm.prompt_template.template"]
        assert json.loads(span.attributes["llm.prompt_template.variables"])
        assert span.attributes["llm.prompt_template.version"] in {"v1", "v2"}

    # The unrendered template must keep its placeholders; the rendered input must not.
    templated = next(
        span for span in llm_spans if span.attributes["llm.prompt_template.version"] == "v2"
    )
    assert "{" in templated.attributes["llm.prompt_template.template"]


def _capture_annotations(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[dict[str, object]]]:
    """Route every annotation flavour into a dict of sinks keyed by target."""
    sinks: dict[str, list[dict[str, object]]] = {"span": [], "trace": [], "session": []}

    class FakeSpans:
        @staticmethod
        def log_span_annotations(*, span_annotations: list[dict[str, object]]) -> None:
            sinks["span"].extend(span_annotations)

        @staticmethod
        def log_document_annotations(*, document_annotations: list[dict[str, object]]) -> None:
            pass

        @staticmethod
        def add_span_note(*, span_id: str, note: str) -> None:
            pass

    class FakeTraces:
        @staticmethod
        def log_trace_annotations(*, trace_annotations: list[dict[str, object]]) -> None:
            sinks["trace"].extend(trace_annotations)

    class FakeSessions:
        @staticmethod
        def log_session_annotations(*, session_annotations: list[dict[str, object]]) -> None:
            sinks["session"].extend(session_annotations)

    class FakeClient:
        def __init__(self, base_url: str) -> None:
            self.spans, self.traces, self.sessions = FakeSpans(), FakeTraces(), FakeSessions()

    monkeypatch.setattr("phoenix.client.Client", FakeClient)
    return sinks


def test_tools_differ_in_latency_and_reliability(monkeypatch: pytest.MonkeyPatch) -> None:
    """ "Which tool is slow?" and "which tool is unreliable?" are why an agent view exists.

    Every tool once drew from the same latency range and the same flat error rate, so both
    questions returned four indistinguishable answers. They also must not have the *same*
    answer: a warehouse query is slow, a third-party API is flaky, and conflating them would
    let one glance stand in for both.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = agent_tool_calls.build_parser().parse_args(
        ["--traces", "300", "--seed", "5", "--no-preflight", "--annotation-rate", "0"]
    )
    generator, _annotations, _calls, _failures = agent_tool_calls.generate(args)
    generator.close()

    durations: dict[str, list[float]] = {}
    failures: dict[str, list[bool]] = {}
    for span in exporter.get_finished_spans():
        if span.attributes.get("openinference.span.kind") != "TOOL":
            continue
        if json.loads(span.attributes["metadata"])["attempt"] != 1:
            continue
        name = span.attributes["tool.name"]
        durations.setdefault(name, []).append((span.end_time - span.start_time) / 1e9)
        failures.setdefault(name, []).append(span.status.status_code is StatusCode.ERROR)

    assert len(durations) == len(agent_tool_calls.TOOLS)
    median = {name: sorted(values)[len(values) // 2] for name, values in durations.items()}
    rate = {name: sum(values) / len(values) for name, values in failures.items()}

    assert max(median.values()) > min(median.values()) * 5, median
    assert max(rate.values()) > min(rate.values()) * 3, rate
    # The slowest tool is not also the flakiest, so the two questions stay distinct.
    assert max(median, key=median.get) != max(rate, key=rate.get)


def test_parallel_tool_calls_actually_overlap(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--parallel-tool-calls` says "at once"; the spans used to run strictly end to end.

    Across every scenario, not one of 1,451 adjacent sibling pairs overlapped in time, so a
    waterfall never had to render concurrency. Retries are the exception — a retry follows the
    call it is retrying, so those pairs stay sequential.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = agent_tool_calls.build_parser().parse_args(
        ["--traces", "60", "--seed", "5", "--no-preflight", "--annotation-rate", "0"]
    )
    generator, _annotations, _calls, _failures = agent_tool_calls.generate(args)
    generator.close()

    # Group by the LLM step that requested them, not by parent span: every tool call in a run
    # shares the AGENT root as its parent, so grouping by parent mixes separate fan-outs.
    siblings: dict[tuple[int, str], list[ReadableSpan]] = {}
    for span in exporter.get_finished_spans():
        if span.attributes["openinference.span.kind"] == "TOOL":
            step = span.attributes["graph.node.parent_id"]
            siblings.setdefault((span.context.trace_id, step), []).append(span)

    # State the invariant directly rather than counting: calls the model requested together
    # (attempt 1) are dispatched together, so they all start at the same instant. A retry is a
    # consequence of one of them failing, so it must begin after the call it retries ends.
    fan_outs = retries = 0
    for group in siblings.values():
        first_attempts = [
            span for span in group if json.loads(span.attributes["metadata"])["attempt"] == 1
        ]
        if len(first_attempts) > 1:
            fan_outs += 1
            starts = {span.start_time for span in first_attempts}
            assert len(starts) == 1, "concurrent calls must share a start, not run end to end"

        by_call: dict[str, list[ReadableSpan]] = {}
        for span in group:
            by_call.setdefault(span.attributes["tool.id"], []).append(span)
        for attempts in by_call.values():
            if len(attempts) == 2:
                retries += 1
                original, retry = sorted(
                    attempts, key=lambda span: json.loads(span.attributes["metadata"])["attempt"]
                )
                assert retry.start_time >= original.end_time, "a retry cannot precede its call"

    assert fan_outs, "no step requested more than one tool, so concurrency is untested"
    assert retries, "no tool call was retried, so the retry ordering is untested"


def test_agent_retries_every_failed_tool_call_once(monkeypatch: pytest.MonkeyPatch) -> None:
    """--tool-error-rate has always promised a retry; it did not happen until now.

    A retried call shares its tool.id with the original, so the two attempts correlate as one
    logical call and are told apart by metadata.attempt.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = agent_tool_calls.build_parser().parse_args(
        ["--traces", "150", "--seed", "5", "--no-preflight", "--annotation-rate", "0"]
    )
    generator, _annotations, _calls, _failures = agent_tool_calls.generate(args)
    generator.close()

    tools = [
        span
        for span in exporter.get_finished_spans()
        if span.attributes["openinference.span.kind"] == "TOOL"
    ]
    by_call: dict[tuple[int, str], list[ReadableSpan]] = {}
    for span in tools:
        by_call.setdefault((span.context.trace_id, span.attributes["tool.id"]), []).append(span)

    failed_first = [
        spans for spans in by_call.values() if spans[0].status.status_code is StatusCode.ERROR
    ]
    assert failed_first, "seed produced no tool failures, so the retry path is untested"
    for spans in by_call.values():
        attempts = [json.loads(span.attributes["metadata"])["attempt"] for span in spans]
        # Exactly one retry, and only after a failure.
        expected = [1, 2] if spans[0].status.status_code is StatusCode.ERROR else [1]
        assert attempts == expected

    recovered = sum(1 for spans in failed_first if spans[1].status.status_code is StatusCode.OK)
    assert 0 < recovered < len(failed_first), "retries should mostly, but not always, succeed"


def test_agent_task_completion_degrades_with_tool_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The README requires eval scores to correlate with a cause; agent was not asserting it."""
    sinks = _capture_annotations(monkeypatch)
    monkeypatch.setattr(
        shared, "OTLPSpanExporter", lambda endpoint, headers=None: InMemorySpanExporter()
    )
    args = agent_tool_calls.build_parser().parse_args(
        ["--traces", "300", "--seed", "5", "--no-preflight"]
    )
    generator, annotations, _calls, _failures = agent_tool_calls.generate(args)
    generator.close()

    assert annotations.trace_count == 300
    completion = {True: [], False: []}
    for annotation in sinks["trace"]:
        assert annotation["name"] == "task_completion"
        had_failures = annotation["metadata"]["tool_failures"] > 0
        completion[had_failures].append(annotation["result"]["score"])

    assert completion[True] and completion[False]
    clean_rate = sum(completion[False]) / len(completion[False])
    failed_rate = sum(completion[True]) / len(completion[True])
    assert clean_rate > failed_rate, (clean_rate, failed_rate)
    # Tool errors must not be the *only* way a run fails — a fixture where clean runs always
    # succeed implies every agent failure is visible as a failed span, which is not true.
    assert 0.0 < clean_rate < 1.0, clean_rate


@pytest.mark.parametrize("seed", ("5", "17", "99"))
def test_user_experience_is_a_stable_property_of_the_user(
    seed: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "Which user is having a bad time?" needs the answer to be the same user each run.

    All twelve users once drew from one error rate, so the question returned twelve identical
    answers. Drawing a cohort per *session* would have been just as useless — a person has to
    behave like themselves every time they appear, or per-user analysis is still noise.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = sessions.build_parser().parse_args(
        ["--sessions", "500", "--seed", seed, "--no-preflight", "--annotation-rate", "0"]
    )
    generator, _annotations, _histogram = sessions.generate(args)
    generator.close()

    turns: dict[str, int] = {}
    errors: dict[str, int] = {}
    for span in exporter.get_finished_spans():
        user = span.attributes.get("user.id")
        if user is None:
            continue
        if span.name == "conversation-turn":
            turns[user] = turns.get(user, 0) + 1
        elif span.status.status_code is StatusCode.ERROR:
            errors[user] = errors.get(user, 0) + 1

    rates = {user: errors.get(user, 0) / count for user, count in turns.items()}
    assert max(rates.values()) > min(rates.values()) * 3, rates
    # The same users are affected regardless of seed: the cohort belongs to the user, not the
    # run. A per-session draw would still spread these two sets around.
    assert set(sorted(rates, key=rates.get, reverse=True)[:2]) == {"user-001", "user-007"}
    assert set(sorted(rates, key=rates.get)[:2]) == {"user-004", "user-010"}


def test_session_satisfaction_tracks_errored_turns(monkeypatch: pytest.MonkeyPatch) -> None:
    sinks = _capture_annotations(monkeypatch)
    monkeypatch.setattr(
        shared, "OTLPSpanExporter", lambda endpoint, headers=None: InMemorySpanExporter()
    )
    args = sessions.build_parser().parse_args(
        ["--sessions", "200", "--seed", "5", "--no-preflight"]
    )
    generator, annotations, _histogram = sessions.generate(args)
    generator.close()

    assert annotations.session_count == 200
    scores = {True: [], False: []}
    for annotation in sinks["session"]:
        assert annotation["name"] == "user_satisfaction"
        scores[annotation["metadata"]["errored_turns"] > 0].append(annotation["result"]["score"])

    assert scores[True] and scores[False]
    clean = sum(scores[False]) / len(scores[False])
    errored = sum(scores[True]) / len(scores[True])
    assert clean > errored + 0.2, (clean, errored)


def test_rag_answer_quality_tracks_retrieval_quality(monkeypatch: pytest.MonkeyPatch) -> None:
    """The fixture is only useful if the RAG triad correlates; uncorrelated noise is a bug."""
    exporter = InMemorySpanExporter()
    logged_spans: list[dict[str, object]] = []
    logged_documents: list[dict[str, object]] = []
    logged_notes: list[tuple[str, str]] = []

    class FakeSpans:
        @staticmethod
        def log_span_annotations(*, span_annotations: list[dict[str, object]]) -> None:
            logged_spans.extend(span_annotations)

        @staticmethod
        def log_document_annotations(*, document_annotations: list[dict[str, object]]) -> None:
            logged_documents.extend(document_annotations)

        @staticmethod
        def add_span_note(*, span_id: str, note: str) -> None:
            logged_notes.append((span_id, note))

    class FakeClient:
        def __init__(self, base_url: str) -> None:
            self.spans = FakeSpans()

    monkeypatch.setattr("phoenix.client.Client", FakeClient)
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = rag.build_parser().parse_args(
        ["--traces", "60", "--top-k", "4", "--seed", "9", "--no-preflight"]
    )
    generator, annotations, outcomes = rag.generate(args)
    generator.close()
    # Mirrors main(): notes are only posted once the spans they reference have been flushed.
    assert annotations.flush_notes() == annotations.note_count
    spans = exporter.get_finished_spans()

    assert outcomes["hit"] and outcomes["miss"], "seed must produce both hits and misses"
    assert annotations.document_count == 60 * 4

    # Notes go through their own endpoint, never the bulk annotation payload.
    assert logged_notes and len(logged_notes) == annotations.note_count
    assert not any(annotation["name"] == "note" for annotation in logged_spans)

    roots = {
        span.context.span_id: json.loads(span.attributes["metadata"])["retrieval_hit"]
        for span in spans
        if span.name == "rag-query"
    }
    hit_by_span_id = {format_span_id(span_id): is_hit for span_id, is_hit in roots.items()}
    correctness: dict[bool, list[float]] = {True: [], False: []}
    for annotation in logged_spans:
        if annotation["name"] == "qa_correctness":
            correctness[hit_by_span_id[annotation["span_id"]]].append(annotation["result"]["score"])
    hit_mean = sum(correctness[True]) / len(correctness[True])
    miss_mean = sum(correctness[False]) / len(correctness[False])
    assert hit_mean > miss_mean + 0.3

    # Document annotations hang off the RETRIEVER span and are addressed by position.
    retriever_to_hit = {
        format_span_id(span.context.span_id): roots[span.parent.span_id]
        for span in spans
        if span.name == "retrieve-documents"
    }
    relevant_per_span: dict[str, int] = {}
    for annotation in logged_documents:
        assert 0 <= annotation["document_position"] < 4
        relevant_per_span.setdefault(annotation["span_id"], 0)
        relevant_per_span[annotation["span_id"]] += annotation["result"]["label"] == "relevant"
    for span_id_hex, relevant_count in relevant_per_span.items():
        assert relevant_count == (1 if retriever_to_hit[span_id_hex] else 0)


def test_rag_topics_differ_in_retrieval_coverage(monkeypatch: pytest.MonkeyPatch) -> None:
    """ "Which topic retrieves worst?" is how you find the doc set that needs re-chunking.

    A flat --miss-rate put every question at ~75%, so the question had four identical answers.
    Per-topic bias must not change what the flag means overall, though: the weights average
    1.0 so --miss-rate still sets the corpus-wide rate.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = rag.build_parser().parse_args(
        ["--traces", "400", "--seed", "5", "--no-preflight", "--annotation-rate", "0"]
    )
    generator, _annotations, _outcomes = rag.generate(args)
    generator.close()

    per_topic: dict[str, list[bool]] = {}
    for span in exporter.get_finished_spans():
        if span.name != "rag-query":
            continue
        hit = json.loads(span.attributes["metadata"])["retrieval_hit"]
        per_topic.setdefault(span.attributes["input.value"], []).append(hit)

    assert len(per_topic) == len(rag.KNOWLEDGE)
    rates = {topic: sum(hits) / len(hits) for topic, hits in per_topic.items()}
    assert max(rates.values()) > min(rates.values()) * 1.4, rates

    overall = sum(sum(hits) for hits in per_topic.values()) / sum(
        len(hits) for hits in per_topic.values()
    )
    assert abs(overall - (1 - args.miss_rate)) < 0.08, (
        f"--miss-rate no longer sets the corpus-wide rate: {overall:.3f}"
    )


def test_rag_pipeline_has_a_realistic_latency_breakdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A RAG waterfall is the canonical view of this pipeline, and it was all hairlines.

    The shape matters as much as the presence of durations: generation dominates retrieval in
    every real pipeline, so a fixture where embedding or retrieval is the long pole would send
    a reader chasing the wrong stage.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = rag.build_parser().parse_args(
        ["--traces", "80", "--seed", "4", "--no-preflight", "--annotation-rate", "0"]
    )
    generator, _annotations, _outcomes = rag.generate(args)
    generator.close()
    spans = exporter.get_finished_spans()

    assert all((span.end_time - span.start_time) / 1e9 > 0.001 for span in spans)
    by_id = {span.context.span_id: span for span in spans}
    for span in spans:
        if span.parent and span.parent.span_id in by_id:
            parent = by_id[span.parent.span_id]
            assert parent.start_time <= span.start_time <= span.end_time <= parent.end_time

    def median(name: str) -> float:
        values = sorted(
            (span.end_time - span.start_time) / 1e9 for span in spans if span.name == name
        )
        return values[len(values) // 2]

    assert median("synthesize-answer") > median("retrieve-documents") * 3
    assert median("retrieve-documents") > median("embed-query")


def test_rag_retrieval_sometimes_buries_the_relevant_document() -> None:
    """If the relevant passage always ranked first, the RERANKER span would be decorative.

    Disjoint score ranges used to guarantee position 0 on every hit, so reranking could never
    demonstrate the thing rerankers exist for.
    """
    generator = shared.Generator(
        endpoint="http://localhost:6006", project_name="test", seed=11, dry_run=True
    )
    positions = Counter()
    promoted = 0
    for index in range(400):
        entry = rag.KNOWLEDGE[index % len(rag.KNOWLEDGE)]
        documents = rag._documents(generator, entry, 4, True)
        position = next(i for i, (_, _, relevant) in enumerate(documents) if relevant)
        positions[position] += 1
        kept = rag._reranked(generator, documents, 2)
        reranked_position = next((i for i, (_, _, relevant) in enumerate(kept) if relevant), None)
        promoted += position > 0 and reranked_position == 0
    generator.close()

    assert positions[0] > 0, "the relevant passage should usually rank first"
    assert sum(count for rank, count in positions.items() if rank > 0) > 0, (
        "it must sometimes be buried, or reranking has nothing to fix"
    )
    assert promoted > 0, "the reranker should sometimes promote a buried passage"


def test_rag_retrieval_returns_distinct_documents() -> None:
    generator = shared.Generator(
        endpoint="http://localhost:6006", project_name="test", seed=4, dry_run=True
    )
    for entry in rag.KNOWLEDGE:
        for hit in (True, False):
            documents = rag._documents(generator, entry, 4, hit)
            assert len({content for content, _, _ in documents}) == 4
            assert [score for _, score, _ in documents] == sorted(
                (score for _, score, _ in documents), reverse=True
            )
            assert sum(relevant for _, _, relevant in documents) == (1 if hit else 0)
    generator.close()


def test_document_attributes_flatten_by_index_and_omit_absent_keys() -> None:
    attributes = shared.document_attributes(
        [
            {"id": "a", "content": "first", "score": 0.9, "metadata": {"rank": 1}},
            {"content": "second"},
        ]
    )

    assert attributes == {
        "retrieval.documents.0.document.id": "a",
        "retrieval.documents.0.document.content": "first",
        "retrieval.documents.0.document.score": 0.9,
        "retrieval.documents.0.document.metadata": '{"rank": 1}',
        "retrieval.documents.1.document.content": "second",
    }
    # A zero score is meaningful and must survive; only absent keys are dropped.
    assert shared.document_attributes([{"score": 0.0}], "reranker.output_documents") == {
        "reranker.output_documents.0.document.score": 0.0
    }


def test_message_attributes_flatten_tool_calls_with_json_arguments() -> None:
    attributes = shared.message_attributes(
        [
            {"role": "user", "content": "hi"},
            {
                "role": "assistant",
                "tool_calls": [
                    {"id": "call_1", "name": "lookup", "arguments": {"id": 7}},
                    {"id": "call_2", "name": "send", "arguments": {}},
                ],
            },
            {"role": "tool", "content": "ok", "tool_call_id": "call_1"},
        ],
        "llm.input_messages",
    )

    assert attributes == {
        "llm.input_messages.0.message.role": "user",
        "llm.input_messages.0.message.content": "hi",
        "llm.input_messages.1.message.role": "assistant",
        "llm.input_messages.1.message.tool_calls.0.tool_call.id": "call_1",
        "llm.input_messages.1.message.tool_calls.0.tool_call.function.name": "lookup",
        "llm.input_messages.1.message.tool_calls.0.tool_call.function.arguments": '{"id": 7}',
        "llm.input_messages.1.message.tool_calls.1.tool_call.id": "call_2",
        "llm.input_messages.1.message.tool_calls.1.tool_call.function.name": "send",
        "llm.input_messages.1.message.tool_calls.1.tool_call.function.arguments": "{}",
        "llm.input_messages.2.message.role": "tool",
        "llm.input_messages.2.message.content": "ok",
        "llm.input_messages.2.message.tool_call_id": "call_1",
    }


def test_wide_spans_are_not_silently_truncated(monkeypatch: pytest.MonkeyPatch) -> None:
    """OpenTelemetry drops attributes past 128 per span by default and reports success anyway."""
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = edge_cases.build_parser().parse_args(["--width", "300", "--no-preflight"])
    generator, _ = edge_cases.generate(args)
    generator.close()
    spans = exporter.get_finished_spans()

    assert all(span.dropped_attributes == 0 for span in spans)
    assert all(span.dropped_events == 0 for span in spans)
    widest = max(spans, key=lambda span: len(span.attributes))
    assert len(widest.attributes) > 128, "fixture no longer exceeds the default limit"


def test_slow_span_hazard_reaches_durations_nothing_else_does(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Every other scenario tops out around 12s, so minutes and hours had no fixture.

    Latency formatting crosses units at 1s, 60s and 3600s; a chart also has to survive one
    span vastly longer than the rest.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = edge_cases.build_parser().parse_args(
        ["--only", "slow-span", "--repeat", "4", "--no-preflight"]
    )
    generator, _names = edge_cases.generate(args)
    generator.close()

    spans = exporter.get_finished_spans()
    durations = sorted((span.end_time - span.start_time) / 1e9 for span in spans)
    assert durations == sorted(float(seconds) for seconds in edge_cases.DURATIONS)
    assert max(durations) >= 3600, "nothing crosses the hours boundary"
    assert min(durations) == 0.0, "instant spans are their own formatting case"

    now = shared.utc_now().timestamp() * 1e9
    for span in spans:
        assert span.end_time <= now + 1e9, "durations must be backdated, not run into the future"
        # The marker is an instruction to the emitter, not data Phoenix should receive.
        assert "synthetic.duration_seconds" not in span.attributes


def test_partial_traces_produce_the_three_documented_shapes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Every other scenario emits whole traces; collectors receive broken ones constantly.

    The three shapes are genuinely different: `missing-middle` must keep its root and lose a
    span beneath it, while the other two lose the root itself. An earlier version made
    `missing-middle` identical to `orphan-child` because it never emitted a root at all.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    generator, emitted = partial_traces.generate(
        partial_traces.build_parser().parse_args(["--traces", "6", "--seed", "3", "--no-preflight"])
    )
    generator.close()
    spans = exporter.get_finished_spans()
    present = {span.context.span_id for span in spans}

    assert set(emitted) == set(partial_traces.SHAPES)
    orphans = [span for span in spans if span.parent and span.parent.span_id not in present]
    assert orphans, "the whole point is spans whose parent never arrives"
    # An orphan stays inside its absent parent's trace, so the trace still groups correctly.
    assert all(span.context.trace_id == span.parent.trace_id for span in orphans)

    by_trace: dict[int, list[ReadableSpan]] = {}
    for span in spans:
        by_trace.setdefault(span.context.trace_id, []).append(span)

    with_root = [
        group
        for group in by_trace.values()
        if any(span.parent is None for span in group)
        and any(span.parent and span.parent.span_id not in present for span in group)
    ]
    assert len(with_root) == 6, "missing-middle must keep its root and orphan a descendant"
    rootless = [group for group in by_trace.values() if all(span.parent for span in group)]
    assert rootless, "orphan-child and in-flight must lose the root entirely"


@pytest.mark.parametrize("scenario", ("time-series", "sessions"))
def test_latency_tracks_generated_tokens(scenario: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """Duration and token count were independent, so any scatter of the two was noise.

    These are the scenarios that set explicit span durations; the rest use wall-clock timing
    and produce near-instant spans with no duration to correlate.
    """
    import statistics

    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    argv = ["--seed", "3", "--no-preflight", "--annotation-rate", "0"]
    if scenario == "time-series":
        argv += ["--days", "1"]
    assert cli.main([scenario, *argv]) == 0

    pairs = [
        (span.attributes["llm.token_count.completion"], (span.end_time - span.start_time) / 1e9)
        for span in exporter.get_finished_spans()
        if span.attributes.get("llm.token_count.completion")
        and span.end_time - span.start_time > 1_000_000
    ]
    assert len(pairs) > 50, f"{scenario} produced too few timed LLM spans to judge"
    correlation = statistics.correlation(
        [tokens for tokens, _ in pairs], [seconds for _, seconds in pairs]
    )
    assert correlation > 0.5, f"{scenario} latency does not track generation size: {correlation}"
    # Not a straight line either — real latency has scatter around the trend.
    assert correlation < 0.99, correlation


def test_error_spans_always_explain_themselves(every_scenario_span: list[ReadableSpan]) -> None:
    """A red span with no reason is unrealistic and useless for judging the failure UI.

    63 of 122 error spans once carried neither a status message nor a recorded exception,
    because `random_status` sets a code and scenarios never supplied a reason.
    """
    unexplained = [
        span.name
        for span in every_scenario_span
        if span.status.status_code is StatusCode.ERROR
        and not span.status.description
        and not any(event.name == "exception" for event in span.events)
    ]
    assert not unexplained, f"error spans with no explanation: {sorted(set(unexplained))}"


def test_many_attributes_hazard_covers_every_value_type_including_falsy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Booleans appear nowhere else; every other bool is buried in a JSON metadata string.

    The falsy value of each type is the interesting case — a UI that renders False, 0 or ""
    as blank looks identical to one that drops the attribute entirely.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    generator, _names = edge_cases.generate(
        edge_cases.build_parser().parse_args(["--only", "many-attributes", "--no-preflight"])
    )
    generator.close()

    values = list(exporter.get_finished_spans()[0].attributes.values())
    assert {type(value).__name__ for value in values} >= {"str", "int", "float", "bool"}
    assert any(value is False for value in values)
    assert any(value is True for value in values)
    assert any(type(value) is int and value == 0 for value in values)
    assert any(type(value) is float and value == 0.0 for value in values)
    assert any(value == "" for value in values)


def test_many_events_hazard_scales_and_refuses_to_truncate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Nothing else exceeded three events, so the raised max_events was never exercised.

    OpenTelemetry drops events past the limit silently, so asking for more than it allows
    must fail loudly instead of producing a span missing most of what was requested.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    args = edge_cases.build_parser().parse_args(
        ["--only", "many-events", "--width", "400", "--no-preflight"]
    )
    generator, _names = edge_cases.generate(args)
    generator.close()

    span = exporter.get_finished_spans()[0]
    assert len(span.events) == 400
    assert span.dropped_events == 0
    assert "synthetic.event_count" not in span.attributes

    beyond = edge_cases.build_parser().parse_args(
        ["--only", "many-events", "--width", str(shared.SPAN_LIMITS.max_events + 1), "--dry-run"]
    )
    with pytest.raises(ValueError, match="max_events"):
        edge_cases.generate(beyond)


def test_clock_skew_hazard_is_the_only_future_dated_span(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Every other span in the package ends at or before now; real hosts skew forward.

    A future-dated span breaks "last hour" filters, recency sorting, and anything assuming
    end_time <= now — so exactly one hazard produces it, and nothing else does by accident.
    """
    exporter = InMemorySpanExporter()
    monkeypatch.setattr(shared, "OTLPSpanExporter", lambda endpoint, headers=None: exporter)
    generator, _names = edge_cases.generate(
        edge_cases.build_parser().parse_args(["--no-preflight"])
    )
    generator.close()

    now = shared.utc_now().timestamp() * 1e9
    future = [span for span in exporter.get_finished_spans() if span.end_time > now]
    assert [span.name for span in future] == ["edge-case-clock-skew"]
    assert (future[0].end_time - now) / 1e9 > 3600, "skew must exceed a one-hour filter window"
    assert future[0].end_time > future[0].start_time
    assert "synthetic.end_offset_seconds" not in future[0].attributes


def test_edge_case_hazards_are_individually_selectable() -> None:
    args = edge_cases.build_parser().parse_args(["--only", "unicode", "--dry-run"])
    generator, names = edge_cases.generate(args)
    generator.close()

    assert names == ["unicode"]
    assert generator.trace_count == 1

    unknown = edge_cases.build_parser().parse_args(["--only", "nope", "--dry-run"])
    with pytest.raises(ValueError, match="unknown hazard"):
        edge_cases.generate(unknown)


@pytest.mark.parametrize("count", (10, 6, 4, 3, 2))
def test_experiment_sequence_improves_overall_but_not_monotonically(count: int) -> None:
    """A strictly improving sequence cannot show the comparison people care about.

    The fixture exists to make experiment-over-experiment comparison legible, and the case
    worth seeing is an iteration that came out *worse* than the one before it.
    """
    baseline_metrics = importlib.import_module("scripts.experiments.generate_baseline_metrics_data")
    profiles = baseline_metrics._profiles(count)
    quality = [profile.quality for profile in profiles]

    assert len(profiles) == count
    assert quality[-1] > quality[0], "the sequence must still improve overall"
    assert all(value > 0 for value in quality)
    if count > 2:
        regressions = [i for i in range(1, count) if quality[i] < quality[i - 1]]
        assert regressions, "no iteration regressed, so the comparison view has nothing to show"
        # A setback is a bad change, so latency and errors move with quality.
        for index in regressions:
            assert profiles[index].latency_seconds > profiles[index - 1].latency_seconds
            assert profiles[index].error_rate > profiles[index - 1].error_rate
        assert count - 1 not in regressions, "the final iteration should not be a setback"


def test_experiment_examples_are_seeded_and_domain_realistic() -> None:
    first = experiment_data.examples(7, random.Random(5))
    second = experiment_data.examples(7, random.Random(5))

    assert first == second
    assert {row["metadata"]["difficulty"] for row in first} == {"easy", "medium", "hard"}
    assert all(row["question"] and row["answer"] for row in first)


def test_postgres_trace_count_is_passed_as_a_psql_variable(tmp_path: Path) -> None:
    command = psql.command(
        psql.DatabaseConfig(
            name="postgres",
            user="postgres",
            host="localhost",
            port=5432,
            password="phoenix",
        ),
        tmp_path / "generate.sql",
        variables={"num_traces": 17},
    )
    variable_index = command.index("num_traces=17")
    assert ("--set", "num_traces=17") == tuple(command[variable_index - 1 : variable_index + 1])
    assert "ON_ERROR_STOP=1" in command
