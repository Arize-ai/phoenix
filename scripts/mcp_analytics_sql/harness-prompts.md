# Cold-Agent Harness Prompts

**Date:** 2026-08-02
**Fixture:** [`seed_analytics_fixture.py`](seed_analytics_fixture.py) — every expected value below comes from its oracle
**Design notes:** [`advanced-use-cases.md`](advanced-use-cases.md)

Prompts for probing the analytics SQL surface with agents that have no prior
context. Each is written to be pasted verbatim.

---

## How these are written, and why

**Bare questions.** No hint about tables, joins, traps, or time windows. An agent
told what to watch for is not measuring the surface, it is measuring the hint.
An earlier round asked agents to report what confused them, which reliably
produced confusion — the question invited the answer.

**Every prompt names its scope.** The fixture shares a database with real data
and with other agents running concurrently. A prompt that says "which project
used the most tokens" is answerable three different ways depending on what else
is present. Naming a `fixture-*` project or dataset makes the question stable and
keeps concurrent runs from contaminating each other's answers.

**Wrong answers are enumerated, not just right ones.** Each entry lists the
values a specific mistake produces. A result that is merely wrong tells you an
agent failed; a result that is exactly the double-counted total tells you *which*
misreading occurred, which is the difference between a score and a diagnosis.

**Two kinds of prompt.** Gating prompts have a single defensible answer and a
failure means the surface is not ready. Informing prompts have no single right
answer and exist to produce evidence for a decision — they are recorded, never
scored.

**Observation is server-side.** The debug log records every statement as
`caller` and `executed`, with a `q####` correlation tag, the rewrites applied,
and whether the caller supplied a time window at all. Read that
alongside the agent's own report; where the two disagree, the log is right, and
the disagreement is itself a finding about whether self-reports can be trusted.

---

## Gating prompts

### G1 — Token grain

> Using the Phoenix SQL tools, what is the total number of LLM prompt tokens
> recorded for the project `fixture-tokens`?

| | |
|---|---|
| **Correct** | 300 |
| Summed `cumulative_*` | **600** — subtree totals restated at the root |
| **Tests** | the best-documented trap, and whether `promoted_columns_note` is read at all |

### G2 — Time window

> Using the Phoenix SQL tools, across the projects whose names begin
> `fixture-window`, which one consumed the most LLM prompt tokens, and how many?

| | |
|---|---|
| **Correct** | `fixture-window-old-and-large`, 999,000 |
| **Tests** | that reading all of history is the default, and that old data is reachable |

**Retired as a trap, 2026-08-02, and kept as a plain question.** This prompt
existed to measure whether an agent noticed that `executeSql` silently imposed a
trailing seven-day window — a hazard the surface created rather than one the data
contained. Every cold agent across three model tiers and both backends noticed it
and worked around it by passing explicit bounds, which is what settled the
argument: a bound that costs one parameter to defeat stopped no determined
caller, and for anyone less careful it answered a different question than the one
asked while reporting success.

The default window has been removed. A query with no bounds now reads all of
history. The row and byte
caps bound the answer; the statement deadline bounds the work. Explicit
A single endpoint is
honoured on its own rather than completed from a default.

The two fixture projects remain because the question is still worth asking — the
old project's span is dated well outside any window a caller would think to
guess, so an agent that invents a recency filter of its own still gets it wrong.

### G3 — Promotion gap

> Using the Phoenix SQL tools, what is the total number of LLM prompt tokens
> recorded for the project `fixture-promotion`?

| | |
|---|---|
| **Correct** | 556,000 |
| Promoted column only | **1,000** — 555,000 sit on a CHAIN span and are never promoted |
| **Tests** | whether the schema's own advice is followed off a cliff; found by an agent, not by us |

**Observed failure, 2026-08-02.** An agent answered 1,000 and defended it with
three pieces of evidence: the CHAIN span's promoted column is NULL, its
`cumulative_*` is 0, and the schema says to prefer promoted columns. Those are
not three pieces of evidence. All three are consequences of a single line in
ingestion that gates promotion on `span_kind = 'LLM'`, so the agent read a
system's blind spot as the system's testimony, and had no way to discover the
difference from inside the surface.

That is a defect in what we published, not only in what the agent concluded. The
schema note now states that promotion is conditional. Re-running this prompt
measures whether saying so is enough, which is the only way to find out whether
such warnings belong in the discovery payload or the trap is simply unwinnable.

### G4 — Dataset revisions

> Using the Phoenix SQL tools, how many examples are in the dataset
> `fixture-dataset` at its latest version?

| | |
|---|---|
| **Correct** | 2 |
| Counted revision rows | **5** |
| Counted examples, ignored deletes | **3** |
| **Tests** | the untaught trap — nothing in discovery mentions `revision_kind` |

