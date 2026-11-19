---
name: phoenix-experiments
description: Test changes to an LLM app or prompt with Phoenix datasets and experiments, in Python or TypeScript. Build datasets from traces, files, or synthetic data, run a task and evaluators as an experiment, rerun with repetitions, compare experiments to decide whether a change is better, improve an app's prompt and measure the result, and gate CI with pytest, Vitest, or Jest. Use for "did my prompt change help", "compare these two experiments", "should we ship this", "run an experiment", "create a dataset from traces", "A/B test prompts", "improve my system prompt", "regression test my agent", or "add evals to CI". For writing the evaluators themselves use phoenix-evals.
license: Apache-2.0
compatibility: Requires a Phoenix server. Python needs arize-phoenix-client (plus arize-phoenix-evals for library evaluators). TypeScript needs @arizeai/phoenix-client 7.x; @arizeai/phoenix-evals and AI SDK v7 need Node.js 22.12 or later.
metadata:
  targets: "agents mcp"
  author: oss@arize.com
  version: "1.0.0"
  languages: "Python, TypeScript"
---

# Phoenix experiments

An experiment runs a task (your app, a prompt, or one step of an agent) on every
example in a dataset and scores each output with evaluators. Comparing two
experiments on the same dataset shows whether a change helped.

Related skills: **phoenix-evals** writes the evaluators; **phoenix-judge-alignment**
checks an LLM judge against human labels; **phoenix-cli** lists and reads datasets and
experiments from the terminal (`px dataset list`, `px experiment get`).

## Workflow

1. **Pick or build the dataset.** Reuse the dataset the user names. Build a new one
   from traces, a file, or synthetic examples only when none fits. Each example has
   `input`, an optional reference `output`, and `metadata`.
2. **Run the baseline** when none exists: the current app or prompt, with the
   evaluators you'll compare on.
3. **Run the change** on the same dataset version, with the same evaluators, under a
   name that says what changed.
4. **Repeat when outputs vary.** When the task or a judge calls an LLM, run each
   example several times (`repetitions=3` or more) so one lucky sample doesn't decide.
5. **Compare per evaluator and per example.** Read pass rates side by side, then the
   examples that flipped. See [compare-experiments](references/compare-experiments.md).
6. **Decide and say why.** Name the metric, the two rates, the number of runs behind
   each, and whether the difference is larger than the run-to-run spread.

| Task | Python | TypeScript |
| ---- | ------ | ---------- |
| Create and update datasets | [datasets-python](references/datasets-python.md) | [datasets-typescript](references/datasets-typescript.md) |
| Run, add evaluations to, and resume experiments | [experiments-python](references/experiments-python.md) | [experiments-typescript](references/experiments-typescript.md) |
| Compare experiments and decide | [compare-experiments](references/compare-experiments.md) | [compare-experiments](references/compare-experiments.md) |
| Generate synthetic examples | [synthetic-data-python](references/synthetic-data-python.md) | [synthetic-data-typescript](references/synthetic-data-typescript.md) |
| Gate CI on evals | [ci-pytest](references/ci-pytest.md) | [ci-vitest-jest](references/ci-vitest-jest.md) |

## Rules

- **Compare like with like.** Same dataset version, same evaluators, same number of
  repetitions. A comparison across different datasets or judges measures the
  difference in setup.
- **Apply the user's decision rule when they give one.** "Ship if the format check
  doesn't drop" is decided on the observed format-check numbers. Report the uncertainty next to
  the call, but don't swap their rule for a significance test.
- **Must-pass means what the user names.** The checks or slices the user says must
  not regress decide the call. Report other regressions, but don't let them decide
  unless the user says so.
- **Count every run.** With repetitions, a pass rate is passes over all runs. For a
  must-pass check, also report how many examples passed every repetition: an
  example that fails one run in three is a real, intermittent failure.
- **Don't tune on the examples you report.** While you iterate on a prompt, hold
  some examples out by ID and use `dry_run` for drafts so they don't pile up as
  experiments. Run the final candidate on the same dataset and version as the
  baseline, and check the held-out examples separately for generalization.
- **Without a stated rule, small differences are noise until shown otherwise.** On
  20 examples, one example is 5 points. Compare per example (see
  [compare-experiments](references/compare-experiments.md)) before calling a change
  better or worse.
- **Report every evaluator the baseline used,** not only the one that improved. When
  the baseline's evaluator code isn't available, rebuild it under the same name,
  check it against the baseline's recorded results, and say how well it matches.
  Match which records it scores, too: if the baseline scored a record and the
  rebuilt evaluator returns no score for it, the two experiments aren't measured
  on the same records. Compare the scored counts, not only agreement where both
  scored.
- **Don't change other people's datasets or experiments.** Creating a dataset with an
  existing name replaces its examples, and `evaluate_experiment` replaces evaluations
  with the same name. Make a new dataset or experiment unless the user asks.
- **Keep two kinds of suites.** Regression suites hold cases that must keep passing
  (aim for 95% or more). Capability suites hold hard cases you're working toward
  (50 to 80%). When a capability suite passes almost everything, move those cases to
  regression and add harder ones.
