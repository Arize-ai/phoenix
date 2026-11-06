# Pytest Eval-CI Integration: Design Philosophy

Authors: @anticorrelator

The `phoenix.client.pytest` plugin lets you record ordinary pytest tests as Phoenix
experiments. You mark a test with `@pytest.mark.phoenix`, and when it runs in CI it becomes
a row of evaluation data in Phoenix — no separate harness, and no rewriting your tests as
dataset rows. This document explains the thinking behind that design: which rules of
Phoenix's dataset/experiment model we relax on purpose so this feels like normal pytest, and
which rules we hold firm so the recorded data is still trustworthy. Usage and examples for
end users live in
`docs/phoenix/datasets-and-experiments/how-to-experiments/eval-ci-with-pytest.mdx`.

A note on vocabulary, for readers newer to Phoenix. A **dataset** is a collection of
**examples** (the inputs you want to test against). An **experiment** is the record of
running something against those examples — one **run** per example, and each run can carry
**annotations**, which are scores or labels (for instance, the output of an evaluator).
Normally you build the dataset first and then run an experiment against it.

## Core Stance: The Test Suite Is the Source of Truth

Phoenix's experiment model was designed around a curated dataset and a single, uniform task.
You assemble a dataset of examples, then run one function against every example the same
number of times, scored by the same set of evaluators. Because every run is the same task on
a different input, you can average the results meaningfully and compare one experiment to
another.

A pytest suite does not look like that. Tests are independent functions, each doing its own
thing, grouped into files, sometimes parametrized, sometimes sharing fixtures. Rather than
ask people to abandon that and hand-author datasets, we let the test suite remain the source
of truth and **derive** the dataset and experiment from it as a byproduct of running the
tests.

The trade-off is deliberate. The derived data does not satisfy several of the uniformity
assumptions the experiment model was built on. We accept that, and we compensate by being
strict about a different set of guarantees — stable identity, non-duplicating writes, and
clear provenance — so the data stays meaningful even when it isn't uniform.

> In one line: **we relax uniformity, but never identity.**

## Where the Two Models Disagree

| What the experiment model assumes | What a pytest suite actually does | How we bridge the gap |
|---|---|---|
| One task, run over the whole dataset | Every test is its own task | Many different tests share one experiment, and each run is tagged with the test it came from |
| Every example runs the same number of times | Different tests can ask for different repeat counts | The experiment's repeat count becomes a ceiling; some examples simply run fewer times |
| Examples are curated ahead of time, often with an expected answer | Examples are discovered from the tests; there is no expected answer | The test's own assertion decides pass/fail, recorded as a score |
| The same evaluators score every example | Evaluators are attached per test | Different examples in one experiment may be scored differently |
| A pass/fail gate is computed from the aggregate | pytest already passes or fails each test | Gating stays at the individual-test level; there is no aggregate gate |
| A dataset is a fixed, named artifact | The suite changes with every commit | The dataset is re-synced on each run to mirror the current suite |
| One process records all the runs | pytest can split tests across many processes | One process sets things up first; the others just record their runs into it |

## What We Loosen, and Why

Each of these is a place where the recorded data is intentionally less uniform than a
hand-built experiment would be.

1. **Many kinds of test in one experiment.** By default, every marked test in a file shares
   one dataset, and therefore one experiment. Those tests may be entirely unrelated, so a
   single experiment can mix different tasks together. We record which test each example came
   from, so every run is traceable. The practical consequence: a per-test pass/fail rate is
   always meaningful, but *averaging a score across the whole experiment* only makes sense
   when that score means the same thing for every test. When in doubt, trust the counts (how
   many passed, how many an evaluator flagged) rather than the averages. The uniform version
   of this — one task over a dataset — is what `run_experiment` is for.

2. **Different repeat counts per test.** A test can ask to run several times, to catch
   flakiness or to sample a non-deterministic system. An experiment, however, records a
   single repeat count, and tests in the same group may disagree on it. We set the
   experiment's count to the largest any test asked for, and let tests that wanted fewer
   simply have fewer runs. The count is a ceiling for the experiment, not a promise that
   every example reached it. All repeats of a test point at the same example and are
   distinguished only by a repeat number.

