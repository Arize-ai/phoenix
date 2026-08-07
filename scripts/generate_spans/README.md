# `scripts.generate_spans`

Synthetic OpenInference trace generators for Phoenix development. One CLI, one scenario per
file, each answering a different "what does this look like with real data?" question.

```bash
uv run python -m scripts.generate_spans <scenario> [options]
uv run python -m scripts.generate_spans            # list scenarios
uv run python -m scripts.generate_spans <scenario> --help
```

`make seed` wraps the same CLI — see the `generate_spans/` section of `scripts/README.md`.

This package covers traces only. Datasets and experiments live in `scripts/experiments/`, and
bulk data for performance work lives in `scripts/generate_data_via_plpgsql/`; both have their
own READMEs. Prefer these scenarios whenever the data needs to *behave* like real traffic —
the PL/pgSQL generator writes to Postgres directly and so produces no costs and no sessions.

## Scenarios

| Scenario | Question it answers | Key surface exercised |
| --- | --- | --- |
| `mixed` | What does a representative project look like? | every span kind, nesting, errors |
| `agent` | What does an agent run look like? | `llm.tools`, tool calls, retries, `graph.node.*` |
| `rag` | Does the RAG triad tell a story? | retrieval hit/miss correlated with answer quality |
| `prompts` | Was the better prompt worth its cost? | `llm.prompt_template.*`, v1-vs-v2 quality *and* tokens |
| `partial-traces` | What does an *incomplete* trace look like? | orphan spans whose parent never arrives |
| `nested` | Does the trace tree hold up when deep? | one very deep trace |
| `time-series` | Do the time charts look right? | historical traffic with business-hours shape |
| `token-details` | Do token breakdowns add up? | cache read/write, reasoning, multimodal tokens |
| `costs` | Are costs computed for every model? | one span per model in the cost manifest |
| `sessions` | Does the session *list* look real? | many sessions across users, backdated |
| `large-session` | Does one session view scale? | many turns under one `session.id` |
| `events` | Do events and exceptions render? | span events, recorded exceptions, error status |
| `axis-labels` | Do long model names break the charts? | pathological label lengths |
| `edge-cases` | Does the UI survive hostile payloads? | huge text, unicode, markup, wide lists, extreme durations |

Every scenario accepts `--endpoint`, `--project-name`, `--seed`, `--dry-run`, and
`--no-preflight`. `all` runs every scenario into its own project — the fastest way to bring a
local Phoenix up to a realistic state:

```bash
uv run python -m scripts.generate_spans all
uv run python -m scripts.generate_spans all --only rag,agent,sessions
uv run python -m scripts.generate_spans all --exclude time-series --keep-going
uv run python -m scripts.generate_spans all --project-name demo   # -> demo-rag, demo-agent, …
```

On `all`, `--project-name` is a *prefix* rather than a single destination — one project per
scenario is the whole point, so collapsing them would defeat it.

## Adding a scenario

1. Create `generate_<thing>.py` in this directory.
2. Import helpers with the dual-import idiom so the file stays directly executable. **Keep the
   two name lists identical** — see the drift gotcha below:
   ```python
   try:
       from ._shared import Generator, add_common_arguments
   except ImportError:  # Support direct execution from this directory.
       from _shared import Generator, add_common_arguments
   ```
3. Expose `build_parser()`, `generate(args)`, and `main(argv=None) -> int`. Call
   `add_common_arguments(parser, default_project=...)` so the shared flags exist.
4. Build spans through `Generator.span(...)`, then `close()` and `print_summary()`. Reach for
   the shared builders rather than writing attribute keys by hand — `llm_attributes`,
   `document_attributes`, `message_attributes`, `random_status`, and `Annotations`.
5. Register the scenario in `_registry.py`'s `SCENARIOS` with a one-line description. (The CLI
   builds its command table from that registry and adds `all`; nothing else needs editing.)