### G5 — Dangling trace links

> Using the Phoenix SQL tools, how many runs does the experiment
> `fixture-experiment-real` have, and how many of them still have their trace?

| | |
|---|---|
| **Correct** | 3 runs, 1 with a surviving trace |
| Inner join to traces | **1 run** — the other two vanish silently, and the second number is right by luck |
| **Tests** | the cross-area link the plan worries most about |

Both numbers are required, and the second alone does not distinguish a correct
answer from a wrong one: an inner join reports one surviving trace *and* one run,
so only the pair separates the two.

**Fixture correction, 2026-08-02.** The surviving trace previously held no spans,
which made "still has a trace" and "has a trace worth opening" two different
questions with two different answers. An agent correctly refused to collapse
them and reported both, which is a fixture defect masquerading as a hedge. The
trace now carries two spans, so the join is the only thing under test. The
earlier wording, "a usable trace", is what invited the ambiguity and has been
replaced.

### G6 — Attribute shapes

> Using the Phoenix SQL tools, for the project `fixture-shapes`, read the
> retrieved document content and the team recorded in metadata for the span there.

| | |
|---|---|
| **Correct** | `chunk` and `core` |
| Plausible wrong paths | **NULL** from `$.metadata.team` and `$.retrieval.documents."0"…` |
| **Tests** | silent-null rate; a miss is indistinguishable from absent data |

### G7 — Percentiles and time series

> Using the Phoenix SQL tools, for the project `fixture-workload`: what is the
> p50 and p95 span latency in milliseconds, and which hour had the most spans?

| | |
|---|---|
| **Correct** | p50 = 80 ms, p95 = 900 ms, busiest hour 2026-07-31 15:00 with 32 spans |
| Degenerate | p50 == p95 means the latency expression or the percentile is wrong |
| Large negative or start-time ordered | the `latency_ms` rewrite has lost its parentheses |
| **Tests** | the capability half — a uniform fixture would pass a broken implementation |

Either grouping is accepted, because the fixture no longer lets them disagree:
hour 15 wins both by absolute calendar hour, uniquely at 32 spans against 24,
and by hour of day, at 80 spans against 24.

**Fixture and oracle corrections, 2026-08-02.** Three separate faults, all found
by running this prompt. The three days previously carried identical peaks, so
the busiest absolute hour was a three-way tie while the oracle used `max()` and
published whichever it happened to meet first — grading a probe on which reading
it guessed. The most recent day is now busier, and the seeder raises an error
rather than publishing a peak that is not unique. Separately, the latency oracle
was computed over sampled child spans alone while any query sees roots and
grandchildren too, so it published a p95 of 1500 that no query could return; it
now covers every span. Finally it selected a value at a truncated index while
both backends interpolate, so it now interpolates too.

### G8 — Time bucketing

> Using the Phoenix SQL tools, for the project `fixture-workload`, produce the
> count of spans per hour and tell me which hour is busiest.

| | |
|---|---|
| **Correct** | 18 hourly buckets; peak 2026-07-31 15:00 at 32 spans |
| Refused outright | the hour-bucketing function is admitted on one backend and not the other |
| **Tests** | that the natural spelling of a time series is admitted at all |

This exists because bucketing was broken in both directions at once and no
prompt covered it. `date_trunc` was admitted on SQLite, which has no such
function, so it failed at execution; `strftime`, which SQLite does have and the
authorizer already permitted, was refused during admission because it parses to
a class named after neither the caller's spelling nor the engine's. Grouping a
series by hour is the most common analytic operation there is, and it worked by
neither name.

### G9 — The advertised latency column

> Using the Phoenix SQL tools, for the project `fixture-workload`, use the
> `latency_ms` column to report how many spans took longer than 2000 ms, and the
> longest span duration.

| | |
|---|---|
| **Correct** | 4 spans over 2000 ms; slowest 2600 ms |
| Zero spans over the threshold | the predicate form compares seconds against a millisecond number |
| Large negative duration | the substitution lost its parentheses and computes `end - (start × 1000)` |
| **Tests** | a column we advertise, exercised as advertised, in both positions |

The threshold and the maximum are asked together because the column was broken
*differently* in each position: the predicate omitted the conversion to
milliseconds entirely while the projection mis-grouped its arithmetic. A prompt
that used only one of the two would have passed while the other stayed wrong.
The count is also chosen to avoid a tie — four spans sit at 2600 ms and the next
distinct duration is 1500 ms, so no ranking question turns on an arbitrary
tiebreak.

This one names the column deliberately, departing from the bare-question rule
above, and the departure is the point. Every other prompt measures what an agent
discovers; this measures whether a feature we published does what we said. An
agent that quietly writes its own timestamp arithmetic instead — which is what
happened when this went untested — produces a correct answer that tells us
nothing about the column, so the instruction removes that escape.

