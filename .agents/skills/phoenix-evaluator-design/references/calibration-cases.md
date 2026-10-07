# Calibration cases

Calibration cases show whether the evaluator says what the plan says it should. They are a small,
deliberate set, not a benchmark: enough to exercise every criterion and every label at least once.

## Kinds

| Kind | What it tests | Example for "the answer cites a retrieved passage" |
| ---- | ------------- | -------------------------------------------------- |
| positive | a clear pass is labeled a pass | every claim carries a citation to a passage in the context |
| negative | the targeted failure is caught | a fluent answer with no citations, or a citation to a passage that is not there |
| boundary | the hard calls in the criteria | most claims cited but one is not; "the context doesn't say"; a clarifying question |
| malformed | the evaluator survives odd input | empty output, `null`, stringified JSON, missing `context`, truncated text |

Aim for at least one case per criterion line in the plan, and at least one case of each kind.
Malformed cases are expected to produce the not-applicable outcome, a fail, or a clear error, as
the plan decided; what matters is that the behavior is deliberate.

## Shaping cases

- Shape every case exactly like the records the evaluator will score. Inspect real records first;
  for online evaluators, start from real spans, traces, or sessions.
- Use at least one real record as-is whenever records exist, and note its id in the case's
  `Source` column. Invent only to reach a criterion no real record covers, and keep invented cases
  as plausible as real ones. A set that is all invented shares whatever assumption the logic made
  about the record shape, so it cannot catch that assumption being wrong.
- Keep cases small enough to read at a glance, so a mismatch can be diagnosed by eye.
- Record the expected result before previewing. A case whose expectation is written after seeing
  the output calibrates nothing.

## Reading results

- **Mismatch on a positive or negative**: the logic or rubric is wrong, or the case is not
  representative. Check the case first.
- **Mismatch on a boundary**: the criteria did not decide the case clearly. Tighten the criterion
  in the plan, then the rubric or logic.
- **Crash or nonsense on a malformed case**: harden how the field is read.
- **Every case passes on the first try**: suspect the cases are too easy; add a harder negative or
  boundary case before accepting.

When the user has labeled records themselves, agreement with those labels is the strongest
evidence; record it in the plan's results alongside the calibration cases.
