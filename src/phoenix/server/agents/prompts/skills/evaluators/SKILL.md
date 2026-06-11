---
name: evaluators
description: >
  Author or refine a Phoenix evaluator — code or LLM-as-a-judge — that scores a run's output. Trigger when the user wants to create a new evaluator, improve an existing one's logic or rubric, choose labels, or decide what to measure on a dataset or experiment. Do NOT trigger on: (1) manual prompt drafting (use `playground`), (2) running or comparing experiments themselves (use `experiments`), (3) cross-trace failure diagnosis with no evaluator in scope (use `debug-trace`).
summary: Design or refine a code or LLM evaluator — labels, logic or rubric, the field it reads, and representative preview cases.
---

# Evaluators

A Phoenix evaluator scores a run: it reads some subset of the run's `input`, `output`, `reference`,
and `metadata` and returns named annotations — a label, a score, or both. The two artifact kinds —
a **code evaluator** (a Python or TypeScript function) and an **LLM evaluator** (a judge prompt
sent to a model) — share the loop and discipline below; judgment structure follows task need and
environment capability, not artifact kind. The `experiments` skill reads the scores you design
here; the explanations you enable are its evidence channel when comparing runs.

## The Authoring Loop

1. Derive the grading task from the stated purpose — a hypothesis and its evaluator are one design:
   the hypothesis names the failure mode, the evaluator scores it. Evidence comes from the stated
   purpose, the dataset's examples, and existing run outputs, not from interrogating the user.
2. Inventory before creating. Read the dataset's existing evaluators and check input-shape
   compatibility — an evaluator fits when its declared inputs parse the experiment's output
   topology. Reuse or attach on a match; create on a gap. A question is warranted only when
   the stated purpose lacks the failure mode, target output field, or acceptable tradeoff.
3. Decide the labels. Choose a small, mutually exclusive, collectively exhaustive set — often
   binary (`correct`/`incorrect`, `pass`/`fail`). Add labels only to distinguish failure modes that
   matter; every extra label adds boundary ambiguity.
4. Locate the signal in the run's fields — a top-level key, a chat-style `messages` array,
   assistant content parts, `tool_calls`, or a `function_call` — by inspecting the actual shape.
5. Write the judgment: a function that reads the field and returns the label or score, or a judge
   prompt whose rubric names each label and ties the decision to observable evidence in the fields.
   Align scores with the optimization direction and enable an explanation to justify the judgment
   and surface rubric ambiguity.
6. Calibrate against several representative cases covering the named failure modes — one preview is
   not calibration. Shape each payload like a real run. When a case mislabels, change one thing —
   rubric, logic, labels, or case — and fix an unrepresentative case before blaming the logic.
7. Iterate until the representative cases label correctly and the tradeoff is acceptable.
   Persistence is a separate save; do not claim the evaluator is created or updated until that save
   actually completes.

## Reference Provenance

The first fork is **reference-based** versus **reference-free**: does the judgment compare the
output against something stored with the example, or against the input and rubric criteria alone?
When reference-based, triage what the `reference` actually is before trusting it as an answer key:

- **golden** — a hand-labeled ideal output. Deviation is a defect; strict comparison is warranted.
- **baseline-snapshot** — current-state outputs culled into the dataset as a comparison point, not
  ground truth. It anchors did-behavior-change judgments — Pairwise suits it — and losing to it is
  a signal, not a verdict.
- **reference-free** — no stored answer key; judge the output against the input and a rubric.

## Choosing The Judgment Structure

Discover the environment first: read the capability fingerprint of the sandbox the evaluator will
run in — which model credentials its environment variables name, whether it has internet access,
and which packages are installed. Choose by environment capability and task need, not artifact
kind. The ladder, floor to heaviest:

- **deterministic primitives** — exact-match, contains, regex-match, json-distance,
  embedding-distance, levenshtein-distance, scikit-learn metrics, and structural `tool_calls`
  checks. Prefer one whenever the judgment can be computed.
- **single LLM judge** — one rubric, one model, for reading-comprehension or open-ended quality.
- **Composite** — sub-checks (code or LLM) blended into one weighted score; per-axis breakdown in
  the explanation.
- **LLM Jury** — one judgment polled across several models; weighted votes in the explanation.
- **Pairwise** — a blind head-to-head of `output` against `reference`, returning a winner or tie.

A credentialed sandbox with LLM access subsumes the LLM-evaluator artifact: a code evaluator there
can call models, so Composite, LLM Jury, and Pairwise become layered code evaluators recording
steps and votes in explanation or metadata. Design a suite, not a single check: a **deterministic
floor** of primitives plus **judged dimensions** for what the floor cannot settle.

## Matching The Field Topology

- At runtime, `output` is the new run's output; a dataset-backed evaluator receives the example's
  output as `reference` — data the run never saw, provenance triaged above. Don't conflate the two.
- A playground-backed run's `output` always has the fixed LLM-span shape: a `messages` array
  (`role`, `content`, and `tool_calls` with `function.name`/`function.arguments`) plus a top-level
  `available_tools`; shape calibration cases accordingly. A dataset example's output keeps the
  user-defined dataset shape — evidence for where the signal lives, not a guarantee; inspect it
  rather than assuming a top-level key.
- Declare only the fields the judgment needs; the simplest evaluator often reads just `output`.
  Add `reference` for relational checks against the example's expected, golden, or subset data.
- Prefer reading fields directly and parsing nested or stringified JSON in the logic over a custom
  input mapping; in relational checks, normalize `output` and `reference` the same way before
  comparing, or matching values will spuriously diverge.

## Things To Avoid

- Don't edit an existing evaluator without reading its current draft; form a specific hypothesis
  and make the smallest edit that tests it.
- Don't change the rubric, logic, labels, and cases all in one step; you lose attribution.
- Don't reach for a judged structure when a deterministic primitive settles the judgment.
- Don't claim the evaluator is created or updated; persistence is a separate save.
