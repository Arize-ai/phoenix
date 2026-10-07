---
name: phoenix-evaluator-design
description: >
  Design a Phoenix evaluator — a code check or an LLM judge — before building it, whether it scores
  experiment runs over a dataset (offline) or a project's spans, traces, or sessions as they arrive
  (online). Trigger when the user wants to create an evaluator, improve an existing one's logic or
  rubric, choose its labels or scores, or decide what an evaluator should measure. Do NOT trigger
  on: (1) drafting or iterating on an application prompt, (2) running or comparing experiments when
  no evaluator is being designed, (3) finding failure modes across traces when no evaluator is in
  scope (use `phoenix-error-analysis`).
summary: Plan an evaluator before building it — construct, criteria, type, output schema, calibration cases — then preview and revise against the plan before saving.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
---

# Evaluator Design

An evaluator turns one quality judgment into a label, a score, or both. It is only as good as the
definition behind it. The common failure is writing the check first and deciding what it should
capture afterward: the result is a check that passes trivially, or one that misses the cases that
matter. Plan first, build second, and check the result against the plan before saving it.

This skill is about the judgment, not the tool it is built with. However you build and save
evaluators, the workflow below applies.

## Offline and online

- **Offline**: the evaluator scores experiment runs over a dataset. A run has the task's new
  `output`; an example may also carry a `reference` (an expected or prior output) and `metadata`.
  Offline evaluators decide whether a change helped, so they need to separate good from bad runs
  of the same task.
- **Online**: the evaluator scores a project's spans, traces, or sessions as they arrive, sampled
  and unattended. There is no reference: the evaluator judges the record itself. It runs at volume
  without anyone watching, so cost, latency, and robustness to odd input matter more, and an
  inconclusive record should be marked as such rather than guessed.

An evaluator calibrated on dataset examples that were built from real spans transfers to online
use; one calibrated on hand-written examples may not.

## The plan file

Before writing any code or judge prompt, write the plan below as a markdown checklist file, and
keep it current while you work: tick items off as you settle them, record each calibration case's
observed result after every preview, and note what you changed and why. The plan is the record of
what the evaluator is meant to capture, and the place to check the finished evaluator against. If
you cannot write files, put the same checklist in your reply.

```markdown
# Evaluator plan: <name>

## Construct
- [ ] Measures: <the one quality dimension, in a sentence>
- [ ] Failure mode it targets: <what goes wrong when it fails>
- [ ] In scope / out of scope: <what this evaluator deliberately ignores>
- [ ] Runs: offline (experiment runs) | online (spans | traces | sessions)

## Criteria
- [ ] Success: <observable evidence of a good output>
- [ ] Failure: <observable evidence of a bad output>
- [ ] Partial credit: <what earns it, or "none, binary">
- [ ] Abstention: <how a refusal, "I don't know", or clarifying question is judged>
- [ ] Edge cases: <empty, very long, multilingual, multi-part, tool-only, ...>

## Evaluator
- [ ] Type: code | LLM judge, and why
- [ ] Reads: <only the fields the judgment needs>
- [ ] Output: <labels with scores, or a numeric range>; optimization direction; explanation on/off

## Calibration cases
| Case | Kind | Expected | Observed |
| ---- | ---- | -------- | -------- |
| <short name> | positive | <label/score> | |
| <short name> | negative | <label/score> | |
| <short name> | boundary | <label/score> | |
| <short name> | malformed | <label/score or error> | |

## Results
- [ ] Round 1: <n>/<m> cases match; mismatches: <...>; change: <...>
- [ ] Decision: revise | accept
```

## Workflow

1. **Define the construct and its boundaries.** Name one quality dimension and the failure mode it
   targets. Ground both in the stated purpose, the examples or traces in hand, and outputs already
   produced, rather than in questions to the user. Ask only when the purpose leaves the failure
   mode, the field to judge, or an acceptable tradeoff undecided. Write down what the evaluator
   deliberately ignores: an evaluator that tries to judge everything ends up judging nothing well.
   Before creating one, check whether an existing evaluator already covers the dimension and fits
   the record's shape; reuse it when it does.
