# Advanced Analytics Use Cases: Questions a Fixed Interface Cannot Ask

**Revised 2026-08-02** after a correctness pass. Four availability labels were
wrong, one example query would not have been admitted, and the flagship latency
sketch was algorithmically unsound. Corrections are marked inline rather than
quietly applied, because the pattern in them is instructive: every error was an
optimistic claim about what the surface already supports.

**Date:** 2026-08-01
**Status:** brainstorm, not a commitment
**Companion:** [`seed_analytics_fixture.py`](seed_analytics_fixture.py)

**What the fixture does and does not support.** It is trap-first: annotation
fan-out, soft-deleted models, dangling `experiment_runs.trace_id`, revision
history, plus a workload region with a latency distribution, hourly buckets and
cost rows. That makes the *join shapes* below runnable and the traps detectable.
It does **not** make the quality cases meaningfully answerable — there are no
scored annotations that disagree across annotator kinds, and no costs joined to
outcome labels. Claims of testability below name the region they rely on, or say
they have none.

---

## The thesis

The temptation with a SQL surface is to reimplement the product in it: span lists, latency charts, cost by project. Those already exist, they are better in the UI, and an agent that rebuilds them adds nothing but a slower path to the same answer.

**The value of arbitrary SQL is the questions the interface structurally cannot ask.** A UI has to decide in advance which dimensions you can slice by, which entities you can join, and which aggregations you can request. Every one of those decisions forecloses a question. SQL forecloses nothing, so its return is concentrated entirely in the questions a fixed interface could never have anticipated:

- **Correlations across areas** — does offline eval score predict online failure? Nothing in the product joins experiments to production traces, because that join is a research question rather than a feature.
- **Counterfactuals** — what would last month have cost on a different model? The data supports it; no screen asks it.
- **Cohorts defined by behaviour rather than by attribute** — "sessions where the agent called the same tool three times running" is not a filter, it is a query.
- **Ratios between things measured in different tables** — cost per *successful* answer requires costs, annotations, and a definition of success that varies per team.
- **Unknown-unknowns** — which attribute keys appear in failing traces and not in passing ones. You cannot put that on a dashboard because you do not know what it will return.

**Three kinds of "not yet".** The labels below distinguish them, because they
have different owners and wildly different costs:

- **surface gap** — the data exists and the allowlist or manifest refuses it. A
  policy decision plus fixtures.
- **instrumentation gap** — nothing records the value. Requires an SDK change and
  then waiting for data.
- **labelling gap** — the data exists but depends on a team annotating
  consistently. No amount of engineering supplies it.

Everything below is chosen against that filter. Where a case is already well served by the UI, it is called out as such and deprioritised, however impressive the SQL.

A second filter: **LLM observability is not APM.** Non-determinism, per-token cost, subjective quality, and agentic amplification make several questions here meaningless in a normal APM tool. Those are the ones worth building for.

---

## 1. Money

### 1.1 Cost per successful outcome

**Question:** what does a *good* answer cost, as distinct from what a call costs?

Cost per call is a vanity metric — it falls when quality falls. The number a team can act on is spend divided by outcomes that were actually acceptable, which requires joining costs to whatever that team uses as a success signal.

```sql
WITH judged AS (
  SELECT s.id AS span_rowid,
         MAX(CASE WHEN a.label = 'correct' THEN 1 ELSE 0 END) AS ok
  FROM spans s
  JOIN span_annotations a ON a.span_rowid = s.id AND a.name = 'correctness'
  GROUP BY s.id
)
SELECT p.name,
       SUM(c.total_cost)                                  AS spend,
       SUM(j.ok)                                          AS good_answers,
       SUM(c.total_cost) / NULLIF(SUM(j.ok), 0)           AS cost_per_good_answer
FROM span_costs c
JOIN judged j   ON j.span_rowid = c.span_rowid
JOIN traces t   ON t.id = c.trace_rowid
JOIN projects p ON p.id = t.project_rowid
GROUP BY p.name
```

**Why SQL:** the definition of success is per-team and lives in an annotation name the product cannot know in advance.

**Grain warning, and it is the same class as 5.1's inner join.** This joins costs
to annotations at span grain, but in real data annotations are usually attached
to the *root* span while costs attach to the *child* LLM calls. Joined naively,
the two sets barely intersect and the query returns a confident, tiny number. The
fix is to roll costs up to the annotated ancestor first. Silent, not an error —
the closest cousin in the fixture is the annotation fan-out trap.

