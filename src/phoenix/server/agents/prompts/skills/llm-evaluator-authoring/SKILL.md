---
name: llm-evaluator-authoring
description: Author or refine a Phoenix LLM-as-a-judge evaluator — design the judge prompt, classification labels, input mapping, and test payload. Load before proposing edits to an LLM-evaluator draft, including single-shot judge rewrites.
---

# LLM-as-a-Judge Evaluator Authoring

A Phoenix LLM evaluator is an LLM-as-a-judge: a judge prompt (a sequence of messages) sent to a
model that returns one or more named classification annotations over a run's `input`, `output`,
`reference`, and `metadata`. Authoring a good evaluator is mostly prompt design plus a clear,
mutually exclusive set of labels — the same iteration loop as a playground prompt, scoped to a
grading task.

Use this skill whenever you are creating a new LLM evaluator or revising an existing one's judge
prompt, labels, input mapping, or test payload. The draft-edit operations and field shapes live in
the `edit_llm_evaluator_draft` tool instructions; this skill is the authoring methodology that
decides *what* to put in those operations.

## Workflow: Create A New LLM Evaluator

Use this when the user wants a new judge for a dataset-backed experiment or for scoring run output.

1. Clarify the grading task: what does "good" mean for this output, what are the failure modes, and
   what evidence in the run distinguishes pass from fail. Ask for one or two concrete examples of a
   correct and an incorrect output when the user can give them.
2. Decide the labels first. LLM evaluators return classification annotations, so choose a small,
   mutually exclusive label set (often two: `correct`/`incorrect`, `pass`/`fail`, `relevant`/
   `irrelevant`). Assign scores that match the optimization direction — higher score for the better
   label when maximizing. Add more labels only when the user needs to distinguish failure modes.
3. Identify which run field carries the signal. For dataset-backed evaluators, `output` is the new
   experiment run output at runtime and the dataset example `output` is passed as `reference`. Treat
   the dataset example shape as evidence for where the signal lives — chat-style `messages` arrays,
   assistant content parts, `tool_calls`/`toolCalls`, or `function_call` — rather than assuming a
   top-level key.
4. Write the judge prompt. A system message states the grader's role and the rubric; a user message
   presents the run fields via template variables (`{{input}}`, `{{output}}`, `{{reference}}`,
   `{{metadata}}`) and asks for the judgment. Make the rubric concrete: name the labels, say what
   each one means, and tie the decision to observable evidence in the fields.
5. Set the test payload to a representative case so the form preview exercises the judge. Shape
   `testPayload.output` from the dataset `output` shape or the user's concrete target case; treat it
   as representative evidence, not a fixed schema.
6. Propose the draft with `edit_llm_evaluator_draft` so the user reviews an accept/reject diff. Emit
   operations only for fields you intend to change.
7. After the user accepts a populated draft, offer to run `test_llm_evaluator_draft` (when it is
   available) before they click Create. Use the preview result to iterate: if the judge mislabels
   the test case, refine the rubric, the labels, or the test payload — not all three at once.
8. Repeat the refine-and-preview loop until the judge labels the representative cases correctly.
   Persistence stays the user's Create action in the form; do not claim the evaluator is saved.

## Workflow: Refine An Existing LLM Evaluator

Use this when an LLM-evaluator form is already mounted (create or edit mode) and the user wants to
improve the judge.

1. Call `read_llm_evaluator_draft` first to capture the current judge prompt, labels, input mapping,
   and `testPayload`. Reason about what the draft does before changing it.
2. Form a specific hypothesis for the change — a vague or under-specified rubric, the wrong field
   read, an ambiguous label set, or a test payload that misses the signal — rather than rewriting
   the whole judge.
3. Make the smallest edit that tests the hypothesis. Whole-list operations replace the judge prompt
   messages, the output configs, or the test payload; scoped operations change a single field. Keep
   the diff small so the user can read it.
4. When preview failures show the test case is missing the signal the judge should score, update the
   test payload to a representative case before concluding the judge prompt is wrong.
5. Re-run `test_llm_evaluator_draft` when available and compare. Keep the change only when the
   representative cases are labeled correctly and the tradeoff is acceptable.

## Designing The Rubric And Labels

- Keep labels mutually exclusive and collectively exhaustive for the task. A judge that cannot map a
  real output to exactly one label will be inconsistent.
- State the rubric in the judge prompt, not just in the label names. "Mark `correct` only when the
  answer matches the reference's key facts; mark `incorrect` otherwise" beats a bare `correct`/
  `incorrect` choice.
- Prefer a binary judgment unless the user needs graded distinctions. More labels means more
  ambiguity at the boundaries and noisier results.
- When the user wants a rationale, enable an explanation alongside the label so the judge justifies
  its choice — useful for spotting rubric ambiguity during iteration.

## Things To Avoid

- Don't propose edits without calling `read_llm_evaluator_draft` first — you will overwrite fields
  blindly and produce a noisy diff.
- Don't assume the signal is at a top-level key. Inspect the dataset example shape and point the
  judge prompt at the field that actually carries the answer.
- Don't change the judge model through `set_judge_prompt`; the model is a separate operation.
- Don't hand-author the judge prompt `tools` or `toolChoice`. They are derived from the labels and
  the explanation setting and regenerated when the edit applies.
- Don't claim the evaluator is created or updated. Persistence is the user's Create/Update action in
  the form.