2. **Enumerate the criteria.** Write success and failure as evidence you could point to in the
   fields, not as adjectives ("cites a retrieved passage for every claim", not "is grounded").
   Then decide the harder cases explicitly:
   - **Partial credit**: whether a partly right output earns anything, and what separates it from
     a pass and from a fail. Default to binary; add a middle label only when the distinction
     changes a decision.
   - **Abstention**: whether a refusal, "I don't know", or a clarifying question is correct,
     acceptable, or a failure for this construct. Leaving it undecided is the most common source of
     disagreement between a judge and a human.
   - **Not applicable**: records the evaluator cannot judge (the field is missing, the task does
     not apply) are not failures; decide how they are reported.
   - **Edge cases**: empty or whitespace output, very long output, other languages, multi-part
     answers, outputs that are only tool calls.
3. **Choose the evaluator type and output schema.** Use code when the judgment can be computed
   (exact or normalized match, contains, regex, JSON structure, a tool call's name and arguments,
   a distance); use an LLM judge for reading comprehension and open-ended quality. Prefer a
   deterministic floor plus judged dimensions over one judge doing everything. For the output:
   - Categorical labels should be few, mutually exclusive, and cover every case, each with a score
     aligned to the optimization direction. An LLM judge always picks a label; when a numeric scale
     is wanted, give it scored labels (`poor`=0, `fair`=0.5, `good`=1), never a free number.
   - Only a code evaluator returns a free numeric score, and only for a quantity it actually
     computes, with known bounds.
   - Turn on an explanation for judges: it justifies each verdict and exposes rubric ambiguity.
   See [judgment structures](references/judgment-structures.md) for heavier structures and rubric
   writing.
4. **Pick representative calibration cases.** Cover every criterion with at least one case, and
   include each kind: **positive** (should pass), **negative** (should fail, ideally the failure
   mode you named), **boundary** (partial credit, abstention, near misses), and **malformed**
   (empty, wrong type, stringified JSON, missing field, truncated). Shape each case exactly like a
   real record, using real records where you have them. See
   [calibration cases](references/calibration-cases.md).
5. **Build and preview.** Find where the signal lives by inspecting real records (a top-level key,
   a chat `messages` array, assistant content parts, `tool_calls`), not by assumption. Declare only
   the fields the judgment needs; parse nested or stringified JSON in the logic; normalize both
   sides the same way before comparing. Then run the evaluator on every calibration case. One
   preview is not calibration.
6. **Compare against the criteria and revise before saving.** Record each case's observed result
   in the plan. For each mismatch, first check the case is representative, then change one thing
   (the rubric, the logic, the labels, or the case) and preview again, so each change can be
   judged on its own. Accept when every case matches its expected result and the remaining
   tradeoffs are ones the user accepts. Saving is a separate step: an evaluator is not created or
   updated until the save completes, so never report it as saved before then.

## Reference provenance

When an evaluator compares the output against a stored reference, decide what that reference is
before trusting it:

- **golden**: a hand-labeled ideal output; deviation is a defect, and strict comparison is right.
- **baseline snapshot**: an earlier system's output kept for comparison; it anchors "did the
  behavior change" judgments, and losing to it is a signal, not a verdict.
- **none (reference-free)**: judge the output against the input and the rubric alone. Every online
  evaluator is reference-free.

## Things to avoid

- Writing the check before the criteria: the plan comes first.
- Judging several dimensions in one evaluator; split them.
- Reaching for an LLM judge when a deterministic check settles the question.
- Calibrating on positives only; a check that never fails looks perfect until it ships.
- Changing the rubric, logic, labels, and cases in one step; you lose track of what fixed what.
- Editing an existing evaluator without reading its current definition first.
- Reporting an evaluator as saved, or as accurate, before the save or the calibration happened.
