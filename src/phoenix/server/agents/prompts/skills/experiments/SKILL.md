---
name: experiments
description: >
  Run, read, and compare dataset-backed experiments to find evidence that a prompt or pipeline is improving. Trigger when the user wants to iterate over a dataset with experiments, compare experiment runs, read experiment quality/latency/cost, or decide whether a change actually helped. Running a prompt over a dataset is implicitly an experiment — load this skill when dataset-backed work begins, before authoring evaluators for the experiment and before starting the recorded run, not only when reading results. Do NOT trigger on: (1) manual prompt drafting with no dataset-backed evaluation in scope (use `playground`), (2) authoring or refining an evaluator's logic or rubric (use `evaluators`), (3) cross-trace failure diagnosis with no experiment in scope (use `debug-trace`).
summary: Iterate over a dataset with experiments — run, read results across quality, latency, and cost, and compare candidates to drive improvement.
---

# Experiments

An experiment is one run of a prompt or pipeline over every example in a dataset, captured with its
outputs and any evaluator annotations so it can be reviewed and compared later. Experiments turn
"this prompt feels better" into evidence: a per-example record you can score, aggregate, and diff
against an earlier run.

Reading, comparing, recording, and evaluating are run-path agnostic: they apply equally to
experiments created through the SDK or REST API and to experiments culled from traces. Only the run
step binds to playground capabilities — the `playground` skill owns prompt authoring and the
mechanics of starting a recorded run. The `evaluators` skill owns how the scores you read here are
designed. Route dataset evolution and hardening to `datasets`, and human annotation flows to
`annotate-spans`.

## Before You Start: Read What Already Ran

Before designing a new experiment on a dataset, read the experiments already run against it. Each
carries scaffolding written at creation — a hypothesis, the variable changed, the baseline it built
on — plus observations appended afterward. Reading that record avoids re-running a comparison a
previous session settled and tells you which hypotheses are still open. Inventory the dataset's
existing evaluators at the same time: what is already scored shapes what the next run can measure.

## Workflow: Iterate Over A Dataset

The loop's only user touchpoints are defining the goal and accepting a tradeoff; everything between
is drivable end-to-end, pausing only when one of those two conditions is genuinely underdetermined.

1. Confirm the dataset represents the task: the input fields the run consumes, the expected outputs,
   and the failure modes worth catching. Context the prompt must consume — a schema, retrieved
   documents, a policy boundary — belongs in `input`, never in `reference`, which the run under test
   must not see. When reading a dataset's `reference`, triage its provenance before trusting it as an
   answer key — it may be golden, a baseline-snapshot, or absent (reference-free); the `evaluators`
   skill owns that taxonomy.
2. Make sure the starting prompt is well formed before running it — task, variables, output format,
   and the constraints needed for consistent scoring. An ill-formed baseline wastes a run.
3. Run the prompt over the dataset as a recorded experiment, staging the scaffold (hypothesis,
   changed variable, baseline) at creation so a later session can read the comparison rather than
   guess at it. A playground experiment is one LLM completion per example; to test multi-turn or
   read-then-write behavior, prime the example's input with a multi-turn message history so the run
   scores the completion the model emits next.
4. Read the results across all three axes together — output quality (evaluator annotations, including
   each judgment's explanation), latency, and cost — rather than fixating on a single score. Trust
   aggregates only when the run is complete with zero errors; a half-finished or error-laden run
   produces misleading summaries.
5. Score what you observe. Anything example-level and scorable defaults to an evaluator at the moment
   of observation — scores are reviewable, sortable columns a human can scan; observations are not.
   Derive the judgment from the experiment's stated purpose, inventory the dataset's existing
   evaluators, reuse one that matches, and create only on a gap (`evaluators` covers the design).
6. Form one specific hypothesis for the next candidate — a named failure mode and the single change
   expected to fix it — and change exactly one axis: prompt, model, invocation params, tool-guidance,
   or dataset-scope. Changing several axes at once makes the comparison uninterpretable.
7. Compare the new experiment against its baseline per-example and aligned, not by aggregate means
   alone or from memory — an averaged metric hides the example a change broke. Splits may carry
   different success criteria per split; never average a guarded holdout back into the headline
   number. Use repetitions greater than one when you need a consistency read, not a point estimate.
8. Report what the comparison showed: a verdict on the hypothesis, a summary across quality, latency,
   and cost, and the evaluator explanations cited as evidence for the verdict.
9. Continue hypothesis → run → compare → report until the evidence meets the stated goal, then save
   the prompt version the evidence supports or the accepted tradeoff selects.

## Recording What You Learned

There are two moments to write back, and they capture different things. Stage the scaffold before the
run, while the framing is fresh — the hypothesis, the changed variable, the baseline — as part of
starting the recorded run. After reading results, route by kind: experiment-level narrative —
hypothesis verdicts, decisions taken, one-off drifts — belongs in the experiment's observations;
anything example-level and scorable defaults to an evaluator the moment you observe it (step 5), not
to an observation deferred until it recurs. To append an observation without losing what is already
there, read the experiment's current metadata first, then write back the whole object with a new
timestamped observation added and every existing key — hypothesis, changed variable, baseline among
them — left intact; a write that omits them erases the scaffold the next session depends on.

## Boundaries

- When a needed write — a dataset edit, a run setting, an invocation parameter — has no available
  path, surface the change you need to the user rather than improvising it through raw reads or
  writes.

## Things To Avoid

- Don't trust an experiment's aggregates while it is in progress or has nonzero errors.
- Don't change more than one axis between experiments you intend to compare.
- Don't average a guarded holdout split back into the headline number.
- Don't re-run a comparison a previous session already settled; read the scaffolding first.
- Don't read quality in isolation — a higher score that doubled latency or cost is not a win.
