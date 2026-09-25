---
name: experiments
description: >
  Create and run a NEW dataset-backed experiment — load this only when the run to compare does not exist yet and must be produced. Reading or comparing experiments that already ran is NOT this skill; load `phoenix-experiment-analyzer` for that. Trigger when the user wants to iterate over a dataset, start a recorded run, or keep going after a verdict. Running a prompt over a dataset is implicitly an experiment — load this skill when dataset-backed work begins, before authoring evaluators for the experiment and before starting the recorded run. Do NOT trigger on: (1) reading, summarizing, or comparing experiments that already ran, including per-example diffs, latency/cost/quality of a finished run, or a recorded hypothesis (use `phoenix-experiment-analyzer`), (2) manual prompt drafting with no dataset-backed evaluation in scope (use `playground`), (3) authoring or refining an evaluator's logic or rubric (use `evaluators`), (4) cross-trace failure diagnosis with no experiment in scope (use `phoenix-experiment-analyzer`).
summary: Decide whether a new experiment run is needed, create it, then hand comparison to phoenix-experiment-analyzer.
---

# Experiments

This skill creates the run a comparison still needs. Reading the results, comparing them, and
recording the verdict belong to `phoenix-experiment-analyzer`. Load that skill for those steps.

The `playground` skill owns prompt authoring and the mechanics of starting a recorded run. The
`evaluators` skill owns how scores are designed. Route dataset evolution and hardening to
`datasets`.

## Which Skill

Decide whether the runs to compare already exist, or a run still has to be created.

- The user may have named no experiments and want a prompt run over a dataset.
- They may have a baseline and still need a candidate.
- They may already have both, and only want the comparison.
- They may already have both, and the verdict still calls for another run.

If every run the comparison needs is already there, and the user only wants that comparison, load
`phoenix-experiment-analyzer` and stop. 

If a run is missing — no baseline, no candidate, or the next hypothesis still needs a run — create
only that run, using the steps below. Once those runs exist, load `phoenix-experiment-analyzer`.

After that verdict, continue only when the user asked to keep iterating and the goal is not met.
Form the next single-axis hypothesis, create that run, and hand the new runs back to
`phoenix-experiment-analyzer`. When the evidence meets the goal, save the prompt version the
evidence supports or the accepted tradeoff selects.

## Creating The Missing Run

Pause only when the goal is unclear or a tradeoff needs a human.

1. Confirm the dataset represents the task: the input fields the run consumes, the expected outputs,
   and the failure modes worth catching. Context the prompt must consume — a schema, retrieved
   documents, a policy boundary — belongs in `input`, never in `reference`, which the run under test
   must not see. When reading a dataset's `reference`, triage its provenance before trusting it as an
   answer key — it may be golden, a baseline-snapshot, or absent (reference-free); the `evaluators`
   skill owns that taxonomy.
2. Make sure the starting prompt is well formed before running it — task, variables, output format,
   and the constraints needed for consistent scoring. An ill-formed baseline wastes a run.
3. Inventory the evaluators already on the dataset. What is already scored is what the next run can
   measure. Anything example-level and scorable defaults to an evaluator at the moment you observe
   it — scores are reviewable, sortable columns a human can scan. Reuse an evaluator that matches,
   and create one only on a gap (`evaluators` covers the design). Do not park that judgment in
   experiment metadata.
4. Run the prompt over the dataset as a recorded experiment. Stage the scaffold at creation —
   hypothesis, changed variable, baseline — so a later session can read the comparison rather than
   guess at it. A playground experiment is one LLM completion per example. To test multi-turn or
   read-then-write behavior, prime the example's input with a multi-turn message history so the run
   scores the completion the model emits next. Use repetitions greater than one when you need a
   consistency read, not a point estimate.
5. Change exactly one axis from the baseline: prompt, model, invocation params, tool-guidance, or
   dataset-scope. Changing several at once makes the later comparison uninterpretable.

## Boundaries

- Do not compare runs or write the verdict in this skill. Load `phoenix-experiment-analyzer`.
- When a needed write — a dataset edit, a run setting, an invocation parameter — has no available
  path, surface the change you need to the user rather than improvising it through raw reads or
  writes.

## Things To Avoid

- Don't run a new experiment when the user only asked to compare runs that already exist.
- Don't change more than one axis between the run you are creating and the baseline it will be
  compared to.
- Don't record an example-level score as metadata. That belongs on an evaluator.