**Needs:** cross-grain join, `NULLIF` (admitted). Runnable; correctness depends on
resolving the grain mismatch above. **Labelling gap** for the success signal.

### 1.2 The cache-read tax

**Question:** what fraction of prompt spend is re-sending context the model has already seen?

This is specific to agentic loops and invisible in per-call cost. A conversation that re-sends its history every turn has prompt tokens growing quadratically in turns, and the bill reflects it long before anyone notices the design.

`span_cost_details.token_type` already distinguishes token classes, so the ratio is a group-by — but only if instrumentation records cache reads separately, which is worth checking before promising the number.

**Why SQL:** the ratio is between two rows of the same table, which no cost screen exposes.
**Needs:** **instrumentation gap.** `span_cost_details.token_type` is the right
shape, but nothing guarantees cache reads are recorded as a distinct type; the
fixture seeds `input`/`output` only. Confirm against real data before promising
the number — the cold-agent runs found Claude Code's prompt counts include cache
reads with no breakdown available, which is exactly this gap.

### 1.3 Counterfactual repricing

**Question:** what would last month have cost on a different model?

**Correction.** An earlier draft said `generative_models` carries pricing. It does
not. Its columns are `name, provider, start_time, name_pattern, is_built_in,
created_at, updated_at, deleted_at, id` — no rates. Pricing lives in
**`token_prices`** (`model_id, token_type, is_prompt, base_rate, customization`),
which is **not in the manifest**.

**Why SQL:** it is a join between recorded volume and hypothetical price. No
product surface offers hypotheticals.

**Needs:** **surface gap, hard blocker.** `token_prices` must be allowlisted, with
its own security review — rates are commercial configuration, not telemetry.
Until then this is not a query anyone can write, and the earlier "needs pricing
columns" framing understated it. `span_cost_details.tokens` already carries the
volumes, so the remaining work is entirely policy.

### 1.4 The tail tax

**Question:** what share of spend comes from the longest 1% of conversations?

If the answer is "half", the cost problem is a runaway-loop problem, not a model-choice problem — and those have completely different fixes.

**Needs:** `percentile` over a per-session aggregate in a CTE. Runnable today;
testable against the workload region, which has a deliberately skewed latency
distribution so a percentile is not merely the mean.

---

## 2. Speed

### 2.1 Critical path by span kind

**Question:** in a slow trace, where did the time actually go — retrieval, generation, or tools?

Averaging latency by span kind is misleading, because children overlap their
parents. The useful decomposition is self-time: a span's duration minus the time
its children actually occupied.

**Correction — the obvious sketch is wrong, and wrong in a way worth naming.** An
earlier draft summed child durations per parent and subtracted. That
double-counts concurrent siblings: two children running in parallel for 500ms
each occupy 500ms of wall-clock, not 1000ms, so the subtraction can drive
self-time negative. Any agentic trace with parallel tool calls hits this
immediately, and the result looks like data corruption rather than a bad formula.

Exclusive time needs the **union** of child intervals, not their sum — sort the
child start/end points, merge overlaps, then subtract the merged span. That is a
gap-and-island problem, which is expressible with window functions but not with
the ranking functions currently allowed.

Two honest options:

- **Approximate**, and say so: `MAX(child.end_time) - MIN(child.start_time)` as
  occupied time. Correct when children are sequential, an over-estimate when they
  overlap — the opposite bias to the sum, and it never goes negative.
- **Wait for the union**, which needs `LAG`/`LEAD` (see blockers).

**Why SQL:** self-time is a derived quantity nothing stores, and the UI's
waterfall shows it for *one* trace rather than aggregating across thousands.

**Needs:** approximate form runnable today. Exact form is a **surface gap**
pending `LAG`/`LEAD`.

### 2.2 Agentic amplification

**Question:** how many model calls does one user turn cost, and is that number growing?

The single best early warning that an agent is degrading. A rising ratio means the loop is working harder for the same result, and it moves before latency or cost do because it is upstream of both.

