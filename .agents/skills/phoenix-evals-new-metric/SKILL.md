---
name: phoenix-evals-new-metric
description: >-
  Add a new built-in (pre-built) LLM classification evaluator to the Phoenix evals libraries, and optionally
  promote it to a server-side dataset evaluator. Use when working in the Phoenix repo and asked to add a new
  built-in eval, pre-built metric, builtin evaluator, or LLM-as-a-judge template that ships with
  arize-phoenix-evals / @arizeai/phoenix-evals, or to promote an existing one to the dataset evaluators UI.
  Do not use for writing a user's own custom evaluator for their app (use phoenix-evals).
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.1.0"
  internal: true
---

# Creating a New Built-in Classification Evaluator

A built-in evaluator is a YAML config (source of truth) that gets compiled into Python and TypeScript code, wrapped in evaluator classes, benchmarked, and documented. The whole pipeline is linear — follow these steps in order.

## Step 0: Gather Requirements

Before writing anything, clarify with the user:

1. **What does this evaluator measure?** Get a one-sentence description of the quality dimension.
2. **What input data is available?** This determines the template placeholders (e.g., `{{input}}`, `{{output}}`, `{{reference}}`, `{{tool_definitions}}`). If the user is vague, ask follow-up questions — the placeholders are the contract between the evaluator and the caller.
3. **What labels make sense?** Binary is most common (e.g., correct/incorrect, faithful/unfaithful), but some metrics use more. Labels map to scores.
4. **Should it be a promoted dataset evaluator?** See [Promoted dataset evaluators](#promoted-dataset-evaluators) below. Decide this up front, because it changes the YAML (`labels`, possibly `substitutions`) and which docs you write in Step 8.

## Promoted dataset evaluators

Every config in `prompts/classification_evaluator_configs/` ships in the **client-side libraries** (`phoenix.evals.metrics` in Python, `@arizeai/phoenix-evals` in TypeScript). Users call those from their own code against traces, dataframes, or experiments.

A **promoted dataset evaluator** is the subset that also makes sense to run **inside the Phoenix server** on datasets and experiments. Adding the `promoted_dataset_evaluator` label is what promotes it. The UI fetches configs filtered by that label (`classificationEvaluatorConfigs(labels: ["promoted_dataset_evaluator"])` in `AddEvaluatorMenu.tsx` and `DatasetEvaluatorsPage.tsx`), so a labeled config shows up as an **LLM Evaluator Template** when a user adds an evaluator to a dataset. It then runs automatically on that dataset's experiments.

Promote an evaluator when all of these hold:

- It is useful to score *experiment runs* against a dataset, not only production traces. It judges the task output, optionally with the example's input or reference.
- Its template fields can be filled by input mapping from dataset or experiment columns, or by a server formatter (see `substitutions`), without user code.
- It is general enough that a user would plausibly pick it from a menu with only light edits to the prompt.

Leave it library-only when it needs data the server cannot map, such as retrieved documents passed per call or a whole-session transcript, or when it is mainly a production or trace-level monitor.

Don't hardcode which evaluators are promoted; check the current set with:

```bash
grep -l promoted_dataset_evaluator prompts/classification_evaluator_configs/*.yaml
```

Current examples to learn from:

- **Promoted:** `CORRECTNESS` (simple text, no substitutions), `HALLUCINATION` (`output` substituted with `output_with_tool_calls`), `TOOL_SELECTION` / `TOOL_INVOCATION` (structured tool data via substitutions).
- **Library-only today:** `FAITHFULNESS` and `DOCUMENT_RELEVANCE` (built around retrieved `{{context}}` / `{{document_text}}` from RAG spans), `USER_FRICTION` (judges a `{{user_message}}` against a `{{conversation}}`).

## Step 1: Create the YAML Config

Create `prompts/classification_evaluator_configs/{NAME}_CLASSIFICATION_EVALUATOR_CONFIG.yaml`.

Read an existing config to match the current schema. Start with `CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.yaml` for a simple example, or `TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.yaml` if your evaluator needs structured span data.

### Key Decision Points

**`choices`** — Maps label strings to numeric scores. For binary evaluators, use positive/negative labels (e.g., `correct: 1.0` / `incorrect: 0.0`). The labels you pick here flow through to the Python class, TS factory, and benchmarks.

**`optimization_direction`** — Use `maximize` when the positive label is the desired outcome (most evaluators). Use `minimize` only if the metric measures something undesirable (e.g., hallucination). This affects how Phoenix displays the metric in the UI.

**`labels`** — Optional list. Add `promoted_dataset_evaluator` only if you decided in Step 0 to promote it (see above).

**`substitutions`** — Only used by the server, so only relevant for promoted evaluators. Each maps a template placeholder to a formatter in `prompts/formatters/server.yaml` that renders structured experiment data (tool definitions, tool calls, message arrays) into text. Read that file to see which formatters exist, and copy the pattern from `TOOL_SELECTION` or `HALLUCINATION`. Evaluators whose placeholders are plain text fields (input, output, reference) don't need substitutions.

### Prompt Writing Tips

- Be explicit about what makes each label correct — the LLM judge needs a clear rubric
- Separate concerns: if evaluating X, explicitly state you're NOT evaluating Y
- Wrap inputs in XML-style tags (e.g., `<context>`, `<output>`) for clear data formatting
- Tell the judge to reason before deciding — this improves accuracy
- Use `{{placeholder}}` (Mustache syntax) for template variables

## Step 2: Compile Prompts

```bash
make codegen-prompts
```

This generates code in three places:

- `packages/phoenix-evals/src/phoenix/evals/__generated__/classification_evaluator_configs/` (Python)
- `src/phoenix/__generated__/classification_evaluator_configs/` (Python, server copy)
- `js/packages/phoenix-evals/src/__generated__/default_templates/` (TypeScript)

It also copies `prompts/formatters/server.yaml` into `src/phoenix/server/api/helpers/substitutions/`. The server reads that copy for promoted evaluators.

Verify the generated files look correct before moving on.

## Step 3: Create the Python Evaluator

Create `packages/phoenix-evals/src/phoenix/evals/metrics/{name}.py`.

**Read `correctness.py` in that directory** — it's the canonical example. Your evaluator follows the same pattern: subclass `ClassificationEvaluator`, pull constants from the generated config, define a Pydantic input schema with fields matching your template placeholders.

After creating the file, **add it to the exports** in `metrics/__init__.py` — both the import and the `__all__` list. Read the current `__init__.py` to see the existing pattern.

Add test coverage in `packages/phoenix-evals/tests/phoenix/evals/metrics/test_classification_evaluators.py`, following the existing cases there.

## Step 4: Create the TypeScript Evaluator

Create `js/packages/phoenix-evals/src/llm/create{Name}Evaluator.ts`.

**Read `createCorrectnessEvaluator.ts`** — it's the canonical example. The pattern is a factory function that wraps `createClassificationEvaluator` with defaults from the generated config.

Then:

1. **Add the export** to `js/packages/phoenix-evals/src/llm/index.ts`
2. **Add a vitest test** under `js/packages/phoenix-evals/test/llm/` — read
   `createFaithfulnessEvaluator.test.ts` there for the test pattern

## Step 5: Build JS

```bash
cd js && pnpm build
```

Fix any TypeScript errors before proceeding.

## Step 6: Write the Benchmark

Create `js/benchmarks/evals-benchmarks/src/{name}.eval.ts`.

Read existing benchmarks in that directory to match the current patterns:

- `tool_invocation.eval.ts` — multi-category analysis and aggregate metrics
- `aggregateMetrics.ts` — shared macro precision/recall/F1 accumulation

### Benchmark Requirements

- **30-50 synthetic examples** organized by category
- **2-4 examples per category** covering: success cases, failure modes, and edge cases
- **Accuracy evaluator** that compares predicted vs expected labels
- **Failed examples printer** — this is critical for debugging. For each misclassified example, print: category, input, output (truncated), expected vs actual label, and the LLM judge's explanation
- **Per-category accuracy** breakdown in the output
- For binary evaluators, a **confusion matrix** is helpful

The task function must return `input` and `output` text in its result so the failed examples printer has access to them.

Consider using a **separate agent session** for synthetic dataset generation if the examples need realistic domain-specific content — this keeps the dataset creation focused and avoids context-switching.

## Step 7: Run the Benchmark

```bash
# Terminal 1: Start Phoenix using the normal configured database. Do not set
# PHOENIX_WORKING_DIR unless the user explicitly requests an isolated instance.
phoenix serve

# Terminal 2: Run the benchmark
cd js
pnpm --filter evals-benchmarks... build
pnpm --filter evals-benchmarks exec vitest run \
  src/{name}.eval.ts --config phoenix.vitest.config.ts
```

Target **>80% accuracy**. If accuracy is low, look at the failed examples output to decide whether to adjust the prompt (Step 1) or the benchmark examples (Step 6). Iterate until accuracy is acceptable.

## Step 8: Create Documentation

There are two **Pre-Built Metrics** sections in the docs, and `docs.json` has a nav group named "Pre-Built Metrics" under each:

| Section | Directory | Nav group in `docs.json` | Who needs a page |
|---|---|---|---|
| Client-Side Evals (SDK) | `docs/phoenix/evaluation/pre-built-metrics/` | Evaluation > Client-Side Evals (SDK) > Pre-Built Metrics | **Every** new evaluator |
| Server-Side Evals (UI) | `docs/phoenix/evaluation/server-evals/pre-built-metrics/` | Evaluation > Server-Side Evals (UI) > Pre-Built Metrics > LLM Evaluators | **Only** promoted dataset evaluators |

### 8a. Client-side page (always)

Create `docs/phoenix/evaluation/pre-built-metrics/{name}.mdx`. **Read `faithfulness.mdx`** in that directory and follow its section structure: Overview (When to Use), Supported Levels, Input Requirements (Formatting Tips), Output Interpretation, Usage Examples (Python and TypeScript tabs, Using Input Mapping), Configuration (Viewing and Modifying the Prompt), Using with Phoenix, API Reference, Related.

Then update:

1. **`docs.json`**: add the page to the Client-Side Evals (SDK) > Pre-Built Metrics group.
2. **`docs/phoenix/evaluation/pre-built-metrics.mdx`**: add a card to the landing page grid.
3. **`docs/phoenix/sitemap.xml`**: add the URL.

### 8b. Server-side page (promoted evaluators only)

Create `docs/phoenix/evaluation/server-evals/pre-built-metrics/{name}.mdx`. **Read `server-evals/pre-built-metrics/correctness.mdx`** and follow it. This page is about the UI, not code. It has an Overview (When to Use, and Input Mapping showing which dataset column fills each template field and what the server formats automatically), Output Labels, Using in Phoenix (the Add Evaluator → LLM Evaluator Template steps), and See Also.

Cross-link the two pages: the server page links to the client page and the client page links to the server page.

Then update:

1. **`docs.json`**: add the page to the Server-Side Evals (UI) > Pre-Built Metrics > LLM Evaluators group.
2. **`docs/phoenix/evaluation/server-evals/pre-built-metrics.mdx`**: add a card under "LLM Evaluators".
3. **`docs/phoenix/sitemap.xml`**: add the URL.

Read each file to see the existing pattern before editing.

## Checklist

Before calling it done, verify:

- [ ] YAML config created with clear rubric and appropriate labels/choices
- [ ] `make codegen-prompts` ran successfully
- [ ] Python evaluator class with input schema matching template placeholders
- [ ] Python exports updated in `metrics/__init__.py`
- [ ] Python test case added in `test_classification_evaluators.py`
- [ ] TypeScript evaluator factory with types
- [ ] TypeScript export added to `llm/index.ts`
- [ ] Vitest test for TypeScript evaluator
- [ ] JS packages rebuilt (`cd js && pnpm build`)
- [ ] Benchmark with 30-50 examples, category breakdown, failed examples printer
- [ ] Benchmark accuracy >80%
- [ ] Promotion decided; `promoted_dataset_evaluator` label (and any `substitutions`) set only if promoted
- [ ] Client-side docs page, `docs.json` (Client-Side Evals group), landing card, sitemap
- [ ] If promoted: server-side docs page, `docs.json` (Server-Side Evals > LLM Evaluators), server landing card, sitemap, and cross-links between the two pages
- [ ] If promoted: added from the dataset Evaluators tab in a running Phoenix and run on an experiment

## Retrospection

After completing the workflow, verify these instructions matched reality:

- Did any file paths, export patterns, or command names change from what's described here?
- Did the YAML config schema gain or lose fields since this was written?
- Did the benchmark or docs patterns evolve from the referenced examples?
- Did `make codegen-prompts` generate to different locations?
- Did the promotion mechanism (the label, the UI query) or either docs section move?

If anything drifted, **update this SKILL.md before finishing** so the next person (or agent) doesn't hit the same surprises.
