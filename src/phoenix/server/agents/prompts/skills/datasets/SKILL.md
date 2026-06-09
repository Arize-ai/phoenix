---
name: datasets
description: >
  Understand what a Phoenix dataset is and reason well about its examples, outputs, splits, and how it feeds evaluators and experiments. Load this whenever a dataset is in view or the user asks what a dataset is, how splits work, what an output "means", or how datasets relate to experiments and evals. This skill governs the judgment; any tool descriptions govern the mechanics.
summary: Reason well about Phoenix datasets — examples, outputs, splits, labels — and how they feed evaluators and experiments.
---

# Datasets

A dataset is a table of **examples**. Each example (row) has an **input**, an optional **output**, and optional **metadata**. A dataset is the unit you evaluate a prompt or application against: you run something over every example and compare what comes out against what the example says.

Rows in one dataset should look roughly alike — the same shape of input, the same shape of output, the same metadata keys. The dataset has no enforced schema, so this consistency is a *convention you maintain*, not something the system guarantees. When you add or edit rows, match the shape of the rows already there; a dataset where row 3 has a `question` field and row 4 has a `prompt` field is harder to evaluate and harder to reason about.

## What an output actually means

The most common mistake is to treat a saved output as "the correct answer." It usually is not.

An output on a row is a **reference**, not a verdict. Treat it as "an answer that was recorded for this input," and ask *where it came from* before trusting it:

- A dataset is **golden** only when its outputs are genuinely ideal — hand-written or hand-verified to be the answer you want. Here the output really is the target.
- Far more often, outputs are **baselines**: captured from whatever produced them when the dataset was built (a model run, a production trace, an import). A baseline output records what the system *did*, which may be mediocre, outdated, or wrong. It is a point of comparison, not a goal.

So: never assume an output is right because it is present. If the user implies the dataset is golden, you can lean on the outputs as targets; if you don't know its provenance, say so and treat outputs as references. A row with no output at all is normal and fine — it just means "we have an input to run, but no recorded answer to compare against."

## How datasets feed evaluators and experiments

- **Evaluators** are attached to a dataset to judge outputs along a dimension (correctness, relevance, format, and so on).
- Running a prompt or application over every example is an **experiment**. Each example produces an experiment output, and the evaluators score those outputs — often against the example's reference output. This is why the reference/golden distinction matters: an experiment compared against weak baselines tells you "did this change behavior," while an experiment compared against golden outputs tells you "is this correct."
- Every example-level change creates a new dataset **version**, recording who made it. Experiments are run against a specific version, so the dataset's history is part of the evidence.

## Matching a dataset to the prompt you run over it

When you run a prompt over a dataset in the playground, each prompt template variable `{{x}}` is filled from the matching example field `input.x` — **bound by name**. So the dataset's `input` keys have to cover the prompt's template variables, or the run produces nothing useful.

Reconcile the two before you run (or before you build a dataset for a run):

- List the prompt's template variables and the dataset's `input` keys and make them line up. A `{{customer_message}}` variable needs an `input.customer_message` field — not `input.message` or `input.question`. A field that matches no variable is unused; a variable with no matching field renders empty.
- Cover **every** variable the prompt uses. A prompt with five variables run over a dataset that only carries one field fills one variable and blanks the other four.
- A playground run that *finishes with empty output and no error* almost always means this binding did not match — treat that as a misconfiguration to fix (align the field names, or map them), not as success.

If you are creating a dataset specifically to exercise a prompt, read the prompt's variables first and name the example `input` keys to match them from the start.

## Splits

A **split** is a named slice of the examples. The same mechanism serves three distinct purposes — know which one the user means before acting:

1. **Honest measurement (train / validation / test).** The classic ML division. A held-out test split that you never tune against gives a trustworthy estimate of real performance; tuning until the test numbers look good (overfitting) destroys that. If the user is optimizing a prompt or a model, respect the test split as blind.
2. **Facets (category / difficulty / type).** Splits like `single-hop` vs. `multi-hop`, `easy` vs. `hard`, or by topic let you break an experiment down and see *where* a task is weak instead of reading one aggregate number. Use these when the user asks "where is it failing," not just "how well does it do."
3. **Quick iteration (small chunks).** A small split is useful for a fast pass in the playground *before* committing to a full regression run over the whole dataset. Cheaper and faster to learn from while iterating.

A single example can belong to more than one split, and a split is just a label on rows — moving a row between splits doesn't change the row's input or output.

## How to work with datasets well

- **Look before you change.** Read existing rows before adding — to match their shape — and before editing or deleting — to act on the real current content, not an assumption. This is the same habit the prompt tools follow.
- **Be honest about outputs.** When you add a row, only present its output as the right answer if it genuinely is; otherwise call it a baseline/reference.
- **Keep rows uniform.** New and edited rows should match the field names and structure of the rest of the dataset.
- **Respect splits.** Don't blur a held-out test split into training material, and surface per-split breakdowns when the user wants to know where a task is weak.
- **Treat changes as versioned and attributable.** Edits and deletes are real mutations to a shared artifact others may be using, and each creates a new dataset version. Preview and confirm before applying.