**Needs:** **surface gap.** The rollup and time bucketing are fine, but the trend
needs `LAG` to compare a bucket against its predecessor, and only the ranking
window functions (`row_number`, `rank`, `dense_rank`, `ntile`) are allowlisted —
`LAG` and `LEAD` are refused. Without them the trend must be computed client-side
from a bucketed series, which works but forfeits the "one statement" advantage.

### 2.3 Queueing versus working

**Question:** how much of a trace's wall-clock is spans *waiting* rather than running?

The gap between a parent's start and its first child's start, summed. Large gaps point at orchestration overhead rather than model latency — a different team's problem entirely.

**Needs:** **surface gap**, same as above — measuring a gap between consecutive
rows is what `LAG` is for.

---

## 3. Quality

### 3.1 Where humans and judges disagree

**Question:** which spans did a human annotator and an LLM judge score differently?

This is the highest-value quality query I can think of, and it is almost never asked. Disagreement is not noise — it concentrates exactly on the ambiguous cases, which are the ones worth reading, worth adding to the dataset, and worth rewriting the rubric for. A team that reads twenty disagreements learns more than one that reads a thousand random traces.

**Correction — the earlier example used `ABS`, which admission refuses.** Ordering
by the signed difference twice, or by `CASE`, gets the same twenty rows:

```sql
SELECT s.id, h.score AS human, l.score AS judge,
       CASE WHEN h.score > l.score THEN h.score - l.score
            ELSE l.score - h.score END AS gap
FROM spans s
JOIN span_annotations h ON h.span_rowid = s.id AND h.annotator_kind = 'HUMAN'
JOIN span_annotations l ON l.span_rowid = s.id AND l.annotator_kind = 'LLM'
                       AND l.name = h.name
ORDER BY gap DESC
LIMIT 20
```

That `abs` is refused while `CASE` is admitted is arbitrary rather than principled
— `abs` is pure, total and bounded. It is a good candidate for the allowlist, and
this query is the argument for it.

**Why SQL:** a self-join on one table filtered by two annotator kinds. No
annotation view is shaped like that.

**Needs:** runnable as rewritten. **Labelling gap** for the data — it requires a
team to score the same spans both ways, and the fixture does not seed divergent
scores, so this is not testable against the fixture today.

### 3.2 Does retrieval quality drive answer quality?

**Question:** do traces with low-relevance retrieved documents produce worse answers?

If yes, fix retrieval. If no, stop tuning the retriever and look at the prompt. Teams routinely spend months on the wrong one of those, and this query settles it.

**Needs:** **surface gap** — `document_annotations` is not allowlisted, and
admitting it requires an area review rather than a manifest edit — plus a
**labelling gap**, since relevance scores have to exist.

### 3.3 Regression bisect

**Question:** quality dropped last Tuesday — what changed?

Correlate a daily eval-score series against candidate explanatory variables: prompt version, model name, retrieved-document count, input length. Not causal, but it turns "something broke" into three hypotheses in one query.

**Why SQL:** it is an ad-hoc correlation across areas that nobody would build a screen for, because the candidate variables differ every time.
**Needs:** **surface gap** on the prompts area, which needs a column-by-column
review before it can be allowlisted. Attribute extraction and time bucketing are
available.

### 3.4 Cost–quality frontier

**Question:** which models are Pareto-optimal for us — cheaper *and* at least as good?

Average eval score against average cost per call, grouped by model. Points dominated on both axes should be retired. This is a two-axis question, and dashboards are built on one axis at a time.

**Uniqueness: lower.** This is closer to a dashboard than the rest of this
section — two axes grouped by model is a chart someone will eventually build, and
SQL's advantage over it is convenience rather than expressiveness. Kept because
the answer matters, not because only SQL can reach it.

**Needs:** costs joined to annotations joined to `generative_models`. Runnable;
**labelling gap** for the quality axis.

---

## 4. Agentic behaviour

### 4.1 Loop detection

**Question:** which traces called the same tool repeatedly with the same arguments?

The signature of an agent stuck in a cycle. Expensive, slow, and usually invisible until someone reads a trace by hand.

```sql
SELECT t.trace_id, s.name AS tool, COUNT(*) AS calls
FROM spans s
JOIN traces t ON t.id = s.trace_rowid
WHERE s.span_kind = 'TOOL'
GROUP BY t.trace_id, s.name
HAVING COUNT(*) >= 3
ORDER BY calls DESC
```

