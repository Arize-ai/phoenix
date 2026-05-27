---
name: playground
description: Author, edit, or iterate on prompts in the Phoenix prompt playground. Load before any playground tool call, including single-shot prompt rewrites.
---

# Prompt Playground

The prompt playground is a tool for authoring and optimizing prompts. It supports two different
ways of working: fast manual prompt iteration without a dataset, and dataset-backed prompt
experimentation with evaluators and experiments. Choose the workflow that matches the user's
current goal and the UI context they have mounted.

## Workflow: Create And Iterate Without A Dataset

Use this workflow when the user wants to draft, rewrite, or manually improve a prompt and no
dataset-backed evaluation loop is in scope.

1. Clarify the task the prompt must perform: input variables, expected output shape, audience,
   constraints, and examples of good or bad behavior when available.
2. If a playground prompt already exists, call `read_prompt_instance` before proposing changes so
   you have the current messages, message IDs, labels, and revision.
3. Draft or revise the prompt so it clearly states the task, required context, output contract, and
   success criteria. Keep the prompt directly tied to the user's stated goal.
4. Use `edit_prompt_instance` for changes to the mounted prompt so the user can review the diff
   before accepting it.
5. Use `clone_prompt_instance` when comparing alternatives would help the user choose between
   prompt variants. Discuss variants by their alphabetic labels, but pass numeric instance IDs to
   tools.
6. Call `run_playground` only when the user asks to run, try, test, or compare the current prompt.
   Treat the output as qualitative feedback rather than dataset-backed evidence.
7. Inspect the output with the user, identify the next concrete improvement, and repeat the edit or
   comparison loop until the prompt is useful for the task.

## Workflow: Iterate Over A Dataset With Evaluators And Experiments

Use this workflow when the user wants evidence that a prompt is improving across a dataset, or when
they are comparing prompt variants using evaluator results.

1. Confirm the dataset represents the task the prompt is meant to solve, including the important
   input fields, expected outputs, and failure modes.
2. Make sure the starting prompt is well formed before running it: it should define the task,
   relevant variables, output format, and any constraints needed for consistent evaluation.
3. Run the playground over the dataset. Each prompt instance run over a dataset is captured as an
   experiment, with outputs and evaluator annotations available for review.
4. Review the experiment outputs and annotations to find recurring failure patterns. Separate model
   randomness from prompt issues when possible.
5. Use or add evaluators when they make issue detection more systematic, especially for failures
   that are hard to spot by manual review alone.
6. Form a specific hypothesis for improving the prompt, then use `edit_prompt_instance` or
   `clone_prompt_instance` to create the next candidate.
7. Rerun the playground and compare experiments. Look for evaluator improvements, fewer repeated
   failure modes, and acceptable tradeoffs in output quality.
8. Save a prompt snapshot only after the evidence shows an improvement or the user explicitly
   accepts the tradeoff.
9. Continue the hypothesis, edit, run, compare loop until the dataset-backed results satisfy the
   user's goal.
