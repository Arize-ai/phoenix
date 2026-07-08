---
name: phoenix-evals-new-metric
description: >-
  Create a new built-in classification evaluator for Phoenix evals. Use this skill whenever the user asks to
  create a new eval, build a new metric, add a new builtin evaluator, create an LLM-as-a-judge
  metric, or add a new classification evaluator to Phoenix.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  internal: true
---

# Creating a New Built-in Classification Evaluator

A built-in evaluator is a YAML config (source of truth) that gets compiled into Python and TypeScript code, wrapped in evaluator classes, benchmarked, and documented. The whole pipeline is linear — follow these steps in order.

## Step 0: Gather Requirements

Before writing anything, clarify with the user:

1. **What does this evaluator measure?** Get a one-sentence description of the quality dimension.
2. **What input data is available?** This determines the template placeholders (e.g., `{{input}}`, `{{output}}`, `{{reference}}`, `{{tool_definitions}}`). If the user is vague, ask follow-up questions — the placeholders are the contract between the evaluator and the caller.
3. **What labels make sense?** Binary is most common (e.g., correct/incorrect, faithful/unfaithful), but some metrics use more. Labels map to scores.
4. **Should this appear in the dataset experiments UI?** If yes, it needs the `promoted_dataset_evaluator` label. Currently only correctness, tool_selection, and tool_invocation have this — some may new evaluators don't need it.

## Step 1: Create the YAML Config

Create `prompts/classification_evaluator_configs/{NAME}_CLASSIFICATION_EVALUATOR_CONFIG.yaml`.

Read an existing config to match the current schema. Start with `CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.yaml` for a simple example, or `TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.yaml` if your evaluator needs structured span data.

### Key Decision Points

**`choices`** — Maps label strings to numeric scores. For binary evaluators, use positive/negative labels (e.g., `correct: 1.0` / `incorrect: 0.0`). The labels you pick here flow through to the Python class, TS factory, and benchmarks.

**`optimization_direction`** — Use `maximize` when the positive label is the desired outcome (most evaluators). Use `minimize` only if the metric measures something undesirable (e.g., hallucination). This affects how Phoenix displays the metric in the UI.

**`labels`** — Optional list. Add `promoted_dataset_evaluator` only if this evaluator should appear in the dataset experiments UI sidebar.

**`substitutions`** — Only needed if the evaluator is a `promoted_dataset_evaluator` and works with structured span data (tool definitions, tool calls, message arrays). These reference formatter snippets defined in `prompts/formatters/server.yaml`. Read that file if you need substitutions — it defines what structured data formats are available. Most evaluators that only use simple text fields (input, output, reference) don't need substitutions.

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

Verify the generated files look correct before moving on.

## Step 3: Create the Python Evaluator

Create `packages/phoenix-evals/src/phoenix/evals/metrics/{name}.py`.

**Read `correctness.py` in that directory** — it's the canonical example. Your evaluator follows the same pattern: subclass `ClassificationEvaluator`, pull constants from the generated config, define a Pydantic input schema with fields matching your template placeholders.

After creating the file, **add it to the exports** in `metrics/__init__.py` — both the import and the `__all__` list. Read the current `__init__.py` to see the existing pattern.

## Step 4: Create the TypeScript Evaluator

Create `js/packages/phoenix-evals/src/llm/create{Name}Evaluator.ts`.

**Read `createCorrectnessEvaluator.ts`** — it's the canonical example. The pattern is a factory function that wraps `createClassificationEvaluator` with defaults from the generated config.

Then:

1. **Add the export** to `js/packages/phoenix-evals/src/llm/index.ts`
2. **Add a vitest test** — read `createFaithfulnessEvaluator.test.ts` for the test pattern

## Step 5: Build JS

```bash
cd js && pnpm build
```

Fix any TypeScript errors before proceeding.

## Step 6: Write the Benchmark

Create `js/benchmarks/evals-benchmarks/src/{name}_benchmark.ts`.

Read existing benchmarks in that directory to match the current patterns:

- `tool_invocation_benchmark.ts` — confusion matrix printing, multi-category analysis

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
# Terminal 1: Start Phoenix
PHOENIX_WORKING_DIR=/tmp/phoenix-test phoenix serve

# Terminal 2: Run the benchmark
cd js/benchmarks/evals-benchmarks
pnpm tsx src/{name}_benchmark.ts
```

Target **>80% accuracy**. If accuracy is low, look at the failed examples output to decide whether to adjust the prompt (Step 1) or the benchmark examples (Step 6). Iterate until accuracy is acceptable.

## Step 8: Create Documentation

Create `docs/phoenix/evaluation/pre-built-metrics/{name}.mdx`.

**Read `faithfulness.mdx`** in that directory — it's the template. Follow the same section structure:

1. Overview — when to use, what it measures
2. Supported Levels — span/trace/session, relevant span kinds
3. Input Requirements — required fields table
4. Output Interpretation — labels, scores, direction
5. Usage Examples — Python and TypeScript in tabs
6. Using Input Mapping — lambda example if applicable
7. Viewing/Modifying the Prompt — link to GitHub config, custom prompt usage
8. Configuration — link to LLM config docs
9. Using with Phoenix — links to traces and experiments docs
10. Benchmarks — "Coming soon" placeholder (until benchmark results are published)
11. API Reference — links to Python and TypeScript API docs
12. Related — links to related evaluators

### Navigation Updates

After creating the docs page, update these three files:

1. **`docs.json`** — add the page to the Evaluation > Pre-built Metrics nav group
2. **`docs/phoenix/evaluation/pre-built-metrics.mdx`** — add a card to the landing page grid
3. **`docs/phoenix/sitemap.xml`** — add the new URL

Read each file to see the existing pattern before editing.

## Checklist

Before calling it done, verify:

- [ ] YAML config created with clear rubric and appropriate labels/choices
- [ ] `make codegen-prompts` ran successfully
- [ ] Python evaluator class with input schema matching template placeholders
- [ ] Python exports updated in `metrics/__init__.py`
- [ ] TypeScript evaluator factory with types
- [ ] TypeScript export added to `llm/index.ts`
- [ ] Vitest test for TypeScript evaluator
- [ ] JS packages rebuilt (`cd js && pnpm build`)
- [ ] Benchmark with 30-50 examples, category breakdown, failed examples printer
- [ ] Benchmark accuracy >80%
- [ ] Documentation page following the template structure
- [ ] `docs.json` nav updated
- [ ] Landing page card added
- [ ] Sitemap updated

## Retrospection

After completing the workflow, verify these instructions matched reality:

- Did any file paths, export patterns, or command names change from what's described here?
- Did the YAML config schema gain or lose fields since this was written?
- Did the benchmark or docs patterns evolve from the referenced examples?
- Did `make codegen-prompts` generate to different locations?

If anything drifted, **update this SKILL.md before finishing** so the next person (or agent) doesn't hit the same surprises.
