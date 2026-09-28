---
name: phoenix-experiment
description: >
  Read, compare, or create dataset-backed experiment runs. Trigger when the user wants to read experiment quality, latency, or cost; compare two or more experiments; decide whether a change actually helped; inspect per-example diffs, evaluator explanations, or a hypothesis already recorded on an experiment; or start a recorded run because a comparison still needs one. Use for "did this prompt improve things", "compare these two experiments", "which examples got worse", "why did latency jump", "summarize this experiment", "run this over the dataset". Do NOT trigger on: (1) drafting a task with no dataset-backed run in scope, (2) authoring or refining an evaluator's logic or rubric, (3) cross-trace failure diagnosis with no experiment in scope (use `phoenix-error-analysis`).
summary: Create a missing experiment run when a comparison needs one, then compare runs per-example across quality, latency, and cost.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.1.0"
---

# Experiments

An experiment is one run of a task over every example in a dataset, captured with its outputs and
any evaluator annotations so it can be reviewed and compared later. Experiments turn "this feels
better" into evidence: a per-example record you can score, aggregate, and diff against an earlier
run.

This skill covers the whole loop. Compare runs that already exist. Create a run only when the
comparison still needs one.

## Already There, Or Still Missing

List the experiments on the dataset and read their metadata before deciding. Each may carry a
hypothesis, the variable that changed, the baseline it built on, and observations from a later
session. That record tells you which comparison is still open. The annotation names already on the
runs are the quality axes you can actually compare — do not invent a metric the runs never scored.

- The user may have named no experiments and want a task run over a dataset.
- They may have a baseline and still need a candidate.
- They may already have both, and only want the comparison.
- They may already have both, and the verdict still calls for another run.

If every run the comparison needs is already there, compare them. Do not create another run.

If a run is missing — no baseline, no candidate, or the next hypothesis still needs a run — create
only that run, then compare. If you cannot start a run, say what is missing and stop. Do not invent
outputs.

After the verdict, continue only when the user asked to keep iterating and the goal is not met.
Form the next single-axis hypothesis, create that run, and compare again. When the evidence meets
the goal, keep the task the evidence supports or the accepted tradeoff selects.

## Creating The Missing Run

Pause only when the goal is unclear or a tradeoff needs a human.

1. Confirm the dataset represents the task: the input fields the run consumes, the expected outputs,
   and the failure modes worth catching. Context the task must see — a schema, retrieved documents,
   a policy boundary — belongs in `input`, never in `reference`, which the run under test must not
   see. When reading a dataset's `reference`, triage its provenance before trusting it as an answer
   key — it may be golden, a baseline snapshot, or absent.
2. Make sure the task is well formed before running it — what it must do, the variables it reads,
   the output format, and the constraints needed for consistent scoring. An ill-formed baseline
   wastes a run.
3. Inventory the evaluators already on the dataset. What is already scored is what the next run can
   measure. Anything example-level and scorable belongs on an evaluator annotation — a reviewable
   score a person can scan. Reuse an evaluator that matches, and add one only when none measures
   the failure you saw. Do not park that judgment in experiment metadata.
4. Run the task over the dataset as a recorded experiment. Stage the scaffold at creation —
   hypothesis, changed variable, baseline — so a later session can read the comparison rather than
   guess at it. Use repetitions greater than one when you need a consistency read, not a point
   estimate.
5. Change exactly one axis from the baseline: prompt, model, invocation params, tool guidance, or
   dataset scope. Changing several at once makes the later comparison uninterpretable.

Then compare.

## Compare

Pause only if the goal is unclear or a tradeoff needs a human.

1. **Pick the pair.** Resolve whatever the user used to point at an experiment. A **name** is the
   experiment's name. An **id** is the stable experiment id. A **number** is the sequence for that
   dataset: 1 is the oldest run, and each later run gets the next number, in the order they were
   created. A number is not an id — list that dataset's experiments and match the sequence before
   fetching runs. Names can repeat; the id cannot. If they did not point at a pair, take the latest
   complete run as the candidate and the experiment its metadata names as baseline (or the previous
   complete run on the same dataset version).
2. **Read the scaffold.** `metadata` (and sometimes `description`) holds hypothesis, changed
   variable, and baseline. Do not guess the independent variable from the name alone.
3. **Check they are comparable.** Same dataset, ideally the same dataset version. Both complete,
   with no unexplained errors (`missing_run_count` and `failed_run_count` at zero). A half-finished
   run makes averages misleading.
4. **Confirm one axis changed.** Prompt, model, params, tool guidance, *or* dataset scope — not
   several at once. If several moved, say so: the diff is still evidence, not a clean ablation.
5. **Fetch every example for both runs.** For each run, per example you need: `input`,
   `reference_output`, `output`, `error`, `latency_ms`, token counts, and the evaluator
   `annotations` (`name`, `label`, `score`, `explanation`).
6. **Line them up by example**, not by average. The join key is `example_id`, plus
   `repetition_number` when repetitions > 1. Do that in one pass with the bulk or joined read
   already available, rather than a request per example. If you only have two separate run lists,
   join those lists on that key. An averaged score hides the example a change broke. Keep splits
   separate; never fold a holdout into the headline number.
7. **Read quality, latency, and cost together.** Quality is the evaluator annotations — especially
   each judgment's **explanation**. Trust aggregates only when the run is complete with zero
   errors; a half-finished or error-laden run produces misleading summaries. Tokens are a stand-in
   for cost when you do not need a dollar figure.
8. **Report a verdict:** did the hypothesis hold, what happened on all three axes, and a few
   example ids plus explanations as evidence.

## Recording What You Learned

After the verdict, record experiment-level narrative (hypothesis held, tradeoff accepted) on that
experiment when metadata can be updated. Per-example scores already live on run annotations; do not
copy them into metadata. If metadata cannot be updated, put the observation in the answer and say
it was not saved.

A metadata update replaces the whole metadata object. It does not merge keys. **Read** the current
metadata first, then write back that object with a new timestamped note added and every existing
key left intact — `hypothesis`, `changed variable`, and `baseline` among them. A write that sends
only the new note erases the scaffold the next session needs.

## Boundaries

- Do not resume or delete experiments.
- Do not design an evaluator's logic or rubric here. Say that a score is missing when none of the
  existing annotations measure the failure you saw.
- If you cannot read something, say so rather than guessing from an earlier turn.
- When a needed write — a dataset edit, a run setting, an invocation parameter — has no available
  path, say what has to change rather than improvising it.

## Things To Avoid

- Don't create a run when the user only asked to compare runs that already exist.
- Don't trust aggregates while a run is in progress or has unexplained errors.
- Don't change more than one axis between a run you create and the baseline it will be compared to.
- Don't treat a comparison as a clean ablation when more than one axis changed.
- Don't average a guarded holdout split back into the headline number.
- Don't re-run a comparison a previous session already settled; read the scaffolding first.
- Don't read quality in isolation — a higher score that doubled latency or cost is not a win.
- Don't declare a winner from means alone; cite the examples that moved, with explanations.
- Don't record an example-level score as metadata. That belongs on an evaluator annotation.