**Correction — this query does not answer its own question.** It groups by tool
*name*, so an agent legitimately calling one tool with three different arguments
is indistinguishable from one stuck calling it with the same arguments. The
argument comparison is the requirement, not a refinement.

Grouping by the extracted argument value works where arguments are small and
scalar:

```sql
GROUP BY t.trace_id, s.name, json_extract(s.attributes, '$.input.value')
```

Hashing would be more robust for large arguments, but `md5` is refused, so that
route is a **surface gap** today.

**Why SQL:** "three or more of the same thing in one trace" is a `HAVING` clause,
not a filter any UI offers.

**Needs:** the name-only form runs today and is a weak proxy. The argument form
runs where arguments extract to a scalar.

### 4.2 Failure taxonomy without reading traces

**Question:** what are the top failure shapes, grouped rather than enumerated?

Group error spans by `span_kind` and the first line of `status_message`. It will not match a careful open-coding pass, but it takes seconds instead of an afternoon and tells you where to spend the afternoon.

**Needs:** **surface gap.** `substring` and `lower` are both refused, so "first
line of the message" is not expressible; `LIKE` against known patterns is a weak
substitute that requires guessing the patterns in advance, which defeats the
purpose of taxonomising. This case is blocked in practice, and an earlier draft
saying otherwise was wrong.

### 4.3 Abandonment

**Question:** what fraction of sessions end on an error or a tool failure rather than an answer?

Session-level outcome is the metric closest to user experience and the one least visible in span-level dashboards.

**Needs:** `project_sessions` joined through traces, plus `row_number` to find the
last span per session — a ranking window, which is allowlisted. Runnable today;
testable against the workload region, which seeds three sessions.

### 4.4 The thrash metric

**Question:** which traces did the most work for the least output?

Span count divided by output length. High values are loops, retries, or an agent talking to itself. A crude proxy that finds real problems.

**Needs:** attribute extraction runs today, but output *length* needs a string
function — **surface gap**. A count of spans per trace is the runnable proxy.

---

## 5. Datasets and experiments

### 5.1 Does offline eval predict online failure?

**Question:** do the examples our experiments pass correspond to the things production gets right?

The single most valuable question in this list, and currently unanswerable by any product surface, because it spans the offline and online halves of the system. If the answer is no, the eval suite is theatre and everyone should know that.

**Needs:** `experiment_runs.trace_id → traces.trace_id`, which is nullable, unenforced, and severed by retention. **This is the query the cross-area design exists for**, and it is also the one most exposed to the dangling-reference trap — an inner join here silently answers a different question.

### 5.2 Dataset coverage of production failures

**Question:** which production failure modes have no representative example in the dataset?

Points directly at the next examples worth adding. Approximated by comparing failure-mode labels on production spans against labels on dataset examples.

**Needs:** cross-area join runs today; **labelling gap** on both sides.

### 5.3 Dataset staleness

**Question:** which examples have not been revised since version N, and are they the ones still failing?

`dataset_example_revisions` carries full version history. Old-and-failing examples are either genuinely hard or wrong.

**Needs:** latest-revision-per-example with `DELETE` excluded — the registered
trap. Runnable today, and testable: the fixture's dataset region gives 2 as the
correct answer against 5 for counting revision rows and 3 for ignoring deletes,
so a wrong result identifies which mistake was made.

---

## 6. Genuinely speculative

The ones I am least sure about, kept because the upside is highest.

### 6.1 Unknown-unknowns: attribute keys that predict failure

Enumerate attribute keys with `json_each`, then compare their prevalence in failing traces against passing ones. Keys that are strongly over-represented in failures are candidate causes nobody thought to look for — a specific tool, a particular retrieval source, a feature flag.

This is only possible because attributes are queryable rather than merely fetchable. It is the clearest argument for the JSON half of the surface, and it cannot be a dashboard because nobody knows what it will return.

**Needs:** `json_each` key enumeration runs today. **Labelling gap** for the
outcome signal, unless `status_code` is used as a crude proxy — which it can be,
making this the rare speculative case that is fully runnable now.

### 6.2 Conversation shape clustering

Reduce each session to a string of span kinds — `C-L-T-L-C` — and group by that signature. Common shapes are your real user journeys, as opposed to the ones in the design doc. Rare shapes are where things go wrong.