---

## Informing prompts

Recorded, not scored. Each produces evidence for a decision the plan has not made.

### I1 — Root cause navigation

> Using the Phoenix tools, an evaluator flagged answers in the project
> `fixture-rootcause` as incorrect. Diagnose why. Group what you find.

**What good looks like:** three distinct failure modes, four instances each, with
the cause identified *away* from the flagged span — a sibling retriever returning
unrelated passages, a parent system prompt written for the wrong audience, and a
tool that timed out. The flagged span is always the `LLM` span and reads normally
in all three, so an agent that inspects only it cannot separate them.

**Informs:** whether the SQL surface can stand alone. This is the workload a competitor with both a
SQL surface and typed tools serves entirely with typed tools. If SQL handles it
well, SQL can carry it; if it needs many round trips, retiring the typed
navigation tools in favour of SQL is the wrong call.

**Also watch:** whether `span_annotations.explanation` is used. It is the first
evidence a human triager reads, and it describes the symptom without naming the
cause.

### I2 — Evaluator triage

> Using the Phoenix SQL tools, for the experiment `fixture-experiment-baseline`,
> which evaluation metrics are worth investigating and which are not?

**Expected classification:** `answer_correct` 0.45 struggling; `helpfulness` 0.85
and `no_crash` 0.95 interesting; `format_valid` 1.0 perfect; `disabled_check` 0.0
always-zero and probably a disabled feature.

**Informs:** whether an agent triages before analysing, or samples arbitrarily.
The heuristic is one `GROUP BY` here, where a typed surface needs a dedicated
tool — the clearest case found so far where SQL is *better* rather than merely
different.

### I3 — Segmentation

> Using the Phoenix SQL tools, for the experiment `fixture-experiment-baseline`,
> the metric `answer_correct` fails often. Is there a pattern in which examples
> fail?

**Planted signal:** hard examples average about 0.16, easy ones about 0.78,
with real spread inside each class. Segmenting by the difficulty recorded in
the example metadata surfaces it.

The exact means are sampled, so read them from the oracle rather than from
here. Difficulty is shuffled rather than alternating, which matters: when it
tracked the example id exactly, an agent correctly refused to call the
segmentation a finding, because no query could separate "difficulty explains
the failures" from "every other row was labelled hard".

**Informs:** whether the JSON half of the surface supports the analysis it was
enabled for.

### I4 — Regression with a change point

> Using the Phoenix SQL tools, for the project `fixture-evaltrend`, has any
> evaluation metric got worse recently? If so, when did it change?

**Planted signal:** `groundedness` steps from 1.0 to 0.4 four days ago;
`format_valid` stays flat throughout.

**Informs:** whether the agent isolates the changed metric or flags both. Naming
the control as also-regressed is a failure even though it is not a wrong number.

### I5 — Coverage gap

> Using the Phoenix SQL tools, in the project `fixture-rootcause`, are there
> failures that no evaluator has scored?

**Expected:** 4 traces carrying no annotation at all.

**Informs:** the value of allowlisting `annotation_configs`. The question people
actually want is "which failure modes have no configured evaluator," which is not
expressible today — this is the closest approximation, and how well it lands is
the argument for closing that gap.

---

## Running them

Concurrency is fine. The database is read-only to the agents, the fixture is
scoped by name, and the `q####` correlation tags keep interleaved log lines
attributable.

**Do not re-seed while agents are running.** Seeding is idempotent but not
atomic; an agent querying mid-purge sees a half-built fixture and reports a wrong
answer that looks like a surface defect.

**Record per agent:** model and reasoning effort, final answer, token count,
tool-call count, wall clock, statements attempted, and whether the self-report
matches the log.

**Model is a variable, not a constant.** The 2026-08-02 run used the strongest
available model at its highest reasoning effort, which measures the surface
under the most favourable conditions it will ever see. That is the right control
for "is this ready" and the wrong one for "who is this for". A trap that only a
frontier model at maximum effort avoids is a trap most callers will fall into,
and a pass rate cannot tell the difference between a surface that teaches well
and a caller that was strong enough not to need teaching.

Re-running the same prompts on weaker models separates those two. The prompts
whose margin narrows first are the ones where the discovery payload is carrying
the least weight, and they are where documentation earns more than policy does.

**Two aggregate metrics**, both from the plan: **fabricated-path rate**, whether
an agent invented an attribute path that does not exist, and **silent-null rate**,
whether a real path was addressed the wrong way. The second is the one G6 exists
to measure, and it is the failure mode with no runtime control anywhere.

**Sample size.** Three runs of the same prompt gave 3/3 agreement previously,
which was enough to establish that one earlier result was not luck. One run of
each is enough to find blockers; three of any prompt that fails is what
distinguishes a real gap from a bad draw.
