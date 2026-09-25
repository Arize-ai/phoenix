---
name: phoenix-experiment-analyzer
description: >
  Analyze and compare dataset-backed Phoenix experiment results that have already run. Trigger when the user wants to read experiment quality, latency, or cost; compare two or more experiments; decide whether a change actually helped; inspect per-example diffs, evaluator explanations, or a hypothesis already recorded on an experiment. Use for "did this prompt improve things", "compare these two experiments", "which examples got worse", "why did latency jump", "summarize this experiment". Do NOT trigger on: (1) starting or running a new experiment, authoring a prompt, or driving a playground recorded run, (2) authoring or refining an evaluator's logic or rubric, (3) cross-trace failure diagnosis with no experiment in scope (use `phoenix-error-analysis`).
summary: Read experiments that already ran and compare them per-example across quality, latency, and cost, with a verdict backed by evidence.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.1.0"
---

# Experiment Analyzer

An experiment is one run of a prompt or pipeline over every example in a dataset, captured with its
outputs and any evaluator annotations so it can be reviewed and compared later. Experiments turn
"this prompt feels better" into evidence: a per-example record you can score, aggregate, and diff
against an earlier run.
This skill is the **read side**: look at what already ran, compare candidates, and report a verdict with evidence. It
does not start runs, author prompts, or design evaluators.

Reading, comparing, recording, and evaluating are run-path agnostic: they apply equally to
experiments created through the SDK or REST API and to experiments culled from traces.

## Before You Start: Read What Already Ran

Before declaring a winner, list the experiments on the dataset and read their metadata. Each may
carry a hypothesis, the variable that changed, the baseline it built on, and observations from a
later session. That record tells you which comparison is still open. The annotation names already
on the runs are the quality axes you can actually compare — do not invent a metric the runs never
scored.

## Recipe: Compare Two Experiments

Pause only if the goal is unclear or a tradeoff needs a human.

1. **Pick the pair.** Resolve whatever the user used to point at an experiment. A **name** is the
   experiment's name. A **global ID** is a number which indicates the stable experiment id. A **number** could also refer to the sequence
   shown in the UI for that dataset: 1 is the oldest run, and each later run gets the next number,
   in the order they were created. Names can repeat; the id cannot. If they did not point
   at a pair, take the latest complete run as the candidate and the experiment its metadata names
   as baseline (or the previous complete run on the same dataset version).
2. **Read the scaffold.** `metadata` (and sometimes `description`) holds hypothesis, changed
   variable, and baseline. Do not guess the independent variable from the name alone.
3. **Check they are comparable.** Same dataset, ideally the same dataset version. Both complete,
   with no unexplained errors (`missing_run_count` and `failed_run_count` at zero). A half-finished
   run makes averages misleading.
4. **Confirm one axis changed.** Prompt, model, params, tool-guidance, *or* dataset-scope — not
   several at once. If several moved, say so: the diff is still evidence, not a clean ablation.
5. **Fetch every example for both runs.** For each run, per example you need: `input`,
   `reference_output`, `output`, `error`, `latency_ms`, token counts, and the evaluator
   `annotations` (`name`, `label`, `score`, `explanation`).
6. **Line them up by example**, not by average. The join key is `example_id`, plus
   `repetition_number` when repetitions > 1. Do that in one pass with the bulk or joined read the
   surface already gives you, rather than a request per example. If you only have two separate run
   lists, join those lists on that key. An averaged score hides the example a change broke. Keep
   splits separate; never fold a holdout into the headline number.
7. **Read quality, latency, and cost together.** Quality is the evaluator annotations — especially
   each judgment's **explanation**. Trust
   aggregates only when the run is complete with zero errors; a half-finished or error-laden run
   produces misleading summaries.
   Tokens on the JSON are a stand-in for
   cost when you do not need a dollar figure.
8. **Report a verdict:** did the hypothesis hold, what happened on all three axes, and a few
   example ids plus explanations as evidence. 

## Recording What You Learned

After the verdict, record experiment-level narrative (hypothesis held, tradeoff accepted) on that
experiment when this surface can update metadata. Per-example scores already live on run
annotations; do not copy them into metadata. If this surface cannot write metadata, put the
observation in the answer and say it was not saved.

A metadata update replaces the whole metadata object. It does not merge keys. **Read** the current
metadata first, then write back that object with a new timestamped note added and every existing
key left intact — `hypothesis`, `changed variable`, and `baseline` among them. A write that sends
only the new note erases the scaffold the next session needs.

## Boundaries

- Do not start, resume, or delete experiments. Ask the user if a new run or evaluator is needed.
- If you cannot read something, say so rather than guessing from an earlier turn.

## Things To Avoid

- Don't trust aggregates while a run is in progress or has unexplained errors.
- Don't treat a comparison as a clean ablation when more than one axis changed.
- Don't average a guarded holdout split back into the headline number.
- Don't re-run a comparison a previous session already settled; read the scaffolding first.
- Don't read quality in isolation — a higher score that doubled latency or cost is not a win.
- Don't declare a winner from means alone; cite the examples that moved, with explanations.