3. **No expected answer on the example.** Because examples come from tests rather than a
   curated set, they carry only the test's inputs — there is no reference output to compare
   against. The test produces its output while it runs, and you record that output
   explicitly (pytest discourages returning values from tests, so you call a small helper
   instead). Correctness comes from the test's own assertions, recorded as a pass/fail score,
   not from comparing the output to an expected answer.

4. **Per-test evaluators.** You can attach evaluators to a test, and they run automatically
   against its inputs and output. Because evaluators are attached per test, two examples in
   the same experiment can be scored by different evaluators. These attached evaluators only
   ever contribute scores — they never fail the individual test on their own. A failing test
   is a failing *assertion*, which is a separate thing.

5. **Gating happens per test, the pytest way.** When a test's assertion fails, the test
   fails — and we record that same failure on its run, taken from the very result pytest
   itself reports, so the two can never disagree. We deliberately do **not** compute an
   aggregate pass/fail gate over the experiment. (An earlier baseline-comparison gate was
   removed so it can be designed properly on its own later.)

6. **The dataset tracks the suite over time.** The dataset is named after the test file by
   default; you can override the name — for example, per CI run — through the
   `PHOENIX_TEST_DATASET` environment variable. Each run reconciles the dataset against the
   tests that were collected, creating a new version only when something actually changed.
   When you run a filtered subset of tests, we add to the dataset rather than reconcile it, so
   we don't delete examples for tests that simply weren't run this time. The dataset is a
   living mirror of the suite, not a frozen benchmark.

7. **Parallel runs don't fragment the experiment.** pytest can distribute tests across worker
   processes. To keep them all in one experiment, a single coordinating process creates the
   dataset and experiment first and hands the resulting identifiers to the workers; the
   workers only record runs and never create anything themselves. So however the tests are
   split up, they all land in the same experiment.

8. **Tracing is layered on top.** Each marked test, and each evaluator call, is wrapped in a
   trace span and exported to the experiment's project, so a recorded run links back to the
   underlying trace. This was added after the first version. If tracing can't be set up it
   degrades to a single warning rather than failing tests, and it is skipped entirely when
   recording is turned off.

## What We Keep Strict

The looseness above is bounded by a small set of guarantees we do not compromise.

- **You opt in, test by test.** Only tests you explicitly mark are recorded. An unmarked
  suite touches no network and behaves exactly as it did before the plugin was installed.
- **Stable identity.** Each example's identity is derived from the test's path and
  parameters, so its history stays continuous across runs. Renaming a test creates a new
  example rather than silently rewriting an old one.
- **Non-duplicating writes.** Each run is keyed by its example and repeat number. Re-running
  an unchanged suite creates no new dataset version and no duplicate runs, and retries —
  including under parallel execution — don't double-record.
- **One source of truth for pass/fail.** The result we record is the same result pytest
  reports. The test log and the recorded experiment cannot drift apart.

## Open Questions

- **One experiment per file, or per test function?** Naming the dataset after the file keeps
  the number of experiments manageable but mixes different tests together. Naming it after
  each test function would make every experiment uniform and easy to interpret, at the cost of
  many more of them. We haven't settled this.
- **Helping readers not over-trust averages.** Since an experiment can mix different tests, we
  may want the UI to signal that pass/fail counts are reliable while averaged scores may not
  be.
- **Aggregate gating / regression analysis.** Deferred. Comparing a run against a baseline,
  and failing CI on a regression, needs its own design.
- **Name collisions across repositories.** A file path doesn't distinguish two different
  repositories that both push to the same Phoenix instance. A naming prefix would; out of
  scope until someone needs it.
- **Repeat counts for `unittest`-style tests.** Tests written as `unittest` classes don't
  receive the machinery that expands repeats, so they record a single run regardless of the
  requested count. A known limitation.