6. Add the row above and to `scripts/README.md`.
7. Cover the invariant that would actually regress in `tests/unit/test_span_datagen.py`
   (use `InMemorySpanExporter` — see the existing tests for the monkeypatch pattern).

Steps 2, 3, 5, and 6 are machine-checked, so getting them wrong fails the suite rather than
surfacing later: `test_dual_import_branches_list_identical_names` compares the two import
lists and names the drifted symbol,
`test_every_scenario_file_is_registered_and_exposes_the_entry_points` catches a file that
exists but was never registered — otherwise dead code nothing runs or tests — and
`test_every_scenario_has_a_row_in_the_readme_table` keeps the table above in step with the
registry in both directions. Flags are covered too: every one must carry help text, and any
`(default: N)` it claims must match the real default.

The example commands in all four datagen READMEs are parsed by
`test_documented_example_commands_still_parse`, so renaming or dropping a flag breaks the
suite rather than leaving a copy-pasteable line that no longer runs. Write examples with real
flags; use `<angle brackets>` for placeholders, which the check skips.

Step 5 is also what puts the scenario under test: `test_every_registered_scenario_runs_with_its_defaults`
is parametrized over `SCENARIOS`, so registering it automatically asserts that it runs with no
arguments and reports a non-zero `traces=` and `spans=`. That is also the contract on
`print_summary` — keep emitting `key=value` lines. It also joins `all`, so keep the scenario's
defaults small enough to be reasonable in a full seed.

Keep every knob a flag with a default that produces useful data with no arguments.

### How these tests reach CI

`tests/unit/test_span_datagen.py` imports this package directly, which makes it the one test
file that depends on `scripts/` existing. The `unit-tests` job in `.github/workflows/python-CI.yml`
uses a **sparse checkout**, so `scripts/` has to be listed there or the module raises
`ModuleNotFoundError` at collection and fails the job — it does not skip quietly. The
`phoenix` path filter also lists the three datagen directories, so changing a scenario runs
the tests that cover it; a scenario-only change would otherwise trigger nothing.

`scripts/` and two of its subpackages have no `__init__.py` and resolve as PEP 420 namespace
packages, so the import works from any working directory once the repo root is on `sys.path`.
tox runs `pytest unit/` with `changedir = tests`, which is why the test file derives paths
from `__file__` rather than the cwd.

## Known limitation: spans are never curated into datasets

Nothing here sets `Span.containedInDataset`, so the "curate examples from traces" flow has no
fixture. That is deliberate rather than an oversight: `addSpansToDataset` is a GraphQL
mutation taking base64 relay IDs, so it needs a live server, a query to resolve span row IDs,
and a second phase after ingestion — a different shape of tool from an OTLP span exporter.
`scripts/experiments/` builds datasets, but from synthetic examples rather than from spans, so
the provenance link is unexercised either way. Worth building if the dataset-from-spans UI
needs fixtures; do not bolt it onto a scenario.

## Verifying against a real Phoenix

`--dry-run` and the unit tests only prove a scenario builds the attributes it intended. They
cannot tell you Phoenix ingests them, or that the UI can join them back together. For that,
run against a throwaway server rather than your own, so seed data never lands in the Phoenix
you actually use:

```bash
PHOENIX_WORKING_DIR=$(mktemp -d) PHOENIX_PORT=6017 uv run phoenix serve &
# wait for the port, then seed everything
uv run python -m scripts.generate_spans all --endpoint http://127.0.0.1:6017 --keep-going
```

Then check what landed — trace counts per project, and the joins that flat attributes cannot
express on their own:

```python
from phoenix.client import Client

client = Client(base_url="http://127.0.0.1:6017")
spans = client.spans.get_spans_dataframe(project_identifier="rag", limit=5000)
client.spans.get_span_annotations_dataframe(spans_dataframe=spans, project_identifier="rag")
```