**Needs:** **surface gap.** `GROUP_CONCAT` on SQLite and `STRING_AGG` on Postgres
are both refused. A good candidate precisely because one function unlocks a whole
question class rather than a single query.

### 6.3 First-token latency versus total

If instrumentation records streaming start, the split between time-to-first-token and total generation separates perceived from actual latency. Those have different fixes and teams routinely conflate them.

**Needs:** **instrumentation gap**, and possibly an unfixable one — if the SDK
does not record a first-token timestamp, no query can recover it.

### 6.4 The cost of being wrong

Join the spend on traces that were annotated as failures. This is the number that funds the quality work — not "our eval score is 0.82" but "we spent $4,000 last month on answers we know were wrong."

**Needs:** costs joined to annotations, with the same grain caution as 1.1 —
annotations on roots, costs on children. **Labelling gap** for the failure signal.
Probably the single most persuasive query here, which is why it is promoted below.

---

## What is blocked, and what it would unlock

| Blocker | Kind | Unlocks |
|---|---|---|
| `token_prices` not allowlisted | surface | counterfactual repricing (1.3) — **hard blocker**, pricing is not on `generative_models` |
| `LAG` / `LEAD` not allowlisted | surface | exact self-time (2.1), amplification trend (2.2), queueing (2.3) |
| `substring` / `lower` not allowlisted | surface | failure taxonomy (4.2), thrash metric (4.4) |
| `GROUP_CONCAT` / `STRING_AGG` not allowlisted | surface | conversation shape clustering (6.2) |
| `abs` not allowlisted | surface | tidier disagreement query (3.1); a `CASE` works meanwhile |
| `md5` not allowlisted | surface | robust argument hashing for loop detection (4.1) |
| `document_annotations` not allowlisted; needs an area review | surface | retrieval quality drives answer quality (3.2) |
| Prompts area not allowlisted; needs a column-by-column review | surface | regression bisect against prompt version (3.3) |
| Cache-read token types may be unrecorded | instrumentation | the cache tax (1.2) |
| First-token timestamp may be unrecorded | instrumentation | perceived vs actual latency (6.3) |
| Consistent annotation names and scores | labelling | 1.1, 3.1, 3.2, 3.4, 5.2, 6.4 — most of the quality section |

**The string and window-function gaps are worth more than their individual rows.**
Four cases are blocked on two small families of pure, total functions. That is a
better return on an allowlist decision than anything else on this list.

**FK join hints: resolved.** An earlier version listed missing join guidance as a
blocker. `describeSqlSchema` now reports direct edges and the path to each area
root, so `spans → traces → projects` is discoverable rather than folklore.

---

## Practicality, which expressiveness does not settle

Every query above is written as though it runs against all the data. It does not.

**The injected time window** defaults to seven days, so any trend, cohort or
"last month" question must pass explicit bounds or it silently answers about a
week — and for ranking questions that changes the winner, not just the totals.

**Row limits** are clamped, so a query returning per-span rows will be truncated;
these questions need to aggregate server-side rather than paginate.

**Cost is real.** Several of these scan the span table with JSON extraction on
every row. On a large deployment the statement timeout is a live constraint, not
a formality, and the sensible pattern is to narrow by project and window first.

None of this changes what is *expressible*. It changes what is *practical for an
agent*, which is the only thing that matters for the surface these were written
for.

---

## If only three were built

**1.4 the tail tax**, **6.4 the cost of being wrong**, and **5.1 does offline eval
predict online failure**.

**Revised from an earlier list** that named 3.1 instead of 6.4, while separately
calling 6.4 the most persuasive query in the document — an inconsistency worth
correcting rather than hiding. 3.1 is the better *investigative* tool, but it
needs a labelling discipline most teams do not yet have, whereas 6.4 needs only a
failure signal and produces a number that funds the work: not "our eval score is
0.82" but "we spent four thousand dollars last month on answers we know were
wrong."

Each of the three changes a decision. The tail tax says whether to fix loops or
change models. The cost of being wrong says whether quality work gets funded. The
offline-online correlation says whether the eval suite is worth maintaining.

The test to apply to anything added later: **if the answer came back, would
someone do something differently?** A surprising number of impressive queries fail
it — and, as this revision showed, a surprising number of confident availability
claims fail a simpler test than that.