GraphQL is the way to reach anything the dataframe API does not expose — `documentEvaluations`
(document annotations by position), `spanNotes`, `sessions { tokenUsage costSummary }`, and
per-project `costSummary`. Project `id` fields are `ID!`, not `String!`, which the error
message does not make obvious. `spanKind` comes back **lowercase** (`llm`, `guardrail`) even
though the attribute is written uppercase, so compare case-insensitively.

`Project` has no `traces` connection — it exposes `trace(traceId:)` for one trace and
`hasTraces`, so reaching trace annotations means fetching the trace ids from spans first.
Sessions do have a `sessions` connection, with `sessionAnnotations` on each node.

`filterCondition` reaches into attributes by path, which is how list attributes become useful:

```
span_kind == 'RERANKER'
'billing' in attributes['tag']['tags']
```

## Gotchas

Things that have surprised people (including agents) working in here. Grouped by when they
bite: [building spans](#building-spans), [exporting](#exporting-and-endpoints),
[attribute shape](#attribute-shape), [annotations](#annotations),
[fixture caveats](#determinism-and-fixture-caveats), [packaging](#packaging-and-tooling).

### Building spans

**`root=True` is what counts a trace.** `Generator` does not infer trace boundaries from
OpenTelemetry parentage. Forget the flag on your outermost span and the summary reports
`traces=0` even though the exported data is fine.

**Passing `start_time` without `end_time` gives you a near-zero duration.** The span ends at
wall-clock time, not at `start_time + duration`. Backdated spans must pass both. `Generator.span`
handles the `end_on_exit` bookkeeping — you just have to supply both values.

**`Generator.span(name, kind)` already sets `openinference.span.kind`.** Helpers like
`llm_attributes()` also include it, and the explicit `attributes` mapping wins. Keep them
consistent or a span will claim a kind that contradicts its content.

### Exporting and endpoints

**A wrong `--endpoint` used to look like a hang, not an error.** `SimpleSpanProcessor` exports
one span at a time and each failure retries with exponential backoff, so a few hundred spans
spent tens of minutes retrying — and the process still exited 0, having sent nothing. A TCP
preflight now fails in well under a second with an actionable message; `--no-preflight` skips
it for setups where the collector's port is not directly reachable. Tests that swap in a fake
exporter should pass it too, since they are not really exporting.

**Failed exports never reach the exit code.** Even with preflight, a server that accepts the
connection and then rejects the payload only logs to stderr. Treat a clean exit as "the script
ran", not "Phoenix has the data" — confirm in the UI.

**`--endpoint` is used two different ways.** `trace_endpoint()` appends `/v1/traces` for the
OTLP exporter, while `base_url()` strips it back off for the REST client. Both accept either
form, so pass `--endpoint` through unmodified and let the helpers normalize it.

**`PHOENIX_API_KEY` is read from the environment, not a flag.** It becomes an
`Authorization: Bearer` header. `--endpoint` accepts either a Phoenix base URL or a full
`/v1/traces` collector URL; `trace_endpoint()` normalizes both.

**`--dry-run` builds everything and skips only the exporter.** The printed counts are real, so
it is a fast way to check the shape of a workload before sending it anywhere.

### Attribute shape

**OpenTelemetry silently drops attributes past 128 per span.** That is the SDK default, and
nothing errors — the span exports, the summary reports success, and the data is simply
incomplete. A retriever span with 50 documents is 150+ keys, so fixtures hit this easily.
`Generator` raises the ceiling via `SPAN_LIMITS`; if you build a provider yourself, pass the
same limits. `ReadableSpan.dropped_attributes` is how you check, and a test asserts it stays
zero for the widest scenario.

**Attribute values must be primitives, or lists of primitives.** Anything structured
(`metadata`, `tool.parameters`, a tool JSON schema) has to be `json.dumps`'d first. Lists of
floats are fine, which is why embedding vectors can be passed through directly.

**Lists of objects are flattened into indexed keys, not nested.** Messages, documents, and tool
calls become `llm.input_messages.0.message.role`, `retrieval.documents.2.document.score`,
`llm.output_messages.0.message.tool_calls.1.tool_call.function.name`. There is no nesting; the
index sits in the middle of the key. Do not hand-roll this — use the shared builders, which
take ordinary dicts and handle the indexing, the JSON encoding, and the tool-call sub-keys:

```python
document_attributes([{"id": "kb-1", "content": passage, "score": 0.91}])
message_attributes([{"role": "assistant", "tool_calls": [...]}], "llm.output_messages")
```

**Omit absent keys with `is not None`, not truthiness.** A document with `score: 0.0`, an empty
assistant message, or a zero token count are all meaningful values that a truthiness check
silently drops. The shared builders get this right; watch for it in scenario code too.

**`llm.prompt_template.template` is the *unrendered* source.** It keeps its `{placeholders}`;
the values that filled them go in `llm.prompt_template.variables` as a JSON object, and the
rendered result belongs in `input.value` or the messages. Storing the rendered string as the
template loses exactly the information the playground needs to re-run it with new variables.
Phoenix parses `variables` back into a real object, so it must be valid JSON.

### Annotations

**Annotations do not travel over OTLP.** They are a separate REST resource, so writing them
needs a reachable Phoenix server and is skipped entirely under `--dry-run` (the count is still
reported, so you can check the shape). Use the shared `Annotations` buffer rather than calling
the client directly — it batches, and one request per annotation is easily slower than
exporting every span:

```python
annotations = Annotations(endpoint=args.endpoint, dry_run=args.dry_run)
with generator.span("assistant-request", "CHAIN", root=True) as root:
    ...
annotations.add(root, "helpfulness", score=0.82, label="helpful")
annotations.flush()  # required — the tail batch is still buffered without it
```

**Annotations come in four flavours, and they are not interchangeable.** `Annotations` covers
all of them, but each targets a different thing and lands in a different place in the UI:

| Method | Keyed by | Use for |
| --- | --- | --- |
| `add` | `span_id` | a judgement about one span |
| `add_document` | `span_id` + `document_position` | relevance of one retrieved document |
| `add_trace` | `trace_id` | a property of the whole run, e.g. task completion |
| `add_session` | `session.id` string | a property of a conversation, e.g. satisfaction |

Annotating a root span is *not* the same as annotating its trace. `add_session` takes the id
string rather than a span, because a session is not an OpenTelemetry object — it exists only
as an attribute on spans.

**`note` is a reserved annotation name, and notes race span ingestion.** Notes are their own
resource: the bulk annotation endpoint rejects `name="note"` with a 400, and `POST
/v1/span_notes` stores the text in `explanation` with `annotator_kind="HUMAN"`. Worse, that
endpoint resolves the span immediately and 404s if it is not there yet — and Phoenix ingests
spans asynchronously, so posting a note right after export reliably loses the race. Bulk
annotations are queued and tolerate this, which is why the difference is easy to miss. Use
`Annotations.add_note()` and call `flush_notes()` *after* `Generator.close()`; it retries a
404 with backoff. `Annotations.add()` raises if you pass the reserved name.

**Annotation scores nest under `result`.** `score`, `label`, and `explanation` are not
top-level fields of the payload, and at least one of the three is required. `Annotations.add`
builds the right shape and raises if you pass none of them.

**Documents are annotated by position, not by id.** `Annotations.add_document(span, position, …)`
takes the index in the span's flattened `retrieval.documents.N` keys. The `document.id`
attribute is yours to use for bookkeeping — nothing joins on it. Note the annotation attaches
to the `RETRIEVER` span that produced the documents, not to the root of the trace.

**Help text is a claim, and claims rot.** `agent --tool-error-rate` said a failed tool call
"is retried" from the day it was written; no retry existed for thirty-odd iterations, because
nothing checks that a help string matches behaviour. A failed call now emits a second TOOL
span sharing the original's `tool.id` and distinguished by `metadata.attempt`, so the two
correlate as one logical call — the shape a real agent produces. When auditing a scenario,
read its `--help` against its code, not just its code.

**`--annotation-rate` is a probability, not a switch.** Five scenarios offer it (`agent`,
`sessions`, `prompts`, `rag`, `time-series`) and it means the same thing in all of them: the
fraction of traces or sessions that receive an annotation. Wiring it only to the `Annotations`
constructor is the easy mistake — that makes `0` disable annotations while `0.5` still
annotates everything, a flag that silently ignores its own value. Gate the `add*` call with
`rng.random() < args.annotation_rate` as well.

**Annotation `metadata` survives the round-trip and is what you group by.** `prompts` tags each
score with its `prompt_version`, so a version-over-version comparison is a `groupby` on the
annotations dataframe — no join back to span attributes required.

**Correlate quality with cause — but leave a baseline failure rate.** Scoring answers
independently of retrieval produces charts where every eval looks like uncorrelated noise,
which makes the fixture useless for judging a UI. `rag` derives answer quality from whether
retrieval actually hit, and its test asserts the correlation survives — do the same for any
scenario that emits eval scores.

The opposite mistake is just as bad: a *perfect* correlation. Two have been fixed here, and
both came from ranges that happened not to overlap.

`agent` originally computed completion as `rng.random() > 0.25 * tool_failures`, so a run with
no failed tool calls always succeeded. That implies every agent failure is visible as a failed
span, which no real trace looks like — agents also fail from bad plans and wrong tool choices
that nothing records. The formula now carries `BASELINE_FAILURE_RATE`, giving a gradient
(0.87 → 0.66 → 0.31 → 0.00 completion as failures accumulate) instead of a step function.

`rag` scored the relevant passage `uniform(0.78, 0.97)` and distractors `uniform(0.30, 0.74)`.
Disjoint ranges, so on a hit the relevant passage ranked first **every time** — which quietly
made the RERANKER span decorative, because a reranker exists to promote a passage the
retriever buried. The ranges now overlap (relevant first ~70% of the time), and reranking
re-scores rather than truncating, so it usually promotes a buried passage and occasionally
drops it. Only then can a fixture answer "did reranking help?".

`sessions` had a third variant of the same problem, in a plain distribution rather than a
correlation. Turn counts were drawn from a weighted list of fixed lengths — 1, 2, 3, 5, 8, 13,
21 — so no session ever had 4, 6, 7, 9-12 or 14-20 turns. A turn-count histogram showed seven
spikes with gaps, and a "4 to 10 turns" filter matched only the two lengths in the list. It now
picks a weighted *bucket* and a length uniformly inside it, which fills 1-21 while keeping the
long tail (~69% of sessions are still 3 turns or fewer).

The lesson generalizes: when a fixture derives one value from another, or samples from a
hand-written list, check the *distribution* of the result rather than trusting that the code
reads correctly. A property that holds 100% of the time, or a value that never appears, is
usually a modelling accident. `time-series` and `token-details` were audited the same way and
are clean — the daily counts show a real weekday/weekend split, and no span's token details
exceed its token total.

### Determinism and fixture caveats

**Reproducibility is positional.** `--seed` fixes the RNG stream, so inserting a single extra
`generator.rng` call shifts every downstream value. Two runs of the same seed only match if the
code between them is unchanged. Adding three span kinds to `mixed` changed every span it
generates for a given seed — that is expected, not a bug, but it means seeded output is not a
stable contract across versions. Do not treat a saved hash as a golden file.

**Do not emit `llm.cost.*`.** Phoenix computes cost itself from token counts and its model
cost manifest, so instrumentation reporting cost attributes would duplicate or contradict the
calculation. Thirteen of the semantic-convention attributes are cost fields and all are
excluded on purpose — `test_semconv_attribute_coverage_is_accounted_for` holds the full list
with a reason for each, and fails when OpenInference adds an attribute nothing emits, so the
gap gets a decision instead of going unnoticed.

**`UNKNOWN` is a fallback, not something to emit.** Phoenix's `SpanKind._missing_` upper-cases
an unrecognized ASCII kind before giving up, so `"llm"` becomes `LLM` and only a genuinely
unmappable value lands on `UNKNOWN`. That is why `mixed --malformed-rate` uses a non-ASCII
string: an ASCII typo would be silently repaired instead of exercising the fallback. Confirmed
end to end — seeding with `--malformed-rate 1` produces spans Phoenix stores as `unknown`.
Phoenix's
own `SpanKind` enum currently matches OpenInference exactly, so a kind valid in semconv is
accepted as-is — but they are separate enums that could drift, and a kind Phoenix does not
know is coerced to `UNKNOWN` silently rather than rejected.

**`random_status` returns `UNSET` ~5% of the time by default, and Phoenix keeps it distinct.**
Seeding 200 spans gave `OK` 179 / `ERROR` 13 / `UNSET` 8, so unset statuses survive ingestion
rather than collapsing into `OK`. That is deliberate — real traffic contains them. Note that
`error_rate` and `unset_rate` partition a *single* uniform draw rather than being sampled
independently, so raising one eats into the others; `--error-rate 1` yields no `UNSET` at all.

**Every scenario but `partial-traces` emits whole traces.** Measured across ~4,300 spans, not
one had a parent that was absent from the export — yet collectors receive broken traces
constantly, because head sampling drops the root, an exporter dies mid-flush, the root is
still in flight, or an upstream service was never instrumented. `Generator.span(parent=…)`
plus `detached_parent()` attaches a span to a context that is never exported; pass
`within=<trace_id>` to drop a span out of the *middle* of a trace whose root does arrive,
rather than losing the root itself. The two cases look identical in code and completely
different in the UI, so the scenario emits both.

**Two whole dimensions of the data were unexercised until measured.** Across all ~4,300 spans
the scenarios emit, none lasted over 60s and none was dated in the future:

- `slow-span` covers 3h / 45m / 90s / 0s, cycling as `--repeat` increases, so latency
  formatting crosses the minute and hour boundaries and a chart sees one huge outlier.
- `clock-skew` emits the package's only future-dated span, two hours ahead. Hosts with fast
  clocks do this constantly, and it breaks "last hour" filters, recency sorting, and any code
  assuming `end_time <= now`.

A third was events: no span anywhere carried more than **three**, so the event list had never
been rendered at scale and the `max_events` ceiling raised back in `SPAN_LIMITS` was never
reached. `many-events` emits one `token.chunk` event per `--width`, the shape a streaming
completion produces. Asking for more than `SPAN_LIMITS.max_events` now **raises** rather than
quietly dropping the excess — the same silent-truncation trap that motivated raising the
limits, this time reachable through a user-facing flag.

Two more came out of the same sweep. **63 of 122 error spans carried neither a status message
nor a recorded exception** — `random_status` sets a code and the scenarios never supplied a
reason, so the UI showed a red span with no explanation. `Generator.span(status_message=…)`
now takes one, and a test asserts every ERROR span anywhere explains itself. And **no
attribute anywhere held a boolean**; every bool was buried inside a JSON metadata string. The
`many-attributes` hazard now cycles str/int/float/bool and leads each type with its *falsy*
value, since a UI rendering `False`, `0` or `""` as blank is indistinguishable from one that
dropped the attribute.

**Every trace in the package was strictly sequential.** Of 1,451 adjacent sibling pairs, zero
overlapped in time — so a waterfall never had to render concurrency, which is most of what an
async agent actually does. `agent --parallel-tool-calls` even promised calls happen "at once"
while emitting their spans end to end: a fidelity gap and a false help-text claim in the same
flag. Calls the model requests together now share a start and differ in duration, so they
overlap. Retries stay sequential, because a retry follows the call it retries — the test
asserts every non-overlapping sibling pair involves an `attempt: 2` span.

**Uniform sub-populations answer no questions.** This has now been the most common defect
found in this package, in three different scenarios. The shape is always the same: a dimension
exists in the data, a view is built on it, and every member of it carries the same
distribution — so the view shows noise and the question it exists to answer has no answer.

`sessions` had a second-order version of it. All twelve users drew from one error rate, so
"which user is having a bad time?" returned twelve answers between 4.3% and 8.9% — noise.
Users now belong to stable cohorts (roughly one in six on a degraded path, one in six on a
clean one), giving a 2.9%-to-19% spread.

The subtlety there is worth spelling out: drawing a cohort **per session** would have been
just as useless. A person has to behave like themselves every time they appear, or grouping by
`user.id` still averages out to noise. The cohort is derived from the user index, so
`user-001` is the struggling user under every seed — a test asserts exactly that across three
of them. Any sub-population keyed by an identity needs the same treatment.

`rag` had it too. Every question drew from the same `--miss-rate`, putting all four topics at
~75% retrieval, so "which topic retrieves worst?" — the question that sends you to re-chunk a
specific doc set — returned four identical answers. Topics now carry a `miss_bias`: 92% / 76%
/ 69% / 52%, with a findable worst corner of the corpus. The weights average 1.0 so
`--miss-rate` still sets the corpus-wide rate, and a test asserts that, because a per-member
bias can quietly redefine what the flag means.

Every tool in `agent` drew from the same
latency range and the same flat error rate, so all four sat at ~0.8s and ~12% — the spread was
sampling noise. "Which tool is slow?" and "which tool is unreliable?", the two questions an
agent tool view exists for, each returned four indistinguishable answers. Tools now carry
their own `latency` and `failure_weight`: a warehouse query is 29× slower than a cached
lookup, and a third-party API is the flakiest at 29% while being fast. That last part is
deliberate — the slowest tool must *not* also be the flakiest, or one glance stands in for
both questions and the fixture teaches a habit that fails on real data.

**A comparison fixture needs both sides of the tradeoff.** `prompts` showed v2 scoring better
than v1 and left cost out: prompt tokens came from the model's typical usage and ignored the
template entirely, even though v2's is three times longer. So the data answered "did the new
prompt help?" but not "was it worth it?" — and the second question is why anyone opens a
version comparison. v2 now costs ~40% more prompt tokens (median 1,710 → 2,394) while still
scoring better. Only the *prompt* side scales, since the instructions grew and the answer did
not, and `llm.token_count.total` moves with it so the cost breakdown still adds up.

**Latency was independent of token count** — correlation −0.000 across 2,215 spans. More
generated tokens take longer in reality, so a latency-versus-tokens view over this data was
pure noise: the same failure as an eval score uncorrelated with its cause, but far harder to
notice because both values look individually plausible. `duration_for()` derives a duration
from the completion size, and the scenarios that set explicit durations now correlate at
+0.79 (`time-series`) and +0.84 (`sessions`), with `token-details` already at +0.85.

**A span with no explicit `start_time`/`end_time` lasts microseconds.** Ten of fourteen
scenarios timed spans by wall clock, so a waterfall over them was a row of hairlines — worst
of all in `mixed`, the `make seed` default, whose 508 spans all measured 0.003ms. `mixed` now
plans its tree before emitting it, because `Generator.span` needs both timestamps up front and
a parent therefore cannot know its own end until its children are known. Planning first is
what lets a parent's duration *be* the work beneath it: median 238ms, p95 10.4s, children
always inside the parent's window, and leaf LLM spans correlating with their tokens at +0.86.

`large-session` had the same defect with sharper consequences: 500 turns landed inside **9
milliseconds**, so the session view — the one thing that scenario exists to stress — showed a
multi-hour conversation as instant. Its turns are now separated by think time and backdated to
end about now, spanning 7.6 hours for 500 turns.

**Half-timed is worse than untimed.** `agent` got real durations on its TOOL spans and kept
wall clock on its LLM spans, so the slowest part of every step — the model call the tools were
waiting on — rendered as a hairline beside the work it caused. Mixed timing within one
scenario is the tell; the fix was the same plan-then-emit restructure.

Two things that restructure exposed, both worth knowing before doing it elsewhere:

- **Accumulated timedeltas overshoot a parent computed as one float sum.** Children escaped the
  agent's window by ~768ns — rounding alone. A millisecond of trailing slack on the parent
  fixes it, and is honest: a parent does bookkeeping after its last child.
- **Group by the step, not the parent span.** Every tool call in a run shares the AGENT root as
  its parent, so grouping by parent merges separate fan-outs and makes concurrent calls look
  sequential. `graph.node.parent_id` names the step that requested them.

`rag` followed for the same reason: its waterfall is the canonical view of a RAG pipeline, and
the *shape* matters as much as the presence of durations. Generation has to dominate retrieval
— embed 38ms, retrieve 200ms, rerank 168ms, synthesize 5.5s — because a fixture where
retrieval is the long pole sends a reader chasing the wrong stage.

Seven of fourteen scenarios are now fully timed. The rest are ones where timing genuinely is
not the point (`costs` is one span per model, `axis-labels` is about label text, `events` is
about event payloads, `partial-traces` is about missing parents). `nested` reports "partial"
only as an artifact — its deep parents accumulate past a millisecond of real wall-clock time
while their hundreds of children do not, which is incidental rather than designed.
Converting them would follow the same plan-then-emit shape. The tell that a scenario needs it:
its purpose mentions a view that displays *time* — a waterfall, a session duration, a latency
chart.

Span *links* are the one dimension deliberately left uncovered: Phoenix's GraphQL `Span` type
exposes no `links` field, so a fixture would have no consumer.

Hazards request the rest by returning `synthetic.duration_seconds` and `synthetic.end_offset_seconds`,
which the emitter pops and turns into a start/end pair. Neither ever reaches Phoenix as an
attribute — they are instructions to the emitter, not data. Worth copying the technique: pick a
dimension of the output, measure its range across every scenario, and see what never occurs.

**`edge-cases` deliberately skews cost and token totals.** Its `numeric-extremes` hazard emits
a span with two billion prompt tokens, which rolls up to roughly $1,000 for that project. That
is the point — it exercises formatting at the limit — but do not point cost demos or
screenshots at the `edge-cases` project. Scenario projects are separate, so nothing else is
affected.

### Packaging and tooling

**`_shared` must keep `phoenix.client` imported lazily.** Two scenarios carry PEP 723 headers
(`time-series`, `token-details`) so they can run standalone under `uv run`, and
`token-details` declares only the OpenTelemetry and semconv packages — no
`arize-phoenix-client`. It nonetheless imports `_shared`. That is fine only because `_shared`
defers `from phoenix.client import Client` into `Annotations.__init__`. Hoisting that import
to module scope would break those scripts under `uv run` while every in-project test stayed
green, since the project venv has the client installed either way. If you add a PEP 723
header to another scenario, check its declared list against what `_shared` pulls in too.

**The two halves of the dual-import block drift silently.** Adding a name to the `from ._shared`
branch without adding it to the `from _shared` fallback produces a file that is perfectly valid,
imports cleanly under `-m`, passes every in-process test — and dies with a `NameError` the
moment someone runs it directly. Both branches must list exactly the same names, and
`_registry.py` needs the fallback too. `test_scenario_files_run_when_executed_directly` runs
each file as a subprocess to cover this; it has to *generate*, not merely import, because the
failure surfaces at first use rather than at import.

**`make seed` passes flags you may not have planned for.** It always forwards `--endpoint`,
`--seed`, and `--dry-run`, and adds `--project-name` whenever `DATAGEN_PROJECT` or
`PHOENIX_PROJECT` is set — and `PHOENIX_PROJECT` is often set in a shell without anyone
thinking about it. A command that rejects one of those is broken only on the Makefile path,
which running the scenario directly will never reveal.
`test_every_command_accepts_the_flags_make_seed_passes` covers that seam.
